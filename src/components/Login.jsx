import React from 'react';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import showToast from '../utils/toast';

export default function Login(){
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false); // Estado para ver contraseña
  const nav = useNavigate();

  const submit = async (e)=>{
    e.preventDefault();
    try{
      const cred = await signInWithEmailAndPassword(auth, email, password);
      
      // Verificar email antes de entrar
      if(!cred.user.emailVerified){
        await sendEmailVerification(cred.user);
        showToast('Se ha enviado un correo de verificación. Verifica tu email antes de continuar.', 'info');
        return;
      }
      
      // Actualizar última conexión
      try{ await updateDoc(doc(db,'users', cred.user.uid), { last_login: new Date().toISOString() }); }catch(e){}
      
      nav('/profile');
    }catch(err){
      console.error("Código de error Firebase:", err.code); // Míralo en consola si sigue fallando
      
      // --- MANEJO DE ERRORES MEJORADO ---
      let msg = 'Ocurrió un error al iniciar sesión.';
      
      // Lista de códigos que significan "Datos Incorrectos"
      const errorCredenciales = [
        'auth/invalid-credential',          // Estándar actual
        'auth/invalid-login-credentials',   // Nuevo estándar (Identity Platform)
        'auth/user-not-found',              // Antiguo
        'auth/wrong-password',              // Antiguo
        'auth/invalid-email'                // Formato de email mal
      ];

      if (errorCredenciales.includes(err.code)) {
        msg = 'Datos incorrectos. Verifica tu correo y contraseña.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por seguridad.';
      } else if (err.code === 'auth/user-disabled') {
        msg = 'Esta cuenta ha sido inhabilitada por el administrador.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Error de conexión. Revisa tu internet.';
      }

      showToast(msg, 'error');
    }
  }

  return (
    <div className="body-login">
      <div className="login-container">
        <div className="login-box">
          <h2>Acceso a Clientes</h2>
          <form id="loginForm" onSubmit={submit} noValidate>
            <div className="input-group">
              <label htmlFor="email">Correo Electrónico</label>
              <input type="email" id="email" name="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            
            {/* Campo Contraseña con botón de revelar */}
            <div className="input-group" style={{position: 'relative'}}>
              <label htmlFor="password">Contraseña</label>
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                name="password" 
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                required 
                style={{paddingRight: '40px'}} // Espacio para el botón
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '38px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#666'
                }}
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? '👁️' : '🔒'}
              </button>
            </div>

            <div id="loginError" className="login-error-message" style={{display:'none'}}>Credenciales Incorrectas</div>
            <button type="submit" className="btn-primario btn-full">Ingresar</button>
          </form>
          <p>¿No tienes cuenta? <a href="/register">Regístrate aquí</a></p>
        </div>
      </div>
    </div>
  )
}