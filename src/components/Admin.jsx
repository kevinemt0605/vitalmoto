import React from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, getDocs, doc, getDoc, query, where, orderBy, limit, startAfter, getCountFromServer 
} from 'firebase/firestore';
import showToast from '../utils/toast';
import '../admin.css';

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

  // Diccionario etiquetas
  const photoLabels = {
    docURL: 'DOCUMENTOS (LEGAL)',
    frontURL: 'Frontal',
    rearURL: 'Trasera',
    leftURL: 'Lateral Izq.',
    rightURL: 'Lateral Der.',
    tachoURL: 'Tacómetro',
    bikeURL: 'Moto (Antiguo)'
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

  // Render Helpers
  const renderThumbnail = (url, label) => {
    if(!url) return null;
    return (
      <div 
        key={label} 
        style={{textAlign:'center', cursor:'pointer', border:'1px solid #ddd', borderRadius:6, padding:4, background:'#fff'}}
        onClick={() => setEnlargedImage(url)} // Trigger Zoom
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
      <div className="metrics">
        <div className="metric-card"><h3>{metrics.totalUsers}</h3><p>Usuarios</p></div>
        <div className="metric-card"><h3>{metrics.totalVehicles}</h3><p>Vehículos</p></div>
        <div className="metric-card"><h3>{metrics.paidUsers}</h3><p>Pagados</p></div>
        <div className="metric-card"><h3>{metrics.unpaidUsers}</h3><p>Pendientes</p></div>
      </div>

      {/* FILTERS */}
      <section className="vehicles-section" style={{marginTop:12}}>
        <div className="admin-controls" style={{display:'flex',gap:8,marginBottom: 12, flexWrap:'wrap'}}>
          <form onSubmit={(e)=>{e.preventDefault(); loadUsers(true)}} style={{display:'flex', gap:8}}>
            <input className="search-input" placeholder="Buscar email..." value={search} onChange={e=>setSearch(e.target.value)} />
            <button type="submit" className="btn-primario btn-sm">Buscar</button>
          </form>
          <select className="filter-select" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
            <option value="all">Rol: Todos</option>
            <option value="admin">Admin</option>
            <option value="user">Usuario</option>
          </select>
          <select className="filter-select" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}>
            <option value="all">Pago: Todos</option>
            <option value="paid">Pagado</option>
            <option value="unpaid">No pagado</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="admin-table-container">
          <table className="users-table">
            <thead>
              <tr><th>Email</th><th>Nombre</th><th>Rol</th><th>Pagó</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id} className="admin-row" onClick={()=>openUserDetail(u.id)}>
                  <td>{u.email}</td>
                  <td>{u.fullname || '-'}</td>
                  <td><span className={u.role==='admin'?'badge-admin':'badge-user'}>{u.role || 'user'}</span></td>
                  <td>{u.hasPaid? '✅':'❌'}</td>
                  <td>{u.created_at? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* PAGINATION */}
        <div className="pagination" style={{marginTop:12,textAlign:'center'}}>
          <button className="btn-secundario" onClick={() => loadUsers(true)} disabled={pageNumber === 1}>Inicio</button>
          <span style={{margin:'0 10px'}}>Página {pageNumber}</span>
          <button className="btn-secundario" onClick={()=> lastVisible && loadUsers(false, 'next')} disabled={users.length < pageSize}>Siguiente</button>
        </div>
      </section>

      {/* --- MODAL DETALLE USUARIO --- */}
      {selectedUser && (
        <div className="modal-overlay" onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <button className="modal-close" onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }}>✕</button>
            {loadingDetail ? <p>Cargando detalles...</p> : (
              <>
                <h3>Detalle de Usuario</h3>
                <div style={{display:'flex',gap:20, flexWrap:'wrap', borderBottom:'1px solid #eee', paddingBottom:20}}>
                  <div style={{cursor:'pointer'}} onClick={()=> selectedUser.photoURL && setEnlargedImage(selectedUser.photoURL)}>
                    {selectedUser.photoURL ? 
                      <img src={selectedUser.photoURL} alt="user" style={{width:100,height:100,objectFit:'cover',borderRadius:'50%'}} /> : 
                      <div style={{width:100,height:100,background:'#eee',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center'}}>Sin foto</div>
                    }
                  </div>
                  <div style={{flex:1}}>
                     <p><strong>Email:</strong> {selectedUser.email}</p>
                     <p><strong>Nombre:</strong> {selectedUser.fullname}</p>
                     <p><strong>ID:</strong> {selectedUser.id_type}-{selectedUser.id_number}</p>
                     <p><strong>Teléfonos:</strong> {selectedUser.phone_local} / {selectedUser.phone_mobile}</p>
                     <p><strong>Dirección:</strong> {selectedUser.address_home}</p>
                     <p><strong>Banco:</strong> {selectedUser.bank} | <strong>Cta:</strong> {selectedUser.account_number}</p>
                  </div>
                </div>

                <div style={{marginTop:20}}>
                  <h4>Vehículos ({selectedUserVehicles.length})</h4>
                  <div style={{display:'flex', flexDirection:'column', gap:15}}>
                    {selectedUserVehicles.map(v=> (
                      <div key={v.id} style={{border:'1px solid #ccc', borderRadius:8, padding:15, background:'#f9f9f9'}}>
                        
                        {/* Datos Texto del Vehículo */}
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:10, marginBottom:15}}>
                           <div><strong>Vehículo:</strong> {v.brand} {v.model} ({v.year})</div>
                           <div><strong>Placa:</strong> <span style={{color:'blue', fontWeight:'bold'}}>{v.license_plate}</span></div>
                           <div><strong>Color:</strong> {v.color}</div>
                           <div><strong>Cilindraje:</strong> {v.displacement} cc</div>
                           <div><strong>Uso:</strong> {v.motoUse}</div>
                           <div><strong>Serial Chasis:</strong> {v.chassis_serial}</div>
                           <div><strong>Serial Motor:</strong> {v.engine_serial}</div>
                           <div style={{gridColumn:'1 / -1'}}><strong>Observaciones:</strong> {v.observations || 'Ninguna'}</div>
                        </div>

                        {/* Galería de Imágenes del Vehículo */}
                        <div style={{background:'#fff', padding:10, borderRadius:6, border:'1px solid #eee'}}>
                           <p style={{margin:'0 0 10px 0', fontSize:'0.9rem', color:'#777'}}>Galería de imágenes (Click para ampliar)</p>
                           <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
                              {['docURL', 'frontURL', 'rearURL', 'leftURL', 'rightURL', 'tachoURL', 'bikeURL'].map(key => 
                                 renderThumbnail(v[key], photoLabels[key])
                              )}
                           </div>
                        </div>
                      </div>
                    ))}
                    {selectedUserVehicles.length === 0 && <p>No hay vehículos.</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL ZOOM IMAGEN (LIGHTBOX) --- */}
      {enlargedImage && (
        <div 
          style={{
            position:'fixed', top:0, left:0, width:'100%', height:'100%', 
            background:'rgba(0,0,0,0.9)', zIndex:99999, 
            display:'flex', alignItems:'center', justifyContent:'center'
          }}
          onClick={()=> setEnlargedImage(null)}
        >
          <img 
            src={enlargedImage} 
            alt="Zoom" 
            style={{maxWidth:'95%', maxHeight:'95%', objectFit:'contain', borderRadius:4, boxShadow:'0 0 20px rgba(0,0,0,0.5)'}} 
          />
          <button 
            onClick={()=> setEnlargedImage(null)}
            style={{
              position:'absolute', top:20, right:20, 
              background:'white', border:'none', borderRadius:'50%', 
              width:40, height:40, fontSize:20, cursor:'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </main>
  )
}