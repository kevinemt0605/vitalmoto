const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// --- 1. FUNCIÓN DE CONCILIACIÓN DE PAGOS (HTTPS - GEN 2) ---
exports.conciliarPagoBDV = onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
      const { 
        cedulaPagador, telefonoPagador, referencia, 
        fechaPago, importe, bancoOrigen, 
        serviceId, userId
      } = req.body;

      // VALIDACIÓN 1: ANTI-FRAUDE LOCAL
      // Verificamos si esta referencia ya fue registrada exitosamente en NUESTRA base de datos.
      const refCheck = await admin.firestore().collection("payments")
        .where("reference", "==", referencia)
        .where("status", "==", "approved")
        .get();

      if (!refCheck.empty) {
        return res.status(200).json({ 
            success: false, 
            message: "Esta referencia ya fue utilizada y registrada anteriormente en VitalMoto." 
        });
      }

      // --- CONFIGURACIÓN PRODUCCIÓN ---
      const urlBDV = "https://bdvconciliacion.banvenez.com/getMovement";
      const apiKeyProd = "DD28B79FACEDACC587C0A13A6B7BDC4F"; // Tu API Key
      const telefonoEmpresa = "04128056008"; // Tu Teléfono

      const headers = {
        "Content-Type": "application/json",
        "X-API-Key": apiKeyProd 
      };

      const bodyBDV = {
        "cedulaPagador": cedulaPagador,   
        "telefonoPagador": telefonoPagador, 
        "telefonoDestino": telefonoEmpresa,
        "referencia": referencia,         
        "fechaPago": fechaPago,           
        "importe": importe,               
        "bancoOrigen": bancoOrigen,       
        "reqCed": false 
      };

      console.log("Consultando BDV:", JSON.stringify(bodyBDV));

      const response = await axios.post(urlBDV, bodyBDV, { headers });
      const data = response.data;
      console.log("Respuesta BDV:", data);

      // --- ANÁLISIS DE RESPUESTA ---
      const code = data.code;
      const msg = data.message || "";
      
      const esExitoso = code === 1000;
      // Si el banco dice "conciliado anteriormente" pero NO está en nuestra DB (pasó la validación 1),
      // significa que la referencia se usó para otra cosa ajena a la app o es un error. La rechazamos.
      const yaConciliadoBanco = code === 1010 && msg.toLowerCase().includes("conciliado anteriormente");

      if (esExitoso) {
        // A. Guardar en historial
        await admin.firestore().collection("payments").add({
            userId: userId || "anonimo",
            serviceId: serviceId || "n/a",
            amount: importe,
            reference: referencia,
            bankResponse: data,
            status: "approved",
            concept: 'Membresía Diaria',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentDate: fechaPago
        });

        // B. Activar Membresía al Usuario
        if (userId) {
            await admin.firestore().collection("users").doc(userId).update({
                hasPaid: true,
                lastPaymentDate: new Date().toISOString(),
                lastPaymentRef: referencia
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: "Pago verificado exitosamente. Membresía activada.", 
            data: data 
        });

      } else {
        // --- TRADUCCIÓN DE ERRORES AL USUARIO ---
        let errorUser = "No se pudo verificar el pago.";
        const msgLower = msg.toLowerCase();
        // A veces el detalle viene en data.data o en data directamente
        const dataDetail = (data.data || "").toString().toLowerCase(); 

        if (yaConciliadoBanco) {
            errorUser = "Error: Este pago móvil ya fue procesado por el banco anteriormente (Referencia duplicada).";
        } else if (dataDetail.includes("referencia") || msgLower.includes("referencia")) {
            errorUser = "La REFERENCIA no existe o es incorrecta.";
        } else if (dataDetail.includes("fecha")) {
            errorUser = "La FECHA no coincide. Verifica el día exacto.";
        } else if (dataDetail.includes("monto") || dataDetail.includes("importe") || msgLower.includes("monto")) {
            errorUser = "Referencia encontrada, pero el MONTO es incorrecto.";
        } else if (dataDetail.includes("cedula")) {
            errorUser = "La CÉDULA del pagador no coincide.";
        } else if (dataDetail.includes("telefono")) {
            errorUser = "El TELÉFONO de origen no coincide.";
        } else if (dataDetail.includes("banco")) {
            errorUser = "El BANCO de origen es incorrecto.";
        } else if (msgLower.includes("registro solicitado no existe")) {
            errorUser = "Pago no encontrado. Verifica referencia, banco y fecha.";
        }

        return res.status(200).json({ 
            success: false, 
            message: errorUser,
            details: msg 
        });
      }

    } catch (error) {
      console.error("Error Servidor:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error de conexión con el banco.",
        error: error.message 
      });
    }
  });
});

// --- 2. REINICIO AUTOMÁTICO DE MEMBRESÍA (CRON JOB - GEN 2) ---
// Se ejecuta todos los días a las 3:00 AM hora de Venezuela
exports.resetMembresiaDiaria = onSchedule(
  {
    schedule: "0 3 * * *", // <--- AQUI CAMBIAS LA HORA (Minuto Hora * * *)
    timeZone: "America/Caracas",
  },
  async (event) => {
    console.log("Iniciando reinicio diario de membresías...");
    
    const db = admin.firestore();
    // Buscamos solo los que pagaron para ahorrar recursos
    const snapshot = await db.collection('users').where('hasPaid', '==', true).get();

    if (snapshot.empty) {
      console.log('No hay usuarios activos para reiniciar.');
      return null;
    }

    // Firestore permite actualizar en lotes de 500
    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    snapshot.forEach(doc => {
        // Ponemos hasPaid en false
        batchArray[batchIndex].update(doc.ref, { hasPaid: false });
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });

    await Promise.all(batchArray.map(batch => batch.commit()));

    console.log(`Se reinició la membresía de ${snapshot.size} usuarios.`);
    return null;
});