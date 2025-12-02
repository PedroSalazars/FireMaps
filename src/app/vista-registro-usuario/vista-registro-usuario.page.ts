import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';

// Firebase core & auth
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Firestore
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase-config';

// Environment
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-registro-usuario',
  templateUrl: './registro-usuario.page.html',
  styleUrls: ['./registro-usuario.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class RegistroUsuarioPage implements OnInit {

  nombre = '';
  apellidos = '';
  rut = '';
  telefono = '';
  correo = '';
  clave = '';
  confirmarClave = '';

  submitted = false;

  constructor(private alertController: AlertController) {
    this.initFirebase();
  }

  ngOnInit() {
    console.log('DEBUG: RegistroUsuarioPage cargada');
  }

  // ================================
  //  INIT FIREBASE
  // ================================
  private initFirebase() {
    try {
      const apps = getApps();
      if (!apps.length) {
        initializeApp(environment.firebase);
        console.log('DEBUG REGISTRO: Firebase inicializado en RegistroUsuarioPage');
      } else {
        console.log('DEBUG REGISTRO: Firebase ya estaba inicializado');
      }
    } catch (e) {
      console.error('DEBUG REGISTRO: Error inicializando Firebase', e);
    }
  }

  // ================================
  //  VALIDACIONES
  // ================================
  esRutValido(rut: string): boolean {
    if (!rut) return false;
    const limpio = rut.replace(/\./g, '').trim();
    const rutRegex = /^[0-9]+-[0-9kK]{1}$/;
    return rutRegex.test(limpio);
  }

  esTelefonoValido(telefono: string): boolean {
    if (!telefono) return false;
    const soloNumeros = /^[0-9]+$/.test(telefono);
    return soloNumeros && telefono.length >= 8 && telefono.length <= 12;
  }

  esCorreoBasicoValido(correo: string): boolean {
    if (!correo) return false;
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(correo.trim());
  }

  // ================================
  //  REGISTRO: AUTH + FIRESTORE
  // ================================
  async registrarUsuario() {
    this.submitted = true;
    console.log('DEBUG REGISTRO: registrarUsuario() llamado');

    // 1) Validaciones básicas
    if (
      !this.nombre ||
      !this.apellidos ||
      !this.rut ||
      !this.telefono ||
      !this.correo ||
      !this.clave ||
      !this.confirmarClave
    ) {
      await this.mostrarAlerta(
        'Campos incompletos',
        'Por favor completa todos los campos.'
      );
      return;
    }

    if (!this.esRutValido(this.rut)) {
      await this.mostrarAlerta(
        'RUT inválido',
        'El RUT ingresado no es válido.'
      );
      return;
    }

    if (!this.esTelefonoValido(this.telefono)) {
      await this.mostrarAlerta(
        'Teléfono inválido',
        'Revisa el número de teléfono.'
      );
      return;
    }

    if (!this.esCorreoBasicoValido(this.correo)) {
      await this.mostrarAlerta(
        'Correo inválido',
        'Ingresa un correo electrónico válido.'
      );
      return;
    }

    if (this.clave !== this.confirmarClave) {
      await this.mostrarAlerta(
        'Contraseñas incorrectas',
        'Las contraseñas no coinciden.'
      );
      return;
    }

    const emailNormalizado = this.correo.trim().toLowerCase();
    console.log('DEBUG REGISTRO: Datos validados. Email =', emailNormalizado);

    try {
      // 2) Crear usuario en AUTH
      const auth = getAuth();
      console.log('DEBUG REGISTRO: Llamando a Firebase Auth…');
      const cred = await createUserWithEmailAndPassword(auth, emailNormalizado, this.clave);
      console.log('DEBUG REGISTRO: Usuario Auth creado UID =', cred.user.uid);

      // 3) Guardar datos adicionales en FIRESTORE
      const uid = cred.user.uid;
      const ref = doc(db, 'usuarios', uid);

      const dataUsuario = {
        uid,
        nombre: this.nombre,
        apellidos: this.apellidos,
        rut: this.rut,
        telefono: this.telefono,
        correo: emailNormalizado,
        creadoEn: serverTimestamp(),
      };

      console.log('DEBUG REGISTRO: Guardando datos en Firestore:', dataUsuario);
      await setDoc(ref, dataUsuario);
      console.log('DEBUG REGISTRO: Documento usuarios/' + uid + ' creado en Firestore');

      // ✅ PopUp de EXITO
      await this.mostrarAlerta(
        'Usuario registrado con éxito 🎉',
        'Tu cuenta ha sido creada y guardada en Firebase.'
      );

      this.resetFormulario();

    } catch (error: any) {
      console.error('DEBUG REGISTRO: Error completo =>', error);

      let mensaje = 'El usuario no ha podido registrarse.';

      if (error.code === 'auth/email-already-in-use') {
        mensaje = 'El correo ya está registrado. Intenta iniciar sesión.';
      } else if (error.code === 'auth/weak-password') {
        mensaje = 'La contraseña es demasiado débil. Usa al menos 6 caracteres.';
      }

      // ❌ PopUp de ERROR
      await this.mostrarAlerta(
        'El usuario no ha podido registrarse ❌',
        mensaje
      );
    }
  }

  // ================================
  //  UTILIDADES
  // ================================
  private resetFormulario() {
    this.submitted = false;
    this.nombre = '';
    this.apellidos = '';
    this.rut = '';
    this.telefono = '';
    this.correo = '';
    this.clave = '';
    this.confirmarClave = '';
  }

  private async mostrarAlerta(header: string, message: string) {
    console.log('DEBUG ALERT:', header, message);

    try {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: ['OK'],
        cssClass: 'custom-alert'
      });

      await alert.present();
    } catch (e) {
      console.error('ERROR MOSTRANDO ALERTA:', e);
      // Fallback por si algo raro pasa con AlertController
      window.alert(`${header}\n\n${message}`);
    }
  }
}
