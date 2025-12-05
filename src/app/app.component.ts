// src/app/app.component.ts
import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `<ion-app><ion-router-outlet /></ion-app>`,
  imports: [IonApp, IonRouterOutlet, TranslateModule]
})
export class AppComponent {

  constructor(private translate: TranslateService) {
    // Idioma por defecto
    this.translate.setDefaultLang('es');
    this.translate.use('es');
  }
}
