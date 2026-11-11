'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreatorLocation } from '@/lib/types';
import dynamic from 'next/dynamic';

// Dynamically import Leaflet to avoid SSR issues
const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false });

export default function CombinedMap() {
  const [allLocations, setAllLocations] = useState<CreatorLocation[]>([]);
  const [creators, setCreators] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedLocations = localStorage.getItem('creatorLocations');
    if (savedLocations) {
      const parsed = JSON.parse(savedLocations);
      setAllLocations(parsed);

      // Extract unique creators
      const uniqueCreators = new Set<string>(parsed.map((l: CreatorLocation) => l.creatorUsername));
      setCreators(uniqueCreators);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🌍 Combined Map</h1>
              <p className="text-gray-600 mt-1">
                {creators.size} creators • {allLocations.length} locations
              </p>
            </div>
            <div className="space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                Dashboard
              </Link>
              <Link href="/map/personal" className="text-blue-600 hover:text-blue-800">
                My Map
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden" style={{ height: '600px' }}>
          {allLocations.length > 0 ? (
            <MapComponent locations={allLocations} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 text-lg">No locations mapped yet</p>
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
                  Get started →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Stats & Creators */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Stats</h2>
            <div className="space-y-3">
              <div>
                <p className="text-gray-600">Total Creators</p>
                <p className="text-3xl font-bold text-blue-600">{creators.size}</p>
              </div>
              <div>
                <p className="text-gray-600">Total Locations</p>
                <p className="text-3xl font-bold text-green-600">{allLocations.length}</p>
              </div>
            </div>
          </div>

          {/* Creators */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Creators</h2>
            <div className="space-y-2">
              {Array.from(creators).map(creator => {
                const creatorLocations = allLocations.filter(l => l.creatorUsername === creator);
                return (
                  <div key={creator} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="font-medium text-gray-900">@{creator}</span>
                    <span className="text-sm text-gray-600">
                      {creatorLocations.length} location{creatorLocations.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* All Locations */}
        {allLocations.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">All Locations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allLocations.map(location => (
                <div key={location.id} className="border border-gray-200 rounded-lg p-4">
                  <img
                    src={location.thumbnail}
                    alt={location.title}
                    className="w-full h-32 rounded object-cover mb-3"
                  />
                  <p className="text-xs text-gray-500 mb-1">@{location.creatorUsername}</p>
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
