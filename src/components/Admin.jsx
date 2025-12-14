import React from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where, orderBy, limit, startAfter } from 'firebase/firestore';
import showToast from '../utils/toast';
import '../admin.css';

export default function Admin(){
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState([]);
  const [filtered, setFiltered] = React.useState([]);
  const [vehiclesCount, setVehiclesCount] = React.useState(0);

  // paging/search/filter state
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [paymentFilter, setPaymentFilter] = React.useState('all');
  const [pageSize] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);

  // selected user detail
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [selectedUserVehicles, setSelectedUserVehicles] = React.useState([]);

  React.useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u);
      setLoading(true);
      if(!u){
        setIsAdmin(false);
        setUsers([]);
        setFiltered([]);
        setVehiclesCount(0);
        setLoading(false);
        return;
      }
      try{
        const profileSnap = await getDoc(doc(db,'users', u.uid));
        const profile = profileSnap.exists()? profileSnap.data() : null;
        if(profile && profile.role === 'admin'){
          setIsAdmin(true);
          // load all users (small admin panel - if DB large, switch to server-side pagination)
          const q = await getDocs(collection(db,'users'));
          const list = [];
          q.forEach(s=> list.push({ id: s.id, ...s.data() }));
          setUsers(list.sort((a,b)=> (a.email||'').localeCompare(b.email||'')));
          setFiltered(list);
          // vehicles count
          try{
            const v = await getDocs(collection(db,'vehicles'));
            setVehiclesCount(v.size);
          }catch(e){ console.warn('Could not load vehicles count', e); setVehiclesCount(0) }
        }else{
          setIsAdmin(false);
          setUsers([]);
          setFiltered([]);
          setVehiclesCount(0);
        }
      }catch(err){
        console.error('Admin load error', err);
        showToast('Error cargando panel admin','error');
        setIsAdmin(false);
      }finally{ setLoading(false) }
    });
    return ()=> unsub();
  },[]);

  // apply search/filters client-side
  React.useEffect(()=>{
    let list = [...users];
    if(search && search.trim()){
      const s = search.trim().toLowerCase();
      list = list.filter(u => (u.email||'').toLowerCase().includes(s) || (u.fullname||'').toLowerCase().includes(s) || (u.id_number||'').toLowerCase().includes(s));
    }
    if(roleFilter !== 'all'){
      list = list.filter(u => (u.role||'user') === roleFilter);
    }
    if(paymentFilter !== 'all'){
      list = list.filter(u => (paymentFilter === 'paid') ? !!u.hasPaid : !u.hasPaid);
    }
    setFiltered(list);
    setCurrentPage(1);
  },[search, roleFilter, paymentFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((currentPage-1)*pageSize, currentPage*pageSize);

  const loadUserDetail = async (uid)=>{
    setSelectedUser(null);
    setSelectedUserVehicles([]);
    try{
      const s = await getDoc(doc(db,'users', uid));
      if(s.exists()) setSelectedUser({ id: s.id, ...s.data() });
      // load vehicles
      const q = query(collection(db,'vehicles'), where('ownerId','==', uid));
      const v = await getDocs(q);
      const list = [];
      v.forEach(d=> list.push({id: d.id, ...d.data()}));
      setSelectedUserVehicles(list);
    }catch(e){ showToast('Error cargando detalle de usuario','error'); }
  }

  if(loading) return <div className="card">Cargando...</div>;
  if(!user) return <div className="card">Acceso denegado. Debes iniciar sesión como administrador.</div>;
  if(!isAdmin) return <div className="card">No tienes permisos para ver este panel.</div>;

  return (
    <main className="admin-container">
      <h2>Panel de Administración</h2>
      <div className="metrics">
        <div className="metric-card">
          <h3 id="totalUsers">{users.length}</h3>
          <p>Usuarios Registrados</p>
        </div>
        <div className="metric-card">
          <h3 id="totalVehicles">{vehiclesCount}</h3>
          <p>Vehículos Registrados</p>
        </div>
        <div className="metric-card">
          <h3 id="paidUsers">{users.filter(u => !!u.hasPaid).length}</h3>
          <p>Usuarios que han pagado</p>
        </div>
        <div className="metric-card">
          <h3 id="unpaidUsers">{users.filter(u => !u.hasPaid).length}</h3>
          <p>Usuarios sin pagar</p>
        </div>
      </div>

      <section className="vehicles-section" style={{marginTop:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
          <h3>Listado de Usuarios</h3>
          <div className="admin-controls" style={{display:'flex',gap:8,alignItems:'center'}}>
            <input className="search-input" placeholder="Buscar por email, nombre o ID" value={search} onChange={e=>setSearch(e.target.value)} />
            <select className="filter-select" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
              <option value="all">Todos los roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
            <select className="filter-select" value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="paid">Pagados</option>
              <option value="unpaid">No pagados</option>
            </select>
          </div>
        </div>

        <div className="admin-table-container" style={{overflowX:'auto', marginTop:8}}>
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Pagó</th>
                <th>Último pago</th>
                <th>Registrado</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(u=> (
                <tr key={u.id} className="admin-row" onClick={()=>loadUserDetail(u.id)}>
                  <td>{u.email}</td>
                  <td>{u.fullname || '-'}</td>
                  <td>{u.role || 'user'}</td>
                  <td>{u.hasPaid? 'Sí':'No'}</td>
                  <td>{u.lastPayment? new Date(u.lastPayment).toLocaleString('es-ES') : 'Nunca'}</td>
                  <td>{u.created_at? new Date(u.created_at).toLocaleString('es-ES') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination" style={{marginTop:12,display:'flex',gap:8,alignItems:'center'}}>
          <button className="btn-secundario" disabled={currentPage<=1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))}>Anterior</button>
          <div>Página {currentPage} / {totalPages}</div>
          <button className="btn-secundario" disabled={currentPage>=totalPages} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))}>Siguiente</button>
        </div>
      </section>

      {selectedUser && (
        <div className="modal-overlay" onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <button className="modal-close" onClick={()=>{ setSelectedUser(null); setSelectedUserVehicles([]); }}>✕</button>
            <h3>Detalle: {selectedUser.email}</h3>
            <div style={{display:'flex',gap:16,alignItems:'flex-start',marginTop:8}}>
              <div style={{minWidth:160}}>
                {selectedUser.photoURL ? <img src={selectedUser.photoURL} alt="user" style={{width:160,height:160,objectFit:'cover',borderRadius:8}} /> : <div style={{width:160,height:160,background:'#eee',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>Sin foto</div>}
              </div>
              <div style={{flex:1}}>
                <p><strong>Nombre:</strong> {selectedUser.fullname}</p>
                <p><strong>Identificación:</strong> {selectedUser.id_type} - {selectedUser.id_number}</p>
                <p><strong>Teléfonos:</strong> {selectedUser.phone_local} / {selectedUser.phone_mobile}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Dirección Habitación:</strong> {selectedUser.address_home}</p>
                <p><strong>Banco / Cuenta:</strong> {selectedUser.bank} / {selectedUser.account_number}</p>
                <p><strong>Pagó:</strong> {selectedUser.hasPaid? 'Sí':'No'}</p>
                <p><strong>Último pago:</strong> {selectedUser.lastPayment? new Date(selectedUser.lastPayment).toLocaleString('es-ES') : 'Nunca'}</p>
              </div>
            </div>

            <div style={{marginTop:12}}>
              <h4>Vehículos del usuario</h4>
              {selectedUserVehicles.length === 0 && <div>No tiene vehículos registrados</div>}
              <div style={{display:'flex',flexWrap:'wrap',gap:12,marginTop:8}}>
                {selectedUserVehicles.map(v=> (
                  <div key={v.id} style={{width:300,border:'1px solid #e0e0e0',padding:8,borderRadius:8}}>
                    <div style={{display:'flex',gap:8}}>
                      {v.docURL && <img src={v.docURL} alt="doc" style={{width:120,height:120,objectFit:'cover',borderRadius:6}} />}
                      {v.bikeURL && <img src={v.bikeURL} alt="bike" style={{width:160,height:120,objectFit:'cover',borderRadius:6}} />}
                    </div>
                    <p style={{marginTop:8}}><strong>{v.brand} {v.model}</strong></p>
                    <p>Placa: {v.license_plate}</p>
                    <p>Año: {v.year} - Cil: {v.displacement}</p>
                    <p style={{fontSize:12,color:'#666'}}>{v.observations}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
