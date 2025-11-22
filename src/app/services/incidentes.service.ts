import { Injectable } from '@angular/core';
import { collection, getDocs } from "firebase/firestore";
import { db } from '../firebase-config';

@Injectable({
  providedIn: 'root'
})
export class IncidentesService {
  async getIncidentes() {
    const querySnapshot = await getDocs(collection(db, "incidents"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
