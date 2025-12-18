import React from 'react';

export default function Home(){
  // Estado para controlar la visibilidad del aviso de empleo
  const [showHiringModal, setShowHiringModal] = React.useState(true);

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

      {/* --- AVISO DE EMPLEO (MODAL) --- */}
      {showHiringModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', 
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#fff', 
            borderRadius: '16px', 
            padding: '30px',
            maxWidth: '480px', 
            width: '100%', 
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button 
              onClick={() => setShowHiringModal(false)}
              style={{
                position: 'absolute', top: '15px', right: '15px',
                background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#999'
              }}
            >✕</button>

            <div style={{marginBottom: '15px'}}>
              <img 
                src="/img/Untitled 01 Artboard 1.png" 
                alt="VitalMoto Logo" 
                style={{width: '120px', height: 'auto', objectFit: 'contain'}} 
              />
            </div>

            <h2 style={{color: '#2c3e50', marginBottom: '10px', fontSize: '1.8rem', fontWeight: '800'}}>
              ¡Estamos Buscando Empleados!
            </h2>

            <p style={{color: '#546e7a', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '25px'}}>
              ¿Tienes experiencia y pasión por las motos? En <strong>VitalMoto</strong> estamos expandiendo nuestro equipo y queremos conocerte.
            </p>

            <div style={{
              backgroundColor: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '10px', 
              marginBottom: '25px', 
              border: '2px dashed #cfd8dc'
            }}>
              <p style={{margin: 0, fontSize: '0.9rem', color: '#78909c', marginBottom: '5px', fontWeight: '600'}}>
                Envíanos tu CV actualizado a:
              </p>
              <a href="mailto:vitalmoto.rrhh@outlook.com" style={{
                fontSize: '1.3rem', fontWeight: 'bold', color: '#e67e22', textDecoration: 'none', display: 'block', wordBreak: 'break-all'
              }}>
                vitalmoto.rrhh@outlook.com
              </a>
            </div>

            <button
              onClick={() => setShowHiringModal(false)}
              style={{
                backgroundColor: '#2c3e50', color: 'white', border: 'none', padding: '14px 40px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.2s', boxShadow: '0 4px 6px rgba(50, 50, 93, 0.11)'
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.02)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </main>
  )
}