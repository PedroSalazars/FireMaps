import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonFab, IonFabButton, IonFabList, IonButton, IonFooter
} from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { Loader } from '@googlemaps/js-api-loader';
import { environment } from '../../environments/environment';

// Firebase SDK Web
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, addDoc,
  serverTimestamp, GeoPoint, QuerySnapshot, DocumentData
} from 'firebase/firestore';

type LatLng = { lat: number; lng: number };
type FireStation = { name: string; position: LatLng };
type GHydrant = { lat: number; lon: number; tags?: Record<string, string> };
type IncidentType = 'Incendio' | 'FuGas' | 'rescate' | 'choque';

type IncidentDoc = {
  id: string;
  type: IncidentType;
  status: string;
  priority?: number;
  address?: string | null;
  location: { latitude: number; longitude: number };
  createdAt?: Date;
};

enum TruckState {
  STANDBY = 'En base',
  RESPONDING = 'Respondiendo',
  ATTENDING = 'Atendiendo',
  RETURNING = 'Retornando',
  PATROL = 'Patrullando'
}

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

  // patrullaje
  isPatroller?: boolean;
  patrolTimeout?: any;
  patrolResumeTimeout?: any;
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonFab, IonFabButton, IonFabList,
    IonButton, IonFooter,
    RouterLink
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements AfterViewInit, OnDestroy {
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

  private dirCache = new Map<string, google.maps.LatLng[]>();
  private toLiteral(p: google.maps.LatLng | google.maps.LatLngLiteral): google.maps.LatLngLiteral {
    return p instanceof google.maps.LatLng ? { lat: p.lat(), lng: p.lng() } : p;
  }
  private dirKey(a: google.maps.LatLng | google.maps.LatLngLiteral,
                 b: google.maps.LatLng | google.maps.LatLngLiteral): string {
    const A = this.toLiteral(a), B = this.toLiteral(b);
    return `${A.lat.toFixed(5)},${A.lng.toFixed(5)}->${B.lat.toFixed(5)},${B.lng.toFixed(5)}`;
  }

  private routeQueue: Array<() => void> = [];
  private processingQueue = false;
  private lastRouteTs = 0;
  private readonly ROUTE_THROTTLE_MS = 700;

  private incidentMarkersByType: Record<IncidentType, google.maps.Marker[]> = {
    Incendio: [], FuGas: [], rescate: [], choque: []
  };
  private incidentMarkersById = new Map<string, google.maps.Marker>();
  private unsubIncidents?: () => void;

  private landPolygons: google.maps.Polygon[] = [];

  private streetCacheMem = new Map<string, string>();
  private lastNominatimTs = 0;

  private geometryReady = false;

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

  private readonly STEP = 0.05;
  private acc = 0;
  private lastTs = 0;
  private rafId = 0;

  private readonly SPEED_RESPONSE   = 22;
  private readonly SPEED_RETURN     = 14;
  private readonly SPEED_PATROL     = 12;

  private readonly ATTEND_MS = 20000;

  private readonly PATROL_LEG_MAX_MS = 60_000;
  private readonly PATROL_DWELL_MS   = 600_000;

  private readonly INCIDENTS_MIN = 3;
  private readonly INCIDENTS_MAX = 5;

  private hydrantsLoaded = false;
  private hydrantMarkers: google.maps.Marker[] = [];

  async ngAfterViewInit() {
    const el = document.getElementById('map') as HTMLElement;

    await new Promise<void>((resolve) => {
      const ok = () => el.offsetWidth > 0 && el.offsetHeight > 0;
      if (ok()) return resolve();
      const id = setInterval(() => { if (ok()) { clearInterval(id); resolve(); } }, 16);
    });

    const loader = new Loader({
      apiKey: environment.googleMapsApiKey,
      version: 'weekly',
      language: 'es',
      region: 'CL',
      libraries: ['geometry'] as any
    });
    await loader.load();

    this.geometryReady = !!google.maps.geometry?.spherical && !!google.maps.geometry?.poly;

    this.STATION_ICON = { url: 'assets/icons/station@2x.png', scaledSize: new google.maps.Size(28, 28), anchor: new google.maps.Point(14, 28) };
    this.HYDRANT_ICON = { url: 'assets/icons/hydrant@2x.png',  scaledSize: new google.maps.Size(24, 24), anchor: new google.maps.Point(12, 24) };
    this.INCIDENT_ICONS = {
      Incendio: { url: 'assets/icons/Incendio.png', scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
      FuGas:    { url: 'assets/icons/FuGas.png',    scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
      rescate:  { url: 'assets/icons/rescate.png',  scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
      choque:   { url: 'assets/icons/choque.png',   scaledSize: new google.maps.Size(32, 32), anchor: new google.maps.Point(16, 32) },
    };
    this.FIRETRUCK_ICON = { url: 'assets/icons/camionbomberos.png', scaledSize: new google.maps.Size(36, 36), anchor: new google.maps.Point(18, 18) };

    this.chiloeBounds = new google.maps.LatLngBounds(
      { lat: this.CHILOE_BOUNDS.south, lng: this.CHILOE_BOUNDS.west },
      { lat: this.CHILOE_BOUNDS.north, lng: this.CHILOE_BOUNDS.east }
    );
    this.map = new google.maps.Map(el, {
      center: { lat: -42.6, lng: -73.9 },
      zoom: 9, minZoom: 8, maxZoom: 19,
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
      restriction: { latLngBounds: this.CHILOE_BOUNDS, strictBounds: true }
    });
    this.map.fitBounds(this.chiloeBounds, 24);
    this.infoWin = new google.maps.InfoWindow();

    this.directionsService = new google.maps.DirectionsService();

    this.addMaskPolygon();
    try { await this.loadLandPolygons(); } catch {}

    this.addStations();

    this.map.addListener('zoom_changed', () => this.updateHydrantsVisibility());
    this.updateHydrantsVisibility();

    this.startFirestoreSubscription();

    this.spawnFleetPerCompany();

    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.tickRaf);
  }

  private startFirestoreSubscription() {
    if (!getApps().length) initializeApp(environment.firebase);
    const db = getFirestore();
    const colRef = collection(db, 'incidents');

    this.unsubIncidents = onSnapshot(colRef, (snap: QuerySnapshot<DocumentData>) => {
      const next: IncidentDoc[] = [];
      snap.forEach(doc => {
        const d = doc.data() as any;
        const loc = d.location;
        next.push({
          id: doc.id,
          type: (d.type as IncidentType) ?? 'Incendio',
          status: d.status ?? 'open',
          priority: d.priority,
          address: d.address ?? null,
          location: { latitude: loc?.latitude ?? 0, longitude: loc?.longitude ?? 0 },
          createdAt: d.createdAt?.toDate?.()
        });
      });
      this.syncIncidentMarkers(next);
    });
  }

  private syncIncidentMarkers(list: IncidentDoc[]) {
    const seen = new Set<string>();

    for (const i of list) {
      seen.add(i.id);
      const pos = new google.maps.LatLng(i.location.latitude, i.location.longitude);
      const icon = this.INCIDENT_ICONS[i.type] || this.INCIDENT_ICONS['Incendio'];

      let marker = this.incidentMarkersById.get(i.id);
      if (!marker) {
        marker = new google.maps.Marker({
          position: pos,
          map: this.map,
          icon,
          title: `${i.type}${i.address ? ' - ' + i.address : ''}`,
          zIndex: 3
        });
        marker.addListener('click', () => this.dispatchBest(marker!, i.type));
        this.incidentMarkersById.set(i.id, marker);
        this.incidentMarkersByType[i.type].push(marker);
      } else {
        marker.setPosition(pos);
        marker.setIcon(icon);
        marker.setTitle(`${i.type}${i.address ? ' - ' + i.address : ''}`);
        if (!marker.getMap()) marker.setMap(this.map);
      }
    }

    for (const [id, marker] of this.incidentMarkersById.entries()) {
      if (!seen.has(id)) {
        marker.setMap(null);
        this.incidentMarkersById.delete(id);
        (Object.keys(this.incidentMarkersByType) as IncidentType[]).forEach(t => {
          this.incidentMarkersByType[t] = this.incidentMarkersByType[t].filter(m => m !== marker);
        });
      }
    }
  }

  public async reportQuickIncident() {
    if (!getApps().length) initializeApp(environment.firebase);
    const db = getFirestore();
    const colRef = collection(db, 'incidents');
    await addDoc(colRef, {
      type: 'Incendio',
      status: 'open',
      priority: 2,
      address: 'Reporte rápido desde app',
      location: new GeoPoint(-42.481 + (Math.random() - 0.5) * 0.02, -73.764 + (Math.random() - 0.5) * 0.02),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  clearIncidents() {
    (Object.keys(this.incidentMarkersByType) as IncidentType[]).forEach(t => {
      this.incidentMarkersByType[t].forEach(m => m.setMap(null));
      this.incidentMarkersByType[t] = [];
    });
    for (const [, m] of this.incidentMarkersById) m.setMap(null);
    this.incidentMarkersById.clear();
  }

  public async generateIncidents(n?: number): Promise<void> {
    const count = typeof n === 'number'
      ? n
      : this.INCIDENTS_MIN + Math.floor(Math.random() * (this.INCIDENTS_MAX - this.INCIDENTS_MIN + 1));
    const types: IncidentType[] = ['Incendio', 'FuGas', 'rescate', 'choque'];

    for (let i = 0; i < count; i++) {
      const t = types[Math.floor(Math.random() * types.length)];
      await this.addIncidentSnappedToRoad(t);
    }
  }

  private async addIncidentSnappedToRoad(type: IncidentType) {
    const station = this.randomStation();
    const stationLatLng = new google.maps.LatLng(station.position.lat, station.position.lng);

    for (let attempt = 0; attempt < 6; attempt++) {
      const seed = this.pickNearbySeed(stationLatLng, 3000, 10000);
      const path = await this.safeFetchPath(stationLatLng, seed);
      if (path.length < 2) continue;

      const snapped = path[Math.floor(Math.random() * path.length)];
      const minDistFromAnyStation = 1500;
      if (this.minDistanceToStations(snapped) < minDistFromAnyStation) continue;

      const verify = await this.safeFetchPath(stationLatLng, snapped);
      if (verify.length < 2) continue;

      const marker = new google.maps.Marker({
        position: snapped, icon: this.INCIDENT_ICONS[type], title: type, zIndex: 3, map: this.map
      });
      marker.addListener('click', () => this.dispatchBest(marker, type));
      this.incidentMarkersByType[type].push(marker);
      return;
    }

    const pos = this.randOnLand();
    const marker = new google.maps.Marker({
      position: pos, icon: this.INCIDENT_ICONS[type], title: type, zIndex: 3, map: this.map
    });
    marker.addListener('click', () => this.dispatchBest(marker, type));
    this.incidentMarkersByType[type].push(marker);
  }

  private minDistanceToStations(p: google.maps.LatLng): number {
    let best = Infinity;
    for (const st of this.STATIONS_LIST) {
      const d = google.maps.geometry.spherical.computeDistanceBetween(
        p, new google.maps.LatLng(st.position.lat, st.position.lng)
      );
      if (d < best) best = d;
    }
    return best;
  }

  private randomStation(): FireStation {
    return this.STATIONS_LIST[Math.floor(Math.random() * this.STATIONS_LIST.length)];
  }

  private pickNearbySeed(origin: google.maps.LatLng, minM: number, maxM: number): google.maps.LatLng {
    const dist = minM + Math.random() * (maxM - minM);
    const bear = Math.random() * 360;
    return google.maps.geometry.spherical.computeOffset(origin, dist, bear);
  }

  private async safeFetchPath(a: google.maps.LatLng, b: google.maps.LatLng): Promise<google.maps.LatLng[]> {
    try { return await this.fetchDirectionsPath(a, b); }
    catch { return []; }
  }

  private async dispatchBest(incidentMarker: google.maps.Marker, _type: IncidentType) {
    const pos = incidentMarker.getPosition()!;
    const candidates = this.trucks.filter(t => t.state === TruckState.STANDBY || t.state === TruckState.PATROL);
    if (!candidates.length) return;

    candidates.sort((t1, t2) => {
      const d1 = google.maps.geometry.spherical.computeDistanceBetween(t1.marker.getPosition()!, pos);
      const d2 = google.maps.geometry.spherical.computeDistanceBetween(t2.marker.getPosition()!, pos);
      return d1 - d2;
    });
    const chosen = candidates[0];

    this.clearPatrolTimers(chosen);

    this.gotoByDirections(chosen, pos, () => {
      chosen.state = TruckState.ATTENDING;
      chosen.speedMps = 0;
      setTimeout(() => {
        incidentMarker.setMap(null);
        this.returnToBase(chosen, () => {
          if (chosen.isPatroller) this.schedulePatrolResume(chosen);
        });
      }, this.ATTEND_MS);
    });
  }

  private rand(min: number, max: number) { return min + Math.random() * (max - min); }

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

  private isOnLand(p: google.maps.LatLng): boolean {
    if (!this.landPolygons.length) return this.chiloeBounds.contains(p);
    if (!this.geometryReady || !google.maps.geometry?.poly?.containsLocation) {
      return this.chiloeBounds.contains(p);
    }
    try {
      return this.landPolygons.some(poly => google.maps.geometry.poly.containsLocation(p, poly));
    } catch {
      return this.chiloeBounds.contains(p);
    }
  }

  private async loadLandPolygons() {
    const islands = ['Isla Grande de Chiloé', 'Isla Quinchao', 'Isla Lemuy'];
    const polys: google.maps.Polygon[] = [];

    for (const name of islands) {
      const diff = Date.now() - this.lastNominatimTs;
      const wait = 1100 - diff;
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      this.lastNominatimTs = Date.now();

      const url =
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(name + ', Chile')}` +
        `&format=geojson&polygon_geojson=1&limit=1&accept-language=es`;

      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/geo+json, application/json' } });
        if (!res.ok) continue;
        const geo: any = await res.json();
        const f = geo?.features?.[0];
        if (!f?.geometry) continue;

        const newPolys = this.polygonsFromGeoJSONGeometry(f.geometry);
        polys.push(...newPolys);
      } catch {}
    }
    this.landPolygons = polys;
  }

  private polygonsFromGeoJSONGeometry(geom: any): google.maps.Polygon[] {
    const ringToPath = (ring: any[]): google.maps.LatLngLiteral[] =>
      ring
        .filter(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));

    const polygons: google.maps.Polygon[] = [];

    if (geom?.type === 'Polygon') {
      const rings: any[][] = geom.coordinates || [];
      const paths: google.maps.LatLngLiteral[][] = rings.map(ringToPath).filter(r => r.length >= 3);
      if (paths.length) polygons.push(new google.maps.Polygon({ paths, clickable: false, strokeOpacity: 0, fillOpacity: 0 }));
    } else if (geom?.type === 'MultiPolygon') {
      const polys: any[][][] = geom.coordinates || [];
      for (const poly of polys) {
        const paths: google.maps.LatLngLiteral[][] = poly.map(ringToPath).filter(r => r.length >= 3);
        if (paths.length) polygons.push(new google.maps.Polygon({ paths, clickable: false, strokeOpacity: 0, fillOpacity: 0 }));
      }
    }
    return polygons;
  }

  private addStations() {
    for (const s of this.STATIONS_LIST) {
      const m = new google.maps.Marker({
        position: s.position, title: s.name, icon: this.STATION_ICON, zIndex: 2, map: this.map
      });
      m.addListener('click', () => {
        this.infoWin.setContent(`<strong>${s.name}</strong>`);
        this.infoWin.open({ map: this.map, anchor: m });
      });
    }
  }

  private async updateHydrantsVisibility() {
    const zoom = this.map.getZoom() ?? 9;

    if (zoom >= 14 && !this.hydrantsLoaded) {
      this.hydrantsLoaded = true;
      await this.addHydrantsWithStreet();
    }

    const show = zoom >= 14;
    for (const m of this.hydrantMarkers) m.setMap(show ? this.map : null);
  }

  private async addHydrantsWithStreet() {
    const overpassQuery = `[out:json][timeout:50];
      node["emergency"="fire_hydrant"](${this.CHILOE_BOUNDS.south},${this.CHILOE_BOUNDS.west},${this.CHILOE_BOUNDS.north},${this.CHILOE_BOUNDS.east});
      out body;`;
    const overpassURL = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery);

    let hydrants: GHydrant[] = [];
    try {
      const cacheKey = 'hydrants-chiloe-v1';
      const cached = localStorage.getItem(cacheKey);
      if (cached) hydrants = JSON.parse(cached);
      else {
        const res = await fetch(overpassURL);
        const json = await res.json();
        hydrants = (json.elements || []).filter((e: any) => e.type === 'node');
        localStorage.setItem(cacheKey, JSON.stringify(hydrants));
      }
    } catch {}

    const geocoder = new google.maps.Geocoder();

    for (const h of hydrants) {
      const pos = new google.maps.LatLng(h.lat, h.lon);
      if (!this.chiloeBounds.contains(pos)) continue;

      const m = new google.maps.Marker({
        position: pos, icon: this.HYDRANT_ICON, title: 'Grifo', zIndex: 1, map: null
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

  private addMaskPolygon() {
    const WORLD_RECT = [
      { lat: 85,  lng: -180 }, { lat: 85,  lng: 180 },
      { lat: -85, lng: 180  }, { lat: -85, lng: -180 }
    ];
    const HOLE_RECT = [
      { lat: this.CHILOE_BOUNDS.north, lng: this.CHILOE_BOUNDS.west },
      { lat: this.CHILOE_BOUNDS.north, lng: this.CHILOE_BOUNDS.east },
      { lat: this.CHILOE_BOUNDS.south, lng: this.CHILOE_BOUNDS.east },
      { lat: this.CHILOE_BOUNDS.south, lng: this.CHILOE_BOUNDS.west }
    ];
    new google.maps.Polygon({
      paths: [WORLD_RECT, HOLE_RECT],
      strokeOpacity: 0, fillColor: '#000', fillOpacity: 0.45, clickable: false, map: this.map
    });
  }

  private cacheKey(lat: number, lng: number) { return `${lat.toFixed(6)},${lng.toFixed(6)}`; }
  private streetFromTags(tags?: Record<string,string>) {
    return tags?.['addr:street'] || tags?.['addr:place'] || tags?.['addr:road'] || null;
  }
  private reverseWithGoogle(pos: google.maps.LatLng, geocoder: google.maps.Geocoder): Promise<string | null> {
    return new Promise((resolve) => {
      geocoder.geocode({ location: pos }, (results, status) => {
        if (status === 'OK' && results?.length) {
          const comps = results[0].address_components || [];
          const find = (t: string) => comps.find(c => c.types.includes(t))?.long_name || '';
          const route = find('route'); const number = find('street_number');
          const locality = find('locality') || find('administrative_area_level_3') || find('administrative_area_level_2');
          const text = route ? `${route}${number ? ' ' + number : ''}${locality ? ', ' + locality : ''}` : (results[0].formatted_address || '');
          resolve(text || null);
        } else resolve(null);
      });
    });
  }
  private async reverseWithNominatim(lat: number, lng: number): Promise<string | null> {
    const diff = Date.now() - this.lastNominatimTs; const wait = 1100 - diff; if (wait > 0) await new Promise(r => setTimeout(r, wait));
    this.lastNominatimTs = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`;
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return null;
      const data: any = await res.json();
      const a = data.address || {};
      const route = a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.residential || a.street || '';
      const num = a.house_number || '';
      const place = a.village || a.town || a.city || a.municipality || a.county || '';
      const text = route ? `${route}${num ? ' ' + num : ''}${place ? ', ' + place : ''}` : (data.display_name || '');
      return text || null;
    } catch { return null; }
  }
  private async reverseStreet(pos: google.maps.LatLng, tags: Record<string,string> | undefined, geocoder: google.maps.Geocoder): Promise<string | null> {
    const fromTags = this.streetFromTags(tags); if (fromTags) return fromTags;
    const key = this.cacheKey(pos.lat(), pos.lng()); if (this.streetCacheMem.has(key)) return this.streetCacheMem.get(key)!;
    const g = await this.reverseWithGoogle(pos, geocoder); if (g) { this.streetCacheMem.set(key, g); return g; }
    const n = await this.reverseWithNominatim(pos.lat(), pos.lng()); if (n) { this.streetCacheMem.set(key, n); return n; }
    return null;
  }

  private spawnFleetPerCompany() {
    const seen = new Set<string>();
    for (const st of this.STATIONS_LIST) {
      if (seen.has(st.name)) continue; seen.add(st.name);
      const base = new google.maps.LatLng(st.position.lat, st.position.lng);

      this.trucks.push(this.createTruck(st.name, base, TruckState.STANDBY));

      const patrol = this.createTruck(st.name, base, TruckState.PATROL);
      patrol.isPatroller = true;
      patrol.speedMps = this.SPEED_PATROL;
      this.startPatrolCycle(patrol);
      this.trucks.push(patrol);
    }
  }

  private createTruck(company: string, start: google.maps.LatLng, state: TruckState): Truck {
    const m = new google.maps.Marker({ position: start, icon: this.FIRETRUCK_ICON, map: this.map, title: `Camión de ${company}` });

    m.addListener('click', () => {
      const t = this.trucks.find(x => x.marker === m);
      if (!t) return;
      this.infoWin.setContent(`<b>Camión de:</b> ${t.company}<br><b>Estado:</b> ${t.state}`);
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

  private clearPatrolTimers(t: Truck) {
    if (t.patrolTimeout) { clearTimeout(t.patrolTimeout); t.patrolTimeout = undefined; }
    if (t.patrolResumeTimeout) { clearTimeout(t.patrolResumeTimeout); t.patrolResumeTimeout = undefined; }
  }

  private startPatrolCycle(t: Truck) {
    this.clearPatrolTimers(t);
    t.state = TruckState.PATROL;
    t.speedMps = this.SPEED_PATROL;
    this.startPatrolLeg(t);

    t.patrolTimeout = setTimeout(() => {
      if (t.state === TruckState.PATROL) {
        this.returnToBase(t, () => this.schedulePatrolResume(t));
      }
    }, this.PATROL_LEG_MAX_MS);
  }

  private schedulePatrolResume(t: Truck) {
    this.clearPatrolTimers(t);
    if (!t.isPatroller || t.state !== TruckState.STANDBY) return;
    t.patrolResumeTimeout = setTimeout(() => {
      if (!t.isPatroller || t.state !== TruckState.STANDBY) return;
      this.startPatrolCycle(t);
    }, this.PATROL_DWELL_MS);
  }

  private startPatrolLeg(truck: Truck) {
    if (truck.state !== TruckState.PATROL) return;
    const origin = truck.marker.getPosition()!;
    const roughTarget = this.pickNearbySeed(origin, 400, 1200);

    this.enqueueRouteRequest(() => this.fetchDirectionsPath(origin, roughTarget)
      .then(path => {
        if (truck.state !== TruckState.PATROL) return;
        if (path.length < 2) {
          this.useStraightFallback(truck, roughTarget);
          setTimeout(() => this.startPatrolLeg(truck), 2000);
          return;
        }
        truck.route = path;
        truck.segIdx = 0;
        truck.segT = 0;
        if (truck.routeLine) { truck.routeLine.setMap(null); truck.routeLine = undefined; }
      })
      .catch(() => {
        this.useStraightFallback(truck, roughTarget);
        setTimeout(() => this.startPatrolLeg(truck), 2000);
      })
    );
  }

  private gotoByDirections(truck: Truck, target: google.maps.LatLng, onArrive: () => void) {
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
        const d = google.maps.geometry.spherical.computeDistanceBetween(truck.marker.getPosition()!, target);
        if (d < 25) {
          if (truck.routeLine) truck.routeLine.setMap(null);
          onArrive();
        } else {
          requestAnimationFrame(watch);
        }
      };
      requestAnimationFrame(watch);
    };

    if (cached) { apply(cached); return; }

    this.enqueueRouteRequest(() => this.fetchDirectionsPath(origin, target)
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

  private returnToBase(truck: Truck, onArrivedBase?: () => void) {
    truck.state = TruckState.RETURNING;
    truck.speedMps = this.SPEED_RETURN;

    const origin = truck.marker.getPosition()!;
    const target = truck.home;
    const key = this.dirKey(origin, target);
    const cached = this.dirCache.get(key);

    const finishAtBase = () => {
      const dHome = google.maps.geometry.spherical.computeDistanceBetween(truck.marker.getPosition()!, truck.home);
      if (dHome < 15) {
        truck.state = TruckState.STANDBY;
        truck.speedMps = 0;
        truck.route = [truck.home];
        truck.segIdx = 0; truck.segT = 0;
        if (truck.routeLine) truck.routeLine.setMap(null);
        if (onArrivedBase) onArrivedBase();
        else if (truck.isPatroller) this.schedulePatrolResume(truck);
      } else {
        requestAnimationFrame(finishAtBase);
      }
    };

    const apply = (path: google.maps.LatLng[]) => {
      this.applyRoute(truck, path);
      requestAnimationFrame(finishAtBase);
    };

    if (cached) { apply(cached); return; }

    this.enqueueRouteRequest(() => this.fetchDirectionsPath(origin, target)
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

  private async fetchDirectionsPath(origin: google.maps.LatLng, destination: google.maps.LatLng): Promise<google.maps.LatLng[]> {
    const res = await this.directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      avoidFerries: true
    });
    const route = res.routes?.[0];
    const leg = route?.legs?.[0];
    if (!leg?.steps?.length) return route?.overview_path ?? [];
    const allPts: google.maps.LatLng[] = [];
    for (const s of leg.steps) {
      if (s.path?.length) allPts.push(...s.path);
    }
    return allPts.length ? allPts : (route?.overview_path ?? []);
  }

  private applyRoute(truck: Truck, path: google.maps.LatLng[]) {
    truck.route = path; truck.segIdx = 0; truck.segT = 0;
    if (!truck.routeLine) {
      truck.routeLine = new google.maps.Polyline({
        path, geodesic: true, strokeColor: '#ff3b30', strokeOpacity: 0.95, strokeWeight: 3, map: this.map, zIndex: 3
      });
    } else {
      truck.routeLine.setPath(path);
      truck.routeLine.setMap(this.map);
    }
  }

  private useStraightFallback(truck: Truck, target: google.maps.LatLng) {
    truck.route = [truck.marker.getPosition()!, target]; truck.segIdx = 0; truck.segT = 0;
    if (!truck.routeLine) {
      truck.routeLine = new google.maps.Polyline({
        path: truck.route, geodesic: true, strokeColor: '#ff3b30', strokeOpacity: 0.95, strokeWeight: 3, map: this.map, zIndex: 3
      });
    } else {
      truck.routeLine.setPath(truck.route);
      truck.routeLine.setMap(this.map);
    }
  }

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
          setTimeout(pump, Math.max(10, this.ROUTE_THROTTLE_MS - (Date.now() - this.lastRouteTs)));
        } else {
          this.processingQueue = false;
        }
      };
      pump();
    }
  }

  private tickRaf = (ts: number) => {
    const dt = (ts - this.lastTs) / 1000; this.lastTs = ts; this.acc += dt;
    while (this.acc >= this.STEP) { this.physicsStep(this.STEP); this.acc -= this.STEP; }
    this.rafId = requestAnimationFrame(this.tickRaf);
  };

  private physicsStep(step: number) {
    for (const t of this.trucks) {
      switch (t.state) {
        case TruckState.STANDBY:
        case TruckState.ATTENDING:
          break;

        case TruckState.RESPONDING:
        case TruckState.RETURNING:
        case TruckState.PATROL:
          this.advanceAlongRoute(t, step, () => {
            if (t.state === TruckState.PATROL) {
              const wait = 2000 + Math.random() * 3000;
              setTimeout(() => this.startPatrolLeg(t), wait);
            }
          });
          break;
      }
    }
  }

  private advanceAlongRoute(t: Truck, dt: number, onEnd: () => void) {
    if (!t.route || t.route.length < 2) { onEnd(); return; }
    let a = t.route[t.segIdx], b = t.route[t.segIdx + 1]; if (!b) { onEnd(); return; }

    const segLen = google.maps.geometry.spherical.computeDistanceBetween(a, b);
    if (segLen <= 0.1) {
      t.segIdx++; t.segT = 0; if (t.segIdx >= t.route.length - 1) { onEnd(); return; }
    }

    const speed =
      t.state === TruckState.RESPONDING ? this.SPEED_RESPONSE :
      t.state === TruckState.RETURNING  ? this.SPEED_RETURN   :
      t.state === TruckState.PATROL     ? (t.speedMps || this.SPEED_PATROL) : 0;

    let remaining = speed * dt;
    while (remaining > 0) {
      const distOnSeg = segLen * (1 - t.segT);
      if (remaining < distOnSeg) { t.segT += remaining / segLen; remaining = 0; }
      else {
        remaining -= distOnSeg;
        t.segIdx++; t.segT = 0;
        a = t.route[t.segIdx]; b = t.route[t.segIdx + 1];
        if (!b) { onEnd(); break; }
      }
    }

    const start = t.route[t.segIdx], end = t.route[t.segIdx + 1];
    if (end) {
      const heading = google.maps.geometry.spherical.computeHeading(start, end);
      const segDist = google.maps.geometry.spherical.computeDistanceBetween(start, end);
      const pos = google.maps.geometry.spherical.computeOffset(start, segDist * t.segT, heading);
      t.marker.setPosition(pos);
    }
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    for (const t of this.trucks) this.clearPatrolTimers(t);
    if (this.unsubIncidents) this.unsubIncidents();
  }
}
