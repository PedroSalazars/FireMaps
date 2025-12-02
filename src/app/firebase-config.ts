// Inicialización central de Firebase para toda la app

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../environments/environment';

// Inicializamos Firebase solo una vez
let app;
if (!getApps().length) {
  app = initializeApp(environment.firebase);
  console.log('Firebase inicializado desde firebase-config.ts');
} else {
  app = getApps()[0];
  console.log('Firebase ya estaba inicializado (firebase-config.ts)');
}

// Exportamos Firestore para TODA la app
export const db = getFirestore(app);
