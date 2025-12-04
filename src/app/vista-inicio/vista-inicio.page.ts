import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-vista-inicio',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, TranslateModule],
  templateUrl: './vista-inicio.page.html',
  styleUrls: ['./vista-inicio.page.scss'],
})
export class VistaInicioPage {

  constructor(private translate: TranslateService) {
    const savedLang = localStorage.getItem('lang') || 'es';
    this.translate.setDefaultLang('es');
    this.translate.use(savedLang);
  }
}
