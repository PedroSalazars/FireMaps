import { Component, AfterViewInit } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonFab, IonFabButton, IonFabList
} from '@ionic/angular/standalone';
import { Loader } from '@googlemaps/js-api-loader';
import { environment } from '../../environments/environment';

type LatLng = { lat: number; lng: number };
type FireStation = { name: string; position: LatLng };
type GHydrant = { lat: number; lon: number; tags?: Record<string, string> };
type IncidentType = 'Incendio' | 'FuGas' | 'rescate' | 'choque';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonFab, IonFabButton, IonFabList],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss']
})
export class HomePage implements AfterViewInit {
  private map!: google.maps.Map;
  private infoWin!: google.maps.InfoWindow;
  private chiloeBounds!: google.maps.LatLngBounds;

  private readonly CHILOE_BOUNDS: google.maps.LatLngBoundsLiteral = {
    north: -41.70, south: -43.30, west: -74.50, east: -73.10
  };

  // Iconos (se crean después de loader.load)
  private STATION_ICON!: google.maps.Icon;
  private HYDRANT_ICON!: google.maps.Icon;
  private INCIDENT_ICONS!: Record<IncidentType, google.maps.Icon>;

  private incidentMarkersByType: Record<IncidentType, google.maps.Marker[]> = {
    Incendio: [], FuGas: [], rescate: [], choque: []
  };

  // Polígonos de tierra (islas)
  private landPolygons: google.maps.Polygon[] = [];

  // Cache calle
  private streetCacheMem = new Map<string, string>();
  private lastNominatimTs = 0;

  async ngAfterViewInit() {
    const el = document.getElementById('map') as HTMLElement;

    // Espera a que el contenedor tenga tamaño
    await new Promise<void>((resolve) => {
      const ok = () => el.offsetWidth > 0 && el.offsetHeight > 0;
      if (ok()) return resolve();
      const id = setInterval(() => { if (ok()) { clearInterval(id); resolve(); } }, 16);
    });

    // Google Maps (+ geometry)
    const loader = new Loader({
      apiKey: environment.googleMapsApiKey,
      version: 'weekly',
      language: 'es',
      region: 'CL',
      libraries: ['geometry'] as any
    });
    await loader.load();

    // Iconos
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

    // Bounds y mapa
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

    // Máscara fuera de Chiloé
    this.addMaskPolygon();

    // Carga polígonos de islas (tierra)
    await this.loadLandPolygons();

    // Estaciones
    this.addStations();

    // Grifos con calle
    await this.addHydrantsWithStreet();

    // Incidentes iniciales (1–3 por tipo, solo en tierra)
    this.clearIncidents();
    this.generateIncidents();
  }

  /* =================== Siniestros (FAB) =================== */
  clearIncidents() {
    (Object.keys(this.incidentMarkersByType) as IncidentType[]).forEach(t => {
      this.incidentMarkersByType[t].forEach(m => m.setMap(null));
      this.incidentMarkersByType[t] = [];
    });
  }

  generateIncidents(n?: number) {
    const types: IncidentType[] = ['Incendio', 'FuGas', 'rescate', 'choque'];

    if (n == null) {
      for (const t of types) {
        const current = this.incidentMarkersByType[t].length;
        const toAdd = Math.max(1, Math.min(3 - current, 1 + Math.floor(Math.random() * 3)));
        for (let i = 0; i < toAdd; i++) this.addIncident(t);
      }
      return;
    }

    for (const t of types) {
      if (this.incidentMarkersByType[t].length === 0) {
        this.addIncident(t);
        n--; if (n <= 0) return;
      }
    }

    while (n > 0) {
      const t = types[Math.floor(Math.random() * types.length)];
      if (this.incidentMarkersByType[t].length < 3) {
        this.addIncident(t); n--;
      } else if (types.every(tp => this.incidentMarkersByType[tp].length >= 3)) break;
    }
  }

  private addIncident(type: IncidentType) {
    const pos = this.randOnLand(); // <-- sólo tierra
    const marker = new google.maps.Marker({
      position: pos, icon: this.INCIDENT_ICONS[type], title: type, zIndex: 3, map: this.map
    });
    marker.addListener('click', () => {
      this.infoWin.setContent(
        `<div style="min-width:200px">
           <strong>${type}</strong><br>
           <small>Reporte simulado en Chiloé</small>
         </div>`
      );
      this.infoWin.open({ map: this.map, anchor: marker });
    });
    this.incidentMarkersByType[type].push(marker);
  }

  /* =============== Random en tierra =============== */
  private rand(min: number, max: number) { return min + Math.random() * (max - min); }

  private randOnLand(): LatLng {
    // intenta hasta 50 veces conseguir un punto dentro de algún polígono de isla
    for (let i = 0; i < 50; i++) {
      const p = new google.maps.LatLng(
        this.rand(this.CHILOE_BOUNDS.south, this.CHILOE_BOUNDS.north),
        this.rand(this.CHILOE_BOUNDS.west,  this.CHILOE_BOUNDS.east)
      );
      if (this.isOnLand(p)) return { lat: p.lat(), lng: p.lng() };
    }
    // Fallback: centro de Chiloé si no se logró (muy poco probable)
    return { lat: -42.6, lng: -73.9 };
  }

  private isOnLand(p: google.maps.LatLng): boolean {
    if (!this.landPolygons.length) return this.chiloeBounds.contains(p); // si no hay polígonos, al menos bbox
    // geometry.containsLocation requiere la librería 'geometry'
    return this.landPolygons.some(poly => google.maps.geometry.poly.containsLocation(p, poly));
  }

  /* =============== Cargar polígonos de islas (GeoJSON desde Nominatim) =============== */
  private async loadLandPolygons() {
    // Para partir, estas 3 cubren casi todos los casos prácticos
    const islands = ['Isla Grande de Chiloé', 'Isla Quinchao', 'Isla Lemuy'];
    this.landPolygons = [];

    for (const name of islands) {
      // Respetar rate limit de Nominatim
      const diff = Date.now() - this.lastNominatimTs; const wait = 1100 - diff;
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      this.lastNominatimTs = Date.now();

      const url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(name + ', Chile')}` +
        `&format=geojson&polygon_geojson=1&limit=1&accept-language=es`;
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/geo+json, application/json' } });
        if (!res.ok) continue;
        const geo: any = await res.json();
        const f = geo.features?.[0];
        if (!f?.geometry) continue;

        const polys = this.polygonsFromGeoJSONGeometry(f.geometry);
        this.landPolygons.push(...polys);
      } catch { /* ignore */ }
    }
  }

  private polygonsFromGeoJSONGeometry(geom: any): google.maps.Polygon[] {
    const toPath = (ring: number[][]) => ring.map(([lng, lat]) => ({ lat, lng }));
    const result: google.maps.Polygon[] = [];

    if (geom.type === 'Polygon') {
      const rings = geom.coordinates as number[][][];
      const paths = rings.map(toPath); // outer + holes
      result.push(new google.maps.Polygon({ paths }));
    } else if (geom.type === 'MultiPolygon') {
      const polys = geom.coordinates as number[][][][];
      for (const poly of polys) {
        const paths = poly.map(toPath);
        result.push(new google.maps.Polygon({ paths }));
      }
    }
    return result;
  }

  /* =============== Estaciones (demo) =============== */
  private addStations() {
    const STATIONS: FireStation[] = [
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

    for (const s of STATIONS) {
      if (!this.chiloeBounds.contains(s.position as google.maps.LatLngLiteral)) continue;
      const m = new google.maps.Marker({
        position: s.position, title: s.name, icon: this.STATION_ICON, zIndex: 2, map: this.map
      });
      m.addListener('click', () => {
        this.infoWin.setContent(`<strong>${s.name}</strong>`);
        this.infoWin.open({ map: this.map, anchor: m });
      });
    }
  }

  /* =============== Grifos con calle (OSM + reverse) =============== */
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
    } catch (e) { console.error('Error cargando grifos desde Overpass', e); }

    const geocoder = new google.maps.Geocoder();

    for (const h of hydrants) {
      const pos = new google.maps.LatLng(h.lat, h.lon);
      if (!this.chiloeBounds.contains(pos)) continue;

      const m = new google.maps.Marker({
        position: pos, icon: this.HYDRANT_ICON, title: 'Grifo', zIndex: 1, map: this.map
      });

      const tags = h.tags ?? {};
      const tipo     = tags['fire_hydrant:type'] ? `Tipo: ${tags['fire_hydrant:type']}` : '';
      const presion  = tags['pressure']          ? `Presión: ${tags['pressure']}`       : '';
      const diametro = tags['diameter']          ? `Diámetro: ${tags['diameter']}`       : '';
      const infoExtra = [tipo, presion, diametro].filter(Boolean).join('<br>');

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
  }

  /* =============== Máscara fuera de límites =============== */
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

  /* =============== Reverse geocoding helpers =============== */
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
}
