import React from 'react';
import { auth, storage, db } from '../firebase';
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { doc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { sendEmailVerification, onAuthStateChanged } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import showToast from '../utils/toast';

export default function Profile(){
  const [user, setUser] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [vehicles, setVehicles] = React.useState([]);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  
  const nav = useNavigate();

  // Diccionario para etiquetas de fotos
  const photoLabels = {
    docURL: 'Documentos',
    frontURL: 'Frontal',
    rearURL: 'Trasera',
    leftURL: 'Izq.',
    rightURL: 'Der.',
    tachoURL: 'Tacómetro',
    bikeURL: 'Moto (Gral)'
  };

  React.useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u);
      if(u){
        try{
          const d = await getDoc(doc(db,'users',u.uid));
          setProfile(d.exists()? d.data(): null);
        }catch(e){console.warn('Could not load profile', e)}
        
        try{
          const q = query(collection(db,'vehicles'), where('ownerId','==', u.uid));
          const snap = await getDocs(q);
          const list = [];
          snap.forEach(s=> list.push({id: s.id, ...s.data()}));
          setVehicles(list);
        }catch(e){console.warn('Could not load vehicles', e)}
      }else{
        setProfile(null);
        setVehicles([]);
      }
    });
    return ()=> unsub();
  },[]);

  const resendVerification = async ()=>{
    if(!auth.currentUser) return showToast('Debes iniciar sesión','warn');
    if(auth.currentUser.emailVerified) return showToast('Tu email ya está verificado','info');
    try{
      await sendEmailVerification(auth.currentUser);
      showToast('Correo de verificación enviado','success');
    }catch(err){showToast(err.message || 'Error','error')}
  }

  const handleFile = async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(!auth.currentUser) return showToast('Debes iniciar sesión', 'warn');

    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileName = file.name.toLowerCase();
    if (!validExtensions.some(ext => fileName.endsWith(ext))) {
        return showToast('Formato no válido. Solo JPG, PNG, WEBP.', 'error');
    }
    if (file.size > 10 * 1024 * 1024) return showToast('Imagen muy pesada (>10MB)', 'error');

    setLoading(true);
    setUploadProgress(0);
    try{
      const options = {maxSizeMB:0.2, maxWidthOrHeight:1024, useWebWorker:true};
      const compressedFile = await imageCompression(file, options);
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}/profile.jpg`);
      const task = uploadBytesResumable(storageRef, compressedFile);
      task.on('state_changed', (snapshot)=>{
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(pct);
      },
        (err)=>{ showToast(err.message, 'error'); setLoading(false); },
        async ()=>{
          const url = await getDownloadURL(task.snapshot.ref);
          await updateDoc(doc(db,'users',auth.currentUser.uid),{photoURL: url});
          showToast('Foto actualizada', 'success');
          setLoading(false);
          setUploadProgress(0);
        }
      )
    }catch(err){ showToast(err.message, 'error'); setLoading(false); }
  }

  const handleEditVehicle = (vehicle) => {
    nav('/vehicle', { state: { vehicleData: vehicle } });
  };

  const handleDeleteVehicle = async (vehicle) => {
    if(!window.confirm(`¿Eliminar ${vehicle.brand} ${vehicle.model}?`)) return;
    setLoading(true);
    try {
      const imagesToDelete = [vehicle.docURL, vehicle.frontURL, vehicle.rearURL, vehicle.leftURL, vehicle.rightURL, vehicle.tachoURL, vehicle.bikeURL];
      for(const url of imagesToDelete){
        if(url && url.startsWith('http')) {
             try { await deleteObject(ref(storage, url)); } catch(e){}
        }
      }
      await deleteDoc(doc(db, 'vehicles', vehicle.id));
      setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
      showToast('Vehículo eliminado', 'success');
    } catch (error) {
      console.error(error);
      showToast('Error al eliminar', 'error');
    } finally {
      setLoading(false);
    }
  };

  if(!user) return <div className="card">Debes iniciar sesión</div>

  return (
    <main className="profile-container">
      <section className="user-info">
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          {profile && profile.photoURL ? (
            <img src={profile.photoURL} alt="profile" style={{width:120,height:120,objectFit:'cover',borderRadius:8}} />
          ) : (
            <div style={{width:120,height:120,background:'#eee',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>Sin foto</div>
          )}
          <div>
            <h2>Perfil de Usuario</h2>
            <div>{!user.emailVerified && <button onClick={resendVerification} className="btn-primario">Reenviar verificación</button>}</div>
            <div style={{marginTop:6}}><strong>Registrado:</strong> <span>{profile?.created_at? new Date(profile.created_at).toLocaleDateString(): ''}</span></div>
          </div>
        </div>

        <div id="profileInfo" style={{marginTop:14}}>
          <div className="profile-field"><strong>Nombre:</strong> <span>{profile?.fullname}</span></div>
          <div className="profile-field"><strong>ID:</strong> <span>{profile?.id_type}-{profile?.id_number}</span></div>
          <div className="profile-field"><strong>Email:</strong> <span>{profile?.email}</span></div>
          <div className="profile-field"><strong>Móvil:</strong> <span>{profile?.phone_mobile}</span></div>
          <div className="profile-field"><strong>Local:</strong> <span>{profile?.phone_local || '-'}</span></div>
          <div className="profile-field"><strong>Dirección:</strong> <span>{profile?.address_home}</span></div>
          <div className="profile-field"><strong>Cuenta:</strong> <span>{profile?.bank} - {profile?.account_number}</span></div>
          
          <div style={{marginTop:12}}>
            <label>Actualizar foto perfil:</label>
            <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFile} />
            {loading && <p>Cargando...</p>}
          </div>
        </div>
      </section>

      <section className="vehicles-section">
        <div className="vehicles-header">
          <h2>Mis Vehículos</h2>
          <a href="/vehicle" className="btn-primario">Agregar Vehículo</a>
        </div>
        <div id="vehiclesList" className="vehicles-list">
          {vehicles.length === 0 && <div className="no-vehicles">No tienes vehículos registrados</div>}
          {vehicles.map(v=> (
            // FIX: Añadido overflow:hidden al card para contener hijos
            <div className="vehicle-card" key={v.id} style={{padding:'15px', border:'1px solid #ddd', borderRadius:'8px', background:'#fff', marginBottom:'15px', maxWidth: '100%', overflow: 'hidden'}}>
              
              <div style={{borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'10px'}}>
                <h3 style={{margin:0, color:'#333'}}>{v.brand} {v.model} ({v.year})</h3>
                <span style={{background:'#eef', padding:'2px 8px', borderRadius:'4px', fontSize:'0.85rem', color:'#336699'}}>
                  {v.license_plate}
                </span>
              </div>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'0.9rem', color:'#555', marginBottom:'15px'}}>
                <div><strong>Color:</strong> {v.color}</div>
                <div><strong>Cilindraje:</strong> {v.displacement} cc</div>
                <div><strong>Uso:</strong> {v.motoUse}</div>
                <div><strong>Chasis:</strong> <span style={{fontSize:'0.8rem'}}>{v.chassis_serial}</span></div>
                <div><strong>Motor:</strong> <span style={{fontSize:'0.8rem'}}>{v.engine_serial}</span></div>
              </div>
              
              {v.observations && <p style={{fontSize:'0.9rem', fontStyle:'italic', color:'#777'}}>Obs: {v.observations}</p>}

              {/* FIX: Contenedor de scroll horizontal responsivo */}
              <div style={{
                display:'flex', 
                gap:'10px', 
                overflowX:'auto', 
                paddingBottom:'10px',
                width: '100%',
                WebkitOverflowScrolling: 'touch', // Scroll suave en iOS
                scrollBehavior: 'smooth'
              }}>
                {['docURL', 'frontURL', 'rearURL', 'leftURL', 'rightURL', 'tachoURL'].map(key => (
                  v[key] && (
                    <div key={key} style={{minWidth:'80px', flexShrink: 0, textAlign:'center'}}>
                      <img src={v[key]} alt={photoLabels[key]} style={{width:'80px', height:'60px', objectFit:'cover', borderRadius:'4px', border:'1px solid #ccc'}} />
                      <div style={{fontSize:'0.75rem', marginTop:'2px'}}>{photoLabels[key]}</div>
                    </div>
                  )
                ))}
              </div>

              <div className="vehicle-actions" style={{marginTop:'15px', display:'flex', gap:'10px'}}>
                <button className="btn-sm edit-vehicle-btn" onClick={() => handleEditVehicle(v)}>Editar</button>
                <button className="btn-sm" onClick={() => handleDeleteVehicle(v)} style={{backgroundColor: '#e74c3c'}}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}