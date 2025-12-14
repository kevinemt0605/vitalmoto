Admin panel access

1) Cómo dar acceso de administrador a un usuario
- Ve a la consola de Firebase -> Firestore -> collection `users` -> abre el documento del usuario (su uid).
- Añade o edita el campo `role` y pon su valor a `admin`.

2) Cómo acceder al panel de administración
- El panel está disponible en la ruta `/admin` de tu app (por ejemplo: `https://tu-dominio.com/admin` o `http://localhost:3000/admin` durante desarrollo).
- NO hay ningún enlace visible a esta ruta en la UI por seguridad. Para entrar debes:
  - Iniciar sesión con el usuario que tenga `role: 'admin'` en Firestore.
  - Navegar manualmente a `/admin` (escribiendo la URL en la barra del navegador).

3) Seguridad
- El componente comprueba el campo `users/{uid}.role === 'admin'` antes de mostrar datos.
- Asegúrate de no permitir a clientes escribir su propio `role` en Firestore; asigna roles solo vía servidor (Cloud Function o Firebase Admin SDK).

4) Despliegue y pruebas
- Para probar localmente:
  - Inicia la app con `npm start`.
  - Loguéate con la cuenta de administrador.
  - Navega a `http://localhost:3000/admin`.

5) Extensiones futuras
- Añadir paginación, filtros, export CSV, acciones (promover/demitir admin), métricas avanzadas.
- Implementar endpoints admin server-side para operaciones sensibles y audit logging.
