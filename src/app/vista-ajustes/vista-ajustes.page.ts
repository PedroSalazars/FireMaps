import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { App } from '@capacitor/app';

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
  theme: 'claro' | 'oscuro' = 'claro';
  language = 'es';

  // dropdowns personalizados
  mostrarMapa = false;
  mostrarTema = false;
  mostrarIdioma = false;

  constructor(
    private translate: TranslateService,
    private navCtrl: NavController,
    private router: Router
  ) {
    // Idioma guardado
    const savedLang = localStorage.getItem('lang') || 'es';
    this.language = savedLang;
    this.translate.setDefaultLang('es');
    this.translate.use(savedLang);

    // Tipo de mapa guardado (opcional)
    const savedMapType = localStorage.getItem('mapType');
    if (savedMapType === 'google' || savedMapType === 'osm') {
      this.mapType = savedMapType;
    }

    // Geolocalización guardada (opcional)
    const savedGeo = localStorage.getItem('geolocationEnabled');
    if (savedGeo !== null) {
      this.geolocationEnabled = savedGeo === 'true';
    }

    // Tema guardado
    const savedTheme = (localStorage.getItem('theme') as 'claro' | 'oscuro') || 'claro';
    this.theme = savedTheme;
    this.aplicarTema();
  }

  aplicarTema() {
    const isDark = this.theme === 'oscuro';
    document.body.classList.toggle('dark', isDark);
    localStorage.setItem('theme', this.theme);
  }

    changeLanguage(lang: string) {
    this.language = lang;
    this.translate.use(lang);
    localStorage.setItem('lang', lang);
  }

guardarAjustes() {
  // Guardar en localStorage
  localStorage.setItem('mapType', this.mapType);
  localStorage.setItem('geolocationEnabled', String(this.geolocationEnabled));
  localStorage.setItem('theme', this.theme);
  localStorage.setItem('lang', this.language);

  // 👇 aplicar idioma inmediatamente
  this.translate.use(this.language);

  console.log('Ajustes guardados:', {
    mapType: this.mapType,
    geolocationEnabled: this.geolocationEnabled,
    theme: this.theme,
    language: this.language
  });

  // 🔙 Volver a la vista anterior (Home o de donde vino)
  this.navCtrl.back();
}


  async cerrarSesion() {
    // Aquí podrías limpiar cosas de auth si tuvieras
    // localStorage.removeItem('token'); etc.

    try {
      // 👇 En app nativa (Android/iOS) cierra la app
      await App.exitApp();
    } catch (error) {
      console.warn('No se pudo cerrar la app (probablemente estás en navegador). Redirigiendo a inicio.', error);
      // Fallback en navegador: ir a la vista de inicio
      this.router.navigate(['/vista-inicio']);
    }
  }
}
