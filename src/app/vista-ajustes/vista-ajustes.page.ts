import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-vista-ajustes',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterLink,
    TranslateModule
  ],
  templateUrl: './vista-ajustes.page.html',
  styleUrls: ['./vista-ajustes.page.scss']
})
export class VistaAjustesPage {
  mapType = 'google';
  geolocationEnabled = true;
  theme = 'claro';
  language = 'es';

  submitted = false;
  cargando = false;

  // 👇 variables auxiliares para los dropdowns personalizados
  mostrarMapa = false;
  mostrarTema = false;
  mostrarIdioma = false;

  constructor(private translate: TranslateService) {
    const savedLang = localStorage.getItem('lang') || 'es';
    this.language = savedLang;
    this.translate.setDefaultLang('es');
    this.translate.use(savedLang);
  }

  aplicarTema() {
    if (this.theme === 'oscuro') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }

  changeLanguage(lang: string) {
    this.language = lang;
    this.translate.use(lang);
    localStorage.setItem('lang', lang);
  }

  guardarAjustes() {
    this.submitted = true;
    localStorage.setItem('mapType', this.mapType);
    localStorage.setItem('geolocationEnabled', String(this.geolocationEnabled));
    localStorage.setItem('theme', this.theme);
    localStorage.setItem('lang', this.language);

    console.log('Ajustes guardados:', {
      mapType: this.mapType,
      geolocationEnabled: this.geolocationEnabled,
      theme: this.theme,
      language: this.language
    });
  }
}
