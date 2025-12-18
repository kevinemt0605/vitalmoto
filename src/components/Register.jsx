import React from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Agregado Link
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore'; 
import { isEmailValid, isIdNumberValid, isPhoneValid, isAccountNumberValid } from '../utils/validators';
import showToast from '../utils/toast';

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
  const [acceptedTerms, setAcceptedTerms] = React.useState(false); // Estado para checkbox
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
      if(!isAccountNumberValid(form.account_number)) throw new Error('Número de cuenta inválido (solo dígitos, 20 caracteres)');
      if(form.password !== form.confirm_password) throw new Error('Las contraseñas no coinciden');

      // --- VALIDACIÓN DE TÉRMINOS ---
      if(!acceptedTerms) throw new Error('Debes leer y aceptar los Términos y Condiciones para continuar.');

      // --- VALIDACIÓN DE BANCO ---
      if (!form.bank) throw new Error('Debes seleccionar un banco');
      
      const selectedBankObj = VENEZUELA_BANKS.find(b => b.name === form.bank);
      if (selectedBankObj) {
        if (!form.account_number.startsWith(selectedBankObj.code)) {
          throw new Error(`El número de cuenta no coincide con el banco seleccionado. Para ${selectedBankObj.name} debe comenzar por ${selectedBankObj.code}`);
        }
      }

      // --- VALIDACIÓN DE UNICIDAD ---
      const compositeId = `${form.id_type}-${form.id_number}`;
      const idRegistryRef = doc(db, 'id_registry', compositeId);
      
      const idSnapshot = await getDoc(idRegistryRef);
      if (idSnapshot.exists()) {
        throw new Error(`La cédula ${form.id_type}-${form.id_number} ya está registrada.`);
      }

      // --- CREACIÓN DE USUARIO (Auth) ---
      const userCred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      
      await updateProfile(userCred.user,{displayName: form.fullname});
      await sendEmailVerification(userCred.user);

      nav('/profile');

      // --- GUARDADO EN FIRESTORE (Background) ---
      (async function saveUserDocWithRetries(){
        const maxRetries = 3;
        const delay = ms => new Promise(res => setTimeout(res, ms));
        let lastErr = null;

        for(let attempt=1; attempt<=maxRetries; attempt++){
          try{
            try{ await userCred.user.getIdToken(true); }catch(e){}

            // 1. Guardar Perfil de Usuario (Incluyendo que aceptó términos)
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
              role: 'user',
              acceptedTerms: true, // Registro de aceptación legal
              acceptedTermsDate: new Date().toISOString()
            });

            // 2. Guardar en Registro de IDs
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
            
            {/* SECCIÓN BANCO */}
            <div className="input-group">
              <label htmlFor="bank">Banco *</label>
              <select id="bank" name="bank" value={form.bank} onChange={onChange} required>
                <option value="">Seleccione un banco</option>
                {VENEZUELA_BANKS.map(bank => (
                  <option key={bank.code} value={bank.name}>
                    {bank.code} - {bank.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="input-group">
              <label htmlFor="account_number">N° de Cuenta (20 dígitos) *</label>
              <input type="text" id="account_number" name="account_number" value={form.account_number} onChange={onChange} required minLength={20} maxLength={20} placeholder="0102..." />
            </div>
            
            <div className="input-group">
              <label htmlFor="password">Contraseña *</label>
              <input type="password" id="password" name="password" value={form.password} onChange={onChange} required />
            </div>
            <div className="input-group">
              <label htmlFor="confirm_password">Confirmar Contraseña *</label>
              <input type="password" id="confirm_password" name="confirm_password" value={form.confirm_password} onChange={onChange} required />
            </div>

            {/* --- CHECKBOX TÉRMINOS Y CONDICIONES --- */}
            <div className="input-group" style={{display:'flex', alignItems:'center', gap:'10px', marginTop:'15px', marginBottom:'15px'}}>
              <input 
                type="checkbox" 
                id="terms" 
                checked={acceptedTerms} 
                onChange={e=>setAcceptedTerms(e.target.checked)} 
                required 
                style={{width:'20px', height:'20px', cursor:'pointer', margin:0}} 
              />
              <label htmlFor="terms" style={{marginBottom:0, fontWeight:'normal', fontSize:'0.95rem', cursor:'pointer'}}>
                He leído y acepto los <Link to="/terms" target="_blank" style={{color:'var(--color-primario)', textDecoration:'underline', fontWeight:'bold'}}>Términos y Condiciones</Link>
              </label>
            </div>

            <button type="submit" className="btn-primario btn-full" disabled={loading}>{loading? 'Creando...':'Registrarse'}</button>
          </form>
          <p>¿Ya tienes una cuenta? <a href="/login">Inicia sesión</a></p>
        </div>
      </div>
    </div>
  )
}