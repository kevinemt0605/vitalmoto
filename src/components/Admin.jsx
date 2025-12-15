import React from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getCountFromServer 
} from 'firebase/firestore';
import showToast from '../utils/toast';
import '../admin.css';

export default function Admin(){
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  
  // Datos de la tabla y métricas
  const [users, setUsers] = React.useState([]);
  const [metrics, setMetrics] = React.useState({
    totalUsers: 0,
    paidUsers: 0,
    unpaidUsers: 0,
    totalVehicles: 0
  });

  // Paginación y Filtros
  const [lastVisible, setLastVisible] = React.useState(null); // Cursor para "Siguiente"
  const [pageNumber, setPageNumber] = React.useState(1);
  const pageSize = 10;

  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [paymentFilter, setPaymentFilter] = React.useState('all');

  // Detalles del usuario seleccionado (Modal)
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [selectedUserVehicles, setSelectedUserVehicles] = React.useState([]);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  // 1. Verificar Rol de Admin
  React.useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      if(!u){
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setUser(u);
      try{
        // Verificar rol en documento de usuario
        const profileSnap = await getDoc(doc(db, 'users', u.uid));
        const profile = profileSnap.exists() ? profileSnap.data() : null;
        
        if(profile && profile.role === 'admin'){
          setIsAdmin(true);
          // Cargar métricas y primera página
          loadMetrics();
          loadUsers(true); // true = reset pagination
        } else {
          setIsAdmin(false);
        }
      } catch(err){
        console.error('Error verificando admin:', err);
        showToast('Error de permisos', 'error');
      } finally {
        setLoading(false);
      }
    });
    return ()=> unsub();
  }, []);

  // 2. Cargar Métricas (Optimizado con getCountFromServer)
  const loadMetrics = async () => {
    try {
      const usersColl = collection(db, 'users');
      const vehiclesColl = collection(db, 'vehicles');

      // Ejecutamos conteos en paralelo
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
    } catch (e) {
      console.warn('Error cargando métricas:', e);
    }
  };

  // 3. Cargar Usuarios (Paginado y Filtrado en Servidor)
  const loadUsers = async (reset = false, direction = 'next') => {
    setLoading(true);
    try {
      let q = collection(db, 'users');
      let constraints = [];

      // --- FILTROS ---
      if(roleFilter !== 'all') {
        constraints.push(where('role', '==', roleFilter));
      }
      
      if(paymentFilter !== 'all') {
        const isPaid = paymentFilter === 'paid';
        constraints.push(where('hasPaid', '==', isPaid));
      }

      // Búsqueda por Email (Prefijo)
      if(search.trim()) {
        const term = search.trim().toLowerCase(); 
        constraints.push(where('email', '>=', term));
        constraints.push(where('email', '<=', term + '\uf8ff'));
      } else {
        // Orden por defecto solo si no estamos buscando
        constraints.push(orderBy('created_at', 'desc'));
      }

      // --- PAGINACIÓN ---
      constraints.push(limit(pageSize));

      if (!reset) {
        if (direction === 'next' && lastVisible) {
          constraints.push(startAfter(lastVisible));
        } 
      }

      // Construir Query final
      const finalQuery = query(q, ...constraints);
      const documentSnapshots = await getDocs(finalQuery);

      if (documentSnapshots.empty && !reset && direction === 'next') {
        showToast('No hay más resultados', 'info');
        setLoading(false);
        return;
      }

      const list = [];
      documentSnapshots.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });

      setUsers(list);

      // Actualizar cursor para la próxima página
      const last = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      setLastVisible(last);

      if (reset) {
        setPageNumber(1);
      } else if (direction === 'next') {
        setPageNumber(prev => prev + 1);
      } 
      
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      if(err.message && err.message.includes('index')){
        showToast('Falta un índice en Firebase. Revisa la consola (F12) y abre el link.', 'warn');
      } else {
        showToast('Error cargando datos', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Manejadores de eventos
  const handleSearch = (e) => {
    e.preventDefault();
    loadUsers(true);
  };

  const handleNextPage = () => {
    if(lastVisible) {
      loadUsers(false, 'next');
    }
  };

  // Resetear filtros recarga todo
  React.useEffect(() => {
    if(isAdmin) loadUsers(true);
  }, [roleFilter, paymentFilter]);

  // Cargar detalles de usuario
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

  if(loading) return <div className="admin-container" style={{textAlign:'center', padding: 40}}>Cargando panel...</div>;
  if(!user || !isAdmin) return <div className="admin-container">No tienes permisos de administrador.</div>;

  return (
    <main className="admin-container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
        <h2>Panel de Administración</h2>
        <button onClick={() => loadUsers(true)} className="btn-secundario" style={{fontSize:'0.9rem'}}>↻ Recargar</button>
      </div>

      <div className="metrics">
        <div className="metric-card">
          <h3>{metrics.totalUsers}</h3>
          <p>Usuarios</p>
        </div>
        <div className="metric-card">
          <h3>{metrics.totalVehicles}</h3>
          <p>Vehículos</p>
        </div>
        <div className="metric-card">
          <h3>{metrics.paidUsers}</h3>
          <p>Pagados</p>
        </div>
        <div className="metric-card">
          <h3>{metrics.unpaidUsers}</h3>
          <p>Pendientes</p>
        </div>
      </div>

      <section className="vehicles-section" style={{marginTop:12}}>
        <div className="admin-controls" style={{display:'flex',gap:8,alignItems:'center', flexWrap:'wrap', marginBottom: 12}}>
          <form onSubmit={handleSearch} style={{display:'flex', gap:8}}>
            <input 
              className="search-input" 
              placeholder="Buscar email exacto..." 
              value={search} 
              onChange={e=>setSearch(e.target.value)} 
            />
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

        <div className="admin-table-container" style={{overflowX:'auto', marginTop:8}}>
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Pagó</th>
                <th>Registrado</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u=> (
                <tr key={u.id} className="admin-row" onClick={()=>openUserDetail(u.id)}>
                  <td>{u.email}</td>
                  <td>{u.fullname || '-'}</td>
                  <td>
                    <span style={{
                      padding:'2px 8px', 
                      borderRadius:'12px', 
                      background: u.role==='admin'?'#d1ecf1':'#eee',
                      color: u.role==='admin'?'#0c5460':'#333',
                      fontSize:'0.85rem'
                    }}>
                      {u.role || 'user'}
                    </span>
                  </td>
                  <td>{u.hasPaid? '✅':'❌'}</td>
                  <td>{u.created_at? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" style={{textAlign:'center', padding: 20}}>No se encontraron usuarios</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination" style={{marginTop:12,display:'flex',gap:8,alignItems:'center', justifyContent:'center'}}>
          <button 
            className="btn-secundario" 
            onClick={() => loadUsers(true)} 
            disabled={pageNumber === 1}
          >
            Inicio
          </button>
          <span>Página {pageNumber}</span>
          <button 
            className="btn-secundario" 
            onClick={handleNextPage}
            disabled={users.length < pageSize} 
          >
            Siguiente
          </button>
        </div>
      </section>

      {/* MODAL DE DETALLE */}
      {selectedUser && (
        <div className="modal-overlay" onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <button className="modal-close" onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }}>✕</button>
            {loadingDetail ? <p>Cargando detalles...</p> : (
              <>
                <h3>Detalle: {selectedUser.email}</h3>
                <div style={{display:'flex',gap:16,alignItems:'flex-start',marginTop:8, flexWrap:'wrap'}}>
                  <div style={{minWidth:120}}>
                    {selectedUser.photoURL ? 
                      <img src={selectedUser.photoURL} alt="user" style={{width:120,height:120,objectFit:'cover',borderRadius:8}} /> : 
                      <div style={{width:120,height:120,background:'#eee',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>Sin foto</div>
                    }
                  </div>
                  <div style={{flex:1}}>
                    <p><strong>Nombre:</strong> {selectedUser.fullname}</p>
                    <p><strong>ID:</strong> {selectedUser.id_type}-{selectedUser.id_number}</p>
                    <p><strong>Teléfonos:</strong> {selectedUser.phone_local} / {selectedUser.phone_mobile}</p>
                    <p><strong>Dirección:</strong> {selectedUser.address_home}</p>
                    <p><strong>Cuenta:</strong> {selectedUser.bank} - {selectedUser.account_number}</p>
                  </div>
                </div>

                <div style={{marginTop:20, borderTop:'1px solid #eee', paddingTop:10}}>
                  <h4>Vehículos ({selectedUserVehicles.length})</h4>
                  <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:8}}>
                    {selectedUserVehicles.map(v=> (
                      <div key={v.id} style={{width:'100%', maxWidth:300, border:'1px solid #e0e0e0',padding:10,borderRadius:8}}>
                        <div style={{display:'flex',gap:8}}>
                          {v.bikeURL ? 
                            <img src={v.bikeURL} alt="bike" style={{width:80,height:60,objectFit:'cover',borderRadius:4}} /> : 
                            <div style={{width:80,height:60,background:'#eee'}}></div>
                          }
                          <div>
                            <p style={{fontWeight:'bold', margin:0}}>{v.brand} {v.model}</p>
                            <p style={{fontSize:'0.9rem', margin:0}}>{v.license_plate}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {selectedUserVehicles.length === 0 && <p style={{color:'#777'}}>Este usuario no tiene vehículos registrados.</p>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}