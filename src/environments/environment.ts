// Configuración del entorno de desarrollo FireMaps

export const environment = {
  production: false,

  // 🔑 Clave de Google Maps
  googleMapsApiKey: 'AIzaSyBtUALFct2gkspRZ1IZt1dcmA3wJbgENMo',

  // 🔥 Configuración de Firebase (según tu proyecto)
  firebase: {
    apiKey: "AIzaSyB2FQOMy323DMki8UyTrLr1i1LTCWBiqzo",
    authDomain: "firemaps-38e99.firebaseapp.com",
    projectId: "firemaps-38e99",
    storageBucket: "firemaps-38e99.firebasestorage.app",
    messagingSenderId: "64009841672",
    appId: "1:64009841672:web:7e32cb48121c893b66b5bd"
  }
};

/*
 * Para depuración en modo desarrollo, puedes importar la siguiente línea
 * para ignorar errores de zone.js relacionados con el stack trace.
 * (No la habilites en producción).
 */
// import 'zone.js/plugins/zone-error';
