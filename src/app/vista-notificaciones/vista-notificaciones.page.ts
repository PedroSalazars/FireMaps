import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

// Firestore
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase-config';

@Component({
  selector: 'app-vista-notificaciones',
  templateUrl: './vista-notificaciones.page.html',
  styleUrls: ['./vista-notificaciones.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule,TranslateModule],
})
export class VistaNotificacionesPage implements OnInit {

  incidentes: any[] = [];

  constructor(private router: Router) {}

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

  // ===== Navegación footer =====
  goToNotificaciones() {
    this.router.navigate(['/vista-notificaciones']);
  }

  goToHome() {
    this.router.navigate(['/vista-bombero']);
  }

  goToAjustes() {
    this.router.navigate(['/vista-perfil']);
  }
}
