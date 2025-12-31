const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// Función que conecta VitalMoto con el Banco de Venezuela (Entorno QA)
exports.conciliarPagoBDV = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    // 1. Verificar método (Solo aceptamos POST)
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    try {
      const { 
        cedulaPagador, 
        telefonoPagador, 
        referencia, 
        fechaPago, 
        importe, 
        bancoOrigen,
        serviceId, // Puede ser un ID real o "MEMBRESIA_DIARIA"
        userId     // ID del usuario (Vital para actualizar el perfil)
      } = req.body;

      // 2. Configuración BDV (Entorno Calidad/QA según PDF)
      const urlBDV = "https://bdvconciliacionqa.banvenez.com:444/getMovement/v2"; // [cite: 13]
      const apiKeyQA = "96R7T1T5J2134T5YFC2GF15SDFG4BD1Z"; // [cite: 15]
      
      const headers = {
        "Content-Type": "application/json",
        "X-API-Key": apiKeyQA // [cite: 15]
      };

      // 3. Cuerpo de la petición (JSON estricto según PDF)
      const bodyBDV = {
        "cedulaPagador": cedulaPagador,   
        "telefonoPagador": telefonoPagador, 
        // OJO: En QA este número es OBLIGATORIO (ver PDF Pag 2 y 3). 
        // Cuando pases a Producción, pon aquí TU número real afiliado.
        "telefonoDestino": "04127141363", // [cite: 22, 47]
        "referencia": referencia,         
        "fechaPago": fechaPago,           
        "importe": importe,               
        "bancoOrigen": bancoOrigen,       
        "reqCed": false // [cite: 52]
      };

      // En produccion: 
      // Banco: 0102 - Venezuela
      // Cédula: V27037606
      // Teléfono: 04127141363
      // Fecha: 12/02/2023
      // Referencia: 12345678
      // Monto: 120.00 

      console.log("Enviando a BDV:", JSON.stringify(bodyBDV));

      // 4. Llamada al Banco
      const response = await axios.post(urlBDV, bodyBDV, { headers });
      const data = response.data;

      console.log("Respuesta BDV:", data);

      // 5. Validar Respuesta
      // Código 1000 = Éxito[cite: 24, 108]. 
      // Código 1010 con mensaje "conciliado" = Ya pagado (también es éxito)[cite: 90].
      const esExitoso = data.code === 1000;
      const yaPagado = data.code === 1010 && (data.message && data.message.toLowerCase().includes("conciliado"));

      if (esExitoso || yaPagado) {
        
        // --- ACCIÓN A: Actualizar Servicio (SOLO SI ES REPARACIÓN, NO MEMBRESÍA) ---
        if (serviceId && serviceId !== 'MEMBRESIA_DIARIA') {
            try {
              await admin.firestore().collection("services").doc(serviceId).update({
                status: "pagado_verificado",
                paymentDate: new Date().toISOString(),
                bdvData: data
              });
            } catch (err) {
              console.warn("No se pudo actualizar el servicio (quizás no existe), pero seguimos:", err.message);
            }
        }

        // --- ACCIÓN B: Guardar Auditoría (SIEMPRE) ---
        await admin.firestore().collection("payments").add({
            userId: userId || "anonimo",
            serviceId: serviceId || "n/a",
            amount: importe,
            reference: referencia,
            bankResponse: data,
            status: "approved",
            concept: serviceId === 'MEMBRESIA_DIARIA' ? 'Pago Membresía Diaria' : 'Servicio Taller',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // --- ACCIÓN C: Actualizar Perfil de Usuario (PARA EL ADMIN) ---
        // Esto activa el "Check Verde" y la fecha en tu panel de /admin
        if (userId) {
            try {
                await admin.firestore().collection("users").doc(userId).update({
                    hasPaid: true, // El usuario pasa a estado "Pagado"
                    lastPaymentDate: new Date().toISOString(),
                    lastPaymentRef: referencia
                });
            } catch (error) {
                console.error("Error actualizando perfil de usuario:", error);
            }
        }

        return res.status(200).json({ 
            success: true, 
            message: "Pago conciliado correctamente.", 
            data: data 
        });

      } else {
        // El banco dice que no existe o hay error en los datos
        return res.status(200).json({ 
            success: false, 
            message: "El banco no pudo verificar el pago.",
            details: data.message // [cite: 73]
        });
      }

    } catch (error) {
      console.error("Error interno:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Error de conexión con el servidor.",
        error: error.message 
      });
    }
  });
});