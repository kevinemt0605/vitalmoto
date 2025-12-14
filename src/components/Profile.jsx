import React from 'react';
import { auth, storage, db } from '../firebase';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { sendEmailVerification, onAuthStateChanged } from 'firebase/auth';
import showToast from '../utils/toast';

export default function Profile(){
  const [user, setUser] = React.useState(null);
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [vehicles, setVehicles] = React.useState([]);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  // Listen to auth state changes so the profile always reflects the current user (fixes back-navigation bug)
  React.useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async (u)=>{
      setUser(u);
      if(u){
        try{
          const d = await getDoc(doc(db,'users',u.uid));
          setProfile(d.exists()? d.data(): null);
        }catch(e){console.warn('Could not load profile', e)}
        // load vehicles owned by user
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
    if(!auth.currentUser) return alert('Debes iniciar sesión');
    setLoading(true);
    setUploadProgress(0);
    try{
      // compress
      const options = {maxSizeMB:0.2, maxWidthOrHeight:1024, useWebWorker:true};
      const compressedFile = await imageCompression(file, options);
      const storageRef = ref(storage, `profiles/${auth.currentUser.uid}/profile.jpg`);
      const task = uploadBytesResumable(storageRef, compressedFile);
      task.on('state_changed', (snapshot)=>{
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setUploadProgress(pct);
      },
        (err)=>{alert(err.message); setLoading(false); setUploadProgress(0)},
        async ()=>{
          const url = await getDownloadURL(task.snapshot.ref);
          // save to firestore
          await updateDoc(doc(db,'users',auth.currentUser.uid),{photoURL: url});
          alert('Foto de perfil actualizada');
          setLoading(false);
          setUploadProgress(0);
        }
      )
    }catch(err){alert(err.message); setLoading(false); setUploadProgress(0)}
  }

    if(!user) return <div className="card">Debes iniciar sesión</div>

  return (
    <main className="profile-container">
      <section className="user-info">
        {/* Profile photo at top */}
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          {profile && profile.photoURL ? (
            <img src={profile.photoURL} alt="profile" style={{width:120,height:120,objectFit:'cover',borderRadius:8}} />
          ) : (
            <div style={{width:120,height:120,background:'#eee',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>Sin foto</div>
          )}
          <div>
            <h2>Perfil de Usuario</h2>
            <div>
              {!user.emailVerified && <button onClick={resendVerification} className="btn-primario">Reenviar verificación</button>}
            </div>
            <div style={{marginTop:6}}><strong>Fecha de Registro:</strong> <span>{profile?.created_at? new Date(profile.created_at).toLocaleString('es-ES',{day:'2-digit',month:'long',year:'numeric'}): ''}</span></div>
          </div>
        </div>

        <div id="profileInfo" style={{marginTop:14}}>
          <div className="profile-field"><strong>Nombre Completo:</strong> <span id="profileFullname">{profile?.fullname}</span></div>
          <div className="profile-field"><strong>Identificación:</strong> <span id="profileId">{profile?.id_type} - {profile?.id_number}</span></div>
          <div className="profile-field"><strong>Teléfono Local:</strong> <span id="profilePhoneLocal">{profile?.phone_local}</span></div>
          <div className="profile-field"><strong>Teléfono Móvil:</strong> <span id="profilePhoneMobile">{profile?.phone_mobile}</span></div>
          <div className="profile-field"><strong>Correo Electrónico:</strong> <span id="profileEmail">{profile?.email}</span></div>
          <div className="profile-field"><strong>Dirección Habitación:</strong> <span id="profileAddressHome">{profile?.address_home}</span></div>
          <div className="profile-field"><strong>Dirección Oficina:</strong> <span id="profileAddressOffice">{profile?.address_office}</span></div>
          <div className="profile-field"><strong>Banco:</strong> <span id="profileBank">{profile?.bank}</span></div>
          <div className="profile-field"><strong>N° de Cuenta:</strong> <span id="profileAccountNumber">{profile?.account_number}</span></div>
          <div style={{marginTop:12}}>
            <label>Subir foto de perfil (se comprimirá automáticamente)</label>
            <input type="file" accept="image/*" onChange={handleFile} />
            {loading && <p>Subiendo...</p>}
            {uploadProgress > 0 && <div className="progress-bar"><div className="progress-fill" style={{width: `${uploadProgress}%`}}>{uploadProgress}%</div></div>}
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
            <div className="vehicle-card" key={v.id}>
              <div className="vehicle-info">
                <p><strong>Marca:</strong> {v.brand}</p>
                <p><strong>Modelo:</strong> {v.model}</p>
                <p><strong>Placa:</strong> {v.license_plate}</p>
                <p><strong>Año:</strong> {v.year}</p>
              </div>
              <div className="vehicle-images" style={{display:'flex',gap:12,alignItems:'center'}}>
                {v.docURL && <div style={{textAlign:'center'}}>
                  <img src={v.docURL} alt="doc" style={{width:140,height:'auto',borderRadius:6,objectFit:'cover'}} />
                  <div style={{fontSize:12}}>Documento</div>
                </div>}
                {v.bikeURL && <div style={{textAlign:'center'}}>
                  <img src={v.bikeURL} alt="bike" style={{width:180,height:'auto',borderRadius:6,objectFit:'cover'}} />
                  <div style={{fontSize:12}}>Moto</div>
                </div>}
              </div>
              <div className="vehicle-actions">
                <button className="btn-sm edit-vehicle-btn">Editar</button>
                <button className="btn-sm">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="subscription-section" style={{marginTop:16}}>
        <h3>Suscripción</h3>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div>
            <div><strong>Pagó:</strong> {profile?.hasPaid? 'Sí':'No'}</div>
            <div><strong>Último pago:</strong> {profile?.lastPayment? new Date(profile.lastPayment).toLocaleString('es-ES') : 'Nunca'}</div>
          </div>
          <div>
            <button className="btn-primario" disabled style={{opacity:0.6,cursor:'not-allowed'}}>Pagar suscripción (deshabilitado)</button>
          </div>
        </div>
      </section>
    </main>
  )
}
