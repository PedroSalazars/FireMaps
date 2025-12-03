import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import '@ionic/angular/css/core.css';
import '@ionic/angular/css/normalize.css';
import '@ionic/angular/css/structure.css';
import '@ionic/angular/css/typography.css';
import './theme/variables.css';



@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    CommonModule,       // funciones básicas de Angular
    IonicModule,        // habilita <ion-app>, <ion-router-outlet>, botones, inputs, etc.
    RouterModule,       // habilita <router-outlet> y navegación
    TranslateModule     // habilita directivas y pipes de ngx-translate
  ]
})
export class AppComponent {
  // tu lógica aquí
}
