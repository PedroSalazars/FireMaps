import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonFab, IonFabButton, IonFabList, IonButton, IonFooter,
  IonModal, IonButtons, IonInput, IonTextarea, IonIcon
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { Loader } from '@googlemaps/js-api-loader';
import { environment } from '../../environments/environment';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// Firebase SDK Web
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, addDoc,
  updateDoc, doc, serverTimestamp, GeoPoint, QuerySnapshot, DocumentData
} from 'firebase/firestore';

/** Tipos básicos de coordenadas y entidades **/
type LatLng = { lat: number; lng: number };
type FireStation = { name: string; position: LatLng };
type GHydrant = { lat: number; lon: number; tags?: Record<string, string> };
type IncidentType = 'Incendio' | 'FuGas' | 'rescate' | 'choque';

type IncidentDoc = {
  id: string;
  type: IncidentType;
  status: 'open' | 'closed';
  priority?: number;
  address?: string | null;
  location: { latitude: number; longitude: number };
  createdAt?: Date;
};

/** Estados operacionales de un carro bomba **/
enum TruckState {
  STANDBY = 'En base',
  RESPONDING = 'Respondiendo',
  ATTENDING = 'Atendiendo',
  RETURNING = 'Retornando',
  PATROL = 'Patrullando'
}

/** Estructura interna de cada camión simulado en el mapa **/
type Truck = {
  id: string;
  company: string;
  home: google.maps.LatLng;
  marker: google.maps.Marker;
  speedMps: number;
  route: google.maps.LatLng[];
  segIdx: number;
  segT: number;
  state: TruckState;
  target?: google.maps.LatLng;
  routeLine?: google.maps.Polyline;

  isPatroller?: boolean;
  patrolTimeout?: any;
  patrolResumeTimeout?: any;
};

@Component({
  selector: 'app-vista-home',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonFab, IonFabButton, IonFabList,
    IonButton, IonFooter,
    IonModal, IonButtons, IonInput, IonTextarea,
    IonIcon,
    RouterLink,
    FormsModule,
    TranslateModule
  ],
  templateUrl: './vista-home.page.html',
  styleUrls: ['./vista-home.page.scss']
})
export class VistaHomePage implements AfterViewInit, OnDestroy {

  constructor(private toastController: ToastController) {}

  /** ---------------------------
   *  CONFIGURACIÓN DE MAPA
   *  --------------------------- */
  private map!: google.maps.Map;
  private infoWin!: google.maps.InfoWindow;
  private chiloeBounds!: google.maps.LatLngBounds;

  private readonly CHILOE_BOUNDS: google.maps.LatLngBoundsLiteral = {
    north: -41.70, south: -43.30, west: -74.50, east: -73.10
  };

  private STATION_ICON!: google.maps.Icon;
  private HYDRANT_ICON!: google.maps.Icon;
  private INCIDENT_ICONS!: Record<IncidentType, google.maps.Icon>;
  private FIRETRUCK_ICON!: google.maps.Icon;

  private directionsService!: google.maps.DirectionsService;

  /** Cache para ruteo (Directions API) **/
  private dirCache = new Map<string, google.maps.LatLng[]>();
  private routeQueue: Array<() => void> = [];
  private processingQueue = false;
  private lastRouteTs = 0;
  private readonly ROUTE_THROTTLE_MS = 700;

  private toLiteral(
    p: google.maps.LatLng | google.maps.LatLngLiteral
  ): google.maps.LatLngLiteral {
    return p instanceof google.maps.LatLng ? { lat: p.lat(), lng: p.lng() } : p;
  }

  private dirKey(
    a: google.maps.LatLng | google.maps.LatLngLiteral,
    b: google.maps.LatLng | google.maps.LatLngLiteral
  ): string {
    const A = this.toLiteral(a), B = this.toLiteral(b);
    return `${A.lat.toFixed(5)},${A.lng.toFixed(5)}->${B.lat.toFixed(5)},${B.lng.toFixed(5)}`;
  }

  /** ---------------------------
   *  INCIDENTES (Marcadores)
   *  --------------------------- */
  private incidentMarkersByType: Record<IncidentType, google.maps.Marker[]> = {
    Incendio: [], FuGas: [], rescate: [], choque: []
  };
  private incidentMarkersById = new Map<string, google.maps.Marker>();
  private unsubIncidents?: () => void;

  // Seguimiento de camiones por incidente (control de asignaciones y cierre)
  private incidentAssignments = new Map<
    string,
    { truckIds: Set<string>; max: number; closed: boolean }
  >();

  /** Geometría y polígonos (para máscara y detección de tierra) **/
  private landPolygons: google.maps.Polygon[] = [];
  private geometryReady = false;

  /** Cache de calles (reverse geocoding) **/
  private streetCacheMem = new Map<string, string>();
  private lastNominatimTs = 0;

  /** Estaciones de bomberos y flota simulada **/
  private STATIONS_LIST: FireStation[] = [
    { name: 'Bomberos de Ancud',             position: { lat: -41.869, lng: -73.828 } },
    { name: 'Bomberos de Quemchi',           position: { lat: -42.141, lng: -73.484 } },
    { name: 'Bomberos de Dalcahue',          position: { lat: -42.379, lng: -73.650 } },
    { name: 'Bomberos de Castro',            position: { lat: -42.481, lng: -73.764 } },
    { name: 'Bomberos de Chonchi',           position: { lat: -42.616, lng: -73.807 } },
    { name: 'Bomberos de Curaco de Vélez',   position: { lat: -42.440, lng: -73.620 } },
    { name: 'Bomberos de Achao (Quinchao)',  position: { lat: -42.465, lng: -73.503 } },
    { name: 'Bomberos de Puqueldón (Lemuy)', position: { lat: -42.628, lng: -73.658 } },
    { name: 'Bomberos de Queilen',           position: { lat: -42.885, lng: -73.474 } },
    { name: 'Bomberos de Quellón',           position: { lat: -43.116, lng: -73.616 } }
  ];

  private trucks: Truck[] = [];

  /** Parámetros de simulación (animación física de los camiones) **/
  private readonly STEP = 0.05;
  private acc = 0;
  private lastTs = 0;
  private rafId = 0;

  private readonly SPEED_RESPONSE   = 22; // m/s en respuesta a incidente
  private readonly SPEED_RETURN     = 14; // m/s al retornar a base
  private readonly SPEED_PATROL     = 12; // m/s en patrullaje

  // Tiempo de permanencia en el incidente (ms)
  private readonly ATTEND_MS = 10_000;

  // Patrullaje: tiempo máx de pierna y de espera antes de reanudar
  private readonly PATROL_LEG_MAX_MS = 300_000;
  private readonly PATROL_DWELL_MS   = 600_000;

  /** Hidrantes **/
  private hydrantsLoaded = false;
  private hydrantMarkers: google.maps.Marker[] = [];

  /** Filtro de lenguaje inadecuado **/
  private readonly BAD_WORDS = [
    'weon', 'weón', 'wea', 'culiao', 'conchetumare', 'ctm',
    'mierda', 'pico', 'puta'
  ];

  /** Estado del formulario de reporte **/
  public reportOpen = false;
  public reportType: IncidentType | null = null;
  public reportAddress: string = '';
  public reportNotes: string = '';
  public selectedFiles: File[] = [];
  public reportDistanceM: number | null = null;

  public formErrors = {
    type: '',
    address: '',
    notes: '',
    photos: ''
  };

  private addressAutocomplete?: google.maps.places.Autocomplete;
  private reportLatLng: google.maps.LatLng | null = null;

  // -------------------------------------------------------------
  // MODAL DE REPORTE
  // -------------------------------------------------------------

  /** Abre el modal de reporte y configura Autocomplete de dirección */
  openReportModal() {
    this.reportOpen = true;

    setTimeout(() => {
      this.setupAddressAutocomplete();
    }, 350);
  }

  /** Cierra el modal de reporte (sin limpiar datos aún) */
  closeReportModal() {
    this.reportOpen = false;
  }

  // -------------------------------------------------------------
  // CICLO DE VIDA – INICIALIZACIÓN DE MAPA
  // -------------------------------------------------------------

  async ngAfterViewInit() {
    const el = document.getElementById('map') as HTMLElement;

    // Esperar a que el contenedor del mapa tenga tamaño visible
    await new Promise<void>((resolve) => {
      const ok = () => el.offsetWidth > 0 && el.offsetHeight > 0;
      if (ok()) return resolve();
      const id = setInterval(() => {
        if (ok()) {
          clearInterval(id);
          resolve();
        }
      }, 16);
    });

    // Cargar librerías de Google Maps
    const loader = new Loader({
      apiKey: environment.googleMapsApiKey,
      version: 'weekly',
      language: 'es',
      region: 'CL',
      libraries: ['geometry', 'places'] as any
    });
    await loader.load();

    this.geometryReady = !!google.maps.geometry?.spherical && !!google.maps.geometry?.poly;

    // Iconos personalizados para el mapa
    this.STATION_ICON = {
      url: 'assets/icons/station@2x.png',
      scaledSize: new google.maps.Size(28, 28),
      anchor: new google.maps.Point(14, 28)
    };
    this.HYDRANT_ICON = {
      url: 'assets/icons/hydrant@2x.png',
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 24)
    };
    this.INCIDENT_ICONS = {
      Incendio: { url: 'assets/icons/Incendio.png', scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
      FuGas:    { url: 'assets/icons/FuGas.png',    scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
      rescate:  { url: 'assets/icons/rescate.png',  scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
      choque:   { url: 'assets/icons/choque.png',   scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
    };
    this.FIRETRUCK_ICON = {
      url: 'assets/icons/camionbomberos.png',
      scaledSize: new google.maps.Size(36, 36),
      anchor: new google.maps.Point(18, 18)
    };

    this.chiloeBounds = new google.maps.LatLngBounds(
      { lat: this.CHILOE_BOUNDS.south, lng: this.CHILOE_BOUNDS.west },
      { lat: this.CHILOE_BOUNDS.north, lng: this.CHILOE_BOUNDS.east }
    );

    // Configuración del mapa centrado en Chiloé
    this.map = new google.maps.Map(el, {
      center: { lat: -42.6, lng: -73.9 },
      zoom: 9,
      minZoom: 9,
      maxZoom: 19,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      keyboardShortcuts: false,
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      restriction: {
        latLngBounds: this.CHILOE_BOUNDS,
        strictBounds: true
      }
    });

    this.map.fitBounds(this.chiloeBounds, 24);

    this.infoWin = new google.maps.InfoWindow();
    this.directionsService = new google.maps.DirectionsService();

    // Máscara oscura alrededor de Chiloé
    this.addMaskPolygon();
    try { await this.loadLandPolygons(); } catch {}

    // Renderizar estaciones de bomberos
    this.addStations();

    // Hidratnes visibles según zoom
    this.map.addListener('zoom_changed', () => this.updateHydrantsVisibility());
    this.updateHydrantsVisibility();

    // Suscripción en tiempo real a incidentes desde Firestore
    this.startFirestoreSubscription();

    // Flota inicial de camiones por compañía
    this.spawnFleetPerCompany();

    // Autocomplete (utilizado al abrir modal de reporte)
    this.setupAddressAutocomplete();

    // Arrancar bucle de animación
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.tickRaf);
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    for (const t of this.trucks) {
      this.clearPatrolTimers(t);
    }

    if (this.unsubIncidents) this.unsubIncidents();
  }

  // -------------------------------------------------------------
  // AUTOCOMPLETE – PLACES API PARA DIRECCIONES
  // -------------------------------------------------------------

  /** Configura Autocomplete en el input de dirección del reporte */
  private setupAddressAutocomplete() {
    const input = document.getElementById('report-address-input') as HTMLInputElement | null;
    if (!input || !google.maps.places || !google.maps.places.Autocomplete) return;

    const options: google.maps.places.AutocompleteOptions = {
      componentRestrictions: { country: 'cl' },
      fields: ['geometry', 'formatted_address', 'name'],
      bounds: this.chiloeBounds,
      strictBounds: true,
      types: ['geocode']
    };

    this.addressAutocomplete = new google.maps.places.Autocomplete(input, options);

    this.addressAutocomplete.addListener('place_changed', () => {
      const place = this.addressAutocomplete!.getPlace();
      if (!place.geometry || !place.geometry.location) {
        this.reportLatLng = null;
        return;
      }

      this.reportLatLng = place.geometry.location;
      const addr = place.formatted_address || place.name || this.reportAddress;
      if (addr) this.reportAddress = addr;

      if (!this.chiloeBounds.contains(this.reportLatLng)) {
        this.formErrors.address = 'La dirección debe estar dentro de Chiloé.';
      } else {
        this.formErrors.address = '';
      }
    });
  }

  // -------------------------------------------------------------
  // FIRESTORE — SUSCRIPCIÓN A INCIDENTES EN TIEMPO REAL
  // -------------------------------------------------------------

  /** Escucha los cambios en la colección "incidents" en Firestore */
  private startFirestoreSubscription() {
    if (!getApps().length) initializeApp(environment.firebase);

    const db = getFirestore();
    const colRef = collection(db, 'incidents');

    this.unsubIncidents = onSnapshot(colRef, (snap: QuerySnapshot<DocumentData>) => {
      const next: IncidentDoc[] = [];

      snap.forEach(docSnap => {
        const d = docSnap.data() as any;
        const loc = d.location;

        next.push({
          id: docSnap.id,
          type: (d.type as IncidentType) ?? 'Incendio',
          status: (d.status as 'open' | 'closed') ?? 'open',
          priority: d.priority,
          address: d.address ?? null,
          location: {
            latitude:  loc?.latitude ?? 0,
            longitude: loc?.longitude ?? 0
          },
          createdAt: d.createdAt?.toDate?.()
        });
      });

      this.syncIncidentMarkers(next);
    });
  }

  /** Sincroniza los marcadores de incidentes con la data en Firestore */
  private syncIncidentMarkers(list: IncidentDoc[]) {
    const seen = new Set<string>();

    for (const i of list) {
      if (i.status === 'closed') continue;

      seen.add(i.id);
      const pos = new google.maps.LatLng(i.location.latitude, i.location.longitude);
      const icon = this.INCIDENT_ICONS[i.type] || this.INCIDENT_ICONS['Incendio'];

      let marker = this.incidentMarkersById.get(i.id);

      // Crear marcador si no existe
      if (!marker) {
        marker = new google.maps.Marker({
          position: pos,
          map: this.map,
          icon,
          title: `${i.type}${i.address ? ' - ' + i.address : ''}`,
          zIndex: 3
        });

        marker.addListener('click', () => this.dispatchBest(marker!, i));

        this.incidentMarkersById.set(i.id, marker);
        this.incidentMarkersByType[i.type].push(marker);
      }

      // Actualizar marcador existente
      else {
        marker.setPosition(pos);
        marker.setIcon(icon);
        marker.setTitle(`${i.type}${i.address ? ' - ' + i.address : ''}`);
        if (!marker.getMap()) marker.setMap(this.map);
      }
    }

    // Remover incidentes eliminados o cerrados
    for (const [id, marker] of this.incidentMarkersById.entries()) {
      if (!seen.has(id)) {
        marker.setMap(null);
        this.incidentMarkersById.delete(id);

        (Object.keys(this.incidentMarkersByType) as IncidentType[])
          .forEach(t => {
            this.incidentMarkersByType[t] =
              this.incidentMarkersByType[t].filter(m => m !== marker);
          });
      }
    }
  }

  // -------------------------------------------------------------
  // FORMULARIO DE REPORTE
  // -------------------------------------------------------------

  /** Asigna el tipo de incidente seleccionado */
  public setReportType(t: IncidentType) {
    this.reportType = t;
  }

  /** Maneja selección de fotos (máximo 3) */
  public onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files) return;
    const files = Array.from(input.files);
    this.selectedFiles = files.slice(0, 3);
    this.formErrors.photos = files.length > 3 ? 'Máximo 3 fotos' : '';
  }

  /** Habilita el botón de "Enviar reporte" */
  public canSubmitReport(): boolean {
    return !!this.reportType && this.reportAddress.trim().length >= 5;
  }

  /** Detecta lenguaje inapropiado para filtrar insultos */
  private containsBadWords(text: string | null | undefined): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();
    return this.BAD_WORDS.some(w => lower.includes(w));
  }

  /** Geocoding estándar de Google (de texto a coordenadas) */
  private geocodeAddress(address: string): Promise<google.maps.LatLng | null> {
    return new Promise(resolve => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address, region: 'CL', componentRestrictions: { country: 'CL' } as any },
        (results, status) => {
          if (status === 'OK' && results && results[0]?.geometry?.location) {
            resolve(results[0].geometry.location);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /** Prioridad automática según tipo de incidente */
  private defaultPriorityForType(t: IncidentType): number {
    switch (t) {
      case 'Incendio': return 3;
      case 'FuGas':    return 2;
      case 'rescate':  return 2;
      case 'choque':   return 1;
      default:         return 1;
    }
  }

  /** Snap al camino más cercano usando Roads API */
  private async snapToNearestRoad(
    lat: number,
    lng: number
  ): Promise<{ lat: number; lng: number } | null> {
    const url =
      `https://roads.googleapis.com/v1/nearestRoads?points=${lat},${lng}` +
      `&key=${environment.googleMapsApiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;

      const data: any = await res.json();
      const snapped = data?.snappedPoints?.[0]?.location;
      if (!snapped) return null;

      return {
        lat: snapped.latitude,
        lng: snapped.longitude
      };
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------
  // SUBMIT — ENVÍO DE REPORTE A FIRESTORE + TOAST VERDE
  // -------------------------------------------------------------

  public async submitReport() {
    this.formErrors = { type: '', address: '', notes: '', photos: '' };

    /** --- Validaciones básicas --- */
    if (!this.reportType) {
      this.formErrors.type = 'Selecciona el tipo de incidente.';
    }

    const cleanAddress = this.reportAddress.trim();
    if (!cleanAddress || cleanAddress.length < 5) {
      this.formErrors.address = 'Ingresa una dirección válida.';
    }

    const cleanNotes = (this.reportNotes || '').trim().slice(0, 200);

    if (this.containsBadWords(cleanAddress)) {
      this.formErrors.address = 'Por favor evita usar garabatos en la dirección.';
    }
    if (this.containsBadWords(cleanNotes)) {
      this.formErrors.notes = 'Por favor evita usar garabatos en la descripción.';
    }

    // Si hay errores, cancelar envío
    if (this.formErrors.type || this.formErrors.address ||
        this.formErrors.notes || this.formErrors.photos) {
      return;
    }

    /** --- Convertir dirección a coordenadas si no viene de Autocomplete --- */
    let point: google.maps.LatLng | null = this.reportLatLng;

    if (!point) {
      try {
        point = await this.geocodeAddress(cleanAddress);
      } catch {
        point = null;
      }
    }

    if (!point) {
      this.formErrors.address = 'No se pudo localizar la dirección.';
      return;
    }

    if (!this.chiloeBounds.contains(point)) {
      this.formErrors.address = 'La dirección debe estar dentro de Chiloé.';
      return;
    }

    /** --- Coordenadas iniciales --- */
    let lat = point.lat();
    let lng = point.lng();

    /** --- Aplicar Snap-to-Road --- */
    const snapped = await this.snapToNearestRoad(lat, lng);
    if (snapped) {
      const snappedLatLng = new google.maps.LatLng(snapped.lat, snapped.lng);
      if (this.chiloeBounds.contains(snappedLatLng)) {
        lat = snapped.lat;
        lng = snapped.lng;
      }
    }

    /** --- Guardar a Firestore --- */
    if (!getApps().length) initializeApp(environment.firebase);

    const db = getFirestore();
    const colRef = collection(db, 'incidents');

    await addDoc(colRef, {
      type: this.reportType,
      status: 'open',
      priority: this.defaultPriorityForType(this.reportType!),
      address: cleanAddress,
      notes: cleanNotes || null,
      location: new GeoPoint(lat, lng),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      attachmentsCount: this.selectedFiles.length
    });

    /** --- Cerrar modal y resetear formulario --- */
    this.reportOpen = false;
    this.reportType = null;
    this.reportAddress = '';
    this.reportNotes = '';
    this.selectedFiles = [];
    this.reportDistanceM = null;
    this.reportLatLng = null;

    /** --- Mostrar Toast verde de éxito --- */
    const toast = await this.toastController.create({
      message: '✔ El reporte ha sido enviado correctamente',
      duration: 2500,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
  }

  // -------------------------------------------------------------
  // MÁSCARA, TIERRA, ESTACIONES E HIDRANTES
  // -------------------------------------------------------------

  /** Máscara oscura fuera del rectángulo de Chiloé */
  private addMaskPolygon() {
    // Polígono gigante que cubre casi todo el mundo
    const WORLD: google.maps.LatLngLiteral[] = [
      { lat: 85, lng: -180 },
      { lat: 85, lng: 180 },
      { lat: -85, lng: 180 },
      { lat: -85, lng: -180 }
    ];

    // Rectángulo de Chiloé (el área visible)
    const HOLE: google.maps.LatLngLiteral[] = [
      { lat: this.CHILOE_BOUNDS.north, lng: this.CHILOE_BOUNDS.west },
      { lat: this.CHILOE_BOUNDS.north, lng: this.CHILOE_BOUNDS.east },
      { lat: this.CHILOE_BOUNDS.south, lng: this.CHILOE_BOUNDS.east },
      { lat: this.CHILOE_BOUNDS.south, lng: this.CHILOE_BOUNDS.west }
    ];

    // Google interpreta paths invertidos como “huecos”
    const HOLE_REVERSED = [...HOLE].reverse();

    new google.maps.Polygon({
      paths: [WORLD, HOLE_REVERSED],
      strokeOpacity: 0,
      fillColor: '#000',
      fillOpacity: 0.45,
      clickable: false,
      map: this.map
    });
  }

  /**
   * Carga polígonos de tierra (islas principales de Chiloé) desde Nominatim.
   * Se usan solo para distinguir tierra / mar en isOnLand().
   */
  private async loadLandPolygons() {
    const islands = ['Isla Grande de Chiloé', 'Isla Quinchao', 'Isla Lemuy'];
    const polys: google.maps.Polygon[] = [];

    for (const name of islands) {
      const diff = Date.now() - this.lastNominatimTs;
      const wait = 1100 - diff;
      if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
      }
      this.lastNominatimTs = Date.now();

      const url =
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(name + ', Chile')}` +
        `&format=geojson&polygon_geojson=1&limit=1&accept-language=es`;

      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/geo+json, application/json' }
        });
        if (!res.ok) continue;

        const geo: any = await res.json();
        const f = geo?.features?.[0];
        if (!f?.geometry) continue;

        const parsed = this.polygonsFromGeoJSONGeometry(f.geometry);
        polys.push(...parsed);
      } catch {
        // En caso de error, simplemente no se agregan polígonos
      }
    }

    this.landPolygons = polys;
  }

  /** Convierte geometrías GeoJSON en polígonos de Google Maps (solo contornos, sin relleno visible). */
  private polygonsFromGeoJSONGeometry(geom: any): google.maps.Polygon[] {
    const ringToPath = (ring: any[]): google.maps.LatLngLiteral[] =>
      ring
        .filter(p => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]))
        .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));

    const polygons: google.maps.Polygon[] = [];

    if (geom?.type === 'Polygon') {
      const rings: any[][] = geom.coordinates || [];
      const paths = rings.map(ringToPath).filter(r => r.length >= 3);

      if (paths.length) {
        polygons.push(
          new google.maps.Polygon({
            paths,
            clickable: false,
            strokeOpacity: 0,
            fillOpacity: 0
          })
        );
      }
    } else if (geom?.type === 'MultiPolygon') {
      const polys: any[][][] = geom.coordinates || [];

      for (const poly of polys) {
        const paths = poly.map(ringToPath).filter(r => r.length >= 3);

        if (paths.length) {
          polygons.push(
            new google.maps.Polygon({
              paths,
              clickable: false,
              strokeOpacity: 0,
              fillOpacity: 0
            })
          );
        }
      }
    }

    return polygons;
  }

  /** Crea y dibuja los marcadores de las compañías de bomberos. */
  private addStations() {
    for (const s of this.STATIONS_LIST) {
      const m = new google.maps.Marker({
        position: s.position,
        title: s.name,
        icon: this.STATION_ICON,
        zIndex: 2,
        map: this.map
      });

      m.addListener('click', () => {
        this.infoWin.setContent(`<strong>${s.name}</strong>`);
        this.infoWin.open({ map: this.map, anchor: m });
      });
    }
  }

  /** Actualiza visibilidad de hidrantes según zoom; carga desde Overpass en zoom >= 14. */
  private async updateHydrantsVisibility() {
    const zoom = this.map.getZoom() ?? 9;

    if (zoom >= 14 && !this.hydrantsLoaded) {
      this.hydrantsLoaded = true;
      await this.addHydrantsWithStreet();
    }

    const show = zoom >= 14;

    for (const m of this.hydrantMarkers) {
      m.setMap(show ? this.map : null);
    }
  }

  /**
   * Carga hidrantes desde Overpass, los dibuja en el mapa
   * y permite consultar la calle cercana al hacer clic.
   */
  private async addHydrantsWithStreet() {
    const query = `[out:json][timeout:50];
      node["emergency"="fire_hydrant"](${this.CHILOE_BOUNDS.south},${this.CHILOE_BOUNDS.west},${this.CHILOE_BOUNDS.north},${this.CHILOE_BOUNDS.east});
      out body;`;

    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

    let hydrants: GHydrant[] = [];

    try {
      const cacheKey = 'hydrants-chiloe-v1';
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        hydrants = JSON.parse(cached);
      } else {
        const res = await fetch(url);
        const json = await res.json();
        hydrants = (json.elements || []).filter((e: any) => e.type === 'node');
        localStorage.setItem(cacheKey, JSON.stringify(hydrants));
      }
    } catch {
      // Si falla la carga, no se muestran hidrantes
    }

    const geocoder = new google.maps.Geocoder();

    for (const h of hydrants) {
      const pos = new google.maps.LatLng(h.lat, h.lon);
      if (!this.chiloeBounds.contains(pos)) continue;

      const m = new google.maps.Marker({
        position: pos,
        icon: this.HYDRANT_ICON,
        title: 'Grifo',
        zIndex: 1,
        map: null
      });

      this.hydrantMarkers.push(m);

      const tags = h.tags ?? {};
      const infoExtra = [
        tags['fire_hydrant:type'] ? `Tipo: ${tags['fire_hydrant:type']}` : '',
        tags['pressure'] ? `Presión: ${tags['pressure']}` : '',
        tags['diameter'] ? `Diámetro: ${tags['diameter']}` : ''
      ].filter(Boolean).join('<br>');

      m.addListener('click', async () => {
        const spanId = 'street-' + Math.random().toString(36).slice(2);

        this.infoWin.setContent(
          `<div style="min-width:240px;color:#111">
             <div style="font-weight:600;margin-bottom:6px">Grifo</div>
             ${infoExtra ? infoExtra + '<br>' : ''}
             <b>Calle:</b> <span id="${spanId}">buscando…</span>
           </div>`
        );

        this.infoWin.open({ map: this.map, anchor: m });

        const street = await this.reverseStreet(pos, tags, geocoder);
        const span = document.getElementById(spanId);
        if (span) span.textContent = street ?? 'Desconocida';
      });
    }

    this.updateHydrantsVisibility();
  }

  // -------------------------------------------------------------
  // REVERSE GEOCODING (CALLES PARA HIDRANTES)
  // -------------------------------------------------------------

  private cacheKey(lat: number, lng: number) {
    return `${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  private streetFromTags(tags?: Record<string, string>) {
    return tags?.['addr:street'] ||
           tags?.['addr:place'] ||
           tags?.['addr:road'] ||
           null;
  }

  private reverseWithGoogle(
    pos: google.maps.LatLng,
    geocoder: google.maps.Geocoder
  ): Promise<string | null> {
    return new Promise(resolve => {
      geocoder.geocode({ location: pos }, (results, status) => {
        if (status === 'OK' && results?.length) {
          const comps = results[0].address_components || [];

          const find = (t: string) =>
            comps.find(c => c.types.includes(t))?.long_name || '';

          const route = find('route');
          const num = find('street_number');
          const locality =
            find('locality') ||
            find('administrative_area_level_3') ||
            find('administrative_area_level_2');

          const text = route
            ? `${route}${num ? ' ' + num : ''}${locality ? ', ' + locality : ''}`
            : (results[0].formatted_address || '');

          resolve(text || null);
        } else {
          resolve(null);
        }
      });
    });
  }

  private async reverseWithNominatim(lat: number, lng: number): Promise<string | null> {
    const diff = Date.now() - this.lastNominatimTs;
    const wait = 1100 - diff;

    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastNominatimTs = Date.now();

    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat
      }&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;

    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return null;

      const data: any = await res.json();
      const a = data.address || {};

      const route =
        a.road ||
        a.pedestrian ||
        a.footway ||
        a.path ||
        a.cycleway ||
        a.residential ||
        a.street ||
        '';

      const num = a.house_number || '';
      const place =
        a.village ||
        a.town ||
        a.city ||
        a.municipality ||
        a.county ||
        '';

      return route
        ? `${route}${num ? ' ' + num : ''}${place ? ', ' + place : ''}`
        : (data.display_name || '');
    } catch {
      return null;
    }
  }

  private async reverseStreet(
    pos: google.maps.LatLng,
    tags: Record<string, string> | undefined,
    geocoder: google.maps.Geocoder
  ): Promise<string | null> {

    const fromTags = this.streetFromTags(tags);
    if (fromTags) return fromTags;

    const key = this.cacheKey(pos.lat(), pos.lng());
    if (this.streetCacheMem.has(key)) return this.streetCacheMem.get(key)!;

    const g = await this.reverseWithGoogle(pos, geocoder);
    if (g) {
      this.streetCacheMem.set(key, g);
      return g;
    }

    const n = await this.reverseWithNominatim(pos.lat(), pos.lng());
    if (n) {
      this.streetCacheMem.set(key, n);
      return n;
    }

    return null;
  }

  // -------------------------------------------------------------
  // HELPERS DE PATRULLAJE Y PRIORIDADES
  // -------------------------------------------------------------

  /**
   * Genera un punto aleatorio cerca del origen, en un rango de metros.
   * Utilizado para que los camiones patrullen alrededor de su posición actual.
   */
  private pickNearbySeed(
    origin: google.maps.LatLng,
    minDistM: number,
    maxDistM: number
  ): google.maps.LatLng {
    const dist = minDistM + Math.random() * (maxDistM - minDistM);
    const bearing = Math.random() * 360;

    const p = google.maps.geometry.spherical.computeOffset(origin, dist, bearing);

    // Se fuerza a permanecer dentro de los límites de Chiloé
    if (!this.chiloeBounds.contains(p)) {
      return origin;
    }

    return p;
  }

  /**
   * Define el número máximo de camiones asignables a un incidente,
   * en función de su prioridad.
   */
  private maxTrucksForIncident(incident: IncidentDoc): number {
    const p = incident.priority ?? this.defaultPriorityForType(incident.type);

    // Política simple:
    //  - Prioridad 3 o 2: hasta 2 camiones
    //  - Prioridad 1: 1 camión
    switch (p) {
      case 3:
      case 2:
        return 2;
      case 1:
      default:
        return 1;
    }
  }

  // -------------------------------------------------------------
  // FLOTA, RUTAS Y PATRULLAJE
  // -------------------------------------------------------------

  /**
   * Crea la flota inicial: por cada estación se generan:
   *  - 2 camiones en base (STANDBY)
   *  - 1 camión patrullero (PATROL)
   */
  private spawnFleetPerCompany() {
    const seen = new Set<string>();

    for (const st of this.STATIONS_LIST) {
      if (seen.has(st.name)) continue;
      seen.add(st.name);

      const base = new google.maps.LatLng(st.position.lat, st.position.lng);

      // 2 camiones en base
      const standby1 = this.createTruck(st.name, base, TruckState.STANDBY);
      const standby2 = this.createTruck(st.name, base, TruckState.STANDBY);

      // 1 camión patrullero
      const patrol = this.createTruck(st.name, base, TruckState.PATROL);
      patrol.isPatroller = true;
      patrol.speedMps = this.SPEED_PATROL;

      this.trucks.push(standby1, standby2, patrol);

      this.startPatrolCycle(patrol);
    }
  }

  /**
   * Crea un camión con marcador en el mapa.
   * El InfoWindow muestra:
   *  - Compañía
   *  - Estado
   *  - ETA (si está respondiendo o retornando)
   */
  private createTruck(
    company: string,
    start: google.maps.LatLng,
    state: TruckState
  ): Truck {

    const m = new google.maps.Marker({
      position: start,
      icon: this.FIRETRUCK_ICON,
      map: this.map,
      title: `Camión de ${company}`
    });

    m.addListener('click', () => {
      const t = this.trucks.find(x => x.marker === m);
      if (!t) return;

      // Mostrar ETA sólo si está en movimiento hacia incidente o base
      let etaHtml = '';
      if (t.state === TruckState.RESPONDING || t.state === TruckState.RETURNING) {
        const remaining = this.getRemainingDistance(t);
        const speed = t.speedMps || 0;
        if (remaining > 0 && speed > 0) {
          const etaSeconds = remaining / speed;
          etaHtml = `<br><b>Hora de llegada en:</b> ${this.formatEta(etaSeconds)}`;
        }
      }

      this.infoWin.setContent(
        `<b>Camión de:</b> ${t.company}<br><b>Estado:</b> ${t.state}${etaHtml}`
      );

      this.infoWin.open({ map: this.map, anchor: m });
    });

    return {
      id: crypto.randomUUID(),
      company,
      home: start,
      marker: m,
      speedMps: state === TruckState.PATROL ? this.SPEED_PATROL : 0,
      route: [start],
      segIdx: 0,
      segT: 0,
      state
    };
  }

  /** Limpia timers asociados al patrullaje de un camión */
  private clearPatrolTimers(t: Truck) {
    if (t.patrolTimeout) {
      clearTimeout(t.patrolTimeout);
      t.patrolTimeout = undefined;
    }
    if (t.patrolResumeTimeout) {
      clearTimeout(t.patrolResumeTimeout);
      t.patrolResumeTimeout = undefined;
    }
  }

  /**
   * Inicia el ciclo de patrullaje de un camión:
   *  - Cambia estado a PATROL
   *  - Define velocidad
   *  - Inicia una "pierna" de patrulla
   *  - Define tiempo máximo en patrulla antes de forzar retorno
   */
  private startPatrolCycle(t: Truck) {
    this.clearPatrolTimers(t);

    t.state = TruckState.PATROL;
    t.speedMps = this.SPEED_PATROL;

    this.startPatrolLeg(t);

    // Máximo de tiempo en patrulla antes de forzar regreso a base
    t.patrolTimeout = setTimeout(() => {
      if (t.state === TruckState.PATROL) {
        this.returnToBase(t, () => this.schedulePatrolResume(t));
      }
    }, this.PATROL_LEG_MAX_MS);
  }

  /**
   * Programa cuándo retomar el patrullaje
   * después de estar en STANDBY en la base.
   */
  private schedulePatrolResume(t: Truck) {
    this.clearPatrolTimers(t);

    if (!t.isPatroller || t.state !== TruckState.STANDBY) return;

    t.patrolResumeTimeout = setTimeout(() => {
      if (!t.isPatroller || t.state !== TruckState.STANDBY) return;
      this.startPatrolCycle(t);
    }, this.PATROL_DWELL_MS);
  }

  /**
   * Define una "pierna" de patrulla:
   *  - Selecciona un punto aleatorio a ~2 km
   *  - Pide ruta a Directions API
   *  - Si falla, usa una línea recta de fallback
   */
  private startPatrolLeg(t: Truck) {
    if (t.state !== TruckState.PATROL) return;

    const origin = t.marker.getPosition()!;
    // Patrulla en radio aproximado 2 km desde su posición actual
    const roughTarget = this.pickNearbySeed(origin, 1800, 2200);

    this.enqueueRouteRequest(() =>
      this.fetchDirectionsPath(origin, roughTarget)
        .then(path => {
          if (t.state !== TruckState.PATROL) return;

          if (path.length < 2) {
            this.useStraightFallback(t, roughTarget);
            setTimeout(() => this.startPatrolLeg(t), 2000);
            return;
          }

          t.route = path;
          t.segIdx = 0;
          t.segT = 0;

          if (t.routeLine) {
            t.routeLine.setMap(null);
            t.routeLine = undefined;
          }
        })
        .catch(() => {
          this.useStraightFallback(t, roughTarget);
          setTimeout(() => this.startPatrolLeg(t), 2000);
        })
    );
  }

  // -------------------------------------------------------------
  // DISPATCH — LÓGICA CON LÍMITE DE CAMIONES POR INCIDENTE
  // -------------------------------------------------------------

  /**
   * Selecciona el mejor camión disponible para un incidente:
   *  1. Revisa máximo de camiones permitidos por prioridad.
   *  2. Pre-filtra por distancia en línea recta.
   *  3. Para los 3 más cercanos, calcula distancia real de ruta.
   *  4. Asigna el camión con menor distancia.
   */
  private async dispatchBest(incidentMarker: google.maps.Marker, incident: IncidentDoc) {
    const pos = incidentMarker.getPosition()!;
    const incidentId = incident.id;

    // Estado de asignaciones para este incidente
    const max = this.maxTrucksForIncident(incident);
    let entry = this.incidentAssignments.get(incidentId);

    if (!entry) {
      entry = { truckIds: new Set<string>(), max, closed: false };
      this.incidentAssignments.set(incidentId, entry);
    } else {
      entry.max = max; // por si cambia la prioridad en Firestore
    }

    if (entry.closed) {
      const toast = await this.toastController.create({
        message: 'Este incidente ya fue cerrado.',
        duration: 2500,
        color: 'medium',
        position: 'bottom',
        cssClass: 'incident-toast'
      });
      await toast.present();
      return;
    }

    // ¿Ya se alcanzó el máximo de camiones asignados?
    if (entry.truckIds.size >= entry.max) {
      const msg =
        entry.max === 1
          ? 'Ya se está haciendo cargo un carro bomba.'
          : 'Ya se están haciendo cargo 2 carros bomba.';

      const toast = await this.toastController.create({
        message: msg,
        duration: 2500,
        color: 'warning',
        position: 'bottom',
        cssClass: 'incident-toast'
      });
      await toast.present();
      return;
    }

    // Candidatos: camiones en base o patrullando que NO estén ya asignados a este incidente
    const candidates = this.trucks.filter(
      t =>
        (t.state === TruckState.STANDBY || t.state === TruckState.PATROL) &&
        !entry!.truckIds.has(t.id)
    );
    if (!candidates.length) return;

    // 1) Pre-filtro por distancia en línea recta
    const withStraight = candidates.map(t => ({
      truck: t,
      straightDist: google.maps.geometry.spherical.computeDistanceBetween(
        t.marker.getPosition()!,
        pos
      )
    }));

    // Ordenar por más cercano (straight line)
    withStraight.sort((a, b) => a.straightDist - b.straightDist);

    // Tomar como máximo los 3 más cercanos
    const shortlist = withStraight.slice(0, Math.min(3, withStraight.length));

    // 2) Distancia real de ruta usando Directions API
    const results = await Promise.all(
      shortlist.map(async ({ truck }) => {
        const origin = truck.marker.getPosition()!;
        try {
          const res = await this.directionsService.route({
            origin,
            destination: pos,
            travelMode: google.maps.TravelMode.DRIVING,
            avoidFerries: true
          });
          const leg = res.routes?.[0]?.legs?.[0];
          const distMeters = leg?.distance?.value ?? Number.POSITIVE_INFINITY;
          return { truck, distMeters };
        } catch {
          return { truck, distMeters: Number.POSITIVE_INFINITY };
        }
      })
    );

    const valid = results.filter(r => isFinite(r.distMeters));
    if (!valid.length) return;

    // 3) Elegir el camión con menor distancia de ruta
    valid.sort((a, b) => a.distMeters - b.distMeters);
    const chosen = valid[0].truck;

    // Registrar asignación
    entry.truckIds.add(chosen.id);

    this.clearPatrolTimers(chosen);

    // Asegurar que exista polilínea para la ruta roja
    if (!chosen.routeLine) {
      chosen.routeLine = new google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: '#ff3b30',
        strokeOpacity: 0.95,
        strokeWeight: 3,
        map: this.map,
        zIndex: 3
      });
    }

    // Enviar camión al incidente
    this.gotoByDirections(chosen, pos, () => {
      chosen.state = TruckState.ATTENDING;
      chosen.speedMps = 0;

      setTimeout(() => {
        this.onTruckFinishedIncident(incident, incidentMarker, chosen);
      }, this.ATTEND_MS);
    });
  }

  /**
   * Cuando un camión termina de atender un incidente:
   *  - Se actualiza el estado de asignaciones.
   *  - Si fue el último camión, se cierra el incidente en Firestore.
   *  - El camión retorna a su base.
   */
  private onTruckFinishedIncident(
    incident: IncidentDoc,
    incidentMarker: google.maps.Marker,
    truck: Truck
  ) {
    const incidentId = incident.id;
    const entry = this.incidentAssignments.get(incidentId);

    if (entry) {
      if (entry.closed) {
        // El incidente ya estaba cerrado
        this.returnToBase(truck, () => {
          if (truck.isPatroller) this.schedulePatrolResume(truck);
        });
        return;
      }

      // Desasociar este camión
      entry.truckIds.delete(truck.id);

      // Si ya no quedan camiones asignados → cerrar incidente
      if (entry.truckIds.size === 0) {
        this.closeIncident(incident, incidentMarker);
        entry.closed = true;
      }
    } else {
      // Sin entry en memoria, se intenta cerrar por seguridad
      this.closeIncident(incident, incidentMarker);
    }

    // En todos los casos, el camión vuelve a base
    this.returnToBase(truck, () => {
      if (truck.isPatroller) this.schedulePatrolResume(truck);
    });
  }

  /**
   * Cierra el incidente en Firestore y limpia marcador en el mapa.
   */
  private async closeIncident(incident: IncidentDoc, incidentMarker: google.maps.Marker) {
    incidentMarker.setMap(null);

    const entry = this.incidentAssignments.get(incident.id);
    if (entry) entry.closed = true;

    try {
      if (!getApps().length) initializeApp(environment.firebase);
      const db = getFirestore();
      const ref = doc(db, 'incidents', incident.id);
      await updateDoc(ref, {
        status: 'closed',
        updatedAt: serverTimestamp(),
        closedAt: serverTimestamp()
      });
      console.log(`Incidente ${incident.id} cerrado en Firestore`);
    } catch (e) {
      console.error('Error al cerrar incidente en Firestore', e);
    }
  }

  // -------------------------------------------------------------
  // RUTEO / DIRECTIONS API
  // -------------------------------------------------------------

  /** Genera un número aleatorio en rango */
  private rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  /** Punto aleatorio dentro de Chiloé (fallback geométrico) */
  private randOnLand(): LatLng {
    for (let i = 0; i < 60; i++) {
      const p = new google.maps.LatLng(
        this.rand(this.CHILOE_BOUNDS.south, this.CHILOE_BOUNDS.north),
        this.rand(this.CHILOE_BOUNDS.west,  this.CHILOE_BOUNDS.east)
      );
      if (this.isOnLand(p)) return { lat: p.lat(), lng: p.lng() };
    }
    return { lat: -42.6, lng: -73.9 };
  }

  /** Verifica si un punto está dentro de tierra (polígonos o bounds) */
  private isOnLand(p: google.maps.LatLng): boolean {
    if (!this.landPolygons.length) return this.chiloeBounds.contains(p);

    if (!this.geometryReady || !google.maps.geometry?.poly?.containsLocation) {
      return this.chiloeBounds.contains(p);
    }

    try {
      return this.landPolygons.some(poly =>
        google.maps.geometry.poly.containsLocation(p, poly)
      );
    } catch {
      return this.chiloeBounds.contains(p);
    }
  }

  /**
   * Envía un camión al destino usando Directions API.
   * Mantiene referencia al callback en caso de llegada.
   */
  private gotoByDirections(
    truck: Truck,
    target: google.maps.LatLng,
    onArrive: () => void
  ) {
    truck.state = TruckState.RESPONDING;
    truck.speedMps = this.SPEED_RESPONSE;
    truck.target = target;

    const origin = truck.marker.getPosition()!;
    const key = this.dirKey(origin, target);
    const cached = this.dirCache.get(key);

    this.clearPatrolTimers(truck);

    const apply = (path: google.maps.LatLng[]) => {
      this.applyRoute(truck, path);

      const watch = () => {
        if (truck.state !== TruckState.RESPONDING) return;

        const d = google.maps.geometry.spherical.computeDistanceBetween(
          truck.marker.getPosition()!,
          target
        );

        if (d < 25) {
          if (truck.routeLine) truck.routeLine.setMap(null);
          onArrive();
        } else {
          requestAnimationFrame(watch);
        }
      };

      requestAnimationFrame(watch);
    };

    if (cached) {
      apply(cached);
      return;
    }

    this.enqueueRouteRequest(() =>
      this.fetchDirectionsPath(origin, target)
        .then(path => {
          if (path.length > 1) {
            this.dirCache.set(key, path);
            apply(path);
          } else {
            this.useStraightFallback(truck, target);
          }
        })
        .catch(() => this.useStraightFallback(truck, target))
    );
  }

  /**
   * Retorna un camión a su base (home).
   */
  private returnToBase(
    truck: Truck,
    onArrivedBase?: () => void
  ) {
    truck.state = TruckState.RETURNING;
    truck.speedMps = this.SPEED_RETURN;

    const origin = truck.marker.getPosition()!;
    const target = truck.home;

    const key = this.dirKey(origin, target);
    const cached = this.dirCache.get(key);

    const finish = () => {
      const d = google.maps.geometry.spherical.computeDistanceBetween(
        truck.marker.getPosition()!,
        truck.home
      );

      if (d < 15) {
        truck.state = TruckState.STANDBY;
        truck.speedMps = 0;

        truck.route = [truck.home];
        truck.segIdx = 0;
        truck.segT = 0;

        if (truck.routeLine) {
          truck.routeLine.setMap(null);
        }

        if (onArrivedBase) onArrivedBase();
        else if (truck.isPatroller) this.schedulePatrolResume(truck);
      } else {
        requestAnimationFrame(finish);
      }
    };

    const apply = (path: google.maps.LatLng[]) => {
      this.applyRoute(truck, path);
      requestAnimationFrame(finish);
    };

    if (cached) {
      apply(cached);
      return;
    }

    this.enqueueRouteRequest(() =>
      this.fetchDirectionsPath(origin, target)
        .then(path => {
          if (path.length > 1) {
            this.dirCache.set(key, path);
            apply(path);
          } else {
            this.useStraightFallback(truck, target);
          }
        })
        .catch(() => this.useStraightFallback(truck, target))
    );
  }

  /** Usa Directions API y obtiene la ruta paso a paso */
  private async fetchDirectionsPath(
    origin: google.maps.LatLng,
    destination: google.maps.LatLng
  ): Promise<google.maps.LatLng[]> {

    const res = await this.directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidFerries: true
    });

    const route = res.routes?.[0];
    const leg = route?.legs?.[0];

    if (!leg?.steps?.length) return route?.overview_path ?? [];

    const points: google.maps.LatLng[] = [];

    for (const s of leg.steps) {
      if (s.path?.length) points.push(...s.path);
    }

    return points.length ? points : (route?.overview_path ?? []);
  }

  /** Aplica una ruta completa a un camión */
  private applyRoute(truck: Truck, path: google.maps.LatLng[]) {
    truck.route = path;
    truck.segIdx = 0;
    truck.segT = 0;

    if (!truck.routeLine) {
      truck.routeLine = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#ff3b30',
        strokeOpacity: 0.95,
        strokeWeight: 3,
        map: this.map,
        zIndex: 3
      });
    } else {
      truck.routeLine.setPath(path);
      truck.routeLine.setMap(this.map);
    }
  }

  /** Fallback: línea recta si Directions API falla */
  private useStraightFallback(truck: Truck, target: google.maps.LatLng) {
    truck.route = [truck.marker.getPosition()!, target];
    truck.segIdx = 0;
    truck.segT = 0;

    if (!truck.routeLine) {
      truck.routeLine = new google.maps.Polyline({
        path: truck.route,
        geodesic: true,
        strokeColor: '#ff3b30',
        strokeOpacity: 0.95,
        strokeWeight: 3,
        map: this.map,
        zIndex: 3
      });
    } else {
      truck.routeLine.setPath(truck.route);
      truck.routeLine.setMap(this.map);
    }
  }

  /**
   * Cola de peticiones a Directions API
   * Evita saturar la API con muchas solicitudes simultáneas.
   */
  private enqueueRouteRequest(run: () => void) {
    this.routeQueue.push(run);

    if (!this.processingQueue) {
      this.processingQueue = true;

      const pump = () => {
        const now = Date.now();
        const elapsed = now - this.lastRouteTs;

        if (this.routeQueue.length) {
          if (elapsed >= this.ROUTE_THROTTLE_MS) {
            const job = this.routeQueue.shift()!;
            this.lastRouteTs = now;

            try { job(); } catch {}
          }

          setTimeout(
            pump,
            Math.max(10, this.ROUTE_THROTTLE_MS - (Date.now() - this.lastRouteTs))
          );
        } else {
          this.processingQueue = false;
        }
      };

      pump();
    }
  }

  // -------------------------------------------------------------
  // ANIMACIÓN — requestAnimationFrame + Motor de física
  // -------------------------------------------------------------

  private tickRaf = (ts: number) => {
    const dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    this.acc += dt;

    while (this.acc >= this.STEP) {
      this.physicsStep(this.STEP);
      this.acc -= this.STEP;
    }

    this.rafId = requestAnimationFrame(this.tickRaf);
  };

  /**
   * Avanza la simulación física de TODOS los camiones.
   * Según su estado, se mueven o permanecen quietos.
   */
  private physicsStep(step: number) {
    for (const t of this.trucks) {
      switch (t.state) {
        case TruckState.STANDBY:
        case TruckState.ATTENDING:
          // No se mueven
          break;

        case TruckState.RESPONDING:
        case TruckState.RETURNING:
        case TruckState.PATROL:
          this.advanceAlongRoute(t, step, () => {
            if (t.state === TruckState.PATROL) {
              this.returnToBase(t, () => {
                if (t.isPatroller) this.schedulePatrolResume(t);
              });
            }
          });
          break;
      }
    }
  }

  /**
   * Lógica de movimiento de un camión sobre su ruta:
   *  - Interpolación entre puntos
   *  - Eliminación del tramo recorrido (ruta "achicándose")
   *  - Llamado al callback cuando llega al final
   */
  private advanceAlongRoute(
    t: Truck,
    dt: number,
    onEnd: () => void
  ) {
    if (!t.route || t.route.length < 2) {
      onEnd();
      return;
    }

    // Velocidad según estado
    const speed =
      t.state === TruckState.RESPONDING
        ? this.SPEED_RESPONSE :
      t.state === TruckState.RETURNING
        ? this.SPEED_RETURN :
      t.state === TruckState.PATROL
        ? (t.speedMps || this.SPEED_PATROL) :
        0;

    if (speed <= 0) return;

    let remaining = speed * dt;

    while (remaining > 0 && t.segIdx < t.route.length - 1) {
      const a = t.route[t.segIdx];
      const b = t.route[t.segIdx + 1];

      const segLen = google.maps.geometry.spherical.computeDistanceBetween(a, b);
      if (segLen <= 0.1) {
        t.segIdx++;
        t.segT = 0;
        continue;
      }

      const distOnSeg = segLen * (1 - t.segT);

      if (remaining < distOnSeg) {
        // Permanecemos en el mismo segmento
        t.segT += remaining / segLen;
        remaining = 0;
      } else {
        // Avanzamos al siguiente segmento
        remaining -= distOnSeg;
        t.segIdx++;
        t.segT = 0;
      }
    }

    // Al final de la ruta
    if (t.segIdx >= t.route.length - 1) {
      const last = t.route[t.route.length - 1];
      t.marker.setPosition(last);

      if (t.routeLine) {
        t.routeLine.setMap(null);
      }

      onEnd();
      return;
    }

    // Interpolación dentro del segmento actual
    const start = t.route[t.segIdx];
    const end = t.route[t.segIdx + 1];

    const heading = google.maps.geometry.spherical.computeHeading(start, end);
    const segDist = google.maps.geometry.spherical.computeDistanceBetween(start, end);

    const pos = google.maps.geometry.spherical.computeOffset(
      start,
      segDist * t.segT,
      heading
    );

    t.marker.setPosition(pos);

    // 🔥 Actualizar polilínea para que se vaya achicando
    if (t.routeLine) {
      const remainingPath: google.maps.LatLng[] = [pos];
      for (let i = t.segIdx + 1; i < t.route.length; i++) {
        remainingPath.push(t.route[i]);
      }
      t.routeLine.setPath(remainingPath);
    }
  }

  // -------------------------------------------------------------
  // HELPERS PARA ETA (DISTANCIA RESTANTE)
  // -------------------------------------------------------------

  /** Distancia restante a lo largo de la ruta actual (para ETA) */
  private getRemainingDistance(t: Truck): number {
    if (!t.route || t.route.length < 2) return 0;
    const currentPos = t.marker.getPosition();
    if (!currentPos) return 0;

    let dist = 0;

    const idx = t.segIdx;
    const nextIdx = Math.min(idx + 1, t.route.length - 1);

    // Distancia desde la posición actual al siguiente punto
    dist += google.maps.geometry.spherical.computeDistanceBetween(
      currentPos,
      t.route[nextIdx]
    );

    // Sumar segmentos restantes completos
    for (let i = nextIdx; i < t.route.length - 1; i++) {
      dist += google.maps.geometry.spherical.computeDistanceBetween(
        t.route[i],
        t.route[i + 1]
      );
    }

    return dist;
  }

  /** Formato bonito para ETA */
  private formatEta(totalSeconds: number): string {
    const sec = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    const parts: string[] = [];
    if (h > 0) parts.push(`${h} h`);
    if (m > 0) parts.push(`${m} min`);
    parts.push(`${s} s`);

    return parts.join(' ');
  }
}
