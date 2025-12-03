import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';

// Firebase core
import { initializeApp, getApps } from 'firebase/app';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase-config';

// Firebase Auth
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';

// Environment
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-vista-admin',
  templateUrl: './vista-admin.page.html',
  styleUrls: ['./vista-admin.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class VistaAdminPage implements OnInit {

  bomberos: any[] = [];

  nuevoBombero = {
    nombre: '',
    apellidos: '',
    rut: '',
    telefono: '',
    correo: '',
    rol: 'bombero',
    clave: 'FireMaps2025.',   // 👈 clave fija
    creadoEn: '',
    uid: ''
  };

  mostrarRol: boolean = false;
  submitted = false;
  mensaje = '';
  tipoMensaje: 'ok' | 'error' | '' = '';

  constructor(private alertController: AlertController) {
    this.initFirebase();
  }

  ngOnInit() {
    this.cargarBomberos();
  }

  private initFirebase() {
    try {
      const apps = getApps();
      if (!apps.length) {
        initializeApp(environment.firebase);
        console.log('DEBUG ADMIN: Firebase inicializado');
      }
    } catch (e) {
      console.error('DEBUG ADMIN: Error inicializando Firebase', e);
    }
  }

  async cargarBomberos() {
    const snapshot = await getDocs(collection(db, 'bomberos'));
    this.bomberos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async crearBombero() {
    this.submitted = true;

    if (!this.nuevoBombero.nombre || !this.nuevoBombero.apellidos || !this.nuevoBombero.rut || !this.nuevoBombero.correo) {
      this.setMensaje('error', 'Por favor completa los campos obligatorios.');
      await this.mostrarAlerta('Campos incompletos', 'Por favor completa todos los campos.');
      return;
    }

    try {
      const auth = getAuth();

      // 1) Crear usuario en Firebase Auth con clave fija
      const cred = await createUserWithEmailAndPassword(
        auth,
        this.nuevoBombero.correo.trim().toLowerCase(),
        'FireMaps2025.'
      );

      const uid = cred.user.uid;

      // 2) Guardar datos en Firestore con el mismo UID
      const bombero = {
        uid,
        nombre: this.nuevoBombero.nombre,
        apellidos: this.nuevoBombero.apellidos,
        rut: this.nuevoBombero.rut,
        telefono: this.nuevoBombero.telefono,
        correo: this.nuevoBombero.correo.trim().toLowerCase(),
        rol: 'bombero',
        clave: 'FireMaps2025.',
        creadoEn: serverTimestamp()
      };

      await setDoc(doc(db, 'bomberos', uid), bombero);

      this.setMensaje('ok', 'Bombero registrado correctamente.');
      this.resetFormulario();
      this.cargarBomberos();
    } catch (error: any) {
      console.error('DEBUG ADMIN: Error creando bombero', error);
      let mensaje = 'No se pudo registrar el bombero.';
      if (error.code === 'auth/email-already-in-use') {
        mensaje = 'Este correo ya está registrado.';
      }
      this.setMensaje('error', mensaje);
    }
  }

  async editarBombero(index: number) {
    const bombero = this.bomberos[index];
    this.nuevoBombero = { ...bombero, clave: 'FireMaps2025.' };
    this.bomberos.splice(index, 1);
  }

  async actualizarBombero(id: string) {
    try {
      const ref = doc(db, 'bomberos', id);
      await updateDoc(ref, {
        nombre: this.nuevoBombero.nombre,
        apellidos: this.nuevoBombero.apellidos,
        rut: this.nuevoBombero.rut,
        telefono: this.nuevoBombero.telefono,
        correo: this.nuevoBombero.correo.trim().toLowerCase(),
        rol: 'bombero',
        clave: 'FireMaps2025.'
      });
      this.setMensaje('ok', 'Bombero actualizado correctamente.');
      this.resetFormulario();
      this.cargarBomberos();
    } catch (e) {
      console.error('DEBUG ADMIN: Error actualizando bombero', e);
      this.setMensaje('error', 'No se pudo actualizar el bombero.');
    }
  }

  async eliminarBombero(index: number) {
    try {
      const id = this.bomberos[index].id;
      await deleteDoc(doc(db, 'bomberos', id));
      this.setMensaje('ok', 'Bombero eliminado correctamente.');
      this.cargarBomberos();
    } catch (e) {
      console.error('DEBUG ADMIN: Error eliminando bombero', e);
      this.setMensaje('error', 'No se pudo eliminar el bombero.');
    }
  }

  private resetFormulario() {
    this.submitted = false;
    this.nuevoBombero = {
      nombre: '',
      apellidos: '',
      rut: '',
      telefono: '',
      correo: '',
      rol: 'bombero',
      clave: 'FireMaps2025.',
      creadoEn: '',
      uid: ''
    };
  }

  private setMensaje(tipo: 'ok' | 'error', texto: string) {
    this.tipoMensaje = tipo;
    this.mensaje = texto;
  }

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
      cssClass: 'custom-alert'
    });
    await alert.present();
  }
}
