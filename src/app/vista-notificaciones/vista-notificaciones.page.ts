import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { RouterLink } from '@angular/router';

import { addIcons } from 'ionicons';
import { chatboxEllipses } from 'ionicons/icons';
import { home } from 'ionicons/icons';
import { notifications } from 'ionicons/icons';
import { settings } from 'ionicons/icons';

import { IncidentesService } from '../services/incidentes.service';

import { collection, getDocs } from "firebase/firestore";
import { db } from '../firebase-config';

@Component({
  selector: 'app-vista-notificaciones',
  templateUrl: './vista-notificaciones.page.html',
  styleUrls: ['./vista-notificaciones.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterLink ]
})
export class VistaNotificacionesPage implements OnInit {
  incidentes: any[] = [];

  constructor(private incidentesService: IncidentesService) {addIcons({
    chatboxEllipses,
    home,
    notifications,
    settings,
  }); }

  async ngOnInit() {
    await this.cargarIncidentes();
  }
    async cargarIncidentes() {
    try {
      const querySnapshot = await getDocs(collection(db, 'incidents'));
      this.incidentes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error al cargar incidentes:', error);
    }
  }
  async cargarMas(event: any) {
  // Aquí podrías traer más incidentes desde Firebase con paginación
  console.log('Cargar más incidentes...');
  event.target.complete();
}

}
