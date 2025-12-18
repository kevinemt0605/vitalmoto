import React from 'react';

export default function Terms(){
  
  const handleClose = () => {
    // Intenta cerrar la pestaña
    window.close();
    // Nota: Algunos navegadores bloquean window.close() si no fue abierto por script.
    // Por eso dejamos el mensaje abajo.
  };

  return (
    <main className="contenedor" style={{padding: '2rem 0', color: '#333'}}>
      <div style={{background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)'}}>
        <h1 style={{color: 'var(--color-primario)', textAlign: 'center', marginBottom: '1.5rem'}}>CONDICIONES DEL CONTRATO DE SERVICIOS DE VITAL MOTO 24/7</h1>
        
        <div style={{textAlign: 'justify', lineHeight: '1.8'}}>
          
          <h3 style={{color: 'var(--color-secundario)', marginTop: '1.5rem'}}>PRESTACIÓN DE SERVICIOS BÁSICOS</h3>
          <p>
            Vital Moto 24/7 conviene en prestar el servicio al Afiliado, por la sustitución de piezas debido a cualquier evento que sufra la moto afiliada, como consecuencia de cualquiera de los siguientes hechos ocurridos durante el período de vigencia del Contrato de Servicios y dentro del territorio del Área Metropolitana de Caracas:
          </p>
          <ol style={{marginLeft: '20px', marginBottom: '1rem'}}>
            <li>Accidente.</li>
            <li>Accidente de tránsito.</li>
            <li>Cualquier otro riesgo que no esté expresamente contemplado en las exoneraciones de responsabilidad del presente Contrato de servicios.</li>
          </ol>

          <h3 style={{color: 'var(--color-secundario)', marginTop: '1.5rem'}}>EXONERACIONES DE RESPONSABILIDAD</h3>
          <p>Este servicio no se prestará en las siguientes situaciones:</p>
          <ol style={{marginLeft: '20px', marginBottom: '1rem'}}>
            <li>Pérdidas, gastos o daños que sean consecuencia de: vicio propio o intrínseco, uso o desgaste, oxidación, corrosión, deterioro gradual, rotura mecánica, combustión espontánea, moho, factores climáticos, cambios de temperatura, humedad, efecto de luz, descoloramiento, roedores, insectos, cualquier procedimiento de calefacción, refrigeración o desecación al cual hubiese sido sometida la moto afiliada.</li>
            <li>Pérdidas, gastos o daños que sean consecuencia o que se den en el curso de: guerra, invasión, acto de enemigo extranjero, hostilidades u operaciones bélicas, insubordinación militar, levantamiento militar, insurrección, rebelión, revolución, guerra civil, poder militar o usurpación de poder, terrorismo, etc.</li>
            <li>Pérdidas por motín, conmoción civil, disturbios populares y saqueos, disturbios laborales y conflictos de trabajo y daños maliciosos.</li>
            <li>Pérdidas por nacionalización, confiscación, incautación, requisa, decomiso, embargo, expropiación, destrucción o daño por orden de cualquier gobierno.</li>
            <li>Daños por ondas de presión causadas por aviones u otros objetos aéreos.</li>
            <li>Daños por terremoto, maremoto, tsunami, erupción volcánica, inundación, meteorito o cualquier otra convulsión de la naturaleza.</li>
            <li>Daños por fisión o fusión nuclear, radiaciones ionizantes y contaminantes radioactivos.</li>
            <li>Pérdidas indirectas, pérdidas de las ganancias producidas como consecuencia del Accidente o lucro cesante.</li>
            <li>Las pérdidas o daños de letreros o dibujos.</li>
            <li>La reparación de las fallas o roturas mecánicas o eléctricas que no sean consecuencia directa de un Accidente cubierto.</li>
            <li>Daños preexistentes.</li>
            <li>Pérdida o daño de pertenencias del Afiliado en el interior de la moto.</li>
            <li>Desaparición o daños a la moto afiliada como consecuencia de apropiación indebida.</li>
            <li>Gastos de estacionamiento o depositaria judicial y servicios de grúa.</li>
            <li>Avalúo del vehículo por las autoridades competentes.</li>
            <li>La pérdida o daño de los accesorios no originales de la moto afiliada.</li>
            <li>Daño moral y Gastos de recuperación.</li>
          </ol>

          <h3 style={{color: 'var(--color-secundario)', marginTop: '1.5rem'}}>OTRAS EXONERACIONES DE RESPONSABILIDAD</h3>
          <p>Vital Moto 24/7 quedará exonerado de responsabilidad si:</p>
          <ol style={{marginLeft: '20px', marginBottom: '1rem'}}>
            <li>El conductor se encuentra bajo influencia de alcohol o drogas.</li>
            <li>Se participa en carreras, acrobacias o pruebas de velocidad.</li>
            <li>El conductor carece de título o licencia vigente.</li>
            <li>La moto es conducida por menores sin permiso especial.</li>
            <li>Hay infracción de estipulaciones sobre peso, medidas y carga.</li>
            <li>Daños por deslizamiento de carga o transporte en naves no acondicionadas.</li>
            <li>La moto no mantiene su diseño original o condiciones de seguridad exigidas por ley.</li>
            <li>La moto es modificada en relación con el uso declarado en el registro.</li>
            <li>Reclamos por daños extemporáneos no notificados a tiempo.</li>
            <li>Incumplimiento de las obligaciones en caso de siniestro.</li>
            <li>Traspaso del interés del Afiliado sin cumplimiento de preceptos legales.</li>
          </ol>

          <h3 style={{color: 'var(--color-secundario)', marginTop: '1.5rem'}}>PROCEDIMIENTO EN CASO DE SINIESTRO</h3>
          <p>Al ocurrir cualquier Evento, el Afiliado deberá:</p>
          <ol style={{marginLeft: '20px', marginBottom: '1rem'}}>
            <li>Tomar providencias para evitar pérdidas ulteriores.</li>
            <li>Dar aviso a Vital Moto 24/7 dentro de los 30 minutos siguientes.</li>
            <li>Llevar la moto a Vital Moto 24/7 dentro de los 2 días hábiles siguientes para el ajuste de daños.</li>
            <li>Proporcionar recaudos: Copia certificada de actuaciones de tránsito, Informe de Bomberos (si aplica), Copia de Cédula del propietario y conductor, Licencia y Certificado Médico vigentes, Carta de autorización (si es conductor ocasional), Copia de título o carnet de circulación.</li>
          </ol>

          <div style={{marginTop: '3rem', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '20px'}}>
            <button 
              onClick={handleClose} 
              className="btn-primario"
              style={{fontSize: '1.1rem', padding: '12px 24px'}}
            >
              Cerrar Pestaña y Volver al Registro
            </button>
            <p style={{fontSize: '0.85rem', color: '#999', marginTop: '10px'}}>
              (Si la pestaña no se cierra automáticamente, por favor ciérrela manualmente para continuar)
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}