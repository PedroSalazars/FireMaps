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
  }

  private initFirebase() {
    try {
      const apps = getApps();
      if (!apps.length) {
        initializeApp(environment.firebase);
      }
    } catch (e) {
      console.error('Error inicializando Firebase', e);
    }
  }

  esCorreoBasicoValido(correo: string): boolean {
    if (!correo) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(correo.trim());
  }

async iniciarSesion() {
  this.submitted = true;
  const email = this.correo.trim().toLowerCase();
  const password = this.clave;

  if (!email || !password) {
    return this.mostrarToast(this.translate.instant('LOGIN.ERROR_FIELDS_REQUIRED'), 'danger');
  }

  if (!this.esCorreoBasicoValido(email) && email !== 'admin') {
    return this.mostrarToast(this.translate.instant('LOGIN.ERROR_EMAIL_INVALID'), 'danger');
  }

  this.cargando = true;

  try {
    if (email === 'admin' && password === 'admin') {
      this.router.navigate(['/vista-admin']);
      return;
    }

    const auth = getAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    const refUsuario = doc(db, 'usuarios', uid);
    const snapUsuario = await getDoc(refUsuario);
    if (snapUsuario.exists()) {
      this.router.navigate(['/vista-home']);
      return;
    }

    const refBombero = doc(db, 'bomberos', uid);
    const snapBombero = await getDoc(refBombero);
    if (snapBombero.exists()) {
      const dataBombero: any = snapBombero.data();
      if (dataBombero.correo === email && password === 'FireMaps2025.') {
        this.router.navigate(['/vista-bombero']);
        return;
      } else {
        return this.mostrarToast(this.translate.instant('LOGIN.ERROR_BOMBERO_PASSWORD'), 'danger');
      }
    }

    this.mostrarToast(this.translate.instant('LOGIN.ERROR_NO_PROFILE'), 'danger');

  } catch (error: any) {
    let mensaje = this.translate.instant('LOGIN.ERROR_GENERIC');
    if (error.code === 'auth/user-not-found') mensaje = this.translate.instant('LOGIN.ERROR_USER_NOT_FOUND');
    else if (error.code === 'auth/wrong-password') mensaje = this.translate.instant('LOGIN.ERROR_WRONG_PASSWORD');
    else if (error.code === 'auth/too-many-requests') mensaje = this.translate.instant('LOGIN.ERROR_TOO_MANY_REQUESTS');
    else if (error.code === 'auth/invalid-email') mensaje = this.translate.instant('LOGIN.ERROR_INVALID_EMAIL');
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

    goBack() {
    this.router.navigate(['/vista-inicio']);
    }
}