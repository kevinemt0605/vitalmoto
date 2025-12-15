import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore'; 
import { isEmailValid, isIdNumberValid, isPhoneValid, isAccountNumberValid } from '../utils/validators';
import showToast from '../utils/toast';

export default function Register(){
  const [form, setForm] = React.useState({
    fullname: '',
    id_type: 'C',
    id_number: '',
    phone_local: '',
    phone_mobile: '',
    email: '',
    address_home: '',
    address_office: '',
    bank: '',
    account_number: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = React.useState(false);
  const nav = useNavigate();

  const onChange = e => setForm({...form,[e.target.name]:e.target.value});

  const onSubmit = async (e)=>{
    e.preventDefault();
    setLoading(true);
    try{
      // --- VALIDACIONES LOCALES ---
      if(!isEmailValid(form.email)) throw new Error('Email inválido');
      if(!isIdNumberValid(form.id_number)) throw new Error('Número de identificación inválido');
      if(!isPhoneValid(form.phone_local) || !isPhoneValid(form.phone_mobile)) throw new Error('Teléfono inválido');
      if(!isAccountNumberValid(form.account_number)) throw new Error('Número de cuenta inválido (solo dígitos, 6-30)');
      if(form.password !== form.confirm_password) throw new Error('Las contraseñas no coinciden');

      // --- VALIDACIÓN DE UNICIDAD (Segura) ---
      // Creamos un ID compuesto, ej: "V-12345678"
      const compositeId = `${form.id_type}-${form.id_number}`;
      const idRegistryRef = doc(db, 'id_registry', compositeId);
      
      // Intentamos leer este documento. Las reglas permiten 'get' público.
      const idSnapshot = await getDoc(idRegistryRef);
      if (idSnapshot.exists()) {
        throw new Error(`La cédula ${form.id_type}-${form.id_number} ya está registrada.`);
      }

      // --- CREACIÓN DE USUARIO (Auth) ---
      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      
      // Actualizar nombre visual
      await updateProfile(userCred.user,{displayName: form.fullname});
      
      // Enviar email de verificación
      await sendEmailVerification(userCred.user);

      // Redirigir inmediatamente
      nav('/profile');

      // --- GUARDADO EN FIRESTORE (Background) ---
      (async function saveUserDocWithRetries(){
        const maxRetries = 3;
        const delay = ms => new Promise(res => setTimeout(res, ms));
        let lastErr = null;

        for(let attempt=1; attempt<=maxRetries; attempt++){
          try{
            // Forzar refresco de token
            try{ await userCred.user.getIdToken(true); }catch(e){}

            // 1. Guardar Perfil de Usuario
            await setDoc(doc(db,'users', userCred.user.uid),{
              fullname: form.fullname,
              id_type: form.id_type,
              id_number: form.id_number,
              phone_local: form.phone_local || null,
              phone_mobile: form.phone_mobile,
              email: form.email,
              address_home: form.address_home,
              address_office: form.address_office || null,
              bank: form.bank,
              account_number: form.account_number,
              created_at: new Date().toISOString(),
              last_login: null,
              photoURL: null,
              hasPaid: false,
              lastPayment: null,
              role: 'user'
            });

            // 2. Guardar en Registro de IDs (Reservar la cédula)
            // Esto evita que otro se registre con la misma cédula en el futuro
            await setDoc(doc(db, 'id_registry', compositeId), {
              uid: userCred.user.uid,
              registeredAt: new Date().toISOString()
            });
            
            console.info('Firestore: user and registry documents created');
            showToast('Perfil guardado correctamente.', 'success');
            return;
          }catch(err){
            lastErr = err;
            console.warn(`Firestore write attempt ${attempt} failed:`, err);
            const code = (err && (err.code || err.message || '')).toString().toLowerCase();
            if(code.includes('permission') || code.includes('unauthenticated') || attempt < maxRetries){
              await delay(1000 * attempt);
              continue;
            }else{
              break;
            }
          }
        }
        if(lastErr){
          const msg = lastErr && (lastErr.message || lastErr.toString()) || 'Error desconocido';
          showToast(`No se pudo completar el registro en base de datos: ${msg}`, 'error');
        }
      })();
    }catch(err){
      showToast(err.message || 'Error', 'error');
    }finally{setLoading(false)}
  }

  return (
    <div className="body-login">
      <div className="login-container">
        <div className="login-box">
          <h2>Registro de Usuario</h2>
          <form id="registerForm" onSubmit={onSubmit}>
            <div className="input-group">
              <label htmlFor="fullname">Nombres y Apellidos / Razón Social *</label>
              <input type="text" id="fullname" name="fullname" value={form.fullname} onChange={onChange} required />
            </div>
            <div className="input-group">
              <label htmlFor="id_type">Tipo de Identificación *</label>
              <select id="id_type" name="id_type" value={form.id_type} onChange={onChange} required>
                <option value="V">V (Cédula)</option>
                <option value="J">J (RIF)</option>
                <option value="E">E (Extranjero)</option>
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="id_number">Número de Identificación *</label>
              <input type="text" id="id_number" name="id_number" value={form.id_number} onChange={onChange} required />
            </div>
            <div className="input-group">
              <label htmlFor="phone_local">Teléfono Local</label>
              <input type="tel" id="phone_local" name="phone_local" value={form.phone_local} onChange={onChange} />
            </div>
            <div className="input-group">
              <label htmlFor="phone_mobile">Teléfono Móvil *</label>
              <input type="tel" id="phone_mobile" name="phone_mobile" value={form.phone_mobile} onChange={onChange} required />
            </div>
            <div className="input-group">
              <label htmlFor="email">Correo Electrónico *</label>
              <input type="email" id="email" name="email" value={form.email} onChange={onChange} required />
            </div>
            <div className="input-group">
              <label htmlFor="address_home">Dirección Habitación *</label>
              <textarea id="address_home" name="address_home" value={form.address_home} onChange={onChange} required></textarea>
            </div>
            <div className="input-group">
              <label htmlFor="address_office">Dirección Oficina</label>
              <textarea id="address_office" name="address_office" value={form.address_office} onChange={onChange}></textarea>
            </div>
            <div className="input-group">
              <label htmlFor="bank">Banco *</label>
              <input type="text" id="bank" name="bank" value={form.bank} onChange={onChange} required />
            </div>
            <div className="input-group">
              <label htmlFor="account_number">N° de Cuenta (20 dígitos) *</label>
              <input type="text" id="account_number" name="account_number" value={form.account_number} onChange={onChange} required minLength={6} maxLength={30} />
            </div>
                <div className="input-group">
                  <label htmlFor="password">Contraseña *</label>
                  <input type="password" id="password" name="password" value={form.password} onChange={onChange} required />
                </div>
                <div className="input-group">
                  <label htmlFor="confirm_password">Confirmar Contraseña *</label>
                  <input type="password" id="confirm_password" name="confirm_password" value={form.confirm_password} onChange={onChange} required />
                </div>
            <button type="submit" className="btn-primario btn-full" disabled={loading}>{loading? 'Creando...':'Registrarse'}</button>
          </form>
          <p>¿Ya tienes una cuenta? <a href="/login">Inicia sesión</a></p>
        </div>
      </div>
    </div>
  )
}