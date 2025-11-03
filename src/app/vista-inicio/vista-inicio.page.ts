import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-vista-inicio',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  templateUrl: './vista-inicio.page.html',
  styleUrls: ['./vista-inicio.page.scss']
})
export class VistaInicioPage {}
