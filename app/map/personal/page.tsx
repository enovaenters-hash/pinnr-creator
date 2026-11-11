'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreatorLocation } from '@/lib/types';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet to avoid SSR issues
const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false });

export default function PersonalMap() {
  const [locations, setLocations] = useState<CreatorLocation[]>([]);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const savedUsername = localStorage.getItem('creatorUsername');
    const savedLocations = localStorage.getItem('creatorLocations');

    if (savedUsername) setUsername(savedUsername);
    if (savedLocations) {
      const parsed = JSON.parse(savedLocations);
      // Filter to only this creator's locations
      setLocations(parsed);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📍 {username}'s Map</h1>
              <p className="text-gray-600 mt-1">{locations.length} locations</p>
            </div>
            <div className="space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Dashboard
              </Link>
              <Link href="/map/combined" className="text-blue-600 hover:text-blue-800">
                View All Maps
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden" style={{ height: '600px' }}>
          {locations.length > 0 ? (
            <MapComponent locations={locations} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 text-lg">No locations mapped yet</p>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
                  Go add some locations →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Locations List */}
        {locations.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Locations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map(location => (
                <div key={location.id} className="border border-gray-200 rounded-lg p-4">
                  <img
                    src={location.thumbnail}
                    alt={location.title}
                    className="w-full h-32 rounded object-cover mb-3"
                  />
                  <h3 className="font-semibold text-gray-900">{location.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">📍 {location.address}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
