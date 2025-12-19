import React from 'react';

export default function Home(){
  // Estado para controlar la visibilidad del aviso de empleo
  const [showHiringModal, setShowHiringModal] = React.useState(true);

  // Lista de vacantes solicitadas
  const vacantes = [
    "Supervisor", "Analista", "Recepcionista", 
    "RRHH", "Informática", "Redes", 
    "Atención al Cliente", "Motorizado", "Gerentes"
  ];

  // --- CONFIGURACIÓN DE LOS SERVICIOS (SLIDE) ---
  const servicios = [
    {
      title: 'Diagnóstico y Reparación', 
      img: '/img/reparacion.jpg', 
      text: 'Solucionamos problemas complejos de motor, sistema eléctrico, frenos y suspensión.'
    },
    {
      title: 'Personalización', 
      img: '/img/personalizacion.jpeg', 
      text: 'Transformamos tu moto: modificaciones estéticas y mejoras de rendimiento a tu medida.'
    },
    {
      title: 'Mantenimiento Preventivo', 
      img: '/img/mantenimiento.jpeg', 
      text: 'Revisiones periódicas, cambio de aceite, filtros y bujías para tu seguridad.'
    },
    {
      title: 'Transparencia', 
      img: '/img/transparencia.png', 
      text: 'Explicamos cada trabajo y ofrecemos presupuestos claros, sin sorpresas.'
    },
    {
      title: 'Misión', 
      img: '/img/mision.jpg', 
      text: 'Garantizar movilidad y seguridad 24/7 con repuestos y servicio técnico de calidad.'
    },
    {
      title: 'Visión', 
      img: '/img/vision.jpg', 
      text: 'Ser la empresa líder en cambio de piezas y servicios para motos en Venezuela.'
    }
  ];

  return (
    <main>
      {/* --- SECCIÓN SOBRE NOSOTROS --- */}
      <section id="empresa">
        <div className="contenedor">
            <h2>Sobre Nosotros</h2>
            <p>Somos un equipo de mecánicos apasionados por las motocicletas, dedicados a la reparación, mantenimiento y personalización de alta calidad. Más que un taller, somos el centro de confianza para todo motero que busca el mejor cuidado para su máquina. Nos distingue la transparencia, la profesionalidad y la atención personalizada: cada moto es única y merece lo mejor.</p>
        </div>
      </section>

      {/* --- SECCIÓN GALERÍA INFINITA --- */}
      <section id="galeria">
        <div className="galeria-contenedor">
          <div className="galeria-track">
            {/* Duplicamos el array para lograr el efecto infinito sin saltos */}
            {servicios.concat(servicios).map((it, idx) => (
              <div className="galeria-item" key={idx}>
                <img src={it.img} alt={it.title} />
                <div className="galeria-texto">
                  <h3>{it.title}</h3>
                  <p>{it.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer id="contacto">
        <div className="contenedor">
            <h3>Contáctanos</h3>
            <p>¿Listo para empezar tu próximo proyecto con nosotros?</p>
            <p>Email: <a href="mailto:vitalmoto.sistemas@outlook.com">vitalmoto.sistemas@outlook.com</a> | Teléfono: +58 412-805608</p>
        </div>
      </footer>

      {/* --- AVISO DE EMPLEO (MODAL RESPONSIVE) --- */}
      {showHiringModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', 
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          padding: '15px' // Padding externo para asegurar margen en móviles
        }}>
          <div style={{
            backgroundColor: '#fff', 
            borderRadius: '16px', 
            padding: '25px 20px', // Padding interno reducido ligeramente
            maxWidth: '450px',     // Ancho máximo un poco más angosto
            width: '100%',         // Ocupa el ancho disponible hasta el máximo
            maxHeight: '85vh',     // IMPORTANTE: Altura máxima del 85% de la pantalla
            overflowY: 'auto',     // IMPORTANTE: Permite scroll si el contenido es muy alto
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button 
              onClick={() => setShowHiringModal(false)}
              style={{
                position: 'absolute', top: '10px', right: '10px',
                background: '#f1f1f1', border: 'none', borderRadius: '50%',
                width: '30px', height: '30px', fontSize: '1.1rem', 
                cursor: 'pointer', color: '#555', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >✕</button>

            {/* Logo */}
            <div style={{marginBottom: '10px'}}>
              <img 
                src="/img/Untitled 01 Artboard 1.png" 
                alt="VitalMoto Logo" 
                style={{width: '80px', height: 'auto', objectFit: 'contain'}} 
              />
            </div>

            <h2 style={{color: '#2c3e50', marginBottom: '8px', fontSize: '1.4rem', fontWeight: '800', lineHeight: '1.2'}}>
              Forma parte de nuestro gran equipo VM
            </h2>
            
            <p style={{color: '#546e7a', fontSize: '0.95rem', marginBottom: '15px'}}>
              Estamos en busca de personal calificado en las siguientes áreas:
            </p>

            {/* GRID DE VACANTES (Badges) */}
            <div style={{
              display: 'flex', 
              flexWrap: 'wrap', 
              justifyContent: 'center', 
              gap: '8px', 
              marginBottom: '20px'
            }}>
              {vacantes.map((vacante, index) => (
                <span key={index} style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  padding: '6px 12px',
                  borderRadius: '15px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  border: '1px solid #e2e8f0',
                  whiteSpace: 'nowrap' // Evita que los textos cortos se rompan feo
                }}>
                  {vacante}
                </span>
              ))}
            </div>

            {/* Caja del correo */}
            <div style={{
              backgroundColor: '#fff7ed', 
              padding: '12px', 
              borderRadius: '10px', 
              marginBottom: '20px', 
              border: '2px dashed #fdba74'
            }}>
              <p style={{margin: 0, fontSize: '0.85rem', color: '#78909c', marginBottom: '3px', fontWeight: '600'}}>
                Envía tu CV al correo:
              </p>
              <a href="mailto:vitalmoto.rrhh@outlook.com" style={{
                fontSize: '1rem', fontWeight: 'bold', color: '#e67e22', textDecoration: 'none', display: 'block', wordBreak: 'break-all'
              }}>
                vitalmoto.rrhh@outlook.com
              </a>
            </div>

            <button
              onClick={() => setShowHiringModal(false)}
              style={{
                backgroundColor: '#2c3e50', 
                color: 'white', 
                border: 'none', 
                padding: '12px 30px', 
                borderRadius: '50px', 
                fontSize: '0.95rem', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                boxShadow: '0 4px 6px rgba(50, 50, 93, 0.11)',
                width: '100%', // Botón ancho completo en móvil para facilitar el clic
                maxWidth: '200px'
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}