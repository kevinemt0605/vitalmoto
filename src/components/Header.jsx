import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';

export default function Header(){
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const nav = useNavigate();

  React.useEffect(()=>{
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth,u=> setUser(u));
    return unsub;
  },[]);

  const openMenu = ()=>{
    setMenuOpen(true);
  }
  const closeMenu = ()=>{
    setMenuOpen(false);
  }

  const logout = async (e)=>{
    e && e.preventDefault();
    const auth = getAuth();
    await signOut(auth);
    nav('/login');
  }

  return (
    <>
      <div id="sidenav" className="sidenav" style={{width: menuOpen? '280px' : '0'}}>
        <a href="#" className="close-btn" id="closeBtn" onClick={e=>{e.preventDefault(); closeMenu();}}>&times;</a>
        <div className="sidenav-content">
            <h1 className="logo">
                <img src="/img/Untitled 05 Artboard 1 Copy 3WN.png" alt="Logo de VitalMoto" className="logo-imagen" />
                <span>VitalMoto</span>
            </h1>
            {!user && <Link to="/login" className="btn-primario" onClick={closeMenu}>Iniciar Sesión</Link>}
            {user && <Link to="/profile" className="btn-primario" onClick={closeMenu}>Perfil</Link>}
            {user && <a href="#" className="btn-primario" onClick={(e)=>{e.preventDefault(); logout();}}>Cerrar Sesión</a>}
        </div>
      </div>

      <header className="header-fijo">
        <div className="contenedor">
            <Link to="/" className="logo-link">
                <h1 className="logo">
                    <img src="/img/Untitled 05 Artboard 1 Copy 3WN.png" alt="Logo de VitalMoto" className="logo-imagen" />
                    <span className="logo-text-desktop">VitalMoto</span>
                </h1>
            </Link>
            <div className="header-actions" id="headerActions">
                {!user && <Link to="/login" className="btn-primario btn-desktop" id="loginBtnHeader">Iniciar Sesión</Link>}
                {user && <Link to="/profile" className="btn-primario btn-desktop" id="profileBtnHeader">Perfil</Link>}
                {user && <a href="#" className="btn-primario btn-desktop" id="logoutBtnHeader" onClick={logout}>Cerrar Sesión</a>}
            </div>
            <div className="menu-toggle" id="menuToggle" onClick={openMenu}>
                <div className="bar"></div>
                <div className="bar"></div>
                <div className="bar"></div>
            </div>
        </div>
      </header>
    </>
  )
}
