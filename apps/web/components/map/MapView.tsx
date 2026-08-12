'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PublicBusUpdate, PublicStop } from '@tubus/contracts';
import { stateColor } from '@/lib/liveStatus';

// OpenFreeMap's hosted "liberty" style: full street/building/label detail, no API key,
// no rate limit — a real basemap instead of MapLibre's schematic demo style, which
// renders almost nothing below country borders once zoomed to street level.
const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty';

interface MapViewProps {
  /** Omit for a fleet-wide view with no single route to draw (e.g. admin "live"). */
  geometry?: { type: 'LineString'; coordinates: [number, number][] };
  stops?: PublicStop[];
  buses: PublicBusUpdate[];
  className?: string;
  onSelectBus?: (tripId: string) => void;
  focusTripId?: string | null;
}

const FALLBACK_CENTER: [number, number] = [-84.0833, 9.9333]; // San José, Costa Rica

/**
 * A bus marker's DOM element transitions its own transform on every position update
 * (D13 in ROADMAP.md — animate between two known fixes, never extrapolate past the
 * last one). The transition duration matches the observed update interval so movement
 * reads as continuous instead of a jump every few seconds, without inventing a
 * position the GPS never reported.
 */
const MARKER_TRANSITION_MS = 4000;

function createStopElement(name: string, sequence: number): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', name);
  el.className =
    'flex h-5 w-5 items-center justify-center rounded-full border-2 border-brand bg-white text-[10px] font-bold text-brand shadow-elevate-1';
  el.textContent = String(sequence);
  return el;
}

function createBusElement(label: string): HTMLDivElement {
  // MapLibre positions this root element itself via `style.transform` (a translate);
  // the transition below smooths *that* between fixes, exactly like the plain version
  // did. Anything we animate ourselves (the focus scale) has to live on a child, or
  // we'd stomp on MapLibre's own positioning transform.
  const el = document.createElement('div');
  el.style.transition = `transform ${MARKER_TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;

  const wrapper = document.createElement('div');
  wrapper.className = 'tubus-marker-wrapper relative flex items-center justify-center';
  wrapper.style.transition = 'transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1)';

  const ring = document.createElement('span');
  ring.className = 'tubus-marker-ring absolute h-8 w-8 rounded-full';
  ring.style.background = 'var(--tubus-marker-color, #1fb15c)';

  const dot = document.createElement('span');
  dot.className =
    'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white shadow-elevate-2';
  dot.style.background = 'var(--tubus-marker-color, #1fb15c)';
  dot.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 16.5V6.8C4 5.25 5.3 4 6.9 4h10.2C18.7 4 20 5.25 20 6.8v9.7c0 1.05-.86 1.9-1.93 1.9H5.93A1.93 1.93 0 0 1 4 16.5Z" fill="white"/><rect x="6" y="6.4" width="12" height="5" rx="1" fill="var(--tubus-marker-color, #1fb15c)"/><circle cx="7.6" cy="19" r="1.6" fill="white"/><circle cx="16.4" cy="19" r="1.6" fill="white"/></svg>';

  const badge = document.createElement('span');
  badge.className =
    'absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-semibold text-white shadow-elevate-1';
  badge.textContent = label;

  wrapper.append(ring, dot, badge);
  el.append(wrapper);
  return el;
}

export function MapView({
  geometry,
  stops = [],
  buses,
  className = '',
  onSelectBus,
  focusTripId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map>();
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const fitToBusesRef = useRef(!geometry);

  useEffect(() => {
    if (!containerRef.current) return;

    let removed = false;
    const [firstLng, firstLat] = geometry?.coordinates[0] ?? FALLBACK_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [firstLng, firstLat],
      zoom: geometry ? 12 : 11,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true } }),
      'top-right',
    );
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      // React 18 StrictMode mounts, cleans up, and remounts effects in development;
      // the style can finish loading after this instance was already torn down.
      if (removed) return;
      if (!geometry) return;

      map.addSource('route-line', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry },
      });
      // A pale halo under the line keeps it legible over any basemap color, and
      // zoom-interpolated widths keep it visible zoomed out without overwhelming
      // the street grid zoomed in.
      map.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 16, 10],
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#3d5afe',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 16, 5],
        },
      });

      const bounds = geometry.coordinates.reduce(
        (b, coord) => b.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 56, duration: 0 });

      for (const stop of stops) {
        new maplibregl.Marker({
          element: createStopElement(stop.name, stop.sequence),
          anchor: 'center',
        })
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(
            new maplibregl.Popup({ offset: 14, closeButton: false }).setText(
              `${stop.sequence}. ${stop.name}`,
            ),
          )
          .addTo(map);
      }
    });

    return () => {
      removed = true;
      map.remove();
    };
    // Re-created whenever `geometry` changes (e.g. the passenger page's direction
    // switcher swaps in a different variant's LineString) — otherwise only once,
    // regardless of later changes to `stops` or `buses` (handled by the effect below).
  }, [geometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Fleet-wide view (no fixed route): the first time buses arrive, frame them all
    // once, then leave the camera alone — an operator panning around shouldn't get
    // yanked back every time a position updates.
    if (fitToBusesRef.current && buses.length > 0) {
      fitToBusesRef.current = false;
      const bounds = buses.reduce(
        (b, bus) => b.extend([bus.lng, bus.lat] as [number, number]),
        new maplibregl.LngLatBounds([buses[0]!.lng, buses[0]!.lat], [buses[0]!.lng, buses[0]!.lat]),
      );
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 400 });
    }

    const seenTripIds = new Set(buses.map((b) => b.tripId));
    for (const [tripId, marker] of markersRef.current) {
      if (!seenTripIds.has(tripId)) {
        marker.remove();
        markersRef.current.delete(tripId);
      }
    }

    for (const bus of buses) {
      let marker = markersRef.current.get(bus.tripId);
      if (!marker) {
        const el = createBusElement(bus.busLabel);
        if (onSelectBus) {
          el.style.cursor = 'pointer';
          el.addEventListener('click', () => onSelectBus(bus.tripId));
        }
        marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([bus.lng, bus.lat])
          .addTo(map);
        markersRef.current.set(bus.tripId, marker);
      }
      const el = marker.getElement();
      el.style.setProperty('--tubus-marker-color', stateColor[bus.state]);
      const wrapper = el.querySelector<HTMLElement>('.tubus-marker-wrapper');
      if (wrapper) {
        wrapper.style.transform = bus.tripId === focusTripId ? 'scale(1.18)' : 'scale(1)';
      }
      const ring = el.querySelector<HTMLElement>('.tubus-marker-ring');
      if (ring) ring.classList.toggle('animate-pulse-ring', bus.state === 'LIVE');
      marker.setLngLat([bus.lng, bus.lat]);
    }
  }, [buses, focusTripId, onSelectBus]);

  useEffect(() => {
    if (!focusTripId) return;
    const marker = markersRef.current.get(focusTripId);
    const map = mapRef.current;
    if (!marker || !map) return;
    map.easeTo({ center: marker.getLngLat(), zoom: Math.max(map.getZoom(), 14), duration: 600 });
  }, [focusTripId]);

  return <div ref={containerRef} className={`w-full ${className}`} data-testid="map-view" />;
}
