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

type RouteGeometry =
  | { type: 'LineString'; coordinates: [number, number][] }
  // Trip playback (admin/trips/[id]) splits a recorded track into disconnected
  // segments wherever there's a large time/distance gap between fixes, rather than
  // drawing one continuous line through a reconnect or GPS dropout — see
  // buildPlaybackGeometry in that page.
  | { type: 'MultiLineString'; coordinates: [number, number][][] };

interface MapViewProps {
  /** Omit for a fleet-wide view with no single route to draw (e.g. admin "live"). */
  geometry?: RouteGeometry;
  stops?: PublicStop[];
  buses: PublicBusUpdate[];
  className?: string;
  onSelectBus?: (tripId: string) => void;
  focusTripId?: string | null;
}

const FALLBACK_CENTER: [number, number] = [-84.0833, 9.9333]; // San José, Costa Rica

function firstPosition(geometry: RouteGeometry): [number, number] {
  return geometry.type === 'LineString' ? geometry.coordinates[0]! : geometry.coordinates[0]![0]!;
}

function allPositions(geometry: RouteGeometry): [number, number][] {
  return geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat();
}

/**
 * A bus marker animates between two known fixes rather than jumping (D13 in
 * ROADMAP.md), over roughly this long. Two earlier approaches both fought MapLibre:
 *
 * 1. A CSS `transition` on the marker root's `transform` — MapLibre repositions a
 *    Marker's root element by writing that exact same `transform` property on every
 *    pan/zoom/rotate, so the transition couldn't tell "new GPS fix" from "the map
 *    moved under an unchanged position" and animated both, lagging behind the map.
 * 2. Calling `setLngLat()` every rAF frame to interpolate — this is synchronous with
 *    MapLibre from a single-writer perspective, but it means `_update()` (and its
 *    `map.project()` call) fires up to 60x/sec for the *entire* animation window,
 *    racing MapLibre's own continuous 'move'/'moveend'-driven repositioning during a
 *    real touch pan/zoom gesture. Stable under a slow mouse-wheel/drag test; flaky
 *    under a real multi-touch pinch stream on a mid-range Android device, where the
 *    two writers land in different orders relative to the camera matrix update.
 *
 * The animation below never calls into Marker internals mid-flight. `setLngLat` is
 * called exactly once per real GPS fix, so MapLibre's own pan/zoom system is the sole
 * owner of the marker's true screen position (always correct, never racy). The visual
 * "glide" is a pixel-space offset applied via the standalone CSS `translate` property
 * on the *inner* wrapper element — a property MapLibre never touches (it only ever
 * writes `transform` on the marker root) — animated by hand with rAF. Nothing here is
 * extrapolated past the last fix actually received.
 */
const MARKER_ANIMATION_MS = 4000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function createStopElement(name: string, sequence: number): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', name);
  el.className =
    'flex h-5 w-5 items-center justify-center rounded-full border-2 border-brand bg-white text-[10px] font-bold text-brand shadow-elevate-1';
  el.textContent = String(sequence);
  return el;
}

function createBusElement(label: string): HTMLDivElement {
  const el = document.createElement('div');

  const wrapper = document.createElement('div');
  wrapper.className = 'tubus-marker-wrapper relative flex items-center justify-center';
  // `scale` and `translate` are independent CSS properties from `transform` (not
  // shorthand for it) — the focus-zoom scale below can transition on its own without
  // fighting the per-frame `translate` writes the glide animation does to this same
  // element, and without ever touching `transform`, which MapLibre owns exclusively.
  wrapper.style.transition = 'scale 200ms cubic-bezier(0.34, 1.4, 0.64, 1)';
  wrapper.style.translate = '0px 0px';

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
  const animsRef = useRef(new Map<string, number>()); // tripId -> requestAnimationFrame id
  const offsetsRef = useRef(new Map<string, { x: number; y: number }>()); // tripId -> in-flight glide offset (px)
  const fitToBusesRef = useRef(!geometry);

  useEffect(() => {
    if (!containerRef.current) return;

    let removed = false;
    const [firstLng, firstLat] = geometry ? firstPosition(geometry) : FALLBACK_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [firstLng, firstLat],
      zoom: geometry ? 12 : 11,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    // MapLibre caches the container's size at creation and never re-measures it on
    // its own. Without this, any layout change after load — the mobile browser's
    // address bar hiding/showing on scroll, a device rotation, a sidebar toggling —
    // leaves the map computing screen positions (including marker placement) against
    // stale dimensions, throwing markers off to the side or below the visible canvas.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

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

      const positions = allPositions(geometry);
      const bounds = positions.reduce(
        (b, coord) => b.extend(coord),
        new maplibregl.LngLatBounds(positions[0]!, positions[0]!),
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
      resizeObserver.disconnect();
      map.remove();
      // Bus markers are cached by tripId in markersRef so position updates don't
      // recreate them (that's what keeps movement smooth). But that cache is a ref —
      // it outlives this effect. Without clearing it here, a marker created against
      // this map instance becomes orphaned the moment the instance is torn down (its
      // DOM node goes with it) and the next effect run sees a "marker" that already
      // exists for that tripId, skips re-adding it to the new map, and the bus
      // silently vanishes. This bit React 18 StrictMode's dev-only double-invoke of
      // this effect especially hard: mount → add marker → cleanup → remount, gone.
      markersRef.current.clear();
      for (const rafId of animsRef.current.values()) cancelAnimationFrame(rafId);
      animsRef.current.clear();
      offsetsRef.current.clear();
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
        const rafId = animsRef.current.get(tripId);
        if (rafId !== undefined) cancelAnimationFrame(rafId);
        animsRef.current.delete(tripId);
        offsetsRef.current.delete(tripId);
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
      } else {
        // Snap the marker's true position to the new fix immediately — MapLibre's own
        // pan/zoom system now owns positioning exclusively, see the
        // MARKER_ANIMATION_MS comment above. The visual glide is a pixel offset
        // applied to the wrapper below, computed once here (not per animation frame).
        const activeMarker = marker;
        const from = activeMarker.getLngLat();
        const to = { lng: bus.lng, lat: bus.lat };
        const prevRaf = animsRef.current.get(bus.tripId);
        if (prevRaf !== undefined) cancelAnimationFrame(prevRaf);

        if (from.lng !== to.lng || from.lat !== to.lat) {
          const prevOffset = offsetsRef.current.get(bus.tripId) ?? { x: 0, y: 0 };
          const fromPx = map.project(from);
          const toPx = map.project(to);
          activeMarker.setLngLat([to.lng, to.lat]);

          // Where the marker was actually drawn a moment ago (its old anchor plus
          // whatever glide offset was still in flight), expressed relative to the new
          // anchor — that's the offset to start this animation from so there's no
          // visual jump at the handoff.
          const startOffset = {
            x: fromPx.x + prevOffset.x - toPx.x,
            y: fromPx.y + prevOffset.y - toPx.y,
          };
          const wrapperEl = activeMarker.getElement().querySelector<HTMLElement>(
            '.tubus-marker-wrapper',
          );

          const startedAt = performance.now();
          const step = (now: number) => {
            const t = Math.min(1, (now - startedAt) / MARKER_ANIMATION_MS);
            const offset = { x: lerp(startOffset.x, 0, t), y: lerp(startOffset.y, 0, t) };
            offsetsRef.current.set(bus.tripId, offset);
            if (wrapperEl) wrapperEl.style.translate = `${offset.x}px ${offset.y}px`;
            if (t < 1) {
              animsRef.current.set(bus.tripId, requestAnimationFrame(step));
            } else {
              animsRef.current.delete(bus.tripId);
              offsetsRef.current.delete(bus.tripId);
            }
          };
          animsRef.current.set(bus.tripId, requestAnimationFrame(step));
        }
      }
      const el = marker.getElement();
      el.style.setProperty('--tubus-marker-color', stateColor[bus.state]);
      const wrapper = el.querySelector<HTMLElement>('.tubus-marker-wrapper');
      if (wrapper) {
        wrapper.style.scale = bus.tripId === focusTripId ? '1.18' : '1';
      }
      const ring = el.querySelector<HTMLElement>('.tubus-marker-ring');
      if (ring) ring.classList.toggle('animate-pulse-ring', bus.state === 'LIVE');
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
