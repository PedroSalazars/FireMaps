import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { addIcons } from 'ionicons';
import { chatboxEllipses, home, notifications, settings } from 'ionicons/icons';

import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-vista-bombero',
  templateUrl: './vista-bombero.page.html',
  styleUrls: ['./vista-bombero.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterLink],
})
export class VistaBomberoPage implements OnInit {
  usuario: any = null;

  // Emergencia activa de ejemplo (luego se puede conectar a Firestore)
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

  ngOnInit() {
    const data = localStorage.getItem('usuarioActivo');
    if (data) {
      this.usuario = JSON.parse(data);
    }
  }

  irAlMapa() {
    this.router.navigate(['/vista-home']);
  }
}
