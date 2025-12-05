import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

@Component({
  selector: 'app-vista-perfil',
  standalone: true,
  templateUrl: './vista-perfil.page.html',
  styleUrls: ['./vista-perfil.page.scss'],
  imports: [CommonModule, IonicModule, TranslateModule]
})
export class VistaPerfilPage implements OnInit {

  usuario: any = null;
  tipoPerfil: 'usuario' | 'bombero' | null = null;
  cargando = true;
  error: string | null = null;

  constructor(
    private router: Router
  ) {}

  ngOnInit() {
    const auth = getAuth();

    // 👇 Esperamos a que Firebase restaure la sesión
    auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        this.cargando = false;
        this.router.navigate(['/vista-login']);
        return;
      }

      try {
        const uid = currentUser.uid;

        // 1) Intentar en colección "usuarios"
        let snap = await getDoc(doc(db, 'usuarios', uid));

        if (snap.exists()) {
          this.tipoPerfil = 'usuario';
          this.usuario = { uid, ...snap.data() };
        } else {
          // 2) Si no existe, intentamos en "bomberos"
          snap = await getDoc(doc(db, 'bomberos', uid));
          if (snap.exists()) {
            this.tipoPerfil = 'bombero';
            this.usuario = { uid, ...snap.data() };
          } else {
            this.error = 'No se encontró un perfil asociado a tu cuenta.';
          }
        }

      } catch (e) {
        console.error('Error cargando perfil:', e);
        this.error = 'Ocurrió un error al cargar el perfil.';
      } finally {
        this.cargando = false;
      }
    });
  }

  goToNotificaciones() {
    this.router.navigate(['/vista-notificaciones']);
  }

  goToHome() {
    this.router.navigate(['/vista-home']);
  }

  goToAjustes() {
    this.router.navigate(['/vista-ajustes']);
  }

  cerrarSesion() {
    const auth = getAuth();
    auth.signOut().then(() => {
      this.router.navigate(['/vista-login']);
    });
  }
}
