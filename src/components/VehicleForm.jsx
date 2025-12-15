import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, storage, db, firebaseConfig, default as firebaseApp } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, getStorage as getStorageSDK } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { collection, setDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
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

    const fileName = file.name.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
        showToast('Error: Formato no permitido. Solo imágenes JPG, PNG, WEBP.', 'error');
        e.target.value = ''; 
        setFileState(null);
        return;
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimeTypes.includes(file.type)) {
        showToast('Error: El archivo no es una imagen válida.', 'error');
        e.target.value = ''; 
        setFileState(null);
        return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        showToast('Error: La imagen es demasiado pesada (Máximo 10MB)', 'error');
        e.target.value = ''; 
        setFileState(null);
        return;
    }

    setFileState(file);
  };

  const uploadImage = async (file, path, setProgress) => {
      const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1600, useWebWorker: true };
      const compressed = await imageCompression(file, options);
  
      const bucketUrl = `gs://${firebaseConfig.storageBucket}`;
      const storageInstance = getStorageSDK(firebaseApp, bucketUrl);
      const storageRef = ref(storageInstance, path);
  
      console.log('Uploading image to:', bucketUrl, path);
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
                      ? 'Error: Permiso denegado al subir imagen.'
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

  // --- VERIFICAR DISPONIBILIDAD (REGISTRO PÚBLICO) ---
  const checkAvailability = async (key, value, currentVehicleId) => {
    if(!value) return;
    // Creamos un ID único para el registro, ej: "plate_AB123CD"
    const registryId = `${key}_${value.toUpperCase().replace(/\s/g, '')}`;
    const registryRef = doc(db, 'vehicle_identifiers', registryId);
    
    const snap = await getDoc(registryRef);
    if(snap.exists()){
      const data = snap.data();
      // Si existe y pertenece a OTRO vehículo, es un error
      if(data.vehicleId !== currentVehicleId){
        throw new Error(`El valor '${value}' para ${key} ya está registrado en otro vehículo.`);
      }
    }
    return { registryId, registryRef }; // Retornamos referencia para guardarlo luego
  };

  const submit = async (e)=>{
    e.preventDefault();
    if(!auth.currentUser){ showToast('Debes iniciar sesión','warn'); return }
    
    if(!editingId && (!docFile || !bikeFile)){ 
      showToast('Sube ambas imágenes (documentos y moto)','warn'); 
      return; 
    }

    setLoading(true);
    try{
      // Validaciones básicas
      if(!isLicensePlateValid(form.license_plate)) throw new Error('Placa inválida');
      if(!isDisplacementValid(form.displacement)) throw new Error('Cilindraje inválido');
      if(!isYearValid(form.year)) throw new Error('Año inválido');

      // --- DETERMINAR ID DEL VEHÍCULO ---
      // Si es nuevo, generamos un ID cliente-side para poder reservar los identificadores
      const targetVehicleId = editingId || doc(collection(db, 'vehicles')).id;

      // --- VERIFICAR UNICIDAD EN PARALELO ---
      const checks = await Promise.all([
        checkAvailability('plate', form.license_plate, targetVehicleId),
        checkAvailability('chassis', form.chassis_serial, targetVehicleId),
        checkAvailability('engine', form.engine_serial, targetVehicleId)
      ]);
      
      // checks es un array de objetos { registryId, registryRef }

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
      
      // Datos a guardar
      const vehiclePayload = {
        ownerId: auth.currentUser.uid,
        brand: form.brand,
        model: form.model,
        color: form.color,
        license_plate: form.license_plate.toUpperCase(),
        displacement: Number(form.displacement) || null,
        year: Number(form.year) || null,
        chassis_serial: form.chassis_serial.toUpperCase(),
        engine_serial: form.engine_serial.toUpperCase(),
        observations: form.observations || null,
        docURL,
        bikeURL,
        // Si es edición, no tocamos createdAt, si es nuevo sí
        ...(editingId ? {} : { createdAt: new Date().toISOString() })
      };

      if(editingId) {
        // ACTUALIZACIÓN
        await updateDoc(doc(db, 'vehicles', editingId), vehiclePayload);
      } else {
        // CREACIÓN (Usamos setDoc con el ID que generamos antes)
        await setDoc(doc(db, 'vehicles', targetVehicleId), vehiclePayload);
      }

      // --- RESERVAR IDENTIFICADORES ---
      // Guardamos en 'vehicle_identifiers' para bloquear estos valores a futuro
      // Lo hacemos después de guardar el vehículo para asegurar consistencia principal
      // (Idealmente sería una transacción, pero esto funciona para el MVP)
      const registryPromises = checks.map(check => {
        if(check) {
          return setDoc(check.registryRef, { 
            vehicleId: targetVehicleId,
            updatedAt: new Date().toISOString()
          });
        }
        return Promise.resolve();
      });
      await Promise.all(registryPromises);

      showToast(editingId ? 'Vehículo actualizado' : 'Vehículo registrado', 'success');
      navigate('/profile');

    }catch(err){
      console.error(err);
      showToast(err.message, 'error');
    }finally{
      setLoading(false)
    }
  }

  // previews
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
            accept="image/png, image/jpeg, image/webp, .jpg, .jpeg, .png, .webp" 
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
            accept="image/png, image/jpeg, image/webp, .jpg, .jpeg, .png, .webp" 
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