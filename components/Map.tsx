'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { pinSvg } from '@/lib/brand';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string | null;
  cover?: string | null;
  href?: string | null;
  color: string;
}

// Captions come from TikTok, so everything that goes into popup HTML is escaped.
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const safeUrl = (u?: string | null) => (u && /^https:\/\//i.test(u) ? esc(u) : null);

/** focusId: zoom to that pin and open its popup (e.g. from a home-screen card). */
export default function Map({ pins, focusId }: { pins: MapPin[]; focusId?: string | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true }).setView([39.5, -98.35], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const markers = pins.map((p) => {
      const icon = L.divIcon({
        className: '',
        html: pinSvg(28),
        iconSize: [28, 28],
        iconAnchor: [14, 27],
        popupAnchor: [0, -26],
      });
      const cover = safeUrl(p.cover);
      const href = safeUrl(p.href);
      const html = `
        <div style="width:200px;font-family:var(--font-nunito),system-ui,sans-serif">
          ${cover ? `<img src="${cover}" referrerpolicy="no-referrer" style="width:100%;height:110px;object-fit:cover;border-radius:12px;margin-bottom:6px" />` : ''}
          <div style="font-family:var(--font-fredoka),sans-serif;font-weight:600;font-size:15px;color:#13293a">${esc(p.title)}</div>
          ${p.subtitle ? `<div style="font-size:11px;color:#5f7a89;margin-top:2px">${esc(p.subtitle)}</div>` : ''}
          ${href ? `<a href="${href}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:800;color:#1c7fb0">Watch on TikTok →</a>` : ''}
        </div>`;
      return { id: p.id, marker: L.marker([p.lat, p.lng], { icon }).bindPopup(html).addTo(layer.current!) };
    });
    const focused = focusId ? markers.find((m) => m.id === focusId) : undefined;
    if (focused) {
      map.current.setView(focused.marker.getLatLng(), 15);
      focused.marker.openPopup();
    } else if (markers.length) {
      const bounds = L.featureGroup(markers.map((m) => m.marker)).getBounds();
      map.current.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
    }
  }, [pins, focusId]);

  return <div ref={el} className="w-full h-full" style={{ minHeight: 280 }} />;
}
