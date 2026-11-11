'use client';

import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor } from '@/lib/types';
import { FAN_CSS } from './fanMapStyles';

/**
 * The fan map, matching the original layout (keen-lollipop-93bfb2.netlify.app):
 * pink creator bar · category chips · place list | map | TikTok player with clip navigation.
 * Data comes live from Supabase; videos at the same address are grouped into one place.
 */

type Row = {
  id: string; tiktok_id: string; posted_at: string | null; place_name: string | null; category: string | null;
  address: string | null; lat: number; lng: number; discount_code: string | null; featured: boolean; cover_url: string | null;
  creator_id: string; creators: { tiktok_username: string; display_name: string | null; avatar_url: string | null } | null;
};
type Vid = { id: string; date: string; dbId: string; code: string | null; cover: string | null };
type Place = {
  name: string; cuisine: string; city: string; addr: string; lat: number; lon: number;
  videos: Vid[]; creator: string; creatorName: string; accent: string; featured: boolean; newest: string;
};
type CreatorInfo = { handle: string; name: string; avatar: string | null; accent: string; count: number };

const LABELS: Record<string, string> = { soulfood: 'Soul Food', bbq: 'BBQ', cafe: 'Café', other: 'Other' };
const cLabel = (c: string) => LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
const cColor = (c: string) => categoryColor(c);
const formatDate = (d: string) => { if (!d) return 'N/A'; const [y, m, day] = d.split('-'); return m && y ? `${m}/${day || '01'}/${y.slice(-2)}` : 'N/A'; };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const ACCENTS = ['#ff2d55', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#65a30d'];

function cityOf(addr: string): string {
  const parts = addr.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return /^[A-Z]{2}\b/.test(parts[1]) ? parts[0] : parts[1];
  return parts[0] ?? '';
}

/** One place per creator + address; its videos newest first. */
function groupPlaces(rows: Row[]): { places: Place[]; creators: CreatorInfo[] } {
  const creatorMap: Record<string, CreatorInfo> = {};
  const byKey: Record<string, Place> = {};
  for (const r of rows) {
    const handle = r.creators?.tiktok_username ?? 'unknown';
    creatorMap[handle] ??= {
      handle, name: r.creators?.display_name || handle, avatar: r.creators?.avatar_url ?? null,
      accent: ACCENTS[Object.keys(creatorMap).length % ACCENTS.length], count: 0,
    };
    const addrKey = (r.address ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
    const key = `${handle}|${addrKey}`;
    const vid: Vid = { id: r.tiktok_id, date: (r.posted_at ?? '').slice(0, 10), dbId: r.id, code: r.discount_code, cover: r.cover_url };
    if (!byKey[key]) {
      creatorMap[handle].count++;
      byKey[key] = {
        name: r.place_name || r.address || 'Spot', cuisine: r.category || 'other', city: cityOf(r.address ?? ''),
        addr: r.address ?? '', lat: r.lat, lon: r.lng, videos: [], creator: handle,
        creatorName: creatorMap[handle].name, accent: creatorMap[handle].accent, featured: false, newest: r.posted_at ?? '',
      };
    }
    const p = byKey[key];
    p.videos.push(vid);
    p.featured ||= r.featured;
  }
  const places = Object.values(byKey);
  places.forEach((p) => p.videos.sort((a, b) => (b.date > a.date ? 1 : -1)));
  places.sort((a, b) => Number(b.featured) - Number(a.featured) || (b.newest > a.newest ? 1 : -1));
  return { places, creators: Object.values(creatorMap).sort((a, b) => b.count - a.count) };
}

export default function FanMap({ initialCreator = null }: { initialCreator?: string | null }) {
  useEffect(() => {
    if (!supabaseConfigured) return;
    let disposed = false;
    let pubmap: Leaflet.Map | null = null;
    let onPlayerMessage: ((e: MessageEvent) => void) | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      const { data } = await getSupabase().from('videos')
        .select('id, tiktok_id, posted_at, place_name, category, address, lat, lng, discount_code, featured, cover_url, creator_id, creators(tiktok_username, display_name, avatar_url)')
        .eq('hidden', false).not('lat', 'is', null)
        .order('posted_at', { ascending: false }).limit(5000);
      if (disposed) return;

      const { places: ALL, creators: CREATORS } = groupPlaces((data ?? []) as unknown as Row[]);
      const params = new URLSearchParams(window.location.search);
      const focusId = params.get('focus');
      const want = (params.get('creator') ?? initialCreator ?? '').replace(/^@/, '').toLowerCase();

      const $ = (id: string) => document.getElementById(id) as HTMLElement;
      $('pubLoading')?.remove();

      let ACCENT = '#ff2d55';
      let CUR: string | null = null; // creator handle, or null = all creators
      let combinedMode = true;
      let PUBSET: Place[] = [];
      const pubActive = new Set<string>();
      let pubMarkers: Leaflet.Marker[] = [];
      let pubSel = -1, pubQuery = '';
      const metaCollapsedState: Record<string, boolean> = {};
      let lastMetaCollapsed = false;
      let allCreatorVids: Vid[] = [], allCreatorLocations: Place[] = [], pubVidP: Place | null = null;
      let curVid: Vid | null = null;
      let playMode = false; // true once ▶ is tapped; ▲/▼ and date buttons then load the next video directly

      // ── Creator selector in the bar ──
      const sel = $('pubCreator') as HTMLSelectElement;
      sel.innerHTML = `<option value="">All creators (${CREATORS.length})</option>` +
        CREATORS.map((c) => `<option value="${esc(c.handle)}">@${esc(c.handle)} · ${c.count}</option>`).join('');
      sel.onchange = () => {
        const h = sel.value || null;
        const url = new URL(window.location.href);
        url.searchParams.delete('focus');
        if (h) url.searchParams.set('creator', h); else url.searchParams.delete('creator');
        window.history.replaceState(null, '', url);
        openPub(h);
      };

      function openPub(handle: string | null) {
        const c = handle ? CREATORS.find((x) => x.handle === handle) : undefined;
        CUR = c ? c.handle : null;
        combinedMode = !CUR;
        ACCENT = '#ff2d55';
        $('pub').style.setProperty('--accent', ACCENT);
        PUBSET = CUR ? ALL.filter((p) => p.creator === CUR) : ALL;
        sel.value = CUR ?? '';
        const pfp = $('pubPfp');
        pfp.innerHTML = c?.avatar ? `<img src="${esc(c.avatar)}" referrerpolicy="no-referrer" alt="" onerror="this.parentNode.textContent='📍'">` : '📍';
        $('pubName').textContent = c ? `${c.name}'s Spots` : 'All Spots';
        $('pubHandle').textContent = c ? `@${c.handle} · tap a pin to watch` : `${CREATORS.length} creator${CREATORS.length === 1 ? '' : 's'} · tap a pin to watch`;
        showPub();
      }

      function pin(fill: string, ring: string, count: number) {
        const badge = count > 1 ? `<span class="marker-badge">${count}</span>` : '';
        return L.divIcon({
          className: '', iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -20],
          html: `<div style="position:relative;width:22px;height:22px"><div class="marker-pin" style="background:${fill};box-shadow:0 0 0 3px ${ring},0 2px 4px rgba(0,0,0,.4)"></div>${badge}</div>`,
        });
      }

      function showPub() {
        if (!pubmap) {
          pubmap = L.map('pubmap', { zoomControl: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(pubmap);
        }
        pubActive.clear(); pubQuery = ''; pubSel = -1; pubVidP = null;
        ($('pubSearch') as HTMLInputElement).value = '';
        const chips = $('pubChips'); chips.innerHTML = '';
        const cuisineCounts: Record<string, number> = {};
        PUBSET.forEach((p) => { cuisineCounts[p.cuisine] = (cuisineCounts[p.cuisine] || 0) + 1; });
        Object.keys(cuisineCounts).sort((a, b) => cuisineCounts[b] - cuisineCounts[a]).forEach((c) => {
          const el = document.createElement('div'); el.className = 'pchip';
          el.innerHTML = `<span class="d" style="background:${cColor(c)}"></span>${esc(cLabel(c))}`;
          el.onclick = () => {
            if (pubActive.has(c)) pubActive.delete(c); else pubActive.add(c);
            el.classList.toggle('on'); el.style.background = el.classList.contains('on') ? cColor(c) : '';
            applyPubFilter();
          };
          chips.appendChild(el);
        });
        pubMarkers.forEach((m) => pubmap!.removeLayer(m)); pubMarkers = [];
        PUBSET.forEach((p, i) => {
          const m = L.marker([p.lat, p.lon], { icon: pin(cColor(p.cuisine), combinedMode ? p.accent : ACCENT, p.videos.length) }).addTo(pubmap!);
          m.on('click', () => selectPub(i)); pubMarkers[i] = m;
        });
        $('pubRight').innerHTML = PUBSET.length
          ? `<div class="empty"><div class="big">👈</div>Pick a place from the list — or a pin on the map — to watch its video right here.</div>`
          : `<div class="empty"><div class="big">📍</div>No spots on the map yet.</div>`;
        $('pubRight').classList.remove('show'); $('pubLeft').classList.remove('expanded');
        renderPubList();
        setTimeout(() => { pubmap!.invalidateSize(); applyPubFilter(true); }, 60);
      }

      function selectPub(i: number, dbId?: string) {
        pubSel = i; const p = PUBSET[i];
        [...$('pubList').children].forEach((x) => x.classList.toggle('on', Number((x as HTMLElement).dataset.i) === i));
        $('pubList').querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
        pubVidP = p;
        buildCreatorVideoList(p.creator);
        let g = allCreatorLocations.findIndex((loc) => loc === p);
        if (dbId) { const k = allCreatorVids.findIndex((v) => v.dbId === dbId); if (k >= 0) g = k; }
        playMode = false; // a new place starts on its cover; tap ▶ to load TikTok's player
        renderPubVideo(g);
        $('pubRight').classList.add('show');
        pubmap?.flyTo([p.lat, p.lon], 14, { duration: 0.5 });
      }

      function buildCreatorVideoList(creator: string) {
        allCreatorVids = []; allCreatorLocations = [];
        PUBSET.forEach((place) => {
          if (place.creator === creator) place.videos.forEach((vid) => { allCreatorVids.push(vid); allCreatorLocations.push(place); });
        });
      }

      function renderPubVideo(gIdx: number) {
        if (!allCreatorVids.length) return;
        const total = allCreatorVids.length;
        gIdx = ((gIdx % total) + total) % total;
        const v = allCreatorVids[gIdx];
        const p = allCreatorLocations[gIdx];
        pubVidP = p;
        curVid = v;
        pubmap?.flyTo([p.lat, p.lon], 14, { duration: 0.5 });
        const nextIdx = (gIdx + 1) % total, prevIdx = (gIdx - 1 + total) % total;
        const clipnav = total > 1 ? `<div class="clipnav">
            <span class="clippos">${gIdx + 1}/${total}</span>
            <button class="clipbtn" data-g="${prevIdx}" aria-label="Previous - Newer video" title="Previous (Newer)">▲</button>
            <button class="clipbtn" data-g="${nextIdx}" aria-label="Next - Older video" title="Next (Older)">▼</button>
          </div>` : '';
        const locGlobal = allCreatorLocations.map((loc, idx) => (loc === p ? idx : -1)).filter((i) => i >= 0);
        const grid = p.videos.length > 0 ? `<div class="rvids"><div class="rvids-grid">
            ${[...p.videos].reverse().map((vid, r) => {
              const g = locGlobal[p.videos.length - 1 - r];
              const d = formatDate(vid.date);
              return `<button class="rvid-thumb ${gIdx === g ? 'active' : ''}" data-g="${g}" title="${d}"><div class="rvid-num">${d}</div></button>`;
            }).join('')}
          </div></div>` : '';
        const locationId = `${p.creator}|${p.addr}`;
        const collapsed = metaCollapsedState[locationId] ?? lastMetaCollapsed;
        const right = $('pubRight');
        right.dataset.loc = locationId;
        right.innerHTML = `
          <div class="rv"><div class="rstage">${playMode ? playerHtml(v) : posterHtml(v)}</div><button class="mback" data-act="back">← Back to Map</button>${clipnav}</div>
          <div class="rmeta ${collapsed ? 'collapsed' : ''}">
            <h3 data-act="toggle"><span>${esc(p.name)}</span><span class="tag-in-header" style="background:${cColor(p.cuisine)}">#${esc(p.cuisine)}</span><span class="toggle-arrow">▼</span></h3>
            ${combinedMode ? `<div class="rby"><span class="d" style="background:${p.accent}"></span>@${esc(p.creator)} · ${esc(p.creatorName)}</div>` : ''}
            <div class="raddr">📍 ${esc(p.addr)}</div>
            ${v.code ? `<div class="rcode">🏷 Code: ${esc(v.code)}</div>` : ''}
            <div class="info-row">${grid}</div>
            <div class="rbtns">
              <a class="rbtn go" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent(p.addr)}">Directions ›</a>
              <a class="rbtn tt" target="_blank" rel="noopener" href="https://www.tiktok.com/@${encodeURIComponent(p.creator)}/video/${encodeURIComponent(v.id)}">▶ TikTok</a>
            </div>
          </div>`;
      }

      // ── Tap to play: show the cover first, load TikTok's player only when ▶ is tapped ──
      function playerSrc(id: string, bust = false) {
        return `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?autoplay=1&description=1&music_info=0${bust ? `&r=${Date.now()}` : ''}`;
      }
      const coverImg = (v: Vid) =>
        v.cover ? `<img class="rcover" src="${esc(v.cover)}" referrerpolicy="no-referrer" alt="" onerror="this.remove()">` : '';
      function posterHtml(v: Vid) {
        return `<div class="rposter" data-act="play">${coverImg(v)}<button class="rplay" data-act="play" aria-label="Play video">▶</button><span class="rhint">Tap to play</span></div>`;
      }
      function playerHtml(v: Vid, bust = false) {
        return `<iframe src="${playerSrc(v.id, bust)}" allow="autoplay;encrypted-media;fullscreen" allowfullscreen></iframe>`;
      }
      function failHtml(v: Vid, creator: string) {
        return `<div class="rposter rfailed">${coverImg(v)}<div class="rfail">
            <p>This video won't play here right now.</p>
            <a class="rbtn tt" target="_blank" rel="noopener" href="https://www.tiktok.com/@${encodeURIComponent(creator)}/video/${encodeURIComponent(v.id)}">▶ Watch on TikTok</a>
            <button class="rtry" data-act="retry">↻ Try again</button>
          </div></div>`;
      }
      function startPlayer(bust = false) {
        if (!curVid) return;
        playMode = true;
        const stage = $('pubRight').querySelector('.rstage');
        if (stage) stage.innerHTML = playerHtml(curVid, bust);
      }

      // TikTok's player reports errors (server error, playback error, autoplay blocked) via postMessage.
      onPlayerMessage = (e: MessageEvent) => {
        if (e.origin !== 'https://www.tiktok.com') return;
        let d = e.data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
        if (!d || !d['x-tiktok-player']) return;
        const frame = $('pubRight')?.querySelector('iframe');
        if (!frame || e.source !== frame.contentWindow) return;
        if (d.type === 'onPlayerError' && curVid && pubVidP) {
          const stage = $('pubRight').querySelector('.rstage');
          if (stage) stage.innerHTML = failHtml(curVid, pubVidP.creator);
        }
      };
      window.addEventListener('message', onPlayerMessage);

      // Clicks inside the player panel (clip nav, date buttons, back, collapse, reload).
      $('pubRight').onclick = (e) => {
        const t = (e.target as HTMLElement).closest('[data-g],[data-act]') as HTMLElement | null;
        if (!t) return;
        if (t.dataset.g !== undefined) { renderPubVideo(Number(t.dataset.g)); return; }
        if (t.dataset.act === 'back') {
          if (pubVidP) pubmap?.flyTo([pubVidP.lat, pubVidP.lon], 14, { duration: 0.5 });
          $('pubRight').classList.remove('show');
        }
        if (t.dataset.act === 'play') startPlayer();
        if (t.dataset.act === 'retry') startPlayer(true);
        if (t.dataset.act === 'toggle') {
          const id = $('pubRight').dataset.loc ?? '';
          metaCollapsedState[id] = !(metaCollapsedState[id] ?? lastMetaCollapsed);
          lastMetaCollapsed = metaCollapsedState[id];
          $('pubRight').querySelector('.rmeta')?.classList.toggle('collapsed', metaCollapsedState[id]);
        }
      };

      function visiblePub(i: number) {
        const p = PUBSET[i];
        if (pubActive.size && !pubActive.has(p.cuisine)) return false;
        if (pubQuery) {
          const hay = `${p.name} ${p.city} ${p.addr} ${p.cuisine} ${p.creator} ${p.creatorName}`.toLowerCase();
          if (!hay.includes(pubQuery)) return false;
        }
        return true;
      }

      function renderPubList() {
        const el = $('pubList'); el.innerHTML = '';
        PUBSET.forEach((p, i) => {
          const card = document.createElement('div'); card.className = 'pcard' + (i === pubSel ? ' on' : ''); card.dataset.i = String(i);
          card.innerHTML = `<h4>${esc(p.name)}</h4>
            ${combinedMode ? `<div class="by"><span class="d" style="background:${p.accent}"></span>@${esc(p.creator)}</div>` : ''}
            <div class="mt"><span class="cz" style="background:${cColor(p.cuisine)}">${esc(cLabel(p.cuisine))}</span> ${esc(p.city)}${p.videos.length > 1 ? ` <span class="vcount">🔁 ${p.videos.length}</span>` : ''}${p.featured ? ' <span class="star">★ TOP PICK</span>' : ''}</div>`;
          card.onclick = () => selectPub(i);
          el.appendChild(card);
        });
      }

      function applyPubFilter(fit?: boolean) {
        let shown = 0; const pts: [number, number][] = [];
        PUBSET.forEach((p, i) => {
          const ok = visiblePub(i);
          const showPin = ok || pubVidP === p;
          if (pubMarkers[i]) { if (showPin) pubmap!.addLayer(pubMarkers[i]); else pubmap!.removeLayer(pubMarkers[i]); }
          const card = $('pubList').querySelector(`[data-i="${i}"]`) as HTMLElement | null;
          if (card) card.style.display = ok ? '' : 'none';
          if (showPin) { shown++; pts.push([p.lat, p.lon]); }
        });
        $('pubCount').textContent = `${shown} place${shown === 1 ? '' : 's'}`;
        if (fit) {
          if (pts.length === 1) pubmap!.setView(pts[0], 13);
          else if (pts.length) pubmap!.fitBounds(L.latLngBounds(pts).pad(0.2));
          else pubmap!.setView([39.5, -98.35], 4);
        }
      }

      ($('pubSearch') as HTMLInputElement).oninput = (e) => { pubQuery = (e.target as HTMLInputElement).value.toLowerCase(); applyPubFilter(); };
      $('sheetHandle').onclick = () => $('pubLeft').classList.toggle('expanded');
      $('srchToggle').onclick = () => $('pubLeft').classList.toggle('expanded');
      $('clearBtn').onclick = () => {
        pubActive.clear();
        document.querySelectorAll('#pubChips .pchip').forEach((chip) => { chip.classList.remove('on'); (chip as HTMLElement).style.background = ''; });
        applyPubFilter();
      };

      // ── Start: creator from URL, then focus a specific video if asked (?focus=<video id>) ──
      let start = CREATORS.some((c) => c.handle === want) ? want : null;
      const focusPlace = focusId ? ALL.find((p) => p.videos.some((v) => v.dbId === focusId)) : undefined;
      if (focusPlace && start && focusPlace.creator !== start) start = null;
      openPub(start);
      if (focusPlace) setTimeout(() => selectPub(PUBSET.indexOf(focusPlace), focusId!), 150);
    })();

    return () => {
      disposed = true;
      if (onPlayerMessage) window.removeEventListener('message', onPlayerMessage);
      pubmap?.remove(); pubmap = null;
    };
  }, [initialCreator]);

  if (!supabaseConfigured) return <p className="p-6 text-sm">Supabase isn&apos;t connected yet.</p>;

  return (
    <>
      <style>{FAN_CSS}</style>
      <div id="pub">
        <div className="pubbar">
          <a className="pfp" id="pubPfp" href="/" title="Pinnr home">📍</a>
          <div><div className="nm" id="pubName">Pinnr</div><div className="h" id="pubHandle">Loading…</div></div>
          <nav className="pubnav" aria-label="Main">
            <a href="/">Home</a>
            <a href="/map" className="on" aria-current="page">Fan Map</a>
            <a href="/dashboard">Creator Login</a>
          </nav>
          <select className="pubsel" id="pubCreator" aria-label="Choose creator"><option>All creators</option></select>
        </div>
        <div className="pubchips-wrapper">
          <button className="pchip clear-btn" id="clearBtn">✕ Clear Search</button>
          <div className="pubchips-bar" id="pubChips" />
        </div>
        <div className="pubmain">
          <aside className="publeft" id="pubLeft">
            <div className="sheethandle" id="sheetHandle" />
            <div className="srch">
              <input id="pubSearch" placeholder="Search places…" autoComplete="off" />
              <button className="srch-toggle" id="srchToggle">▼</button>
            </div>
            <div id="pubCount" />
            <div id="pubList" />
          </aside>
          <div id="pubmap"><div className="pubload" id="pubLoading">Loading map…</div></div>
          <aside className="pubright" id="pubRight" />
        </div>
      </div>
    </>
  );
}
