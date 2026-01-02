import React from 'react';
import { auth, storage, db } from '../firebase';
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { sendEmailVerification, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import showToast from '../utils/toast';

export default function Profile(){
  // --- ESTADOS PRINCIPALES ---
  const [user, setUser] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [vehicles, setVehicles] = React.useState([]);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  
  // --- ESTADOS DE PAGO ---
  const [tasaBCV, setTasaBCV] = React.useState(0);
  const [showPayModal, setShowPayModal] = React.useState(false);
  const [showBankInfo, setShowBankInfo] = React.useState(false); // Toggle datos bancarios
  const [payForm, setPayForm] = React.useState({
    cedula: '', telefono: '', banco: '0102', 
    fecha: new Date().toISOString().split('T')[0], 
    referencia: '', monto: '' 
  });
  const [formErrors, setFormErrors] = React.useState({}); // Errores de validación

  // --- ESTADOS DE QUEJAS ---
  const [complaint, setComplaint] = React.useState({ subject: 'Pago no conciliado', body: '' });
  const [loadingComplaint, setLoadingComplaint] = React.useState(false);
  
  const nav = useNavigate();

  // --- DATOS CONSTANTES ---
  const VENEZUELA_BANKS = [
    { code: '0001', name: 'Banco Central de Venezuela (BCV)' },
    { code: '0102', name: 'Banco de Venezuela (BDV)' },
    { code: '0104', name: 'Banco Venezolano de Crédito (BVC)' },
    { code: '0105', name: 'Banco Mercantil' },
    { code: '0108', name: 'Banco Provincial (BBVA)' },
    { code: '0114', name: 'Bancaribe' },
    { code: '0115', name: 'Banco Exterior' },
    { code: '0128', name: 'Banco Caroní' },
    { code: '0134', name: 'Banesco Banco Universal' },
    { code: '0137', name: 'Sofitasa' },
    { code: '0138', name: 'Banco Plaza' },
    { code: '0146', name: 'Bangente' },
    { code: '0151', name: 'Banco Fondo Común (BFC)' },
    { code: '0156', name: '100% Banco' },
    { code: '0157', name: 'Del Sur Banco Universal' },
    { code: '0163', name: 'Banco del Tesoro' },
    { code: '0166', name: 'Banco Agrícola de Venezuela' },
    { code: '0168', name: 'Bancrecer' },
    { code: '0169', name: 'Mi Banco, Banco Microfinanciero C.A' },
    { code: '0171', name: 'Banco Activo' },
    { code: '0172', name: 'Bancamiga' },
    { code: '0174', name: 'Banplus' },
    { code: '0175', name: 'Banco Bicentenario del Pueblo' },
    { code: '0177', name: 'Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)' },
    { code: '0191', name: 'Banco Nacional de Crédito (BNC)' }
  ];

  const photoLabels = {
    docURL: 'Documentos', frontURL: 'Frontal', rearURL: 'Trasera',
    leftURL: 'Izq.', rightURL: 'Der.', tachoURL: 'Tacómetro', bikeURL: 'Moto (Gral)'
  };

  const complaintOptions = [
    "Pago no conciliado / Error en pago",
    "Problemas con la Membresía",
    "Error en datos de vehículo",
    "Sugerencia / Otro"
  ];

  // --- EFECTOS ---
  React.useEffect(()=>{
    const fetchTasa = async () => {
      try {
        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
        const data = await res.json();
        const precio = data.promedio || 0;
        if (precio > 0) {
          setTasaBCV(precio);
          // Pre-llenar monto
          setPayForm(prev => ({ ...prev, monto: precio.toFixed(2).replace('.', ',') })); 
        }
      } catch (error) { console.warn('Error tasa BCV:', error); }
    };
    fetchTasa();

    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u);
      if(u){
        try{
          const d = await getDoc(doc(db,'users',u.uid));
          setProfile(d.exists()? d.data(): null);
        }catch(e){}
        
        try{
          const q = query(collection(db,'vehicles'), where('ownerId','==', u.uid));
          const snap = await getDocs(q);
          const list = [];
          snap.forEach(s=> list.push({id: s.id, ...s.data()}));
          setVehicles(list);
        }catch(e){}
      }else{ setProfile(null); setVehicles([]); }
    });
    return ()=> unsub();
  },[]);

  // --- FUNCIONES AUXILIARES ---
  const resendVerification = async ()=>{
    if(!auth.currentUser) return showToast('Debes iniciar sesión','warn');
    if(auth.currentUser.emailVerified) return showToast('Tu email ya está verificado','info');
    try{ await sendEmailVerification(auth.currentUser); showToast('Enviado','success'); }
    catch(err){showToast(err.message,'error')}
  }

  const handleFile = async (e)=>{
    const file = e.target.files[0];
    if(!file || !auth.currentUser) return;
    setLoading(true); setUploadProgress(0);
    try{
      const options = {maxSizeMB:0.2, maxWidthOrHeight:1024, useWebWorker:true};
      const compressedFile = await imageCompression(file, options);
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}/profile.jpg`);
      const task = uploadBytesResumable(storageRef, compressedFile);
      task.on('state_changed', (s)=>{ setUploadProgress(Math.round((s.bytesTransferred/s.totalBytes)*100)); },
        (err)=>{ showToast(err.message, 'error'); setLoading(false); },
        async ()=>{
          const url = await getDownloadURL(task.snapshot.ref);
          await updateDoc(doc(db,'users',auth.currentUser.uid),{photoURL: url});
          showToast('Foto actualizada', 'success'); setLoading(false);
        }
      )
    }catch(err){ showToast(err.message, 'error'); setLoading(false); }
  }

  const handleEditVehicle = (vehicle) => { nav('/vehicle', { state: { vehicleData: vehicle } }); };
  
  const handleDeleteVehicle = async (vehicle) => {
    if(!window.confirm(`¿Eliminar ${vehicle.brand} ${vehicle.model}?`)) return;
    setLoading(true);
    try {
        const imagesToDelete = [vehicle.docURL, vehicle.frontURL, vehicle.rearURL, vehicle.leftURL, vehicle.rightURL, vehicle.tachoURL, vehicle.bikeURL];
        for(const url of imagesToDelete){
          if(url && url.startsWith('http')) { try { await deleteObject(ref(storage, url)); } catch(e){} }
        }
        await deleteDoc(doc(db, 'vehicles', vehicle.id));
        setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
        showToast('Eliminado', 'success');
    } catch(e) { showToast('Error', 'error'); } finally { setLoading(false); }
  };

  // --- VALIDACIÓN Y PAGO ---
  const validatePaymentForm = () => {
    const errors = {};
    const { cedula, telefono, referencia, monto } = payForm;
    const montoFloat = parseFloat(monto.toString().replace(',', '.'));
    
    // 1. Cédula (V12345678)
    if (!/^[VEJG]\d{5,9}$/i.test(cedula.trim())) {
      errors.cedula = true;
      showToast('Formato Cédula inválido (Ej: V12345678)', 'warn');
    }
    // 2. Teléfono (0412...)
    if (!/^\d{11}$/.test(telefono.trim())) {
      errors.telefono = true;
      showToast('Teléfono debe tener 11 dígitos', 'warn');
    }
    // 3. Referencia (mínimo 4 nums)
    if (referencia.length < 4) {
      errors.referencia = true;
    }
    // 4. Monto (Rango Tasa BCV +/- 1)
    if (tasaBCV > 0) {
      const min = tasaBCV - 1;
      const max = tasaBCV + 1;
      if (isNaN(montoFloat) || montoFloat < min || montoFloat > max) {
        errors.monto = true;
        showToast(`El monto debe ser exacto (Entre ${min.toFixed(2)} y ${max.toFixed(2)})`, 'error');
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConciliarBDV = async () => {
    if (!validatePaymentForm()) return;

    setLoading(true);
    try {
      const functionUrl = "https://us-central1-vitalmoto-97b2d.cloudfunctions.net/conciliarPagoBDV";
      const montoLimpio = payForm.monto.toString().replace(',', '.');
      
      const payload = {
        cedulaPagador: payForm.cedula.toUpperCase().trim(),
        telefonoPagador: payForm.telefono.trim(),
        referencia: payForm.referencia.trim(),
        fechaPago: payForm.fecha, 
        importe: parseFloat(montoLimpio).toFixed(2), 
        bancoOrigen: payForm.banco,
        serviceId: 'MEMBRESIA_DIARIA', userId: user.uid
      };
      
      const response = await fetch(functionUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (data.success) {
        showToast('¡Pago verificado correctamente!', 'success'); 
        setShowPayModal(false);
        setProfile(prev => ({...prev, hasPaid: true})); // Actualizar UI
      } else {
        showToast(`Error: ${data.message || 'No se pudo verificar'}`, 'error');
      }
    } catch (error) { console.error(error); showToast('Error de conexión', 'error'); } 
    finally { setLoading(false); }
  };

  // --- ENVÍO DE QUEJAS ---
  const handleReportComplaint = async () => {
    if(!complaint.body.trim()) return showToast('Escribe el detalle de tu situación', 'warn');
    
    setLoadingComplaint(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        userId: user.uid,
        userEmail: user.email,
        userName: profile?.fullname || 'Usuario',
        subject: complaint.subject,
        body: complaint.body,
        status: 'pending', // pending, resolved
        createdAt: new Date()
      });
      showToast('Reporte enviado. Te contactaremos pronto.', 'success');
      setComplaint({ subject: 'Pago no conciliado', body: '' });
    } catch (error) {
      console.error(error);
      showToast('Error al enviar reporte', 'error');
    } finally {
      setLoadingComplaint(false);
    }
  };

  if(!user) return <div className="card">Debes iniciar sesión</div>

  return (
    <main className="profile-container">
      {/* SECCIÓN DATOS USUARIO */}
      <section className="user-info">
        <div style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
          {profile?.photoURL ? 
            <img src={profile.photoURL} alt="profile" style={{width:100, height:100, objectFit:'cover', borderRadius:8}} /> : 
            <div style={{width:100, height:100, background:'#eee', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center'}}>Sin foto</div>
          }
          <div>
            <h2>Perfil de Usuario</h2>
            <div>{!user.emailVerified && <button onClick={resendVerification} className="btn-primario">Verificar Email</button>}</div>
            <small style={{display:'block', marginTop:5}}>Registrado: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : ''}</small>
          </div>
        </div>

        <div id="profileInfo" style={{marginTop:14}}>
          <div className="profile-field"><strong>Nombre:</strong> <span>{profile?.fullname}</span></div>
          <div className="profile-field"><strong>ID:</strong> <span>{profile?.id_type}-{profile?.id_number}</span></div>
          <div className="profile-field"><strong>Email:</strong> <span>{profile?.email}</span></div>
          <div className="profile-field"><strong>Móvil:</strong> <span>{profile?.phone_mobile}</span></div>
          <div className="profile-field"><strong>Local:</strong> <span>{profile?.phone_local || '-'}</span></div>
          <div className="profile-field"><strong>Dirección:</strong> <span>{profile?.address_home}</span></div>
          <div className="profile-field"><strong>Cuenta Bancaria:</strong> <span>{profile?.bank} - {profile?.account_number}</span></div>
          
          <div style={{marginTop:15, marginBottom: 20}}>
            <label style={{fontSize:'0.9rem', fontWeight:'bold'}}>Cambiar foto:</label>
            <input type="file" accept="image/*" onChange={handleFile} style={{marginTop:5}} />
            {loading && !showPayModal && <small>Subiendo...</small>}
          </div>

          {/* TARJETA MEMBRESÍA */}
          <div style={{padding: '15px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bde0fe'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
              <span style={{fontWeight: 'bold', color: '#0056b3'}}>Membresía Diaria</span>
              {tasaBCV > 0 && <span style={{fontSize:'0.75rem', background:'#fff', padding:'2px 6px', borderRadius:'4px', border:'1px solid #ddd'}}>BCV: {tasaBCV}</span>}
            </div>
            
            {profile?.hasPaid ? (
               <div style={{
                  background: '#dcfce7', color: '#166534', padding: '12px', 
                  borderRadius: '6px', textAlign: 'center', border: '1px solid #bbf7d0', fontWeight:'bold'
               }}>
                 ✅ ¡Membresía Activa!
               </div>
            ) : (
               <button className="btn-primario" style={{width: '100%', background: '#27ae60', border: 'none'}} onClick={() => setShowPayModal(true)}>
                  Registrar Pago
               </button>
            )}
          </div>
        </div>
      </section>

      {/* SECCIÓN VEHÍCULOS */}
      <section className="vehicles-section" style={{marginTop: 20}}>
        <div className="vehicles-header">
          <h2>Mis Vehículos</h2>
          <a href="/vehicle" className="btn-primario">Agregar</a>
        </div>
        <div id="vehiclesList" className="vehicles-list">
          {vehicles.length === 0 && <div className="no-vehicles">No tienes vehículos registrados</div>}
          {vehicles.map(v=> (
            <div className="vehicle-card" key={v.id} style={{padding:'15px', border:'1px solid #ddd', borderRadius:'8px', background:'#fff', marginBottom:'15px', maxWidth: '100%', overflow: 'hidden'}}>
              <div style={{borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'10px'}}>
                <h3 style={{margin:0, color:'#333'}}>{v.brand} {v.model} ({v.year})</h3>
                <span style={{background:'#eef', padding:'2px 8px', borderRadius:'4px', fontSize:'0.85rem', color:'#336699'}}>{v.license_plate}</span>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'0.9rem', color:'#555', marginBottom:'15px'}}>
                <div><strong>Color:</strong> {v.color}</div>
                <div><strong>Cilindraje:</strong> {v.displacement} cc</div>
                <div><strong>Uso:</strong> {v.motoUse}</div>
                <div><strong>Chasis:</strong> <span style={{fontSize:'0.8rem'}}>{v.chassis_serial}</span></div>
                <div><strong>Motor:</strong> <span style={{fontSize:'0.8rem'}}>{v.engine_serial}</span></div>
              </div>
              {v.observations && <p style={{fontSize:'0.9rem', fontStyle:'italic', color:'#777'}}>Obs: {v.observations}</p>}
              <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'10px', width: '100%', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth'}}>
                {['docURL', 'frontURL', 'rearURL', 'leftURL', 'rightURL', 'tachoURL'].map(key => v[key] && <img key={key} src={v[key]} alt={key} style={{width:'80px', height:'60px', objectFit:'cover', borderRadius:'4px', border:'1px solid #ccc', marginRight:10}} />)}
              </div>
              <div className="vehicle-actions" style={{marginTop:'15px', display:'flex', gap:'10px'}}>
                <button className="btn-sm edit-vehicle-btn" onClick={() => handleEditVehicle(v)}>Editar</button>
                <button className="btn-sm" onClick={() => handleDeleteVehicle(v)} style={{backgroundColor: '#e74c3c', color:'white', border:'none'}}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- SECCIÓN NUEVA: QUEJAS Y REPORTES --- */}
      <section style={{marginTop: 30, borderTop:'1px solid #eee', paddingTop:20}}>
        <h3 style={{color:'#c0392b'}}>¿Problemas? Reportar Situación</h3>
        <div style={{background:'#fff', padding:15, borderRadius:8, border:'1px solid #ddd'}}>
          <div style={{display:'grid', gap:10}}>
            <label style={{fontSize:'0.9rem', fontWeight:'bold'}}>Asunto:</label>
            <select 
              value={complaint.subject} 
              onChange={e=>setComplaint({...complaint, subject: e.target.value})}
              style={{padding:8, borderRadius:6, border:'1px solid #ccc'}}
            >
              {complaintOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>

            <label style={{fontSize:'0.9rem', fontWeight:'bold'}}>Explicación:</label>
            <textarea 
              rows={3} 
              value={complaint.body} 
              onChange={e=>setComplaint({...complaint, body: e.target.value})}
              placeholder="Describe tu problema con detalle (fecha, monto, error...)"
              style={{padding:10, borderRadius:6, border:'1px solid #ccc', resize:'vertical'}}
            />
            
            <button 
              onClick={handleReportComplaint} 
              disabled={loadingComplaint}
              className="btn-primario" 
              style={{marginTop:5, background:'#e67e22', border:'none'}}
            >
              {loadingComplaint ? 'Enviando...' : 'Enviar Reporte'}
            </button>
          </div>
        </div>
      </section>

      {/* --- MODAL DE PAGO (MEJORADO) --- */}
      {showPayModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '10px'
        }}>
          <div style={{ 
            background: 'white', borderRadius: '12px', width: '100%', maxWidth: '400px', maxHeight: '90vh', 
            overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{padding: '15px 20px', borderBottom: '1px solid #eee', background: '#f8f9fa', position:'sticky', top:0}}>
              <h3 style={{ margin: 0, color: '#2c3e50', fontSize: '1.2rem' }}>Registrar Pago (BDV)</h3>
            </div>
            
            <div style={{padding: '20px'}}>
              {/* DATOS DE PAGO DESPLEGABLES */}
              <button 
                onClick={()=> setShowBankInfo(!showBankInfo)}
                style={{width:'100%', background:'#34495e', color:'white', border:'none', padding:10, borderRadius:6, marginBottom:15, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center'}}
              >
                <span>📲 Ver Datos Pago Móvil</span>
                <span>{showBankInfo ? '▲' : '▼'}</span>
              </button>
              
              {showBankInfo && (
                <div style={{background:'#f2f6fc', padding:12, borderRadius:6, marginBottom:15, border:'1px solid #cce0ff', fontSize:'0.9rem'}}>
                  <p style={{margin:'4px 0'}}><strong>Banco:</strong> Venezuela (0102)</p>
                  <p style={{margin:'4px 0'}}><strong>Teléfono:</strong> 0412-805-6008</p>
                  <p style={{margin:'4px 0'}}><strong>RIF:</strong> J507316181</p>
                  <p style={{margin:'4px 0'}}><strong>Titular:</strong> VITAL MOTO 24 7 CA</p>
                  <div style={{marginTop:8, background:'#fff3cd', color:'#856404', padding:8, borderRadius:4, fontSize:'0.8rem', border:'1px solid #ffeeba'}}>
                    ⚠️ <strong>¡IMPORTANTE!</strong> Paga el monto EXACTO que ves abajo. Si envías más o menos, el sistema rechazará el pago automáticamente.
                  </div>
                </div>
              )}

              <div style={{background: '#e8f8f5', padding: '10px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #2ecc71', textAlign: 'center'}}>
                <p style={{margin:0, fontSize:'0.85rem', color:'#555'}}>Membresía: <strong>$1.00</strong></p>
                <h2 style={{margin:'5px 0', color:'#27ae60', fontSize:'1.8rem'}}>
                  {tasaBCV > 0 ? (1 * tasaBCV).toFixed(2) : '---'} <small style={{fontSize:'1rem'}}>Bs</small>
                </h2>
                <p style={{margin:0, fontSize:'0.7rem', color:'#7f8c8d'}}>Tasa oficial: {tasaBCV || '...'} Bs/$</p>
              </div>

              <div style={{display:'grid', gap:'10px'}}>
                <div>
                  <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Banco Origen</label>
                  <select value={payForm.banco} onChange={e => setPayForm({...payForm, banco: e.target.value})} style={{width:'100%', padding:8, borderRadius:6, border:'1px solid #ddd'}}>
                      {VENEZUELA_BANKS.map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
                  </select>
                </div>

                <div style={{display:'flex', gap:10}}>
                   <div style={{flex:1}}>
                     <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Cédula (V...)</label>
                     <input 
                       type="text" value={payForm.cedula} placeholder="V12345678"
                       onChange={e => {
                         setPayForm({...payForm, cedula: e.target.value});
                         setFormErrors({...formErrors, cedula: false});
                       }} 
                       style={{width:'100%', padding:8, borderRadius:6, border: formErrors.cedula ? '2px solid #e74c3c' : '1px solid #ddd'}}
                     />
                   </div>
                   <div style={{flex:1}}>
                     <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Teléfono (0412...)</label>
                     <input 
                       type="text" value={payForm.telefono} placeholder="0412..."
                       onChange={e => {
                         setPayForm({...payForm, telefono: e.target.value});
                         setFormErrors({...formErrors, telefono: false});
                       }} 
                       style={{width:'100%', padding:8, borderRadius:6, border: formErrors.telefono ? '2px solid #e74c3c' : '1px solid #ddd'}}
                     />
                   </div>
                </div>

                <div>
                  <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Fecha</label>
                  <input type="date" value={payForm.fecha} onChange={e => setPayForm({...payForm, fecha: e.target.value})} style={{width:'100%', padding:8, borderRadius:6, border:'1px solid #ddd'}}/>
                </div>

                <div>
                  <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Referencia</label>
                  <input 
                    type="text" value={payForm.referencia} placeholder="Últimos 6 dígitos"
                    onChange={e => {
                         setPayForm({...payForm, referencia: e.target.value});
                         setFormErrors({...formErrors, referencia: false});
                    }} 
                    style={{width:'100%', padding:8, borderRadius:6, border: formErrors.referencia ? '2px solid #e74c3c' : '1px solid #ddd'}}
                  />
                </div>

                <div>
                  <label style={{fontSize:'0.8rem', fontWeight:'bold'}}>Monto Exacto (Bs)</label>
                  <input 
                    type="text" value={payForm.monto} 
                    onChange={e => {
                         setPayForm({...payForm, monto: e.target.value});
                         setFormErrors({...formErrors, monto: false});
                    }} 
                    style={{width:'100%', padding:8, borderRadius:6, border: formErrors.monto ? '2px solid #e74c3c' : '1px solid #ddd', fontWeight:'bold'}}
                  />
                  {formErrors.monto && <small style={{color:'#e74c3c'}}>El monto debe coincidir con la tasa del día.</small>}
                </div>
              </div>
            </div>

            <div style={{padding: '15px 20px', borderTop: '1px solid #eee', background: '#f8f9fa', display: 'flex', gap: 10}}>
              <button onClick={handleConciliarBDV} disabled={loading} className="btn-primario" style={{flex:1, background: '#27ae60', padding: 10, borderRadius: 6, border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer'}}>
                {loading ? 'Verificando...' : 'Verificar Pago'}
              </button>
              <button onClick={() => setShowPayModal(false)} style={{padding:'10px 15px', background:'#fff', border:'1px solid #ccc', borderRadius:6, cursor:'pointer', color:'#555'}}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}