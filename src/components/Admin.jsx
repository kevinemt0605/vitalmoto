import React from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, getDocs, doc, getDoc, query, where, orderBy, limit, startAfter, getCountFromServer 
} from 'firebase/firestore';
import showToast from '../utils/toast';

export default function Admin(){
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  
  // Datos y métricas
  const [users, setUsers] = React.useState([]);
  const [metrics, setMetrics] = React.useState({ totalUsers: 0, paidUsers: 0, unpaidUsers: 0, totalVehicles: 0 });

  // Paginación y Filtros
  const [lastVisible, setLastVisible] = React.useState(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const pageSize = 10;
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [paymentFilter, setPaymentFilter] = React.useState('all');

  // Detalles y Modales
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [selectedUserVehicles, setSelectedUserVehicles] = React.useState([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  
  // ESTADO PARA ZOOM DE IMAGEN
  const [enlargedImage, setEnlargedImage] = React.useState(null);

  const photoLabels = {
    docURL: 'DOCUMENTOS (LEGAL)', frontURL: 'Frontal', rearURL: 'Trasera',
    leftURL: 'Lateral Izq.', rightURL: 'Lateral Der.', tachoURL: 'Tacómetro', bikeURL: 'Moto (Antiguo)'
  };

  // 1. Verificar Rol
  React.useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      if(!u){ setUser(null); setIsAdmin(false); setLoading(false); return; }
      setUser(u);
      try{
        const profileSnap = await getDoc(doc(db, 'users', u.uid));
        const profile = profileSnap.exists() ? profileSnap.data() : null;
        if(profile && profile.role === 'admin'){
          setIsAdmin(true);
          loadMetrics();
          loadUsers(true);
        } else { setIsAdmin(false); }
      } catch(err){ console.error(err); showToast('Error de permisos', 'error'); } 
      finally { setLoading(false); }
    });
    return ()=> unsub();
  }, []);

  // 2. Métricas
  const loadMetrics = async () => {
    try {
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
    } catch (e) { console.warn(e); }
  };

  // 3. Cargar Usuarios
  const loadUsers = async (reset = false, direction = 'next') => {
    setLoading(true);
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
        setLoading(false);
        return;
      }

      const list = [];
      documentSnapshots.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setUsers(list);
      setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
      if (reset) setPageNumber(1); else if (direction === 'next') setPageNumber(prev => prev + 1);
      
    } catch (err) {
      console.error(err);
      if(err.message && err.message.includes('index')) showToast('Falta índice en Firebase (ver consola)', 'warn');
    } finally { setLoading(false); }
  };

  const openUserDetail = async (uid) => {
    setLoadingDetail(true);
    setSelectedUser(null);
    setSelectedUserVehicles([]);
    try{
      const s = await getDoc(doc(db,'users', uid));
      if(s.exists()) setSelectedUser({ id: s.id, ...s.data() });
      
      const q = query(collection(db,'vehicles'), where('ownerId','==', uid));
      const v = await getDocs(q);
      const list = [];
      v.forEach(d=> list.push({id: d.id, ...d.data()}));
      setSelectedUserVehicles(list);
    }catch(e){ showToast('Error cargando detalles','error'); }
    finally { setLoadingDetail(false); }
  };

  const renderThumbnail = (url, label) => {
    if(!url) return null;
    return (
      <div 
        key={label} 
        style={{textAlign:'center', cursor:'pointer', border:'1px solid #ddd', borderRadius:6, padding:4, background:'#fff'}}
        onClick={() => setEnlargedImage(url)} 
        title="Click para ampliar"
      >
        <img src={url} alt={label} style={{width:80, height:80, objectFit:'cover', borderRadius:4}} />
        <div style={{fontSize:10, fontWeight:'bold', marginTop:4, color: label.includes('LEGAL') ? '#d32f2f' : '#555'}}>
          {label}
        </div>
      </div>
    );
  };

  if(loading) return <div className="admin-container" style={{textAlign:'center', padding: 40}}>Cargando panel...</div>;
  if(!user || !isAdmin) return <div className="admin-container">No tienes permisos.</div>;

  return (
    <main className="admin-container">
      {/* HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
        <h2>Panel de Administración</h2>
        <button onClick={() => loadUsers(true)} className="btn-secundario">↻ Recargar</button>
      </div>

      {/* METRICS */}
      <div className="metrics" style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <div className="metric-card" style={{background:'#fff', padding:15, borderRadius:8, border:'1px solid #ddd', minWidth:100, textAlign:'center'}}><h3>{metrics.totalUsers}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#666'}}>Usuarios</p></div>
        <div className="metric-card" style={{background:'#fff', padding:15, borderRadius:8, border:'1px solid #ddd', minWidth:100, textAlign:'center'}}><h3>{metrics.totalVehicles}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#666'}}>Vehículos</p></div>
        <div className="metric-card" style={{background:'#e8f5e9', padding:15, borderRadius:8, border:'1px solid #c8e6c9', minWidth:100, textAlign:'center'}}><h3 style={{color:'#2e7d32'}}>{metrics.paidUsers}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#2e7d32'}}>Pagados</p></div>
        <div className="metric-card" style={{background:'#ffebee', padding:15, borderRadius:8, border:'1px solid #ffcdd2', minWidth:100, textAlign:'center'}}><h3 style={{color:'#c62828'}}>{metrics.unpaidUsers}</h3><p style={{margin:0, fontSize:'0.9rem', color:'#c62828'}}>Pendientes</p></div>
      </div>

      {/* FILTERS */}
      <section className="vehicles-section" style={{marginTop:12}}>
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

        {/* TABLE */}
        <div className="admin-table-container" style={{overflowX:'auto'}}>
          <table className="users-table" style={{width:'100%', borderCollapse:'collapse'}}>
            <thead style={{background:'#f4f4f4'}}>
              <tr style={{textAlign:'left'}}>
                <th style={{padding:10}}>Email</th>
                <th style={{padding:10}}>Nombre</th>
                <th style={{padding:10}}>Rol</th>
                <th style={{padding:10, textAlign:'center'}}>Pagó</th>
                <th style={{padding:10}}>Registro</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id} className="admin-row" onClick={()=>openUserDetail(u.id)} style={{borderBottom:'1px solid #eee', cursor:'pointer'}}>
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
        
        {/* PAGINATION */}
        <div className="pagination" style={{marginTop:12,textAlign:'center', display:'flex', justifyContent:'center', gap:10}}>
          <button className="btn-secundario" onClick={() => loadUsers(true)} disabled={pageNumber === 1}>Inicio</button>
          <span style={{alignSelf:'center'}}>Página {pageNumber}</span>
          <button className="btn-secundario" onClick={()=> lastVisible && loadUsers(false, 'next')} disabled={users.length < pageSize}>Siguiente</button>
        </div>
      </section>

      {/* --- MODAL DETALLE USUARIO (CORREGIDO) --- */}
      {selectedUser && (
        <div 
          className="modal-overlay" 
          onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }} 
          style={{
            position:'fixed', top:0, left:0, width:'100%', height:'100%', 
            background:'rgba(0,0,0,0.6)', // Fondo un poco más oscuro
            backdropFilter: 'blur(2px)', // Efecto borroso elegante
            display:'flex', alignItems:'center', justifyContent:'center', 
            zIndex: 99999, // Z-INDEX MUY ALTO para tapar el header
            padding: '20px' // Margen seguro para celulares
          }}
        >
          <div 
            className="modal-content" 
            onClick={e=>e.stopPropagation()} 
            style={{
              background:'white', 
              borderRadius:'12px', 
              width:'100%', 
              maxWidth:'700px', 
              maxHeight:'90vh', // Máximo 90% de la altura de la pantalla
              overflowY:'auto', // Scroll interno
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            {/* Header del Modal Sticky */}
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center', 
              padding: '15px 20px', borderBottom:'1px solid #eee', 
              position: 'sticky', top: 0, background: 'white', zIndex: 10
            }}>
                 <h3 style={{margin:0, color:'#333'}}>Detalle de Usuario</h3>
                 <button 
                   onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }} 
                   style={{border:'none', background:'#f5f5f5', width:30, height:30, borderRadius:'50%', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}
                 >
                   ✕
                 </button>
            </div>

            {/* Cuerpo del Modal con Scroll */}
            <div style={{padding: '20px'}}>
              <div style={{display:'flex', gap:20, flexWrap:'wrap', borderBottom:'1px solid #eee', paddingBottom:20}}>
                <div style={{cursor:'pointer', alignSelf: 'flex-start'}} onClick={()=> selectedUser.photoURL && setEnlargedImage(selectedUser.photoURL)}>
                  {selectedUser.photoURL ? 
                    <img src={selectedUser.photoURL} alt="user" style={{width:100,height:100,objectFit:'cover',borderRadius:'50%', border: '3px solid #eee'}} /> : 
                    <div style={{width:100,height:100,background:'#eee',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>Sin foto</div>
                  }
                </div>
                <div style={{flex:1}}>
                    {/* INFO DE PAGO */}
                    <div style={{
                        background: selectedUser.hasPaid ? '#e8f5e9' : '#ffebee', 
                        padding: '12px', borderRadius: '8px', marginBottom: '15px',
                        border: selectedUser.hasPaid ? '1px solid #c8e6c9' : '1px solid #ffcdd2'
                    }}>
                        <p style={{margin:0, display:'flex', alignItems:'center', gap:5}}>
                          <strong>Estado Membresía:</strong> 
                          {selectedUser.hasPaid ? 
                            <span style={{color:'#2e7d32', fontWeight:'bold', background:'#fff', padding:'2px 8px', borderRadius:10, fontSize:'0.85rem', border:'1px solid #a5d6a7'}}>ACTIVA (Pagada)</span> : 
                            <span style={{color:'#c62828', fontWeight:'bold', background:'#fff', padding:'2px 8px', borderRadius:10, fontSize:'0.85rem', border:'1px solid #ef9a9a'}}>PENDIENTE</span>
                          }
                        </p>
                        {selectedUser.lastPaymentDate && (
                            <div style={{marginTop:8, fontSize:'0.9rem', color:'#444'}}>
                              <div style={{display:'flex', gap:10}}>
                                <span>📅 {new Date(selectedUser.lastPaymentDate).toLocaleDateString()}</span>
                                <span>🕒 {new Date(selectedUser.lastPaymentDate).toLocaleTimeString()}</span>
                              </div>
                              {selectedUser.lastPaymentRef && <div style={{marginTop:2}}>💳 Ref: <strong>{selectedUser.lastPaymentRef}</strong></div>}
                            </div>
                        )}
                    </div>

                    <div style={{display:'grid', gap:5}}>
                      <p style={{margin:0}}><strong>Email:</strong> {selectedUser.email}</p>
                      <p style={{margin:0}}><strong>Nombre:</strong> {selectedUser.fullname}</p>
                      <p style={{margin:0}}><strong>ID:</strong> {selectedUser.id_type}-{selectedUser.id_number}</p>
                      <p style={{margin:0}}><strong>Teléfonos:</strong> {selectedUser.phone_local || '-'} / {selectedUser.phone_mobile}</p>
                      <p style={{margin:0}}><strong>Dirección:</strong> {selectedUser.address_home}</p>
                      <p style={{margin:0}}><strong>Banco:</strong> {selectedUser.bank} | <strong>Cta:</strong> {selectedUser.account_number}</p>
                    </div>
                </div>
              </div>

              <div style={{marginTop:20}}>
                <h4 style={{margin:'0 0 15px 0', borderLeft:'4px solid #27ae60', paddingLeft:10}}>Vehículos Registrados ({selectedUserVehicles.length})</h4>
                <div style={{display:'flex', flexDirection:'column', gap:15}}>
                  {selectedUserVehicles.map(v=> (
                    <div key={v.id} style={{border:'1px solid #e0e0e0', borderRadius:8, padding:15, background:'#fafafa'}}>
                      
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:10, marginBottom:15, fontSize:'0.95rem'}}>
                         <div><strong>Vehículo:</strong> {v.brand} {v.model} ({v.year})</div>
                         <div><strong>Placa:</strong> <span style={{background:'#e3f2fd', color:'#1565c0', padding:'2px 6px', borderRadius:4, fontWeight:'bold'}}>{v.license_plate}</span></div>
                         <div><strong>Color:</strong> {v.color}</div>
                         <div><strong>Cilindraje:</strong> {v.displacement} cc</div>
                         <div><strong>Uso:</strong> {v.motoUse}</div>
                         <div><strong>Serial Chasis:</strong> <span style={{fontSize:'0.85rem', fontFamily:'monospace'}}>{v.chassis_serial}</span></div>
                         <div><strong>Serial Motor:</strong> <span style={{fontSize:'0.85rem', fontFamily:'monospace'}}>{v.engine_serial}</span></div>
                         <div style={{gridColumn:'1 / -1', fontStyle:'italic', color:'#666'}}><strong>Obs:</strong> {v.observations || 'Ninguna'}</div>
                      </div>

                      <div style={{background:'#fff', padding:10, borderRadius:6, border:'1px solid #eee'}}>
                         <p style={{margin:'0 0 10px 0', fontSize:'0.85rem', color:'#888', textTransform:'uppercase', letterSpacing:0.5}}>Evidencia Fotográfica</p>
                         <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                            {['docURL', 'frontURL', 'rearURL', 'leftURL', 'rightURL', 'tachoURL', 'bikeURL'].map(key => 
                                renderThumbnail(v[key], photoLabels[key])
                            )}
                         </div>
                      </div>
                    </div>
                  ))}
                  {selectedUserVehicles.length === 0 && <p style={{fontStyle:'italic', color:'#777'}}>Este usuario no tiene vehículos registrados.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ZOOM IMAGEN (Z-INDEX MÁXIMO) --- */}
      {enlargedImage && (
        <div 
          style={{
            position:'fixed', top:0, left:0, width:'100%', height:'100%', 
            background:'rgba(0,0,0,0.95)', zIndex:999999, // Superpuesto a todo
            display:'flex', alignItems:'center', justifyContent:'center'
          }}
          onClick={()=> setEnlargedImage(null)}
        >
          <img 
            src={enlargedImage} 
            alt="Zoom" 
            style={{maxWidth:'95%', maxHeight:'95%', objectFit:'contain', borderRadius:4, boxShadow:'0 0 30px rgba(0,0,0,0.8)'}} 
          />
          <button 
            onClick={()=> setEnlargedImage(null)}
            style={{
              position:'absolute', top:20, right:20, 
              background:'white', border:'none', borderRadius:'50%', 
              width:40, height:40, fontSize:20, cursor:'pointer', fontWeight:'bold'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </main>
  )
}