# VitalMoto (React + Firebase)

Este proyecto es una re-implementación del sistema original, ahora completamente frontend en React y usando Firebase para autenticación, base de datos y almacenamiento.

Características implementadas:
- Registro e inicio de sesión con Firebase Authentication.
- Perfil de usuario con subida y compresión de foto de perfil (cliente-side) y guardado en Firebase Storage + Firestore.
- Registro de vehículo con subida de DOS imágenes: documentos y foto de la moto (ambas comprimidas antes de subir).
- Arquitectura con componentes reutilizables, React Router y estructura escalable.

Importante sobre el JSON de credenciales:
- Para usar Firebase desde el frontend NO necesitas el service account JSON. Debes usar la configuración web de Firebase (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). Coloca esas variables en un archivo `.env` en la raíz del proyecto como se muestra en `.env.example`.
- Si absolutamente necesitas usar un `serviceAccountKey.json` (para tareas administrativas), NUNCA lo pongas en el frontend. Si lo incluyes aquí para pruebas locales, colócalo en la raíz del proyecto con el nombre `serviceAccountKey.json` y no lo subas a git (.gitignore ya lo excluye). Recomendación segura: usa Cloud Functions o un servidor seguro con Firebase Admin.

Instalación y ejecución (Windows PowerShell):

1. Copia `.env.example` a `.env` y completa las variables con tu configuración de Firebase Web.

2. Instala dependencias y arranca:

```powershell
npm install
npm start
```

Estructura principal:
- `public/` - `index.html`
- `src/` - código fuente
  - `src/firebase.js` - inicialización de Firebase (lee variables del entorno)
  - `src/components/` - componentes `Register`, `Login`, `Profile`, `VehicleForm`

  Assets (logo / imágenes)
  - Para que el aspecto sea idéntico al frontend original, copia la carpeta `frontend/img` del proyecto antiguo a `public/img` del nuevo proyecto. Por ejemplo:

    ```powershell
    # Asumiendo que tu carpeta original está en c:\Users\HOME\Documents\KevinDocs\vitalmoto\frontend\img
    Copy-Item -Path "c:\Users\HOME\Documents\KevinDocs\vitalmoto\frontend\img\*" -Destination "c:\Users\HOME\Documents\KevinDocs\vitalmoto_v2\public\img" -Recurse
    ```

    Esto colocará `Untitled 05 Artboard 1 Copy 3WN.png` y otras imágenes en `public/img` para que los componentes React las utilicen exactamente como en el original.

Notas de seguridad:
- Las reglas de Firestore y Storage deben proteger el acceso (ej.: solo el uid del usuario puede escribir sus archivos/colecciones). Configura reglas desde la consola de Firebase.
- No expongas claves sensibles en repositorios públicos.

Siguientes pasos recomendados:
- Añadir validaciones de formularios más robustas y tests.
- Configurar reglas de seguridad en Firestore/Storage.
- Agregar soporte para roles (admin) y panel administrativo si se requiere.
