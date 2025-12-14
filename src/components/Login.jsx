import React from 'react';
import { signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import showToast from '../utils/toast';

export default function Login(){
  const [email,setEmail] = React.useState('');
  const [password,setPassword] = React.useState('');
  const nav = useNavigate();

  const submit = async (e)=>{
    e.preventDefault();
    try{
      const cred = await signInWithEmailAndPassword(auth,email,password);
      // require email verified to proceed
      if(!cred.user.emailVerified){
        // send a verification email option
        await sendEmailVerification(cred.user);
        showToast('Se ha enviado un correo de verificación. Verifica tu email antes de continuar.', 'info');
        return;
      }
      // update last_login in Firestore user doc
      try{ await updateDoc(doc(db,'users', cred.user.uid), { last_login: new Date().toISOString() }); }catch(e){/* non-blocking */}
      nav('/profile');
    }catch(err){ showToast(err.message || 'Error', 'error') }
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
            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <input type="password" id="password" name="password" value={password} onChange={e=>setPassword(e.target.value)} required />
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
