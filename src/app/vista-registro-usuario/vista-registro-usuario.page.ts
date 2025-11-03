import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule, NgForm } from '@angular/forms';

@Component({
  selector: 'app-vista-registro-usuario',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './vista-registro-usuario.page.html',
  styleUrls: ['./vista-registro-usuario.page.scss']
})
export class VistaRegistroUsuarioPage {
  nombre = '';
  apellidos = '';
  rut = '';
  telefono = '';
  correo = '';

  constructor(private toastController: ToastController) {}

  validarCorreo(correo: string): boolean {
    const dominiosPermitidos = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com'];
    const partes = correo.split('@');
    return partes.length === 2 && dominiosPermitidos.includes(partes[1].toLowerCase());
  }

  async registrarUsuario(form: NgForm) {
    if (!form.valid) {
      const toast = await this.toastController.create({
        message: 'Por favor completa todos los campos correctamente.',
        duration: 2500,
        color: 'danger'
      });
      toast.present();
      return;
    }

    if (!this.validarCorreo(this.correo)) {
      const toast = await this.toastController.create({
        message: 'Correo no permitido. Usa gmail, hotmail, outlook o yahoo.',
        duration: 2500,
        color: 'danger'
      });
      toast.present();
      return;
    }

    const toast = await this.toastController.create({
      message: 'Registro exitoso 🎉',
      duration: 2000,
      color: 'success'
    });
    toast.present();

    console.log({
      nombre: this.nombre,
      apellidos: this.apellidos,
      rut: this.rut,
      telefono: this.telefono,
      correo: this.correo
    });

  }

}
