import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


@Component({
  selector: 'app-vista-registro-usuario',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule,TranslateModule],
  templateUrl: './vista-registro-usuario.page.html',
  styleUrls: ['./vista-registro-usuario.page.scss']
})
export class VistaRegistroUsuarioPage {
  nombre = '';
  apellidos = '';
  rut = '';
  telefono = '';
  correo = '';
  clave = '';
  confirmarClave = '';
  

  constructor(private toastController: ToastController, private router: Router,private translate: TranslateService) {}

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

    if (this.clave !== this.confirmarClave) {
      const toast = await this.toastController.create({
        message: 'Las contraseñas no coinciden.',
        duration: 2500,
        color: 'warning'
      });
      toast.present();
      return;
    }

    const nuevoUsuario = {
      nombre: this.nombre,
      apellidos: this.apellidos,
      rut: this.rut,
      telefono: this.telefono,
      correo: this.correo,
      clave: this.clave
    };

    const usuarios = JSON.parse(localStorage.getItem('usuarios') || '[]');
    usuarios.push(nuevoUsuario);
    localStorage.setItem('usuarios', JSON.stringify(usuarios));

    const toast = await this.toastController.create({
      message: 'Registro exitoso 🎉',
      duration: 2000,
      color: 'success'
    });
    toast.present();

    this.router.navigate(['/vista-login']);

  const lang = localStorage.getItem('lang') || 'es';
  this.translate.setDefaultLang('es');
  this.translate.use(lang);
  }
}
