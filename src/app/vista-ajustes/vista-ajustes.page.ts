import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';   //  Importa el servicio

@Component({
  selector: 'app-vista-ajustes',
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    RouterLink,
    TranslateModule,   // Importa el módulo de traducción
  ],
  templateUrl: './vista-ajustes.page.html',
  styleUrls: ['./vista-ajustes.page.scss']
})
export class VistaAjustesPage {
  mapType = 'google';
  geolocationEnabled = true;
  theme = 'claro';
  language = 'es';

  constructor(private translate: TranslateService) {
    // 👇 Inicializa idioma desde localStorage o por defecto
    const savedLang = localStorage.getItem('lang') || 'es';
    this.language = savedLang;
    this.translate.setDefaultLang('es');
    this.translate.use(savedLang);
  }

aplicarTema() {
  document.body.classList.remove('dark'); // fuerza modo claro
}


  changeLanguage(lang: string) {
    this.language = lang;
    this.translate.use(lang);
    localStorage.setItem('lang', lang);   // 👈 Guarda preferencia
  }
}
