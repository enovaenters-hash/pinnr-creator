'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CreatorLocation } from '@/lib/types';

interface MapProps {
  locations: CreatorLocation[];
}

// Fix for default markers
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CUISINE_COLORS: { [key: string]: string } = {
  pizza: '#FF6B6B',
  korean: '#FF8C42',
  mexican: '#F06292',
  thai: '#AB47BC',
  chinese: '#FF6F00',
  japanese: '#E91E63',
  indian: '#FF9800',
  italian: '#2E7D32',
  cafe: '#6F4E37',
  dessert: '#FFB6C1',
  default: '#3B82F6',
};

export default function Map({ locations }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || !locations || locations.length === 0) return;

    // Initialize map if not already done
    if (!map.current) {
      map.current = L.map(mapContainer.current).setView([40, -95], 4);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for each location
    locations.forEach(location => {
      if (map.current && location.latitude && location.longitude) {
        const cuisineKey = location.cuisine?.toLowerCase() || 'default';
        const cuisineColor = CUISINE_COLORS[cuisineKey] || CUISINE_COLORS.default;

        // Create custom marker icon
        const icon = L.icon({
          iconUrl: `data:image/svg+xml;base64,${btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${cuisineColor}">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 7 10 13 10 13s10-6 10-13c0-5.52-4.48-10-10-10zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
          `)}`,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -40],
        });

        const marker = L.marker([location.latitude, location.longitude], { icon });

        const popup = `
          <div class="p-3 max-w-xs">
            <h3 class="font-semibold text-sm">${location.title}</h3>
            <p class="text-xs text-gray-600 mt-1">📍 ${location.address}</p>
            <p class="text-xs text-gray-500 mt-1">by @${location.creatorUsername}</p>
            <img src="${location.thumbnail}" alt="${location.title}" class="mt-2 w-full h-20 rounded object-cover" />
          </div>
        `;

        marker.bindPopup(popup);
        if (map.current) {
          marker.addTo(map.current);
        }
        markersRef.current.push(marker);
      }
    });

    // Fit bounds to show all markers
    if (markersRef.current.length > 0 && map.current) {
      const group = new L.FeatureGroup(markersRef.current);
      map.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [locations]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: '100%' }}
    />
  );
}
