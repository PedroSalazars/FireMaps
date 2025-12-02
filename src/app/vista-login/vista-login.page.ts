import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, NavController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


// Firestore
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';



interface Usuario {
  nombre: string;
  apellido: string;
  correo: string;
  clave: string;
  rut: string;
  telefono: string;
  rol: string;
}

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
    private navCtrl: NavController,
    private translate: TranslateService
  ) {
    const lang = localStorage.getItem('lang') || 'es';
    this.translate.setDefaultLang('es');
    this.translate.use(lang);
  }

  esCorreoBasicoValido(correo: string): boolean {
    if (!correo) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(correo);
  }

  async iniciarSesion() {
    this.submitted = true;

    // Validaciones
    if (!this.correo || !this.clave) {
      const toast = await this.toastController.create({
        message: 'Por favor completa todos los campos.',
        duration: 2500,
        color: 'danger'
      });
      toast.present();
      return;
    }

    if (!this.esCorreoBasicoValido(this.correo)) {
      const toast = await this.toastController.create({
        message: 'El correo no es válido.',
        duration: 2500,
        color: 'danger'
      });
      toast.present();
      return;
    }

    this.cargando = true;

    try {
      // Query Firestore para buscar usuario por correo
      const usuariosRef = collection(db, 'usuarios');
      const q = query(usuariosRef, where('correo', '==', this.correo.trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        const toast = await this.toastController.create({
          message: 'Correo no encontrado.',
          duration: 2500,
          color: 'danger'
        });
        toast.present();
        return;
      }

      let usuario = querySnapshot.docs[0].data() as Usuario;

      // Verificar contraseña guardada en Firestore
      if (usuario.clave !== this.clave) {
        const toast = await this.toastController.create({
          message: 'Contraseña incorrecta.',
          duration: 2500,
          color: 'danger'
        });
        toast.present();
        return;
      }

      // Login exitoso
      const toast = await this.toastController.create({
        message: `Bienvenido ${usuario.nombre}!`,
        duration: 2000,
        color: 'success'
      });
      toast.present();

      // Redirección según el rol
      switch (usuario.rol) {
        case 'bombero':
          this.navCtrl.navigateRoot('/vista-bombero');
          break;

        case 'admin':
          this.navCtrl.navigateRoot('/vista-bombero');
          break;

        case 'usuario':
          this.navCtrl.navigateRoot('/vista-home');
          break;

        default:
          this.navCtrl.navigateRoot('/vista-home');
          break;
      }

    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      const toast = await this.toastController.create({
        message: 'Error al procesar el inicio de sesión.',
        duration: 2500,
        color: 'danger'
      });
      toast.present();

    } finally {
      this.cargando = false;
    }
  }
}
