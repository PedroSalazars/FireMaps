import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { addIcons } from 'ionicons';
import { chatboxEllipses, home, notifications, settings } from 'ionicons/icons';

import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

// Firebase
import { getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-vista-bombero',
  templateUrl: './vista-bombero.page.html',
  styleUrls: ['./vista-bombero.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, TranslateModule],
})
export class VistaBomberoPage implements OnInit {
  usuario: any = null;

  // Emergencia activa de ejemplo
  emergenciaActiva = {
    titulo: 'Incendio estructural – Castro',
    descripcion: 'Foco activo en zona urbana, se requieren unidades de apoyo.',
    hace: 'Hace 2 minutos',
    prioridad: 'Alta',
  };

  // Notificaciones de ejemplo
  notificaciones = [
    {
      titulo: 'Reunión de compañía',
      detalle: 'Reunión extraordinaria hoy a las 21:00 hrs.',
      hace: 'Hace 1 hora',
    },
    {
      titulo: 'Mantención de camión',
      detalle: 'Revisar niveles de agua y combustible antes de la guardia.',
      hace: 'Hace 3 horas',
    },
    {
      titulo: 'Actualización de protocolo',
      detalle: 'Nuevo procedimiento para incendios forestales.',
      hace: 'Ayer',
    },
  ];

  constructor(private router: Router) {
    addIcons({
      chatboxEllipses,
      home,
      notifications,
      settings,
    });
  }

  async ngOnInit() {
    // Inicializar Firebase si no está inicializado
    if (!getApps().length) {
      initializeApp(environment.firebase);
    }

    const db = getFirestore();

    // 👇 Recuperamos el UID del bombero guardado en login
    const uid = localStorage.getItem('bomberoUid');

    if (uid) {
      try {
        const refBombero = doc(db, 'bomberos', uid);
        const snapBombero = await getDoc(refBombero);
        if (snapBombero.exists()) {
          this.usuario = snapBombero.data();
        }
      } catch (error) {
        console.error('Error al cargar datos del bombero:', error);
      }
    }
  }

  irAlMapa() {
    this.router.navigate(['/vista-home']);
  }

  // ===== Navegación del footer =====
  goToNotificaciones() {
    this.router.navigate(['/vista-notificaciones']);
  }

  goToHome() {
    this.router.navigate(['/vista-bombero']);
  }

  goToAjustes() {
    this.router.navigate(['/vista-perfil']);
  }

  // ===== Cerrar sesión =====
  cerrarSesion() {
    localStorage.removeItem('bomberoUid'); // limpiamos el UID
    this.usuario = null;
    this.router.navigate(['/vista-login']); // redirigimos al login
  }
}
