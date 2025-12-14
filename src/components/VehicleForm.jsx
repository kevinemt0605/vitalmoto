import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, storage, db, firebaseConfig, default as firebaseApp } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, getStorage as getStorageSDK } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { isLicensePlateValid, isDisplacementValid, isYearValid } from '../utils/validators';
import showToast from '../utils/toast';

export default function VehicleForm(){
  const [form, setForm] = React.useState({
    brand: '',
    model: '',
    color: '',
    license_plate: '',
    displacement: '',
    year: '',
    chassis_serial: '',
    engine_serial: '',
    observations: ''
  });
  const [docFile, setDocFile] = React.useState(null);
  const [bikeFile, setBikeFile] = React.useState(null);
  const [docPreview, setDocPreview] = React.useState(null);
  const [bikePreview, setBikePreview] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [docProgress, setDocProgress] = React.useState(0);
  const [bikeProgress, setBikeProgress] = React.useState(0);
  const navigate = useNavigate();

  const onChange = e => setForm({...form,[e.target.name]: e.target.value});

  const uploadImage = async (file, path, setProgress) => {
    const options = {maxSizeMB:0.5, maxWidthOrHeight:1600, useWebWorker:true};
    const compressed = await imageCompression(file, options);
    const storageRef = ref(storage, path);
    console.log('Uploading image, user:', auth.currentUser && auth.currentUser.uid, 'to bucket:', firebaseConfig.storageBucket, 'path:', path);
    const task = uploadBytesResumable(storageRef, compressed);
    return new Promise((resolve,reject)=>{
      task.on('state_changed', (snapshot)=>{
        if(setProgress && snapshot && snapshot.totalBytes){
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          try{ setProgress(pct); }catch(e){}
        }
      }, async (err)=>{
        console.error('Upload error', err);
        // If unauthorized, try a fallback storage instance using gs://<projectId>.appspot.com
        if(err && err.code && err.code.includes('storage/unauthorized')){
          try{
            const fallbackBucket = `gs://${firebaseConfig.projectId}.appspot.com`;
            console.warn('Attempting fallback upload to', fallbackBucket);
            const fallbackStorage = getStorageSDK(firebaseApp, fallbackBucket);
            const fallbackRef = ref(fallbackStorage, path);
            const fallbackTask = uploadBytesResumable(fallbackRef, compressed);
            fallbackTask.on('state_changed', (snapshot)=>{
              if(setProgress && snapshot && snapshot.totalBytes){
                const pct2 = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                try{ setProgress(pct2); }catch(e){}
              }
            }, (err2)=>{
              console.error('Fallback upload error', err2);
              reject(new Error(`${err2.code || 'error'}: ${err2.message || err2}`));
            }, async ()=>{
              const url2 = await getDownloadURL(fallbackTask.snapshot.ref);
              resolve(url2);
            });
            return;
          }catch(fe){
            console.error('Fallback failed', fe);
            // fall through to reject original
          }
        }
        // Provide clearer message for auth/permission issues
        if(err && err.code){
          reject(new Error(`${err.code}: ${err.message}`));
        }else{
          reject(err);
        }
      }, async ()=>{
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      })
    })
  }

  const submit = async (e)=>{
    e.preventDefault();
  if(!auth.currentUser){ showToast('Debes iniciar sesión','warn'); return }
  if(!docFile || !bikeFile){ showToast('Sube ambas imágenes (documentos y moto)','warn'); return }
    setLoading(true);
    try{
      // basic validations
      if(!isLicensePlateValid(form.license_plate)) throw new Error('Placa inválida');
      if(!isDisplacementValid(form.displacement)) throw new Error('Cilindraje inválido');
      if(!isYearValid(form.year)) throw new Error('Año inválido');

      // uniqueness checks for license_plate, chassis_serial, engine_serial
      const qPlate = query(collection(db,'vehicles'), where('license_plate','==', form.license_plate));
      const snapPlate = await getDocs(qPlate);
      if(!snapPlate.empty) throw new Error('Ya existe un vehículo con esa placa');
      const qCh = query(collection(db,'vehicles'), where('chassis_serial','==', form.chassis_serial));
      const snapCh = await getDocs(qCh);
      if(!snapCh.empty) throw new Error('Ya existe un vehículo con ese serial de chasis');
      const qEn = query(collection(db,'vehicles'), where('engine_serial','==', form.engine_serial));
      const snapEn = await getDocs(qEn);
      if(!snapEn.empty) throw new Error('Ya existe un vehículo con ese serial de motor');
      const docPath = `vehicles/${auth.currentUser.uid}/${Date.now()}_doc.jpg`;
      const bikePath = `vehicles/${auth.currentUser.uid}/${Date.now()}_bike.jpg`;
  const docURL = await uploadImage(docFile, docPath, setDocProgress);
  const bikeURL = await uploadImage(bikeFile, bikePath, setBikeProgress);
      const vehicleRef = await addDoc(collection(db,'vehicles'),{
        ownerId: auth.currentUser.uid,
        brand: form.brand,
        model: form.model,
        color: form.color,
        license_plate: form.license_plate,
        displacement: Number(form.displacement) || null,
        year: Number(form.year) || null,
        chassis_serial: form.chassis_serial,
        engine_serial: form.engine_serial,
        observations: form.observations || null,
        docURL,
        bikeURL,
        createdAt: new Date().toISOString()
      });
  showToast('Vehículo registrado','success');
      // navigate to profile when done
      navigate('/profile');
    }catch(err){alert(err.message)}
    finally{setLoading(false)}
  }

  // previews for selected files
  React.useEffect(()=>{
    if(docFile){
      const url = URL.createObjectURL(docFile);
      setDocPreview(url);
      return ()=> URL.revokeObjectURL(url);
    }else setDocPreview(null);
  },[docFile]);
  React.useEffect(()=>{
    if(bikeFile){
      const url = URL.createObjectURL(bikeFile);
      setBikePreview(url);
      return ()=> URL.revokeObjectURL(url);
    }else setBikePreview(null);
  },[bikeFile]);

  return (
    <div id="vehicleFormContainer">
      <form id="vehicleForm" onSubmit={submit}>
        <h3 id="vehicleFormTitle">Registrar vehículo</h3>
        <label>Marca:
          <input name="brand" placeholder="Marca" value={form.brand} onChange={onChange} required />
        </label>
        <label>Modelo:
          <input name="model" placeholder="Modelo" value={form.model} onChange={onChange} required />
        </label>
        <label>Color:
          <input name="color" placeholder="Color" value={form.color} onChange={onChange} required />
        </label>
        <label>Placa:
          <input name="license_plate" placeholder="Placa" value={form.license_plate} onChange={onChange} required />
        </label>
        <label>Cilindraje (cc):
          <input name="displacement" placeholder="Cilindraje (cc)" value={form.displacement} onChange={onChange} required />
        </label>
        <label>Año:
          <input name="year" placeholder="Año" value={form.year} onChange={onChange} required />
        </label>
        <label>Serial de chasis:
          <input name="chassis_serial" placeholder="Serial de chasis" value={form.chassis_serial} onChange={onChange} required />
        </label>
        <label>Serial de motor:
          <input name="engine_serial" placeholder="Serial de motor" value={form.engine_serial} onChange={onChange} required />
        </label>
        <label>Observaciones:
          <textarea name="observations" placeholder="Observaciones (opcional)" value={form.observations} onChange={onChange} />
        </label>

        <div>
          <label>Foto de documentos (subir)</label>
          <input type="file" accept="image/*" onChange={e=>setDocFile(e.target.files[0])} required />
          {docPreview && <img src={docPreview} alt="doc preview" style={{maxWidth:180,marginTop:8,borderRadius:6,display:'block'}} />}
          {docProgress > 0 && <div className="progress-bar"><div className="progress-fill" style={{width: `${docProgress}%`}}>{docProgress}%</div></div>}
        </div>

        <div>
          <label>Foto de la moto</label>
          <input type="file" accept="image/*" onChange={e=>setBikeFile(e.target.files[0])} required />
          {bikePreview && <img src={bikePreview} alt="bike preview" style={{maxWidth:220,marginTop:8,borderRadius:6,display:'block'}} />}
          {bikeProgress > 0 && <div className="progress-bar"><div className="progress-fill" style={{width: `${bikeProgress}%`}}>{bikeProgress}%</div></div>}
        </div>

        <button type="submit" disabled={loading}>{loading? 'Subiendo...':'Registrar vehículo'}</button>
      </form>
    </div>
  )
}
