import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase-config';


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
    clave: this.clave,
    fechaRegistro: new Date()
  };

  try {
    await addDoc(collection(db, 'usuarios'), nuevoUsuario);

    const toast = await this.toastController.create({
      message: 'Registro exitoso 🎉',
      duration: 2000,
      color: 'success'
    });
    toast.present();

    this.router.navigate(['/vista-login']);
  } catch (error) {
    const toast = await this.toastController.create({
      message: 'Error al registrar usuario. Intenta nuevamente.',
      duration: 2500,
      color: 'danger'
    });
    toast.present();
    console.error('Error al guardar en Firestore:', error);
  }

  const lang = localStorage.getItem('lang') || 'es';
  this.translate.setDefaultLang('es');
  this.translate.use(lang);
  }

}
