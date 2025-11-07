import { Component } from '@angular/core';
import { IonicModule, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-vista-login',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
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

    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    const usuario = usuarios.find((u: any) => u.correo === this.correo && u.clave === this.clave);

    if (usuario) {
      const toast = await this.toastController.create({
        message: `Bienvenido, ${usuario.nombre}!`,
        duration: 2000,
        color: 'success'
      });
      toast.present();
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
}
