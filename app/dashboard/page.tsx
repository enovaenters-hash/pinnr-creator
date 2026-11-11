'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TikTokVideo, CreatorLocation } from '@/lib/types';
import axios from 'axios';

export default function Dashboard() {
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [locations, setLocations] = useState<CreatorLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState('');

  // Load data from localStorage on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('creatorUsername');
    const savedLocations = localStorage.getItem('creatorLocations');

    if (savedUsername) setUsername(savedUsername);
    if (savedLocations) {
      setLocations(JSON.parse(savedLocations));
    }
  }, []);

  const fetchVideos = async () => {
    if (!username.trim()) {
      setStatus('Please enter a TikTok username');
      return;
    }

    setLoading(true);
    setStatus('Fetching videos...');

    try {
      const response = await axios.post('/api/fetch-videos', { username });
      setVideos(response.data.videos);
      setStatus(`Found ${response.data.count} videos`);

      // Save username
      localStorage.setItem('creatorUsername', username);
    } catch (error) {
      setStatus('Error fetching videos. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const geocodeVideo = async (video: TikTokVideo) => {
    if (!video.address) {
      setStatus('No address found in description. Please enter one manually.');
      setEditingId(video.id);
      return;
    }

    try {
      setStatus(`Geocoding: ${video.address}...`);
      const response = await axios.post('/api/geocode', {
        address: video.address
      });

      const location: CreatorLocation = {
        id: `${username}-${video.id}`,
        creatorUsername: username,
        videoId: video.videoId,
        title: video.title,
        address: video.address,
        latitude: response.data.latitude,
        longitude: response.data.longitude,
        cuisine: video.cuisine,
        thumbnail: video.thumbnail
      };

      const updatedLocations = [...locations, location];
      setLocations(updatedLocations);
      localStorage.setItem('creatorLocations', JSON.stringify(updatedLocations));
      setStatus(`Added "${video.title}" to map!`);
    } catch (error) {
      setStatus('Could not geocode address. Try entering a city name.');
      console.error(error);
    }
  };

  const removeLocation = (id: string) => {
    const updated = locations.filter(l => l.id !== id);
    setLocations(updated);
    localStorage.setItem('creatorLocations', JSON.stringify(updated));
  };

  const updateVideoAddress = (videoId: string, newAddress: string) => {
    const updated = videos.map(v =>
      v.id === videoId ? { ...v, address: newAddress } : v
    );
    setVideos(updated);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Pinnr Creator Dashboard</h1>
            <div className="space-x-4">
              <Link href="/map/personal" className="text-blue-600 hover:text-blue-800">
                View My Map
              </Link>
              <Link href="/map/combined" className="text-blue-600 hover:text-blue-800">
                View All Maps
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Connect Your TikTok</h2>
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter TikTok username (e.g., samspov)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={fetchVideos}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Fetching...' : 'Fetch Videos'}
            </button>
          </div>
          {status && (
            <p className="mt-3 text-sm text-gray-600">{status}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Videos Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Latest 20 Videos ({videos.length})
              </h2>
              <div className="space-y-4">
                {videos.map(video => (
                  <div key={video.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex gap-4">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-20 h-20 rounded object-cover"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{video.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{video.description}</p>

                        {editingId === video.id ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              placeholder="Enter address"
                              value={editingAddress}
                              onChange={(e) => setEditingAddress(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <button
                              onClick={() => {
                                updateVideoAddress(video.id, editingAddress);
                                setEditingId(null);
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <p className="text-sm text-blue-600 mt-2">
                            📍 {video.address || 'No address detected'}
                          </p>
                        )}

                        <button
                          onClick={() => geocodeVideo(video)}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Add to Map
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Locations Column */}
          <div>
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">
                Mapped Locations ({locations.length})
              </h2>
              <div className="space-y-3">
                {locations.map(location => (
                  <div key={location.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900">
                          {location.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          📍 {location.address}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {location.latitude.toFixed(2)}, {location.longitude.toFixed(2)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLocation(location.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {locations.length === 0 && (
                  <p className="text-gray-500 text-sm">No locations mapped yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
