import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, storage, db, firebaseConfig, default as firebaseApp } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, getStorage as getStorageSDK } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
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
  
  // Estado para manejo de edición
  const location = useLocation();
  const { vehicleData } = location.state || {};
  const [editingId, setEditingId] = React.useState(null);

  const [docFile, setDocFile] = React.useState(null);
  const [bikeFile, setBikeFile] = React.useState(null);
  const [docPreview, setDocPreview] = React.useState(null);
  const [bikePreview, setBikePreview] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [docProgress, setDocProgress] = React.useState(0);
  const [bikeProgress, setBikeProgress] = React.useState(0);
  const navigate = useNavigate();

  // Cargar datos si estamos en modo edición
  React.useEffect(() => {
    if (vehicleData) {
      setEditingId(vehicleData.id);
      setForm({
        brand: vehicleData.brand || '',
        model: vehicleData.model || '',
        color: vehicleData.color || '',
        license_plate: vehicleData.license_plate || '',
        displacement: vehicleData.displacement || '',
        year: vehicleData.year || '',
        chassis_serial: vehicleData.chassis_serial || '',
        engine_serial: vehicleData.engine_serial || '',
        observations: vehicleData.observations || ''
      });
      // Mostrar imágenes existentes como preview
      if(vehicleData.docURL) setDocPreview(vehicleData.docURL);
      if(vehicleData.bikeURL) setBikePreview(vehicleData.bikeURL);
    }
  }, [vehicleData]);

  const onChange = e => setForm({...form,[e.target.name]: e.target.value});

  // --- FUNCIÓN DE VALIDACIÓN DE ARCHIVOS ---
  const validateAndSetFile = (e, setFileState) => {
    const file = e.target.files[0];
    if (!file) {
        setFileState(null);
        return;
    }

    // 1. Validar formatos específicos (Whitelist)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
        showToast('Formato no permitido. Solo se aceptan JPG, PNG o WEBP.', 'error');
        e.target.value = ''; // Resetear el input
        setFileState(null);
        return;
    }

    // 2. Validar tamaño (Máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showToast('Error: La imagen es demasiado pesada (Máximo 10MB)', 'error');
        e.target.value = ''; // Resetear el input
        setFileState(null);
        return;
    }

    // Si pasa, guardamos el archivo en el estado
    setFileState(file);
  };

  const uploadImage = async (file, path, setProgress) => {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1600, useWebWorker: true };
      const compressed = await imageCompression(file, options);
  
      // Forzamos el uso del bucket correcto
      const bucketUrl = `gs://${firebaseConfig.storageBucket}`;
      const storageInstance = getStorageSDK(firebaseApp, bucketUrl);
      const storageRef = ref(storageInstance, path);
  
      console.log('Uploading image, user:', auth.currentUser?.uid, 'to bucket:', bucketUrl, 'path:', path);
      const task = uploadBytesResumable(storageRef, compressed);
  
      return new Promise((resolve, reject) => {
          task.on('state_changed',
              (snapshot) => {
                  if (setProgress && snapshot.totalBytes > 0) {
                      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                      setProgress(pct);
                  }
              },
              (error) => {
                  console.error('Upload error:', error.code, error.message);
                  const friendlyMessage = (error.code === 'storage/unauthorized')
                      ? 'Error: No tienes permiso para subir archivos. Revisa tus reglas de Storage en Firebase.'
                      : `Error al subir: ${error.message}`;
                  reject(new Error(friendlyMessage));
              },
              async () => {
                  const downloadURL = await getDownloadURL(task.snapshot.ref);
                  resolve(downloadURL);
              }
          );
      });
  }

  const submit = async (e)=>{
    e.preventDefault();
    if(!auth.currentUser){ showToast('Debes iniciar sesión','warn'); return }
    
    // Validación de imágenes: Si es nuevo registro, son obligatorias. Si es edición, son opcionales.
    if(!editingId && (!docFile || !bikeFile)){ 
      showToast('Sube ambas imágenes (documentos y moto)','warn'); 
      return; 
    }

    setLoading(true);
    try{
      // basic validations
      if(!isLicensePlateValid(form.license_plate)) throw new Error('Placa inválida');
      if(!isDisplacementValid(form.displacement)) throw new Error('Cilindraje inválido');
      if(!isYearValid(form.year)) throw new Error('Año inválido');

      // uniqueness checks for license_plate, chassis_serial, engine_serial
      const qPlate = query(collection(db,'vehicles'), where('license_plate','==', form.license_plate));
      const snapPlate = await getDocs(qPlate);
      if(!snapPlate.empty) {
        const isSelf = editingId && snapPlate.docs[0].id === editingId;
        if(!isSelf) throw new Error('Ya existe un vehículo con esa placa');
      }

      const qCh = query(collection(db,'vehicles'), where('chassis_serial','==', form.chassis_serial));
      const snapCh = await getDocs(qCh);
      if(!snapCh.empty) {
        const isSelf = editingId && snapCh.docs[0].id === editingId;
        if(!isSelf) throw new Error('Ya existe un vehículo con ese serial de chasis');
      }

      const qEn = query(collection(db,'vehicles'), where('engine_serial','==', form.engine_serial));
      const snapEn = await getDocs(qEn);
      if(!snapEn.empty) {
         const isSelf = editingId && snapEn.docs[0].id === editingId;
         if(!isSelf) throw new Error('Ya existe un vehículo con ese serial de motor');
      }

      // Preparar URLs
      let docURL = vehicleData?.docURL || null;
      let bikeURL = vehicleData?.bikeURL || null;

      if (docFile) {
        const docPath = `vehicles/${auth.currentUser.uid}/${Date.now()}_doc.jpg`;
        docURL = await uploadImage(docFile, docPath, setDocProgress);
      }
      
      if (bikeFile) {
        const bikePath = `vehicles/${auth.currentUser.uid}/${Date.now()}_bike.jpg`;
        bikeURL = await uploadImage(bikeFile, bikePath, setBikeProgress);
      }
      
      if(editingId) {
        // --- MODO ACTUALIZACIÓN ---
        await updateDoc(doc(db, 'vehicles', editingId), {
            ...form,
            displacement: Number(form.displacement) || null,
            year: Number(form.year) || null,
            docURL,
            bikeURL,
        });
        showToast('Vehículo actualizado correctamente', 'success');
      } else {
        // --- MODO CREACIÓN ---
        await addDoc(collection(db,'vehicles'),{
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
        showToast('Vehículo registrado', 'success');
      }

      navigate('/profile');
    }catch(err){
      showToast(err.message, 'error')
    }finally{
      setLoading(false)
    }
  }

  // previews for selected files
  React.useEffect(()=>{
    if(docFile){
      const url = URL.createObjectURL(docFile);
      setDocPreview(url);
      return ()=> URL.revokeObjectURL(url);
    }
  },[docFile]);

  React.useEffect(()=>{
    if(bikeFile){
      const url = URL.createObjectURL(bikeFile);
      setBikePreview(url);
      return ()=> URL.revokeObjectURL(url);
    }
  },[bikeFile]);

  return (
    <div id="vehicleFormContainer">
      <form id="vehicleForm" onSubmit={submit}>
        <h3 id="vehicleFormTitle">{editingId ? 'Editar Vehículo' : 'Registrar Vehículo'}</h3>
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
          <label>Foto de documentos {editingId ? '(dejar vacío para mantener actual)' : '(subir JPG, PNG)'}</label>
          <input 
            type="file" 
            accept="image/png, image/jpeg, image/webp" 
            onChange={(e) => validateAndSetFile(e, setDocFile)} 
            required={!editingId} 
          />
          {docPreview && <img src={docPreview} alt="doc preview" style={{maxWidth:180,marginTop:8,borderRadius:6,display:'block'}} />}
          {docProgress > 0 && <div className="progress-bar"><div className="progress-fill" style={{width: `${docProgress}%`}}>{docProgress}%</div></div>}
        </div>

        <div>
          <label>Foto de la moto {editingId ? '(dejar vacío para mantener actual)' : '(subir JPG, PNG)'}</label>
          <input 
            type="file" 
            accept="image/png, image/jpeg, image/webp" 
            onChange={(e) => validateAndSetFile(e, setBikeFile)} 
            required={!editingId} 
          />
          {bikePreview && <img src={bikePreview} alt="bike preview" style={{maxWidth:220,marginTop:8,borderRadius:6,display:'block'}} />}
          {bikeProgress > 0 && <div className="progress-bar"><div className="progress-fill" style={{width: `${bikeProgress}%`}}>{bikeProgress}%</div></div>}
        </div>

        <div style={{display:'flex', gap: 10, marginTop: 10}}>
            <button type="submit" disabled={loading} style={{flex: 1}}>
            {loading ? 'Procesando...' : (editingId ? 'Guardar Cambios' : 'Registrar Vehículo')}
            </button>
            <button type="button" id="cancelVehicleBtn" onClick={() => navigate('/profile')} style={{flex: 1}}>
                Cancelar
            </button>
        </div>

      </form>
    </div>
  )
}