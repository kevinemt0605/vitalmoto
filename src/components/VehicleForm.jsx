import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, firebaseConfig, default as firebaseApp } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL, getStorage as getStorageSDK } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { collection, setDoc, updateDoc, doc, getDoc, getFirestore } from 'firebase/firestore';
import showToast from '../utils/toast';

// Instanciamos db aquí para asegurar consistencia
const db = getFirestore(firebaseApp);

export default function VehicleForm(){
  // --- ESTADOS ---
  const [showModal, setShowModal] = React.useState(true); // Modal de aviso inicial
  const nav = useNavigate();
  const location = useLocation();
  const { vehicleData } = location.state || {};
  const [editingId, setEditingId] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  // Formulario de datos
  const [form, setForm] = React.useState({
    brand: '',
    model: '',
    color: '',
    license_plate: '',
    displacement: '',
    year: '',
    chassis_serial: '',
    engine_serial: '',
    observations: '',
    motoUse: 'Personal', // Valor por defecto
    motoUseOther: ''     // Campo auxiliar para "Otro"
  });

  // Estados para las 6 imágenes (Archivo, Preview, Progreso)
  const [files, setFiles] = React.useState({
    doc: null,
    front: null,
    rear: null,
    left: null,
    right: null,
    tacho: null
  });

  const [previews, setPreviews] = React.useState({
    doc: null,
    front: null,
    rear: null,
    left: null,
    right: null,
    tacho: null
  });

  const [progress, setProgress] = React.useState({
    doc: 0,
    front: 0,
    rear: 0,
    left: 0,
    right: 0,
    tacho: 0
  });

  // --- CARGAR DATOS EN EDICIÓN ---
  React.useEffect(() => {
    if (vehicleData) {
      setEditingId(vehicleData.id);
      
      // Lógica para recuperar el uso
      const standardUses = [
        'Personal', 
        'Moto Taxista (Yummy, Yango, Independiente, etc.)', 
        'Repartidor de comida'
      ];
      const isStandard = standardUses.includes(vehicleData.motoUse);
      
      setForm({
        brand: vehicleData.brand || '',
        model: vehicleData.model || '',
        color: vehicleData.color || '',
        license_plate: vehicleData.license_plate || '',
        displacement: vehicleData.displacement || '',
        year: vehicleData.year || '',
        chassis_serial: vehicleData.chassis_serial || '',
        engine_serial: vehicleData.engine_serial || '',
        observations: vehicleData.observations || '',
        motoUse: isStandard ? vehicleData.motoUse : 'Otro',
        motoUseOther: isStandard ? '' : (vehicleData.motoUse || '')
      });

      // Cargar previews existentes
      setPreviews({
        doc: vehicleData.docURL || null,
        front: vehicleData.frontURL || null,
        rear: vehicleData.rearURL || null,
        left: vehicleData.leftURL || null,
        right: vehicleData.rightURL || null,
        tacho: vehicleData.tachoURL || null
      });
      
      // Si estamos editando, no mostramos el aviso legal de nuevo
      setShowModal(false); 
    }
  }, [vehicleData]);

  // --- MANEJADORES ---
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // Función genérica para manejar selección de archivos
  const handleFileChange = (e, key) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validaciones
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileName = file.name.toLowerCase();
    if (!validExtensions.some(ext => fileName.endsWith(ext)) || !file.type.startsWith('image/')) {
      showToast('Solo se permiten imágenes (JPG, PNG, WEBP)', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('La imagen pesa más de 10MB', 'error');
      e.target.value = '';
      return;
    }

    setFiles(prev => ({ ...prev, [key]: file }));
    
    // Generar preview local
    const url = URL.createObjectURL(file);
    setPreviews(prev => ({ ...prev, [key]: url }));
  };

  // Limpieza de memoria de los previews
  React.useEffect(() => {
    return () => {
      Object.values(previews).forEach(url => {
        if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []); // eslint-disable-line

  // Función de verificación de duplicados (Placa/Seriales)
  const checkAvailability = async (key, value, currentVehicleId) => {
    if(!value) return;
    const registryId = `${key}_${value.toUpperCase().replace(/\s/g, '')}`;
    const registryRef = doc(db, 'vehicle_identifiers', registryId);
    const snap = await getDoc(registryRef);
    if(snap.exists()){
      const data = snap.data();
      if(data.vehicleId !== currentVehicleId){
        throw new Error(`El valor '${value}' para ${key} ya está registrado.`);
      }
    }
    return { registryId, registryRef };
  };

  // Función de subida de imagen
  const uploadImage = async (file, path, keyProgress) => {
    // OPTIMIZACIÓN: 0.3MB para que subir 6 fotos sea rápido
    const options = { maxSizeMB: 0.3, maxWidthOrHeight: 1280, useWebWorker: true };
    const compressed = await imageCompression(file, options);

    const bucketUrl = `gs://${firebaseConfig.storageBucket}`;
    const storageInstance = getStorageSDK(firebaseApp, bucketUrl);
    const storageRef = ref(storageInstance, path);

    const task = uploadBytesResumable(storageRef, compressed);

    return new Promise((resolve, reject) => {
      task.on('state_changed',
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setProgress(prev => ({ ...prev, [keyProgress]: pct }));
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        }
      );
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return showToast('Debes iniciar sesión', 'warn');

    // 1. Validar Uso
    let finalUsage = form.motoUse;
    if (form.motoUse === 'Otro') {
      if (!form.motoUseOther.trim()) return showToast('Especifica el uso de la moto', 'warn');
      finalUsage = form.motoUseOther.trim();
    }

    // 2. Validar Archivos Requeridos
    const isMissing = (key) => !files[key] && !previews[key]; 
    if (isMissing('doc') || isMissing('front') || isMissing('rear') || 
        isMissing('left') || isMissing('right') || isMissing('tacho')) {
      return showToast('Debes subir TODAS las fotos requeridas', 'warn');
    }

    setLoading(true);
    try {
      // --- VALIDACIONES DE NEGOCIO ---

      // 1. PLACA (Formato Venezuela)
      // Formato Actual: 2 Letras + 3 Números + 2 Letras (ej: AB123CD)
      // Formato Anterior: 2 Letras + 4 Números (ej: AB1234)
      const cleanPlate = form.license_plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const plateRegex = /^([A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{2}\d{4})$/;
      
      if (!plateRegex.test(cleanPlate)) {
        throw new Error('Placa inválida. Formato Venezuela: AA123BB (Nuevo) o AA1234 (Viejo).');
      }

      // 2. CILINDRAJE (Numérico y <= 300)
      const disp = Number(form.displacement);
      if (!disp || isNaN(disp) || disp <= 0) throw new Error('El cilindraje debe ser un número válido');
      if (disp > 300) throw new Error('El cilindraje máximo permitido es 300 cc');

      // 3. AÑO (Rango válido 1900 - Año Actual+1)
      const currentYear = new Date().getFullYear();
      const yearNum = Number(form.year);
      if (!yearNum || isNaN(yearNum) || yearNum < 1900 || yearNum > currentYear + 1) {
        throw new Error(`Año inválido. Ingrese un año entre 1900 y ${currentYear + 1}`);
      }

      // 4. SERIALES (Exactamente 17 caracteres)
      const cleanChassis = form.chassis_serial.toUpperCase().trim();
      const cleanEngine = form.engine_serial.toUpperCase().trim();
      if (cleanChassis.length !== 17) throw new Error('El serial de chasis debe tener exactamente 17 caracteres');
      if (cleanEngine.length !== 17) throw new Error('El serial de motor debe tener exactamente 17 caracteres');

      // --- FIN VALIDACIONES ---

      const targetVehicleId = editingId || doc(collection(db, 'vehicles')).id;

      // Verificar disponibilidad (Usando valores limpios)
      const checks = await Promise.all([
        checkAvailability('plate', cleanPlate, targetVehicleId),
        checkAvailability('chassis', cleanChassis, targetVehicleId),
        checkAvailability('engine', cleanEngine, targetVehicleId)
      ]);

      // Subir imágenes en paralelo
      const timestamp = Date.now();
      const userId = auth.currentUser.uid;
      
      const uploadPromises = [];
      const newUrls = {};

      const queueUpload = (key, suffix) => {
        if (files[key]) {
          const path = `vehicles/${userId}/${timestamp}_${suffix}.jpg`;
          uploadPromises.push(
            uploadImage(files[key], path, key).then(url => { newUrls[key] = url; })
          );
        } else {
          // Mantener URL vieja
          if (typeof previews[key] === 'string' && previews[key].startsWith('http')) {
             newUrls[key] = previews[key];
          }
        }
      };

      queueUpload('doc', 'doc');
      queueUpload('front', 'front');
      queueUpload('rear', 'rear');
      queueUpload('left', 'left');
      queueUpload('right', 'right');
      queueUpload('tacho', 'tacho');

      await Promise.all(uploadPromises);

      // Preparar payload
      const vehiclePayload = {
        ownerId: userId,
        brand: form.brand,
        model: form.model,
        color: form.color,
        license_plate: cleanPlate, // Guardamos la placa limpia
        displacement: disp,
        year: yearNum,
        chassis_serial: cleanChassis, // Guardamos seriales limpios
        engine_serial: cleanEngine,
        observations: form.observations || null,
        motoUse: finalUsage,
        
        docURL: newUrls.doc || null,
        frontURL: newUrls.front || null,
        rearURL: newUrls.rear || null,
        leftURL: newUrls.left || null,
        rightURL: newUrls.right || null,
        tachoURL: newUrls.tacho || null,

        bikeURL: newUrls.front || null, // Compatibilidad

        ...(editingId ? {} : { createdAt: new Date().toISOString() })
      };

      // Guardar en Firestore
      if (editingId) {
        await updateDoc(doc(db, 'vehicles', editingId), vehiclePayload);
      } else {
        await setDoc(doc(db, 'vehicles', targetVehicleId), vehiclePayload);
      }

      // Reservar identificadores
      const registryPromises = checks.map(check => {
        if(check) return setDoc(check.registryRef, { vehicleId: targetVehicleId, updatedAt: new Date().toISOString() });
        return Promise.resolve();
      });
      await Promise.all(registryPromises);

      showToast(editingId ? 'Vehículo actualizado' : 'Vehículo registrado', 'success');
      nav('/profile');

    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* --- MODAL DE AVISO --- */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: 12, padding: '2rem',
            maxWidth: '500px', width: '100%', textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ color: '#e74c3c', marginBottom: '1rem', fontSize: '2rem' }}>⚠️ AVISO IMPORTANTE</h2>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '1.5rem', textAlign: 'justify' }}>
              Para que tu vehículo sea validado correctamente, la <strong>Foto de Documentos</strong> debe incluir TODOS los siguientes elementos legibles en la misma imagen (o un collage):
            </p>
            <ul style={{ textAlign: 'left', marginBottom: '2rem', paddingLeft: '20px', fontSize: '1rem', lineHeight: '1.8' }}>
              <li>✅ Cédula de Identidad</li>
              <li>✅ Carnet de Circulación</li>
              <li>✅ RCV Vigente</li>
              <li>✅ Licencia de Conducir (2da Grado)</li>
              <li>✅ Certificado Médico Vial</li>
              <li>✅ Solvencia de Trimestres (Impuestos Municipales)</li>
            </ul>
            <button 
              onClick={() => setShowModal(false)}
              className="btn-primario"
              style={{ width: '100%', fontSize: '1.2rem', padding: '12px' }}
            >
              Entendido, Continuar
            </button>
          </div>
        </div>
      )}

      <div id="vehicleFormContainer">
        <form id="vehicleForm" onSubmit={submit}>
          <h3 id="vehicleFormTitle">{editingId ? 'Editar Vehículo' : 'Registrar Vehículo'}</h3>

          {/* DATOS BÁSICOS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <label>Marca: <input name="brand" value={form.brand} onChange={handleChange} required /></label>
            <label>Modelo: <input name="model" value={form.model} onChange={handleChange} required /></label>
            <label>Color: <input name="color" value={form.color} onChange={handleChange} required /></label>
            <label>Placa: <input name="license_plate" value={form.license_plate} onChange={handleChange} placeholder="Ej: AA123BB" required /></label>
            <label>Cilindraje (Máx 300cc): <input name="displacement" type="number" max="300" value={form.displacement} onChange={handleChange} required /></label>
            <label>Año: <input name="year" type="number" min="1900" max={new Date().getFullYear() + 1} value={form.year} onChange={handleChange} required /></label>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
             <label>Serial Chasis (17 caracteres): 
               <input name="chassis_serial" value={form.chassis_serial} onChange={handleChange} required minLength={17} maxLength={17} />
             </label>
             <label>Serial Motor (17 caracteres): 
               <input name="engine_serial" value={form.engine_serial} onChange={handleChange} required minLength={17} maxLength={17} />
             </label>
          </div>

          {/* USO DE LA MOTO */}
          <div className="input-group" style={{ marginTop: 10 }}>
            <label style={{ fontWeight: 'bold', color: '#2980b9' }}>¿Qué uso le darás a la moto?</label>
            <select 
              name="motoUse" 
              value={form.motoUse} 
              onChange={handleChange}
              style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '1rem' }}
            >
              <option value="Personal">Personal</option>
              <option value="Moto Taxista (Yummy, Yango, Independiente, etc.)">Moto Taxista (Yummy, Yango, Independiente, etc.)</option>
              <option value="Repartidor de comida">Repartidor de comida</option>
              <option value="Otro">Otro...</option>
            </select>
          </div>
          
          {form.motoUse === 'Otro' && (
            <div className="input-group">
              <label>Especifique el uso:</label>
              <input 
                name="motoUseOther" 
                value={form.motoUseOther} 
                onChange={handleChange} 
                placeholder="Ej: Paseos de fin de semana, Mensajería interna..."
                required
              />
            </div>
          )}

          <label>Observaciones:
            <textarea name="observations" value={form.observations} onChange={handleChange} />
          </label>

          <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #eee' }} />
          <h4 style={{ color: '#555', marginBottom: 10 }}>Fotografías del Vehículo</h4>
          <p style={{ fontSize: '0.85rem', color: '#777', marginBottom: 15 }}>Sube las fotos requeridas. Se comprimirán automáticamente.</p>

          {/* COMPONENTE PARA INPUT DE IMAGEN */}
          {[
            { key: 'doc', label: '1. Documentos (Collage completo)', req: true },
            { key: 'front', label: '2. Foto Frontal', req: true },
            { key: 'rear', label: '3. Foto Trasera', req: true },
            { key: 'left', label: '4. Lado Izquierdo', req: true },
            { key: 'right', label: '5. Lado Derecho', req: true },
            { key: 'tacho', label: '6. Tacómetro / Kilometraje', req: true }
          ].map((item) => (
            <div key={item.key} style={{ marginBottom: 15, background: '#f9f9f9', padding: 10, borderRadius: 8 }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: 5 }}>{item.label} {item.req && <span style={{color:'red'}}>*</span>}</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => handleFileChange(e, item.key)}
                required={!editingId} // En edición es opcional si ya existe
              />
              {/* Barra de progreso */}
              {progress[item.key] > 0 && progress[item.key] < 100 && (
                 <div className="progress-bar"><div className="progress-fill" style={{width: `${progress[item.key]}%`}}>{progress[item.key]}%</div></div>
              )}
              {/* Preview */}
              {previews[item.key] ? (
                <img 
                  src={previews[item.key]} 
                  alt={item.label} 
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', marginTop: 10, borderRadius: 5, border: '1px solid #ddd' }} 
                />
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#999', marginTop: 5, fontStyle: 'italic' }}>Sin imagen seleccionada</div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: 12, fontSize: '1.1rem' }}>
              {loading ? 'Subiendo imágenes...' : (editingId ? 'Guardar Cambios' : 'Registrar Vehículo')}
            </button>
            <button type="button" id="cancelVehicleBtn" onClick={() => nav('/profile')} style={{ flex: 1 }}>
              Cancelar
            </button>
          </div>

        </form>
      </div>
    </>
  )
}