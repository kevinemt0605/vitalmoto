import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
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
      // Basic validations
      if(!isEmailValid(form.email)) throw new Error('Email inválido');
      if(!isIdNumberValid(form.id_number)) throw new Error('Número de identificación inválido');
      if(!isPhoneValid(form.phone_local) || !isPhoneValid(form.phone_mobile)) throw new Error('Teléfono inválido');
  if(!isAccountNumberValid(form.account_number)) throw new Error('Número de cuenta inválido (solo dígitos, 6-30)');
  if(form.password !== form.confirm_password) throw new Error('Las contraseñas no coinciden');

      // Check uniqueness of id_number in users collection
      const q = query(collection(db,'users'), where('id_number','==', form.id_number));
      const snap = await getDocs(q);
      if(!snap.empty){
        throw new Error('Ya existe un usuario con ese número de identificación');
      }
      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(userCred.user,{displayName: form.fullname});
      // send verification email
      await sendEmailVerification(userCred.user);
      // ensure auth token is ready before writing to Firestore
      try{
        await userCred.user.getIdToken(true);
      }catch(e){ /* non-blocking: will attempt write anyway */ }
      // Save profile in Firestore mirroring backend model fields
      try{
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
        // payment fields
        hasPaid: false,
        lastPayment: null
        });
      }catch(err){
        // Provide clearer error message for permission issues
        if(err && err.code && err.code.includes('permission')){
          showToast('Error de permisos: revisa las reglas de Firestore en la consola de Firebase.', 'error');
        }else{
          throw err;
        }
      }
      nav('/profile');
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
