'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PublicBusUpdate, PublicStop } from '@tubus/contracts';
import { stateColor } from '@/lib/liveStatus';

const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://demotiles.maplibre.org/style.json';

interface MapViewProps {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  stops: PublicStop[];
  buses: PublicBusUpdate[];
}

/**
 * A bus marker's DOM element transitions its own transform on every position update
 * (D13 in ROADMAP.md — animate between two known fixes, never extrapolate past the
 * last one). The transition duration matches the observed update interval so movement
 * reads as continuous instead of a jump every few seconds, without inventing a
 * position the GPS never reported.
 */
const MARKER_TRANSITION_MS = 4000;

export function MapView({ geometry, stops, buses }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map>();
  const markersRef = useRef(new Map<string, maplibregl.Marker>());

  useEffect(() => {
    if (!containerRef.current) return;

    let removed = false;
    const [firstLng, firstLat] = geometry.coordinates[0] ?? [0, 0];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [firstLng, firstLat],
      zoom: 12,
    });
    mapRef.current = map;

    map.on('load', () => {
      // React 18 StrictMode mounts, cleans up, and remounts effects in development;
      // the style can finish loading after this instance was already torn down.
      if (removed) return;
      map.addSource('route-line', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        paint: { 'line-color': '#1d4ed8', 'line-width': 4 },
      });

      const bounds = geometry.coordinates.reduce(
        (b, coord) => b.extend(coord as [number, number]),
        new maplibregl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 40, duration: 0 });

      for (const stop of stops) {
        const el = document.createElement('div');
        el.style.width = '10px';
        el.style.height = '10px';
        el.style.borderRadius = '50%';
        el.style.background = '#ffffff';
        el.style.border = '2px solid #1d4ed8';
        new maplibregl.Marker({ element: el })
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText(stop.name))
          .addTo(map);
      }
    });

    return () => {
      removed = true;
      map.remove();
    };
    // Runs once: the map instance is created here and re-created only on remount,
    // regardless of later changes to `stops` or `buses` (handled by the effect below).
  }, [geometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
        const el = document.createElement('div');
        el.style.width = '18px';
        el.style.height = '18px';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.4)';
        el.style.transition = `transform ${MARKER_TRANSITION_MS}ms linear`;
        el.title = bus.busLabel;
        marker = new maplibregl.Marker({ element: el }).setLngLat([bus.lng, bus.lat]).addTo(map);
        markersRef.current.set(bus.tripId, marker);
      }
      const el = marker.getElement();
      el.style.background = stateColor[bus.state];
      marker.setLngLat([bus.lng, bus.lat]);
    }
  }, [buses]);

  return <div ref={containerRef} className="h-[50vh] w-full" data-testid="map-view" />;
}
