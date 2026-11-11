'use client';

import { useState } from 'react';
import { CATEGORIES, type Video } from '@/lib/types';

/** Edit place name, category, address, discount code and visibility. Used by creators and admins. */
export default function VideoEditForm({ video, onSave, onCancel }: {
  video: Video;
  onSave: (body: Partial<Video>) => Promise<void>;
  onCancel: () => void;
}) {
  const [placeName, setPlaceName] = useState(video.place_name ?? '');
  const [category, setCategory] = useState(video.category ?? '');
  const [address, setAddress] = useState(video.address ?? '');
  const [discount, setDiscount] = useState(video.discount_code ?? '');
  const [hidden, setHidden] = useState(video.hidden);
  const [saving, setSaving] = useState(false);
  const field = 'w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <form className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({ place_name: placeName, category: category || null, address, discount_code: discount, hidden });
        setSaving(false);
      }}>
      <label className="text-xs text-gray-600">Place name
        <input className={field} value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Joe's Pizza" />
      </label>
      <label className="text-xs text-gray-600">Category
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">—</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-xs text-gray-600 sm:col-span-2">Address
        <input className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="7 Carmine St, New York, NY" />
      </label>
      <label className="text-xs text-gray-600">Discount code <span className="text-gray-400">(optional)</span>
        <input className={field} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="SAMS10" />
      </label>
      <label className="text-xs text-gray-600 flex items-center gap-2 sm:mt-5">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> Hide from public maps
      </label>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-gray-200">Cancel</button>
        <button disabled={saving} className="btn-sun px-4 py-1.5 text-sm">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
