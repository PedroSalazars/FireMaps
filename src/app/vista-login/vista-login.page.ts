import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';

// Firebase App & Auth
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Firestore
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

// Environment
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-vista-login',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, TranslateModule],
  templateUrl: './vista-login.page.html',
  styleUrls: ['./vista-login.page.scss']
})
export class VistaLoginPage {

  correo = '';
  clave = '';

  submitted = false;
  cargando = false;

  constructor(
    private toastController: ToastController,
    private translate: TranslateService,
    private router: Router
  ) {
    const lang = localStorage.getItem('lang') || 'es';
    this.translate.setDefaultLang('es');
    this.translate.use(lang);

    this.initFirebase();
    console.log('DEBUG LOGIN: VistaLoginPage construida');
  }

  // ================================
  //  INIT FIREBASE
  // ================================
  private initFirebase() {
    try {
      const apps = getApps();
      if (!apps.length) {
        initializeApp(environment.firebase);
        console.log('DEBUG LOGIN: Firebase inicializado en VistaLoginPage');
      } else {
        console.log('DEBUG LOGIN: Firebase ya estaba inicializado (login)');
      }
    } catch (e) {
      console.error('DEBUG LOGIN: Error inicializando Firebase', e);
    }
  }

  // ================================
  //  VALIDACIONES
  // ================================
  esCorreoBasicoValido(correo: string): boolean {
    if (!correo) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(correo.trim());
  }
// ================================
//  INICIO DE SESIÓN
// ================================
async iniciarSesion() {
  this.submitted = true;

  const email = this.correo.trim().toLowerCase();
  const password = this.clave;

  console.log('DEBUG LOGIN: iniciarSesion() llamado con', email);

  // Validaciones básicas
  if (!email || !password) {
    return this.mostrarToast('Por favor completa todos los campos.', 'danger');
  }

  if (!this.esCorreoBasicoValido(email) && email !== 'admin') {
    return this.mostrarToast('El correo no es válido.', 'danger');
  }

  this.cargando = true;

  try {
    // Caso especial: admin/admin
    if (email === 'admin' && password === 'admin') {
      this.router.navigate(['/vista-admin']);
      return;
    }

    const auth = getAuth();
    let cred;

 // Intentar login normal con Firebase Auth
cred = await signInWithEmailAndPassword(auth, email, password);
const uid = cred.user.uid;
console.log('DEBUG LOGIN: login OK, UID =', uid);

// Buscar en colección usuarios
const refUsuario = doc(db, 'usuarios', uid);
const snapUsuario = await getDoc(refUsuario);

if (snapUsuario.exists()) {
  console.log('DEBUG LOGIN: Usuario encontrado en colección usuarios → vista-home');
  this.router.navigate(['/vista-home']);
  return;
}

    // Si no está en ninguna colección
    this.mostrarToast('No se encontró perfil asociado a este usuario.', 'danger');

  } catch (error: any) {
    console.error('DEBUG LOGIN: Error completo =>', error);

    let mensaje = 'No se pudo iniciar sesión.';
    if (error.code === 'auth/user-not-found') mensaje = 'Correo no registrado.';
    else if (error.code === 'auth/wrong-password') mensaje = 'Contraseña incorrecta.';
    else if (error.code === 'auth/too-many-requests') mensaje = 'Demasiados intentos, intenta más tarde.';
    else if (error.code === 'auth/invalid-email') mensaje = 'Correo inválido.';

    this.mostrarToast(mensaje, 'danger');
  } finally {
    this.cargando = false;
  }
}

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color
    });
    toast.present();
  }
}
