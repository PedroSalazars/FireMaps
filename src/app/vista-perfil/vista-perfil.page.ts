import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-vista-perfil',
  templateUrl: './vista-perfil.page.html',
  styleUrls: ['./vista-perfil.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class VistaPerfilPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
