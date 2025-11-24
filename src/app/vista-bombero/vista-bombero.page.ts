import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { addIcons } from 'ionicons';
import { chatboxEllipses } from 'ionicons/icons';
import { home } from 'ionicons/icons';
import { notifications } from 'ionicons/icons';
import { settings } from 'ionicons/icons';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-vista-bombero',
  templateUrl: './vista-bombero.page.html',
  styleUrls: ['./vista-bombero.page.scss'],
  standalone: true,
  imports: [ CommonModule, FormsModule,IonicModule, RouterLink ]
})
export class VistaBomberoPage implements OnInit {
  usuario: any = null;
  constructor() {
    addIcons({
      chatboxEllipses,
      home,
      notifications,
      settings,
    });
   }

  ngOnInit() {
    const data = localStorage.getItem('usuarioActivo');
    if (data) {
      this.usuario = JSON.parse(data);
    }
  }
}
