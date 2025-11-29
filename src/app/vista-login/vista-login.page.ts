import { Component } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase-config';

@Component({
  selector: 'app-vista-login',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './vista-login.page.html',
  styleUrls: ['./vista-login.page.scss']
})
export class VistaLoginPage {

  correo = '';
  clave = '';
  usuarioActivo: any = null;

  constructor(
    private toastController: ToastController,
    private router: Router
  ) {}

  async iniciarSesion(form: NgForm) {

    // 1) Validación del formulario
    if (!form.valid) {
      const toast = await this.toastController.create({
        message: 'Completa todos los campos.',
        duration: 2500,
        color: 'danger'
      });
      await toast.present();
      return;
    }

    // 2) Limpiar espacios sobrantes (muy importante en Android)
    const correoLimpio = this.correo.trim();
    const claveLimpia = this.clave.trim();

    if (!correoLimpio || !claveLimpia) {
      const toast = await this.toastController.create({
        message: 'Correo y contraseña no pueden estar vacíos.',
        duration: 2500,
        color: 'danger'
      });
      await toast.present();
      return;
    }

    try {
      // 3) Consulta Firestore
      const usuariosRef = collection(db, 'usuarios');
      const q = query(
        usuariosRef,
        where('correo', '==', correoLimpio),
        where('clave', '==', claveLimpia)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {

        // 4) Usuario encontrado
        const doc = querySnapshot.docs[0];

        const usuario: any = {
          id: doc.id,
          ...doc.data()
        };

        this.usuarioActivo = usuario;

        const nombreUsuario = usuario.nombre || correoLimpio;
        const rolUsuario = usuario.rol;

        const toast = await this.toastController.create({
          message: `Bienvenido, ${nombreUsuario}!`,
          duration: 2000,
          color: 'success'
        });
        await toast.present();

        // 5) Guardar sesión
        localStorage.setItem('usuarioActivo', JSON.stringify(usuario));

        // 6) Navegación según rol
        if (rolUsuario === 'bombero') {
          await this.router.navigate(['/vista-bombero']);
        } else {
          await this.router.navigate(['/vista-home']);
        }

      } else {

        // Usuario NO encontrado
        const toast = await this.toastController.create({
          message: 'Correo o contraseña incorrectos.',
          duration: 2500,
          color: 'warning'
        });
        await toast.present();
      }

    } catch (error) {

      // Error inesperado
      console.error('Error en login:', error);

      const toast = await this.toastController.create({
        message: 'Error al iniciar sesión. Intenta nuevamente.',
        duration: 2500,
        color: 'danger'
      });
      await toast.present();
    }
  }
}
