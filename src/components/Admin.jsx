import React from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, getDocs, doc, getDoc, query, where, orderBy, limit, startAfter, getCountFromServer, updateDoc 
} from 'firebase/firestore';
import showToast from '../utils/toast';

export default function Admin(){
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  
  // --- DATOS Y MÉTRICAS ---
  const [users, setUsers] = React.useState([]);
  const [complaints, setComplaints] = React.useState([]);
  const [metrics, setMetrics] = React.useState({ totalUsers: 0, paidUsers: 0, unpaidUsers: 0, totalVehicles: 0 });
  
  // Inicializamos el gráfico con datos vacíos para evitar el cuadro blanco
  const [earnings, setEarnings] = React.useState({
    dailyBs: 0, dailyUsd: 0,
    monthlyBs: 0, monthlyUsd: 0,
    chartData: [] 
  });

  // --- FILTROS Y PAGINACIÓN ---
  const [lastVisible, setLastVisible] = React.useState(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const pageSize = 10;
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [paymentFilter, setPaymentFilter] = React.useState('all');

  // --- UI STATES ---
  const [activeTab, setActiveTab] = React.useState('users');
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [selectedComplaint, setSelectedComplaint] = React.useState(null);
  const [selectedUserVehicles, setSelectedUserVehicles] = React.useState([]); // ¡Variable necesaria!
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [enlargedImage, setEnlargedImage] = React.useState(null);

  // Diccionario de etiquetas para las fotos
  const photoLabels = {
    docURL: 'Documentos', 
    frontURL: 'Frontal', 
    rearURL: 'Trasera',
    leftURL: 'Lat. Izquierda', 
    rightURL: 'Lat. Derecha', 
    tachoURL: 'Tacómetro', 
    bikeURL: 'Moto (Gral)'
  };

  // 1. CARGA INICIAL
  React.useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      if(!u){ setUser(null); setIsAdmin(false); setLoading(false); return; }
      setUser(u);
      try{
        const profileSnap = await getDoc(doc(db, 'users', u.uid));
        const profile = profileSnap.exists() ? profileSnap.data() : null;
        if(profile && profile.role === 'admin'){
          setIsAdmin(true);
          await loadAllData();
        } else { setIsAdmin(false); }
      } catch(err){ console.error(err); showToast('Error de permisos', 'error'); } 
      finally { setLoading(false); }
    });
    return ()=> unsub();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([loadMetrics(), loadUsers(true), loadComplaints()]);
    setLoading(false);
  };

  // 2. MÉTRICAS (Ganancias + Contadores)
  const loadMetrics = async () => {
    try {
      // A. Contadores
      const usersColl = collection(db, 'users');
      const vehiclesColl = collection(db, 'vehicles');
      const [snapTotal, snapPaid, snapUnpaid, snapVehicles] = await Promise.all([
        getCountFromServer(usersColl),
        getCountFromServer(query(usersColl, where('hasPaid', '==', true))),
        getCountFromServer(query(usersColl, where('hasPaid', '==', false))), 
        getCountFromServer(vehiclesColl)
      ]);
      
      setMetrics({
        totalUsers: snapTotal.data().count,
        paidUsers: snapPaid.data().count,
        unpaidUsers: snapUnpaid.data().count,
        totalVehicles: snapVehicles.data().count
      });

      // B. Ganancias (Pagos Aprobados)
      const qPay = query(collection(db, 'payments'), where('status', '==', 'approved'));
      const snapPay = await getDocs(qPay);
      
      let dayBs = 0, dayCount = 0;
      let monthBs = 0, monthCount = 0;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      // Mapa para últimos 7 días
      const last7DaysMap = {};
      for(let i=6; i>=0; i--){
          const d = new Date(); d.setDate(d.getDate() - i);
          last7DaysMap[d.toISOString().split('T')[0]] = 0;
      }

      snapPay.forEach(doc => {
          const p = doc.data();
          let rawDate = new Date();
          if (p.paymentDate) rawDate = new Date(p.paymentDate);
          else if (p.createdAt && p.createdAt.toDate) rawDate = p.createdAt.toDate();

          const pDateStr = rawDate.toISOString().split('T')[0];
          const amount = parseFloat(p.amount) || 0;

          if(pDateStr === todayStr) {
              dayBs += amount;
              dayCount++;
          }
          if(rawDate.getMonth() === now.getMonth() && rawDate.getFullYear() === now.getFullYear()) {
              monthBs += amount;
              monthCount++;
          }
          if(last7DaysMap[pDateStr] !== undefined) {
              last7DaysMap[pDateStr] += amount;
          }
      });

      const chartDataArray = Object.entries(last7DaysMap).map(([date, val]) => ({ 
          date: date.slice(5), val 
      }));

      setEarnings({
          dailyBs: dayBs, dailyUsd: dayCount, 
          monthlyBs: monthBs, monthlyUsd: monthCount,
          chartData: chartDataArray
      });

    } catch (e) { console.warn(e); }
  };

  // 3. CARGAR USUARIOS
  const loadUsers = async (reset = false, direction = 'next') => {
    try {
      let q = collection(db, 'users');
      let constraints = [];

      if(roleFilter !== 'all') constraints.push(where('role', '==', roleFilter));
      if(paymentFilter !== 'all') constraints.push(where('hasPaid', '==', paymentFilter === 'paid'));

      if(search.trim()) {
        const term = search.trim().toLowerCase(); 
        constraints.push(where('email', '>=', term));
        constraints.push(where('email', '<=', term + '\uf8ff'));
      } else {
        constraints.push(orderBy('created_at', 'desc'));
      }

      constraints.push(limit(pageSize));
      if (!reset && direction === 'next' && lastVisible) constraints.push(startAfter(lastVisible));

      const finalQuery = query(q, ...constraints);
      const documentSnapshots = await getDocs(finalQuery);

      if (documentSnapshots.empty && !reset && direction === 'next') {
        showToast('No hay más resultados', 'info');
        return;
      }

      const list = [];
      documentSnapshots.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setUsers(list);
      setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
      if (reset) setPageNumber(1); else if (direction === 'next') setPageNumber(prev => prev + 1);
      
    } catch (err) { console.error(err); } 
  };

  // 4. CARGAR QUEJAS
  const loadComplaints = async () => {
    try {
        const snap = await getDocs(query(collection(db, 'complaints'), orderBy('createdAt', 'desc')));
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setComplaints(list);
    } catch (e) { console.warn(e); }
  };

  // --- ACCIONES ---
  const openDetail = async (uid, complaintData = null) => {
    setLoadingDetail(true);
    setSelectedUser(null);
    setSelectedUserVehicles([]); // Reiniciar array para evitar error
    setSelectedComplaint(null);

    try{
      const s = await getDoc(doc(db,'users', uid));
      if(s.exists()) setSelectedUser({ id: s.id, ...s.data() });
      
      const q = query(collection(db,'vehicles'), where('ownerId','==', uid));
      const v = await getDocs(q);
      const list = [];
      v.forEach(d=> list.push({id: d.id, ...d.data()}));
      setSelectedUserVehicles(list);

      if(complaintData) setSelectedComplaint(complaintData);

    }catch(e){ showToast('Error cargando detalles','error'); }
    finally { setLoadingDetail(false); }
  };

  const resolveComplaint = async () => {
      if(!selectedComplaint) return;
      if(!window.confirm('¿Marcar queja como resuelta?')) return;
      
      try {
          await updateDoc(doc(db, 'complaints', selectedComplaint.id), { status: 'resolved' });
          showToast('Queja resuelta', 'success');
          setSelectedComplaint(null);
          setSelectedUser(null);
          loadComplaints(); 
      } catch (e) { showToast('Error', 'error'); }
  };

  const renderThumbnail = (url, label) => {
    if(!url) return null;
    return (
      <div 
        key={label} 
        style={{textAlign:'center', cursor:'pointer', border:'1px solid #ddd', borderRadius:6, padding:4, background:'#fff', minWidth: 70}}
        onClick={() => setEnlargedImage(url)} 
        title="Click para ampliar"
      >
        <img src={url} alt={label} style={{width:60, height:60, objectFit:'cover', borderRadius:4}} />
        <div style={{fontSize:10, fontWeight:'bold', marginTop:4, color: label.includes('Documentos') ? '#d32f2f' : '#555'}}>
          {label}
        </div>
      </div>
    );
  };

  if(loading) return <div className="admin-container" style={{textAlign:'center', padding: 40}}>Cargando panel...</div>;
  if(!user || !isAdmin) return <div className="admin-container">Acceso denegado</div>;

  return (
    <main className="admin-container" style={{padding: 20}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
        <h2>Panel de Administración</h2>
        <button onClick={() => { loadUsers(true); loadMetrics(); loadComplaints(); }} className="btn-secundario">↻ Recargar</button>
      </div>

      {/* --- DASHBOARD --- */}
      <section style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:15, marginBottom:20}}>
         <div className="metric-card" style={{background:'#fff', borderLeft:'4px solid #27ae60', padding:15, borderRadius:8, boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
            <h4 style={{margin:0, color:'#7f8c8d', fontSize:'0.9rem'}}>Ganancias HOY</h4>
            <div style={{fontSize:'1.6rem', fontWeight:'bold', color:'#27ae60'}}>{earnings.dailyBs.toFixed(2)} Bs</div>
            <div style={{fontSize:'0.9rem', color:'#555'}}>~ ${earnings.dailyUsd} USD</div>
         </div>
         <div className="metric-card" style={{background:'#fff', borderLeft:'4px solid #2980b9', padding:15, borderRadius:8, boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
            <h4 style={{margin:0, color:'#7f8c8d', fontSize:'0.9rem'}}>Ganancias MES</h4>
            <div style={{fontSize:'1.6rem', fontWeight:'bold', color:'#2980b9'}}>{earnings.monthlyBs.toFixed(2)} Bs</div>
            <div style={{fontSize:'0.9rem', color:'#555'}}>~ ${earnings.monthlyUsd} USD</div>
         </div>

         {/* GRÁFICO */}
         <div style={{gridColumn:'span 2', background:'#fff', padding:15, borderRadius:8, border:'1px solid #ddd', display:'flex', alignItems:'flex-end', height:120, gap:8, boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
            {earnings.chartData.length > 0 ? earnings.chartData.map((d, i) => {
                const max = Math.max(...earnings.chartData.map(o=>o.val)) || 1;
                const h = (d.val / max) * 70; 
                return (
                    <div key={i} style={{flex:1, textAlign:'center', fontSize:'0.7rem', display:'flex', flexDirection:'column', justifyContent:'flex-end', height:'100%'}}>
                        <div style={{marginBottom:5, fontWeight:'bold', color:'#555'}}>{d.val > 0 ? d.val : ''}</div>
                        <div style={{
                            height:`${h}%`, 
                            background: d.val > 0 ? '#3498db' : '#ecf0f1',
                            borderRadius:'4px 4px 0 0', 
                            minHeight: 4, 
                            transition: 'height 0.5s ease'
                        }}></div>
                        <div style={{marginTop:5, color:'#7f8c8d'}}>{d.date}</div>
                    </div>
                )
            }) : <div style={{width:'100%', textAlign:'center', color:'#aaa'}}>Cargando gráfico...</div>}
         </div>
      </section>

      {/* METRICS */}
      <div className="metrics" style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <div className="metric-card" style={{background:'#fff', padding:15, borderRadius:8, border:'1px solid #ddd', minWidth:100, textAlign:'center'}}><h3>{metrics.totalUsers}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#666'}}>Usuarios</p></div>
        <div className="metric-card" style={{background:'#fff', padding:15, borderRadius:8, border:'1px solid #ddd', minWidth:100, textAlign:'center'}}><h3>{metrics.totalVehicles}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#666'}}>Vehículos</p></div>
        <div className="metric-card" style={{background:'#e8f5e9', padding:15, borderRadius:8, border:'1px solid #c8e6c9', minWidth:100, textAlign:'center'}}><h3 style={{color:'#2e7d32'}}>{metrics.paidUsers}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#2e7d32'}}>Pagados</p></div>
        <div className="metric-card" style={{background:'#ffebee', padding:15, borderRadius:8, border:'1px solid #ffcdd2', minWidth:100, textAlign:'center'}}><h3 style={{color:'#c62828'}}>{metrics.unpaidUsers}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#c62828'}}>Pendientes</p></div>
      </div>

      {/* TABS */}
      <div style={{display:'flex', gap:5, marginBottom:15, borderBottom:'1px solid #ddd'}}>
        <button onClick={()=>setActiveTab('users')} style={{padding:'10px 20px', cursor:'pointer', background: activeTab==='users'?'#fff':'#f1f1f1', border:'1px solid #ddd', borderBottom:'none', fontWeight: activeTab==='users'?'bold':'normal', borderRadius:'5px 5px 0 0'}}>
            👥 Usuarios
        </button>
        <button onClick={()=>setActiveTab('complaints')} style={{padding:'10px 20px', cursor:'pointer', background: activeTab==='complaints'?'#fff':'#f1f1f1', border:'1px solid #ddd', borderBottom:'none', fontWeight: activeTab==='complaints'?'bold':'normal', borderRadius:'5px 5px 0 0'}}>
            ⚠️ Quejas ({complaints.filter(c=>c.status==='pending').length})
        </button>
      </div>

      {/* --- TABLA USUARIOS --- */}
      {activeTab === 'users' && (
        <section>
            <div className="admin-controls" style={{display:'flex',gap:8,marginBottom: 12, flexWrap:'wrap'}}>
              <form onSubmit={(e)=>{e.preventDefault(); loadUsers(true)}} style={{display:'flex', gap:8}}>
                <input className="search-input" placeholder="Buscar email..." value={search} onChange={e=>setSearch(e.target.value)} style={{padding:8}} />
                <button type="submit" className="btn-primario btn-sm">Buscar</button>
              </form>
              <select className="filter-select" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{padding:8}}>
                <option value="all">Rol: Todos</option>
                <option value="admin">Admin</option>
                <option value="user">Usuario</option>
              </select>
              <select className="filter-select" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)} style={{padding:8}}>
                <option value="all">Pago: Todos</option>
                <option value="paid">Pagado</option>
                <option value="unpaid">No pagado</option>
              </select>
            </div>

            <div className="admin-table-container" style={{overflowX:'auto', background:'white', borderRadius:8, border:'1px solid #ddd'}}>
              <table className="users-table" style={{width:'100%', borderCollapse:'collapse'}}>
                <thead style={{background:'#f8f9fa'}}>
                    <tr><th style={{padding:10}}>Email</th><th style={{padding:10}}>Nombre</th><th style={{padding:10}}>Rol</th><th style={{padding:10, textAlign:'center'}}>Pago</th><th style={{padding:10}}>Registro</th></tr>
                </thead>
                <tbody>
                    {users.map(u => (
                        <tr key={u.id} className="admin-row" onClick={()=>openDetail(u.id)} style={{borderBottom:'1px solid #eee', cursor:'pointer'}}>
                            <td style={{padding:10}}>{u.email}</td>
                            <td style={{padding:10}}>{u.fullname || '-'}</td>
                            <td style={{padding:10}}><span style={{background: u.role==='admin'?'#e3f2fd':'#eee', padding:'2px 8px', borderRadius:10, fontSize:'0.8rem'}}>{u.role || 'user'}</span></td>
                            <td style={{padding:10, textAlign:'center'}}>{u.hasPaid ? '✅' : '❌'}</td>
                            <td style={{padding:10}}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                        </tr>
                    ))}
                </tbody>
              </table>
            </div>
            
            <div className="pagination" style={{marginTop:12,textAlign:'center', display:'flex', justifyContent:'center', gap:10}}>
              <button className="btn-secundario" onClick={() => loadUsers(true)} disabled={pageNumber === 1}>Inicio</button>
              <span style={{alignSelf:'center'}}>Página {pageNumber}</span>
              <button className="btn-secundario" onClick={()=> lastVisible && loadUsers(false, 'next')} disabled={users.length < pageSize}>Siguiente</button>
            </div>
        </section>
      )}

      {/* --- TABLA QUEJAS --- */}
      {activeTab === 'complaints' && (
        <section>
            <div className="admin-table-container" style={{overflowX:'auto', background:'white', borderRadius:8, border:'1px solid #ddd'}}>
              <table className="users-table" style={{width:'100%', borderCollapse:'collapse'}}>
                <thead style={{background:'#f8f9fa'}}>
                    <tr><th style={{padding:10}}>Asunto</th><th style={{padding:10}}>Usuario</th><th style={{padding:10}}>Estado</th><th style={{padding:10}}>Fecha</th></tr>
                </thead>
                <tbody>
                    {complaints.map(c => (
                        <tr key={c.id} className="admin-row" onClick={()=>openDetail(c.userId, c)} style={{borderBottom:'1px solid #eee', cursor:'pointer', background: c.status==='resolved' ? '#f9f9f9' : '#fff'}}>
                            <td style={{padding:10, fontWeight:'bold', color: c.status==='resolved'?'#7f8c8d':'#c0392b'}}>{c.subject}</td>
                            <td style={{padding:10}}>{c.userEmail}</td>
                            <td style={{padding:10, textAlign:'center'}}>
                                {c.status === 'resolved' 
                                    ? <span style={{background:'#dcfce7', color:'green', padding:'2px 8px', borderRadius:10, fontSize:'0.8rem'}}>Resuelto</span> 
                                    : <span style={{background:'#ffebee', color:'red', padding:'2px 8px', borderRadius:10, fontSize:'0.8rem'}}>Pendiente</span>}
                            </td>
                            <td style={{padding:10}}>{c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : '-'}</td>
                        </tr>
                    ))}
                    {complaints.length === 0 && <tr><td colSpan="4" style={{padding:20, textAlign:'center'}}>No hay quejas registradas.</td></tr>}
                </tbody>
              </table>
            </div>
        </section>
      )}

      {/* --- MODAL DETALLE --- */}
      {selectedUser && (
        <div className="modal-overlay" onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); setSelectedComplaint(null); }} style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, backdropFilter:'blur(2px)', padding:'20px'}}>
          <div className="modal-content" onClick={e=>e.stopPropagation()} style={{background:'white', borderRadius:'12px', width:'100%', maxWidth:'700px', maxHeight:'90vh', overflowY:'auto', display:'flex', flexDirection:'column', boxShadow:'0 10px 30px rgba(0,0,0,0.3)', position:'relative'}}>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding: '15px 20px', borderBottom:'1px solid #eee', position: 'sticky', top: 0, background: 'white', zIndex: 10}}>
                 <h3 style={{margin:0, color:'#333'}}>Detalle de Usuario</h3>
                 <button onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); setSelectedComplaint(null); }} style={{border:'none', background:'#f5f5f5', width:30, height:30, borderRadius:'50%', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>✕</button>
            </div>
            
            <div style={{padding: '20px'}}>
                {/* SI HAY QUEJA */}
                {selectedComplaint && (
                    <div style={{border:'2px solid #e74c3c', background:'#fff5f5', padding:15, borderRadius:8, marginBottom:20}}>
                        <h3 style={{marginTop:0, color:'#c0392b'}}>⚠️ Detalle de la Queja</h3>
                        <p><strong>Asunto:</strong> {selectedComplaint.subject}</p>
                        <div style={{background:'#fff', padding:10, borderRadius:4, border:'1px solid #ecc', whiteSpace:'pre-wrap'}}>{selectedComplaint.body}</div>
                        <div style={{marginTop:10, textAlign:'right'}}>
                            {selectedComplaint.status !== 'resolved' ? (
                                <button onClick={resolveComplaint} className="btn-primario" style={{background:'#27ae60', border:'none', padding:'8px 15px', borderRadius:4, color:'white', cursor:'pointer'}}>✅ Marcar como Resuelto</button>
                            ) : (<span style={{color:'green', fontWeight:'bold'}}>✓ Queja resuelta</span>)}
                        </div>
                    </div>
                )}

                {/* INFO USUARIO */}
                <div style={{display:'flex',gap:20, flexWrap:'wrap', borderBottom:'1px solid #eee', paddingBottom:20}}>
                  <div style={{cursor:'pointer'}} onClick={()=> selectedUser.photoURL && setEnlargedImage(selectedUser.photoURL)}>
                    {selectedUser.photoURL ? 
                      <img src={selectedUser.photoURL} alt="user" style={{width:100,height:100,objectFit:'cover',borderRadius:'50%', border:'3px solid #eee'}} /> : 
                      <div style={{width:100,height:100,background:'#eee',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>Sin foto</div>
                    }
                  </div>
                  <div style={{flex:1}}>
                      <div style={{marginBottom:10, padding:10, background: selectedUser.hasPaid?'#e8f5e9':'#ffebee', borderRadius:6, border: selectedUser.hasPaid?'1px solid #c8e6c9':'1px solid #ffcdd2'}}>
                          {selectedUser.hasPaid 
                            ? <span style={{color:'#2e7d32', fontWeight:'bold'}}>✅ Membresía ACTIVA</span>
                            : <span style={{color:'#c62828', fontWeight:'bold'}}>❌ Membresía PENDIENTE</span>
                          }
                          {selectedUser.lastPaymentDate && <div style={{fontSize:'0.85rem', marginTop:5}}>Pago: {new Date(selectedUser.lastPaymentDate).toLocaleString()} (Ref: {selectedUser.lastPaymentRef})</div>}
                      </div>
                      <div style={{display:'grid', gap:5, fontSize:'0.95rem'}}>
                        <div><strong>Email:</strong> {selectedUser.email}</div>
                        <div><strong>Nombre:</strong> {selectedUser.fullname}</div>
                        <div><strong>ID:</strong> {selectedUser.id_type}-{selectedUser.id_number}</div>
                        <div><strong>Móvil:</strong> {selectedUser.phone_mobile}</div>
                        <div><strong>Banco:</strong> {selectedUser.bank} | {selectedUser.account_number}</div>
                      </div>
                  </div>
                </div>

                <div style={{marginTop:20}}>
                  <h4 style={{margin:'0 0 15px 0', borderLeft:'4px solid #27ae60', paddingLeft:10}}>Vehículos ({selectedUserVehicles.length})</h4>
                  <div style={{display:'flex', flexDirection:'column', gap:15}}>
                    {selectedUserVehicles.map(v=> (
                      <div key={v.id} style={{border:'1px solid #e0e0e0', borderRadius:8, padding:15, background:'#fafafa'}}>
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:10, marginBottom:10, fontSize:'0.9rem'}}>
                           <div><strong>{v.brand} {v.model}</strong> ({v.year})</div>
                           <div>Placa: <span style={{fontWeight:'bold', color:'blue'}}>{v.license_plate}</span></div>
                           <div>Color: {v.color}</div>
                           <div>Seriales: {v.chassis_serial} / {v.engine_serial}</div>
                        </div>
                        <div style={{background:'#fff', padding:5, borderRadius:6, border:'1px solid #eee'}}>
                           {/* AQUI SE MUESTRAN TODAS LAS FOTOS CON SU NOMBRE REAL */}
                           <div style={{display:'flex', gap:5, flexWrap:'wrap'}}>
                              {['docURL', 'frontURL', 'rearURL', 'leftURL', 'rightURL', 'tachoURL', 'bikeURL'].map(key => 
                                 v[key] && renderThumbnail(v[key], photoLabels[key])
                              )}
                           </div>
                        </div>
                      </div>
                    ))}
                    {selectedUserVehicles.length === 0 && <p style={{fontStyle:'italic', color:'#777'}}>Sin vehículos.</p>}
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ZOOM IMAGE --- */}
      {enlargedImage && (
        <div onClick={()=> setEnlargedImage(null)} style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.95)', zIndex:99999, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <img src={enlargedImage} style={{maxWidth:'95%', maxHeight:'95%', objectFit:'contain'}} />
          <button style={{position:'absolute', top:20, right:20, background:'white', border:'none', borderRadius:'50%', width:40, height:40, fontSize:20, cursor:'pointer'}}>✕</button>
        </div>
      )}
    </main>
  )
}