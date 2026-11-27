import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

/**
 * Web map for Where in Boston, built on Leaflet + OpenStreetMap tiles.
 * Leaflet is loaded from a CDN on first use so it never touches the native bundle.
 * (Native builds use boston-map.native.tsx with react-native-maps.)
 */

type Coordinate = { latitude: number; longitude: number };
type Props = {
  guess: Coordinate | null;
  answer: Coordinate | null;
  onGuess: (coordinate: Coordinate) => void;
};

// Minimal slice of the Leaflet API used here.
type LatLng = { lat: number; lng: number };
type Layer = { addTo(map: LeafletMap): Layer; remove(): void };
type LeafletMap = {
  on(event: 'click', handler: (event: { latlng: LatLng }) => void): void;
  fitBounds(bounds: [number, number][], options?: { padding: [number, number]; maxZoom: number }): void;
  remove(): void;
  invalidateSize(): void;
};
type Leaflet = {
  map(element: HTMLElement, options: object): LeafletMap;
  tileLayer(url: string, options: object): Layer;
  circleMarker(at: [number, number], options: object): Layer;
  polyline(points: [number, number][], options: object): Layer;
};

const LEAFLET_VERSION = '1.9.4';
let leafletPromise: Promise<Leaflet> | undefined;

function loadLeaflet(): Promise<Leaflet> {
  const existing = (globalThis as { L?: Leaflet }).L;
  if (existing) return Promise.resolve(existing);
  leafletPromise ??= new Promise<Leaflet>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
    script.async = true;
    script.onload = () => {
      const L = (globalThis as { L?: Leaflet }).L;
      if (L) resolve(L); else reject(new Error('Leaflet failed to initialize'));
    };
    script.onerror = () => { leafletPromise = undefined; reject(new Error('Leaflet failed to load')); };
    document.head.appendChild(script);
  });
  return leafletPromise;
}

const BOSTON: [number, number] = [42.345, -71.07];

export default function BostonMap({ guess, answer, onGuess }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const leaflet = useRef<Leaflet | null>(null);
  const layers = useRef<Layer[]>([]);
  const onGuessRef = useRef(onGuess);
  const answered = useRef(!!answer);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    onGuessRef.current = onGuess;
    answered.current = !!answer;
  });

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !container.current) return;
      leaflet.current = L;
      const instance = L.map(container.current, { center: BOSTON, zoom: 12, zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
      instance.on('click', ({ latlng }) => {
        if (!answered.current) onGuessRef.current({ latitude: latlng.lat, longitude: latlng.lng });
      });
      map.current = instance;
      setStatus('ready');
      setTimeout(() => instance.invalidateSize(), 0);
    }, () => { if (!cancelled) setStatus('error'); });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!L || !instance || status !== 'ready') return;
    layers.current.forEach((layer) => layer.remove());
    layers.current = [];
    if (guess) {
      layers.current.push(L.circleMarker([guess.latitude, guess.longitude], {
        radius: 9, color: '#FFFFFF', weight: 3, fillColor: '#2F6BFF', fillOpacity: 1,
      }).addTo(instance));
    }
    if (answer) {
      layers.current.push(L.circleMarker([answer.latitude, answer.longitude], {
        radius: 10, color: '#FFFFFF', weight: 3, fillColor: '#1FAF5A', fillOpacity: 1,
      }).addTo(instance));
      if (guess) {
        layers.current.push(L.polyline([[guess.latitude, guess.longitude], [answer.latitude, answer.longitude]], {
          color: '#FFFFFF', weight: 2, dashArray: '6 6', opacity: 0.9,
        }).addTo(instance));
        instance.fitBounds([[guess.latitude, guess.longitude], [answer.latitude, answer.longitude]], { padding: [60, 60], maxZoom: 15 });
      }
    }
  }, [answer, guess, status]);

  return (
    <View style={{ height: 440, backgroundColor: '#1B1F24' }}>
      <div ref={container} style={{ width: '100%', height: '100%', cursor: answer ? 'default' : 'crosshair' }} />
      {status !== 'ready' && (
        <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 15 }}>
            {status === 'loading' ? 'Loading map…' : 'The map couldn’t load. Check your connection and reload.'}
          </Text>
        </View>
      )}
    </View>
  );
}
