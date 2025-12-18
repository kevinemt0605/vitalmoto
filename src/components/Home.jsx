import React from 'react';

export default function Home(){
  return (
    <main>
      <section id="empresa">
        <div className="contenedor">
            <h2>Sobre Nosotros</h2>
            <p>Somos un equipo de mecánicos apasionados por las motocicletas, dedicados a la reparación, mantenimiento y personalización de alta calidad. Más que un taller, somos el centro de confianza para todo motero que busca el mejor cuidado para su máquina. Nos distingue la transparencia, la profesionalidad y la atención personalizada: cada moto es única y merece lo mejor.</p>
        </div>
      </section>

      <section id="galeria">
        <div className="galeria-contenedor">
          <div className="galeria-track">
            {[
              {title:'Diagnóstico y Reparación', img:'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Solucionamos problemas complejos de motor, sistema eléctrico, frenos y suspensión.'},
              {title:'Personalización', img:'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Transformamos tu moto: modificaciones estéticas y mejoras de rendimiento a tu medida.'},
              {title:'Mantenimiento Preventivo', img:'https://images.unsplash.com/photo-1517048676732-d65bc937f952?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Revisiones periódicas, cambio de aceite, filtros y bujías para tu seguridad y la vida útil de tu moto.'},
              {title:'Transparencia y Profesionalidad', img:'https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Explicamos cada trabajo y ofrecemos presupuestos claros, sin sorpresas.'},
              {title:'Misión', img:'https://images.unsplash.com/photo-1587440871875-191322ee64b0?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Ser el soporte fundamental para cada motociclista en Venezuela, garantizando movilidad y seguridad 24/7 con repuestos y servicio técnico de calidad.'},
              {title:'Visión', img:'https://images.unsplash.com/photo-1517048676732-d65bc937f952?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Ser la empresa líder en cambio de piezas y servicios para motos en Venezuela, reconocidos por la rapidez, confianza y calidad 24/7.'}
            ].concat([
              {title:'Diagnóstico y Reparación', img:'https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Solucionamos problemas complejos de motor, sistema eléctrico, frenos y suspensión.'},
              {title:'Personalización', img:'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Transformamos tu moto: modificaciones estéticas y mejoras de rendimiento a tu medida.'},
              {title:'Mantenimiento Preventivo', img:'https://images.unsplash.com/photo-1517048676732-d65bc937f952?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Revisiones periódicas, cambio de aceite, filtros y bujías para tu seguridad y la vida útil de tu moto.'},
              {title:'Transparencia y Profesionalidad', img:'https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Explicamos cada trabajo y ofrecemos presupuestos claros, sin sorpresas.'},
              {title:'Misión', img:'https://images.unsplash.com/photo-1587440871875-191322ee64b0?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Ser el soporte fundamental para cada motociclista en Venezuela, garantizando movilidad y seguridad 24/7 con repuestos y servicio técnico de calidad.'},
              {title:'Visión', img:'https://images.unsplash.com/photo-1517048676732-d65bc937f952?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=600', text:'Ser la empresa líder en cambio de piezas y servicios para motos en Venezuela, reconocidos por la rapidez, confianza y calidad 24/7.'}
            ])
            .map((it,idx)=> (
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

      <footer id="contacto">
        <div className="contenedor">
            <h3>Contáctanos</h3>
            <p>¿Listo para empezar tu próximo proyecto con nosotros?</p>
            <p>Email: <a href="mailto:vitalmoto.sistemas@outlook.com">vitalmoto.sistemas@outlook.com</a> | Teléfono: +58 412-805608</p>
        </div>
      </footer>
    </main>
  )
}
