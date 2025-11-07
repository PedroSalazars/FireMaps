import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';       // ✅ Este es el correcto
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-vista-ajustes',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,     // ✅ Este módulo habilita todos los componentes Ionic
    FormsModule,
    RouterLink,      // ✅ Necesario para [(ngModel)]
  ],
  templateUrl: './vista-ajustes.page.html',
  styleUrls: ['./vista-ajustes.page.scss']
})
export class VistaAjustesPage {
  mapType = 'google';
  geolocationEnabled = true;
  theme = 'claro';
  language = 'es';

  aplicarTema() {
    if (this.theme === 'oscuro') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }
}
