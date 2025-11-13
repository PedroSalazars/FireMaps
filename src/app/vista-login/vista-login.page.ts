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
  imports: [IonicModule, CommonModule, FormsModule, RouterModule,TranslateModule],
  templateUrl: './vista-login.page.html',
  styleUrls: ['./vista-login.page.scss']
})
export class VistaLoginPage {
  correo = '';
  clave = '';

  constructor(private toastController: ToastController, private router: Router) {}

async iniciarSesion(form: NgForm) {
  if (!form.valid) {
    const toast = await this.toastController.create({
      message: 'Completa todos los campos.',
      duration: 2500,
      color: 'danger'
    });
    toast.present();
    return;
  }

  try {
    const usuariosRef = collection(db, 'usuarios');
    const q = query(
      usuariosRef,
      where('correo', '==', this.correo),
      where('clave', '==', this.clave)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const usuario = querySnapshot.docs[0].data();

      const toast = await this.toastController.create({
        message: `Bienvenido, ${usuario['nombre']}!`,
        duration: 2000,
        color: 'success'
      });
      toast.present();

      // Guardar sesión local si lo necesitas
      localStorage.setItem('usuarioActivo', JSON.stringify(usuario));

      this.router.navigate(['/home']);
    } else {
      const toast = await this.toastController.create({
        message: 'Correo o contraseña incorrectos.',
        duration: 2500,
        color: 'warning'
      });
      toast.present();
    }
  } 
  catch (error) {
    const toast = await this.toastController.create({
      message: 'Error al iniciar sesión. Intenta nuevamente.',
      duration: 2500,
      color: 'danger'
    });
    toast.present();
    console.error('Error en login:', error);
    }
  }

}
