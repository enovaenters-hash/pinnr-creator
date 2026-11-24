'use client';

import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { categoryColor } from '@/lib/types';
import { FAN_CSS } from './fanMapStyles';
import { pinSvg, ICE, SUN, INK } from '@/lib/brand';
import Logo from '@/components/Logo';
import NavLinks from '@/components/NavLinks';
import SiteNav from '@/components/SiteNav';

/**
 * The fan map, matching the original layout (keen-lollipop-93bfb2.netlify.app):
 * ice-blue POVGo bar · category chips · place list | map | TikTok player with clip navigation.
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
  /** My-map only: the group this place is drawn in, and every group it belongs to. */
  gk?: string; gks?: string[];
};
type CreatorInfo = { handle: string; name: string; avatar: string | null; accent: string; count: number };

const LABELS: Record<string, string> = { soulfood: 'Soul Food', bbq: 'BBQ', cafe: 'Café', other: 'Other' };
const cLabel = (c: string) => LABELS[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
const cColor = (c: string) => categoryColor(c);
const formatDate = (d: string) => { if (!d) return 'N/A'; const [y, m, day] = d.split('-'); return m && y ? `${m}/${day || '01'}/${y.slice(-2)}` : 'N/A'; };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
// Creator dots in the All Spots view.
const ACCENTS = ['#1c7fb0', '#f2a900', '#e8513b', '#7a5af8', '#13a877', '#d9468f', '#0e9fb5', '#6b8e23'];
const HOME_PIN = pinSvg(22, '#ffffff', ICE, '#000000');

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

/**
 * Full page (/map): the site bar, then the map as a card, then search + category chips + the place list as a normal
 * scrolling page (no pop-up sheet). Tapping a place scrolls up to the map and opens its video.
 *
 * embedded: render inside a page (the creator page) instead of full screen. The top bar is hidden,
 * only `initialCreator`'s spots are shown, and other parts of the page can open a spot by firing
 * `window.dispatchEvent(new CustomEvent('povgo:focus', { detail: { id: <video id>, play: true } }))`.
 */
export default function FanMap({ initialCreator = null, embedded = false, home = false, view = null, mine = false, search = false }: {
  initialCreator?: string | null; embedded?: boolean;
  /** Search tab: the full map, the category chips, and a scrolling list that shows 15 places at a time (15 more as you scroll). */
  search?: boolean;
  /**
   * "My Map" on the fan page: same layout as /map, but it shows only the signed-in fan's saved videos and the
   * dropdown picks one of their lists ("All saved" or a list). A panel under the map edits the chosen list.
   */
  mine?: boolean;
  /** Home-page map: just the map and its video panel (no bar, search or list), same pins and behaviour as /map. */
  home?: boolean;
  /** Fixed starting view (e.g. Phoenix) instead of fitting every pin. */
  view?: { center: [number, number]; zoom: number } | null;
}) {
  useEffect(() => {
    if (!supabaseConfigured) return;
    let disposed = false;
    const pageMode = !embedded;
    let pubmap: Leaflet.Map | null = null;
    let onPlayerMessage: ((e: MessageEvent) => void) | null = null;
    let onFocus: ((e: Event) => void) | null = null;
    let onDocClick: ((e: MouseEvent) => void) | null = null;
    let onGroup: ((e: Event) => void) | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      const ROW_FIELDS = 'id, tiktok_id, posted_at, place_name, category, address, lat, lng, discount_code, featured, cover_url, creator_id, creators(tiktok_username, display_name, avatar_url)';
      type MineList = { id: string; name: string; ids: Set<string> };
      let data: unknown[] | null = null;
      const LISTS: MineList[] = [];
      let mineUser: string | null = null;
      const SAVED_IDS = new Set<string>();   // videos the fan saved
      if (mine) {
        // Only this fan's saved videos, plus their lists.
        const sb = getSupabase();
        const { data: { session } } = await sb.auth.getSession();
        mineUser = session?.user.id ?? null;
        if (mineUser) {
          const [sv, ls] = await Promise.all([
            sb.from('saved_videos').select('video_id').eq('user_id', mineUser),
            sb.from('lists').select('id, name, list_items(video_id)').eq('user_id', mineUser).order('created_at'),
          ]);
          ((ls.data ?? []) as unknown as { id: string; name: string; list_items: { video_id: string }[] }[])
            .forEach((r) => LISTS.push({ id: r.id, name: r.name, ids: new Set((r.list_items ?? []).map((i) => i.video_id)) }));
          const ids = (sv.data ?? []).map((r) => r.video_id as string);
          ids.forEach((i) => SAVED_IDS.add(i));
          // Only what they saved or put in a group.
          const want = new Set<string>(ids);
          LISTS.forEach((l) => l.ids.forEach((i) => want.add(i)));
          if (want.size) {
            const res = await sb.from('videos').select(ROW_FIELDS).in('id', [...want]).eq('hidden', false).not('lat', 'is', null)
              .order('posted_at', { ascending: false }).limit(3000);
            data = res.data;
          }
        }
      } else {
        const res = await getSupabase().from('videos').select(ROW_FIELDS)
          .eq('hidden', false).not('lat', 'is', null)
          .order('posted_at', { ascending: false }).limit(5000);
        data = res.data;
      }
      if (disposed) return;

      // Who is signed in, and which videos they've already saved (for the Save button).
      const savedSet = new Set<string>();
      let userId: string | null = null;
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (session) {
          userId = session.user.id;
          const { data: sv } = await getSupabase().from('saved_videos').select('video_id').eq('user_id', userId);
          (sv ?? []).forEach((r) => savedSet.add(r.video_id as string));
        }
        // Their lists, so a video can be added to a group right from the player (My Map already loaded them).
        if (userId && !mine) {
          const { data: ls } = await getSupabase().from('lists').select('id, name, list_items(video_id)').eq('user_id', userId).order('created_at');
          ((ls ?? []) as unknown as { id: string; name: string; list_items: { video_id: string }[] }[])
            .forEach((r) => LISTS.push({ id: r.id, name: r.name, ids: new Set((r.list_items ?? []).map((i) => i.video_id)) }));
        }
      } catch { /* saving is optional; the map still works */ }
      if (disposed) return;

      const { places: ALL, creators: CREATORS } = groupPlaces((data ?? []) as unknown as Row[]);
      const params = new URLSearchParams(window.location.search);
      const focusId = params.get('focus');
      const want = (params.get('creator') ?? initialCreator ?? '').replace(/^@/, '').toLowerCase();

      const $ = (id: string) => document.getElementById(id) as HTMLElement;
      (window as unknown as { __povgoPin: string }).__povgoPin = HOME_PIN;
      $('pubLoading')?.remove();

      let ACCENT = SUN;
      let CUR: string | null = null; // creator handle, or null = all creators
      let combinedMode = true;
      let PUBSET: Place[] = [];
      const pubActive = new Set<string>();
      // Search tab: how many cards the list shows. Starts at 15 and grows by 15 each time you scroll to the bottom.
      const SEARCH_STEP = 15;
      let searchLimit = SEARCH_STEP, searchSig = '';
      let pubMarkers: Leaflet.Marker[] = [];
      let pubSel = -1, pubQuery = '';
      // Creator groups (creator page only): the "Showing" menu narrows the map and list to one public group.
      type Group = { id: string; name: string; ids: string[] };
      let GROUPS: Group[] = [];
      const groupIdx = new Set<number>(); // PUBSET indexes in the chosen group; empty = all spots
      let groupOn = false;
      let groupSel = 'all';
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
        if (mine) { if (h) url.searchParams.set('list', h); else url.searchParams.delete('list'); }
        else if (h) url.searchParams.set('creator', h); else url.searchParams.delete('creator');
        window.history.replaceState(null, '', url);
        if (mine) openMine(h || 'all'); else openPub(h);
      };

      // ── Group Maps: the fan's own groups (lists) are photo buttons under the map ──
      // key: 'all' (every group at once), a list id, or NONE for spots saved before groups were required.
      type GDef = { key: string; name: string; color: string };
      const LIST_COLORS = ['#e8590c', '#2fb77a', '#8a5cf0', '#e05aa8', '#0ea5a4', '#d9480f', '#4263eb', '#a8872c'];
      const NONE = 'none', NONE_COLOR = '#7c8da0';
      const groupDefs = (): GDef[] => LISTS.map((l, i) => ({ key: l.id, name: l.name, color: LIST_COLORS[i % LIST_COLORS.length] }));
      const gdef = (k: string | null | undefined): GDef | undefined =>
        k === NONE ? { key: NONE, name: 'No group yet', color: NONE_COLOR } : groupDefs().find((g) => g.key === k);
      const inGroup = (k: string, _p: Place, v: Vid) =>
        k === NONE ? SAVED_IDS.has(v.dbId) && !LISTS.some((l) => l.ids.has(v.dbId)) : !!LISTS.find((l) => l.id === k)?.ids.has(v.dbId);
      /** Pin colour and section order under "All": the fan's groups in order, then spots with no group yet. */
      const colorOrder = () => [...LISTS.map((l) => l.id), NONE];
      const sectionOrder = () => colorOrder();
      const secKeys = (p: Place) => p.gks ?? [];
      const placesFor = (key: string): Place[] => {
        if (key === 'all') {
          const order = colorOrder();
          return ALL.map((p): Place | null => {
            const gks = order.filter((k) => p.videos.some((v) => inGroup(k, p, v)));
            if (!gks.length) return null;
            return { ...p, videos: p.videos.filter((v) => gks.some((k) => inGroup(k, p, v))), gk: gks[0], gks };
          }).filter((p): p is Place => p !== null);
        }
        return ALL.map((p) => ({ ...p, videos: p.videos.filter((v) => inGroup(key, p, v)), gk: key, gks: [key] })).filter((p) => p.videos.length);
      };
      const colorOf = (p: Place) => (mine ? gdef(p.gk)?.color ?? ICE : ICE);
      const defaultKey = () => 'all';
      const isList = (k: string | null) => !!k && LISTS.some((x) => x.id === k);
      const spotWord = (n: number) => `${n} spot${n === 1 ? '' : 's'}`;
      let gMode: 'idle' | 'new' | 'edit' = 'idle';
      let gRename: string | null = null, gDelete: string | null = null;
      let lpBusy = false;
      const changed = () => window.dispatchEvent(new CustomEvent('povgo:lists-changed'));
      /** Up to four cover photos from these places, as a little collage. */
      const coversOf = (ps: Place[]) => {
        const out: string[] = [];
        for (const p of ps) for (const v of p.videos) if (v.cover && !out.includes(v.cover) && out.length < 4) out.push(v.cover);
        return out;
      };
      const collage = (covers: string[]) => covers.length
        ? `<span class="gph n${covers.length}">${covers.map((c) => `<img src="${esc(c)}" referrerpolicy="no-referrer" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`).join('')}</span>`
        : `<span class="gph n0">${HOME_PIN}</span>`;
      function renderGroups() {
        const el = document.getElementById('pubGroups'); if (!el) return;
        const tile = (key: string, name: string, color: string, ps: Place[]) =>
          `<button type="button" class="gtile${CUR === key ? ' on' : ''}" data-g="${esc(key)}" style="--gc:${color}" aria-pressed="${CUR === key}">
            ${collage(coversOf(ps))}<span class="gnm">${esc(name)}</span><span class="gct">${spotWord(ps.length)}</span></button>`;
        const editTile = (g: GDef) => {
          const pics = collage(coversOf(placesFor(g.key)));
          let body: string;
          if (gDelete === g.key) body = `<span class="gnm">Delete?</span><span class="gct">Spots stay saved</span><span class="gbtns"><button type="button" class="gnb danger" data-ga="delete-yes" data-lid="${esc(g.key)}">Delete</button><button type="button" class="gnb" data-ga="cancel">Keep</button></span>`;
          else if (gRename === g.key) body = `<form class="gform" data-gform="rename" data-lid="${esc(g.key)}"><input name="n" value="${esc(g.name)}" maxlength="60" aria-label="Group name" autocomplete="off"><span class="gbtns"><button type="submit" class="gnb sun">Save</button><button type="button" class="gnb" data-ga="cancel">Cancel</button></span></form>`;
          else body = `<span class="gnm">${esc(g.name)}</span><span class="gbtns"><button type="button" class="gnb" data-ga="rename" data-lid="${esc(g.key)}">Rename</button><button type="button" class="gnb" data-ga="delete" data-lid="${esc(g.key)}">Delete</button></span>`;
          return `<div class="gtile ed" style="--gc:${g.color}">${pics}${body}</div>`;
        };
        const last = gMode === 'new'
          ? `<div class="gtile new form"><form class="gform" data-gform="new"><input name="n" placeholder="Date night" maxlength="60" aria-label="New group name" autocomplete="off"><span class="gbtns"><button type="submit" class="gnb sun">Create</button><button type="button" class="gnb" data-ga="cancel">Cancel</button></span></form></div>`
          : gMode === 'edit'
            ? `<div class="gtile new"><button type="button" class="gnb sun" data-ga="done">Done</button></div>`
            : `<div class="gtile new"><button type="button" class="gnb" data-ga="new">+ New list</button>${LISTS.length ? '<button type="button" class="gnb" data-ga="edit">Edit groups</button>' : ''}</div>`;
        el.innerHTML = tile('all', 'All', INK, placesFor('all'))
          + groupDefs().map((g) => (gMode === 'edit' ? editTile(g) : tile(g.key, g.name, g.color, placesFor(g.key)))).join('')
          + last;
        const inp = el.querySelector('input'); if (inp) { (inp as HTMLInputElement).focus(); (inp as HTMLInputElement).select(); }
      }
      function openMine(key: string) {
        CUR = key === 'all' || isList(key) ? key : 'all';
        combinedMode = true; ACCENT = SUN;
        $('pub').style.setProperty('--accent', ACCENT);
        PUBSET = placesFor(CUR);
        $('pubPfp').innerHTML = HOME_PIN;
        $('pubName').textContent = CUR === 'all' ? 'All' : gdef(CUR)?.name ?? 'All';
        $('pubHandle').textContent = `${spotWord(PUBSET.length)} · tap a pin to watch`;
        showPub();
        renderGroups();
      }
      // Group buttons under the map: pick one, make a new list, or edit (rename / delete) your groups.
      const groupsEl = document.getElementById('pubGroups');
      groupsEl?.addEventListener('click', async (e) => {
        const t = e.target as HTMLElement;
        const act = (t.closest('[data-ga]') as HTMLElement | null);
        if (act) {
          const a = act.dataset.ga!, lid = act.dataset.lid ?? null;
          if (a === 'new') { gMode = 'new'; gRename = gDelete = null; renderGroups(); return; }
          if (a === 'edit') { gMode = 'edit'; gRename = gDelete = null; renderGroups(); return; }
          if (a === 'done' || a === 'cancel') { gMode = a === 'cancel' && gMode === 'edit' ? 'edit' : 'idle'; gRename = gDelete = null; renderGroups(); return; }
          if (a === 'rename') { gRename = lid; gDelete = null; renderGroups(); return; }
          if (a === 'delete') { gDelete = lid; gRename = null; renderGroups(); return; }
          if (a === 'delete-yes' && lid && !lpBusy) {
            lpBusy = true;
            const { error } = await getSupabase().from('lists').delete().eq('id', lid);
            lpBusy = false;
            if (error) return;
            LISTS.splice(LISTS.findIndex((x) => x.id === lid), 1);
            gDelete = null; if (!LISTS.length) gMode = 'idle';
            const url = new URL(window.location.href); url.searchParams.delete('list'); window.history.replaceState(null, '', url);
            openMine(CUR === lid ? 'all' : CUR ?? 'all'); changed();
          }
          return;
        }
        const g = t.closest('[data-g]') as HTMLElement | null;
        if (g) {
          const key = g.dataset.g!;
          const url = new URL(window.location.href); url.searchParams.delete('focus');
          if (key === 'all') url.searchParams.delete('list'); else url.searchParams.set('list', key);
          window.history.replaceState(null, '', url);
          openMine(key);
        }
      });
      groupsEl?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const name = ((form.elements.namedItem('n') as HTMLInputElement).value || '').trim().slice(0, 60);
        if (!name || lpBusy || !mineUser) return;
        lpBusy = true;
        const sb = getSupabase();
        if (form.dataset.gform === 'rename' && form.dataset.lid) {
          const l = LISTS.find((x) => x.id === form.dataset.lid);
          const { error } = await sb.from('lists').update({ name }).eq('id', form.dataset.lid);
          lpBusy = false;
          if (error || !l) return;
          l.name = name; gRename = null; openMine(CUR ?? 'all'); changed();
        } else {
          const { data: row, error } = await sb.from('lists').insert({ user_id: mineUser, name }).select('id, name').single();
          lpBusy = false;
          if (error || !row) return;
          LISTS.push({ id: row.id as string, name: row.name as string, ids: new Set() });
          gMode = 'idle';
          const url = new URL(window.location.href); url.searchParams.set('list', row.id as string); window.history.replaceState(null, '', url);
          openMine(row.id as string); changed();
        }
      });
      // "Remove" on a card takes that place out of the chosen list (it stays saved).
      async function removeFromList(p: Place, listId: string) {
        const l = LISTS.find((x) => x.id === listId); if (!l) return;
        const vids = p.videos.map((v) => v.dbId);
        const { error } = await getSupabase().from('list_items').delete().eq('list_id', l.id).in('video_id', vids);
        if (error) return;
        vids.forEach((v) => l.ids.delete(v));
        openMine(CUR ?? 'all'); changed();
      }

      function openPub(handle: string | null) {
        const c = handle ? CREATORS.find((x) => x.handle === handle) : undefined;
        CUR = c ? c.handle : null;
        combinedMode = !CUR;
        ACCENT = SUN;
        $('pub').style.setProperty('--accent', ACCENT);
        PUBSET = CUR ? ALL.filter((p) => p.creator === CUR) : embedded ? [] : ALL;
        const view = document.getElementById('pubView') as HTMLAnchorElement | null;
        if (view) { view.hidden = !CUR; if (CUR) view.href = `/c/${encodeURIComponent(CUR)}`; }
        sel.value = CUR ?? '';
        const pfp = $('pubPfp');
        pfp.innerHTML = c?.avatar ? `<img src="${esc(c.avatar)}" referrerpolicy="no-referrer" alt="" onerror="this.parentNode.innerHTML=window.__povgoPin">` : HOME_PIN;
        $('pubName').textContent = c ? `${c.name}'s Spots` : 'All Spots';
        $('pubHandle').textContent = c ? `@${c.handle} · tap a pin to watch` : `${CREATORS.length} creator${CREATORS.length === 1 ? '' : 's'} · tap a pin to watch`;
        showPub();
      }

      // POVGo Play Pin markers: ice blue, and sunny yellow for the place being watched.
      function pin(count: number, selected = false, color = ICE) {
        const size = selected ? 38 : 30;
        const badge = count > 1 ? `<span class="marker-badge">${count}</span>` : '';
        return L.divIcon({
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size - 1], popupAnchor: [0, -size],
          html: `<div style="position:relative;width:${size}px;height:${size}px">${pinSvg(size, selected ? SUN : color)}${badge}</div>`,
        });
      }
      let litMarker = -1;
      function lightMarker(i: number) {
        if (litMarker >= 0 && pubMarkers[litMarker]) {
          pubMarkers[litMarker].setIcon(pin(PUBSET[litMarker].videos.length, false, colorOf(PUBSET[litMarker]))).setZIndexOffset(0);
        }
        litMarker = i;
        if (i >= 0 && pubMarkers[i]) pubMarkers[i].setIcon(pin(PUBSET[i].videos.length, true, colorOf(PUBSET[i]))).setZIndexOffset(1000);
      }

      // On the home page the video panel floats over the right of the map, so aim the pin at the visible part.
      function fly(lat: number, lon: number) {
        if (!pubmap) return;
        let target: Leaflet.LatLngExpression = [lat, lon];
        if (home && window.innerWidth > 760 && $('pubRight').classList.contains('show')) {
          const pt = pubmap.project([lat, lon], 14); pt.x += 170;
          target = pubmap.unproject(pt, 14);
        }
        pubmap.flyTo(target, 14, { duration: 0.5 });
      }

      function showPub() {
        if (!pubmap) {
          pubmap = L.map('pubmap', { zoomControl: true, scrollWheelZoom: false });
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
        pubMarkers.forEach((m) => pubmap!.removeLayer(m)); pubMarkers = []; litMarker = -1;
        PUBSET.forEach((p, i) => {
          const m = L.marker([p.lat, p.lon], { icon: pin(p.videos.length, false, colorOf(p)) }).addTo(pubmap!);
          m.on('click', () => selectPub(i)); pubMarkers[i] = m;
        });
        $('pubRight').innerHTML = PUBSET.length
          ? `<div class="empty"><div class="big">👈</div>Pick a place from the list — or a pin on the map — to watch its video right here.</div>`
          : `<div class="empty"><div class="big">📍</div>${mine ? 'Nothing here yet. Follow a creator or save a video and it will show up on this map.' : 'No spots on the map yet.'}</div>`;
        $('pubRight').classList.remove('show'); $('pubLeft').classList.remove('expanded');
        renderPubList();
        setTimeout(() => { pubmap!.invalidateSize(); applyPubFilter(true); }, 60);
      }

      function selectPub(i: number, dbId?: string, fromList?: boolean) {
        pubSel = i; const p = PUBSET[i];
        lightMarker(i);
        $('pubList').querySelectorAll('.pcard').forEach((x) => x.classList.toggle('on', Number((x as HTMLElement).dataset.i) === i));
        if (!pageMode) $('pubList').querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
        pubVidP = p;
        buildCreatorVideoList(p.creator);
        let g = allCreatorLocations.findIndex((loc) => loc === p);
        if (dbId) { const k = allCreatorVids.findIndex((v) => v.dbId === dbId); if (k >= 0) g = k; }
        playMode = false; // a new place starts on its cover; tap ▶ to load TikTok's player
        $('pubRight').classList.add('show');
        pubmap?.invalidateSize(); // the video panel changes the map's width
        renderPubVideo(g);
        // Picked from the list further down the page: scroll back up to the map and video.
        if (pageMode && fromList) document.querySelector('#pub .pubmain')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        fly(p.lat, p.lon);
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
        fly(p.lat, p.lon);
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
            ${combinedMode ? `<div class="rby"><span class="d" style="background:${p.accent}"></span><a class="clink" href="/c/${encodeURIComponent(p.creator)}">@${esc(p.creator)}</a> · ${esc(p.creatorName)}</div>` : ''}
            <div class="raddr">📍 ${esc(p.addr)}</div>
            ${v.code ? `<div class="rcode">🏷 Code: ${esc(v.code)}</div>` : ''}
            <div class="info-row">${grid}</div>
            <div class="rbtns">
              <a class="rbtn go" target="_blank" rel="noopener" href="https://www.google.com/maps/search/${encodeURIComponent(p.addr)}">Directions ›</a>
              <a class="rbtn tt" target="_blank" rel="noopener" href="https://www.tiktok.com/@${encodeURIComponent(p.creator)}/video/${encodeURIComponent(v.id)}">▶ TikTok</a>
              <button class="rbtn sv${savedSet.has(v.dbId) ? ' on' : ''}" data-act="save" data-id="${esc(v.dbId)}" aria-pressed="${savedSet.has(v.dbId)}">${savedSet.has(v.dbId) ? '♥ Saved' : '♡ Save'}</button>
            </div>
            <div class="rbtns2"><button class="rbtn ls" type="button" data-act="lists" data-id="${esc(v.dbId)}" aria-expanded="false">＋ Add to a group</button></div>
            <div class="rlists" hidden></div>
          </div>`;
        renderListPicker(v.dbId);
        if (playMode) watchForSlowPlayer();
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
      // If TikTok's player hasn't said it's ready after a while, offer a way out
      // (it can sit black when TikTok is limiting embeds) without removing the player.
      let slowTimer: ReturnType<typeof setTimeout> | null = null;
      function watchForSlowPlayer() {
        if (slowTimer) clearTimeout(slowTimer);
        slowTimer = setTimeout(() => {
          const stage = $('pubRight')?.querySelector('.rstage');
          if (!stage || !stage.querySelector('iframe') || stage.querySelector('.rslow') || !curVid || !pubVidP) return;
          stage.insertAdjacentHTML('beforeend', `<div class="rslow">Taking a while?
            <a target="_blank" rel="noopener" href="https://www.tiktok.com/@${encodeURIComponent(pubVidP.creator)}/video/${encodeURIComponent(curVid.id)}">▶ Watch on TikTok</a>
            <button data-act="retry">↻ Try again</button></div>`);
        }, 8000);
      }
      // Leaving the video view: swap TikTok's player back to the cover so playback (and sound) stops.
      function stopPlayer() {
        if (slowTimer) clearTimeout(slowTimer);
        playMode = false;
        const stage = $('pubRight')?.querySelector('.rstage');
        if (stage && curVid && stage.querySelector('iframe')) stage.innerHTML = posterHtml(curVid);
      }
      function startPlayer(bust = false) {
        if (!curVid) return;
        playMode = true;
        const stage = $('pubRight').querySelector('.rstage');
        if (stage) stage.innerHTML = playerHtml(curVid, bust);
        watchForSlowPlayer();
      }

      // TikTok's player reports errors (server error, playback error, autoplay blocked) via postMessage.
      onPlayerMessage = (e: MessageEvent) => {
        if (e.origin !== 'https://www.tiktok.com') return;
        let d = e.data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
        if (!d || !d['x-tiktok-player']) return;
        const frame = $('pubRight')?.querySelector('iframe');
        if (!frame || e.source !== frame.contentWindow) return;
        if (d.type === 'onPlayerReady' || d.type === 'onStateChange') {
          if (slowTimer) clearTimeout(slowTimer);
          $('pubRight').querySelector('.rslow')?.remove();
        }
        if (d.type === 'onPlayerError' && curVid && pubVidP) {
          if (slowTimer) clearTimeout(slowTimer);
          const stage = $('pubRight').querySelector('.rstage');
          if (stage) stage.innerHTML = failHtml(curVid, pubVidP.creator);
        }
      };
      window.addEventListener('message', onPlayerMessage);

      // Save a video to the signed-in fan's My Videos (sends signed-out visitors to sign in first).
      async function toggleSave(dbId: string, btn: HTMLElement) {
        if (!userId) { window.location.href = `/login?next=${encodeURIComponent(`/?focus=${dbId}`)}`; return; }
        // Every saved spot needs a group, so saving opens the group picker instead of saving straight away.
        if (!savedSet.has(dbId)) { listsOpenFor = dbId; listNew = false; renderListPicker(dbId); return; }
        const was = savedSet.has(dbId);
        if (was) savedSet.delete(dbId); else savedSet.add(dbId);
        const paint = () => {
          const on = savedSet.has(dbId);
          btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on));
          btn.textContent = on ? '♥ Saved' : '♡ Save';
        };
        paint();
        const supabase = getSupabase();
        const { error } = was
          ? await supabase.from('saved_videos').delete().eq('user_id', userId).eq('video_id', dbId)
          : await supabase.from('saved_videos').insert({ user_id: userId, video_id: dbId });
        if (error) { if (was) savedSet.add(dbId); else savedSet.delete(dbId); paint(); }
        else {
          if (was) {
            // Unsaving removes it from every group too.
            const lids = LISTS.filter((l) => l.ids.has(dbId)).map((l) => l.id);
            if (lids.length) {
              await supabase.from('list_items').delete().eq('video_id', dbId).in('list_id', lids);
              LISTS.forEach((l) => l.ids.delete(dbId));
            }
            if (mine) SAVED_IDS.delete(dbId);
          } else if (mine) SAVED_IDS.add(dbId);
          if (listsOpenFor === dbId) renderListPicker(dbId);
          if (mine) renderGroups();
          window.dispatchEvent(new CustomEvent('povgo:lists-changed'));
        }
      }

      // ── Add the video you're watching to one of your groups (lists) without leaving the map ──
      let listsOpenFor: string | null = null;
      let listNew = false;
      let listBusy = false;
      const goLogin = (dbId: string) => { window.location.href = `/login?next=${encodeURIComponent(`/?focus=${dbId}`)}`; };
      function renderListPicker(dbId: string) {
        const el = $('pubRight').querySelector('.rlists') as HTMLElement | null;
        const opener = $('pubRight').querySelector('[data-act="lists"]') as HTMLElement | null;
        if (!el) return;
        const open = listsOpenFor === dbId;
        el.hidden = !open;
        opener?.classList.toggle('open', open); opener?.setAttribute('aria-expanded', String(open));
        if (!open) return;
        const chips = LISTS.map((l) => {
          const has = l.ids.has(dbId);
          return `<button type="button" class="lchip${has ? ' on' : ''}" data-act="list" data-lid="${esc(l.id)}" data-id="${esc(dbId)}" aria-pressed="${has}">${has ? '✓ ' : ''}${esc(l.name)}</button>`;
        }).join('');
        const form = listNew || !LISTS.length
          ? `<form class="rl-form" data-id="${esc(dbId)}"><input name="n" placeholder="Date night" maxlength="60" aria-label="New group name" autocomplete="off"><button class="lchip on" type="submit">Create</button></form>` : '';
        el.innerHTML = `<div class="rl-h">${!savedSet.has(dbId) ? (LISTS.length ? 'Pick a group to save this spot' : 'Make a group to save this spot') : LISTS.length ? 'Add to a group' : 'Make your first group'}</div>
          <div class="rl-chips">${chips}${listNew || !LISTS.length ? '' : '<button type="button" class="lchip new" data-act="newlist">+ New group</button>'}</div>${form}`;
        if (listNew) (el.querySelector('input') as HTMLInputElement | null)?.focus();
      }
      /** Saving is what puts a video in My Videos, so adding it to a group saves it too. */
      async function ensureSaved(dbId: string): Promise<boolean> {
        if (savedSet.has(dbId)) return true;
        const { error } = await getSupabase().from('saved_videos').insert({ user_id: userId, video_id: dbId });
        if (error) return false;
        savedSet.add(dbId); if (mine) SAVED_IDS.add(dbId);
        const sv = $('pubRight').querySelector(`.rbtn.sv[data-id="${dbId}"]`) as HTMLElement | null;
        if (sv) { sv.classList.add('on'); sv.setAttribute('aria-pressed', 'true'); sv.textContent = '♥ Saved'; }
        return true;
      }
      async function toggleListItem(dbId: string, listId: string) {
        if (!userId) { goLogin(dbId); return; }
        const l = LISTS.find((x) => x.id === listId); if (!l || listBusy) return;
        listBusy = true;
        const sb = getSupabase();
        let ok = true;
        if (l.ids.has(dbId)) {
          ok = !(await sb.from('list_items').delete().eq('list_id', listId).eq('video_id', dbId)).error;
          if (ok) l.ids.delete(dbId);
        } else if (await ensureSaved(dbId)) {
          ok = !(await sb.from('list_items').insert({ list_id: listId, video_id: dbId })).error;
          if (ok) l.ids.add(dbId);
        } else ok = false;
        listBusy = false;
        if (ok) { if (mine) renderGroups(); changed(); }
        renderListPicker(dbId);
      }
      async function createListFor(dbId: string, name: string) {
        if (!userId || listBusy) return;
        listBusy = true;
        const { data: row, error } = await getSupabase().from('lists').insert({ user_id: userId, name }).select('id, name').single();
        listBusy = false;
        if (error || !row) return;
        LISTS.push({ id: row.id as string, name: row.name as string, ids: new Set() });
        listNew = false;
        await toggleListItem(dbId, row.id as string);
      }
      $('pubRight').onsubmit = (e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const name = ((form.elements.namedItem('n') as HTMLInputElement | null)?.value || '').trim().slice(0, 60);
        if (name && form.dataset.id) createListFor(form.dataset.id, name);
      };

      // Clicks inside the player panel (clip nav, date buttons, back, collapse, reload).
      $('pubRight').onclick = (e) => {
        const t = (e.target as HTMLElement).closest('[data-g],[data-act]') as HTMLElement | null;
        if (!t) return;
        if (t.dataset.g !== undefined) { renderPubVideo(Number(t.dataset.g)); return; }
        if (t.dataset.act === 'back') {
          stopPlayer();
          if (pubVidP) fly(pubVidP.lat, pubVidP.lon);
          $('pubRight').classList.remove('show');
          pubmap?.invalidateSize();
        }
        if (t.dataset.act === 'save' && t.dataset.id) { toggleSave(t.dataset.id, t); return; }
        if (t.dataset.act === 'lists' && t.dataset.id) {
          if (!userId) { goLogin(t.dataset.id); return; }
          listsOpenFor = listsOpenFor === t.dataset.id ? null : t.dataset.id; listNew = false;
          renderListPicker(t.dataset.id); return;
        }
        if (t.dataset.act === 'list' && t.dataset.id && t.dataset.lid) { toggleListItem(t.dataset.id, t.dataset.lid); return; }
        if (t.dataset.act === 'newlist') { listNew = true; if (listsOpenFor) renderListPicker(listsOpenFor); return; }
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
        if (groupOn && !groupIdx.has(i)) return false;
        if (pubActive.size && !pubActive.has(p.cuisine)) return false;
        if (pubQuery) {
          const hay = `${p.name} ${p.city} ${p.addr} ${p.cuisine} ${p.creator} ${p.creatorName}`.toLowerCase();
          if (!hay.includes(pubQuery)) return false;
        }
        return true;
      }

      function renderPubList() {
        const el = $('pubList'); el.innerHTML = '';
        const mkCard = (p: Place, i: number, gk: string | null) => {
          const card = document.createElement('div'); card.className = 'pcard' + (i === pubSel ? ' on' : ''); card.dataset.i = String(i);
          const remove = mine && isList(gk) ? '<button class="premove" type="button">Remove</button>' : '';
          const by = combinedMode ? `<span class="by"><span class="d" style="background:${p.accent}"></span><a class="clink" href="/c/${encodeURIComponent(p.creator)}" onclick="event.stopPropagation()">@${esc(p.creator)}</a></span>` : '';
          const mt = `<span class="cz" style="background:${cColor(p.cuisine)}">${esc(cLabel(p.cuisine))}</span> ${esc(p.city)}${p.videos.length > 1 ? ` <span class="vcount">🔁 ${p.videos.length}</span>` : ''}${p.featured ? ' <span class="star">★ TOP PICK</span>' : ''}`;
          // Name (with Remove far right) on top; creator, label and city share the next line.
          card.innerHTML = `<div class="ctop"><h4>${esc(p.name)}</h4>${remove}</div>
            <div class="crow">${by}<span class="mt">${mt}</span></div>`;
          card.onclick = () => selectPub(i, undefined, true);
          const rm = card.querySelector('.premove') as HTMLElement | null;
          if (rm) rm.onclick = (ev) => { ev.stopPropagation(); removeFromList(p, gk!); };
          return card;
        };
        if (mine && CUR === 'all') {
          // Every group at once: a section per group, with its photo and name.
          sectionOrder().forEach((k) => {
            const idxs = PUBSET.map((_, i) => i).filter((i) => secKeys(PUBSET[i]).includes(k));
            const d = gdef(k); if (!idxs.length || !d) return;
            const sec = document.createElement('div'); sec.className = 'gsec';
            sec.innerHTML = `<div class="gsec-h" style="--gc:${d.color}">${collage(coversOf(idxs.map((i) => PUBSET[i])))}<h3>${esc(d.name)}</h3><span class="gsec-n">${spotWord(idxs.length)}</span></div><div class="gsec-cards"></div>`;
            const box = sec.querySelector('.gsec-cards')!;
            idxs.forEach((i) => box.appendChild(mkCard(PUBSET[i], i, k)));
            el.appendChild(sec);
          });
        } else PUBSET.forEach((p, i) => el.appendChild(mkCard(p, i, CUR)));
        if (mine && !PUBSET.length) {
          el.innerHTML = `<p class="lp-hint">${LISTS.length ? 'Nothing here yet. Tap Save on a video and pick this group.' : 'Make a group with + New list, then tap Save on any video and pick it.'}</p>`;
        }
      }

      // Group photo blocks under the creator's map, above the search: All + each public group.
      function renderCreatorGroups() {
        const el = document.getElementById('pubGroups'); if (!el || !embedded) return;
        if (!GROUPS.length) { el.hidden = true; $('pub').classList.remove('hasg'); return; }
        const inG = (g: Group | null) => PUBSET.filter((p) => !g || p.videos.some((v) => g.ids.includes(v.dbId)));
        const tile = (id: string, name: string, color: string, ps: Place[]) =>
          `<button type="button" class="gtile${groupSel === id ? ' on' : ''}" data-cg="${esc(id)}" style="--gc:${color}" aria-pressed="${groupSel === id}">
            ${collage(coversOf(ps))}<span class="gnm">${esc(name)}</span><span class="gct">${spotWord(ps.length)}</span></button>`;
        el.innerHTML = tile('all', 'All', INK, inG(null)) + GROUPS.map((g, i) => tile(g.id, g.name, LIST_COLORS[i % LIST_COLORS.length], inG(g))).join('');
        el.hidden = false; $('pub').classList.add('hasg');
      }
      document.getElementById('pubGroups')?.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('[data-cg]') as HTMLElement | null;
        if (b) window.dispatchEvent(new CustomEvent('povgo:group', { detail: { id: b.dataset.cg === 'all' ? null : b.dataset.cg } }));
      });
      function setGroup(id: string) {
        const g = GROUPS.find((x) => x.id === id) ?? null;
        groupSel = g ? g.id : 'all'; renderCreatorGroups();
        groupOn = Boolean(g); groupIdx.clear();
        if (g) PUBSET.forEach((p, i) => { if (p.videos.some((v) => g.ids.includes(v.dbId))) groupIdx.add(i); });
        applyPubFilter(true);
      }

      async function loadGroups(handle: string) {
        const { data } = await getSupabase().from('creator_groups')
          .select('id, name, creators!inner(tiktok_username), creator_group_items(video_id)')
          .eq('creators.tiktok_username', handle).eq('is_public', true).order('position').order('created_at');
        if (disposed) return;
        const onMap = new Set(PUBSET.flatMap((p) => p.videos.map((v) => v.dbId)));
        GROUPS = ((data ?? []) as unknown as { id: string; name: string; creator_group_items: { video_id: string }[] }[])
          .map((g) => ({ id: g.id, name: g.name, ids: (g.creator_group_items ?? []).map((x) => x.video_id).filter((id) => onMap.has(id)) }))
          .filter((g) => g.ids.length > 0);
        renderCreatorGroups();
      }

      function applyPubFilter(fit?: boolean) {
        let shown = 0, okCount = 0, listed = 0; const pts: [number, number][] = [];
        if (search) {
          // A new search or category starts the list over at 15, back at the top.
          const sig = `${pubQuery}|${[...pubActive].sort().join(',')}|${groupOn}`;
          if (sig !== searchSig) { searchSig = sig; searchLimit = SEARCH_STEP; $('pubList').scrollTop = 0; }
        }
        PUBSET.forEach((p, i) => {
          const ok = visiblePub(i);
          const showPin = ok || pubVidP === p;
          if (ok) okCount++;
          const inList = ok && (!search || listed++ < searchLimit);
          if (pubMarkers[i]) { if (showPin) pubmap!.addLayer(pubMarkers[i]); else pubmap!.removeLayer(pubMarkers[i]); }
          $('pubList').querySelectorAll(`.pcard[data-i="${i}"]`).forEach((c) => { (c as HTMLElement).style.display = inList ? '' : 'none'; });
          if (showPin) { shown++; pts.push([p.lat, p.lon]); }
        });
        $('pubList').querySelectorAll('.gsec').forEach((sec) => {
          const any = [...sec.querySelectorAll('.pcard')].some((c) => (c as HTMLElement).style.display !== 'none');
          (sec as HTMLElement).style.display = any ? '' : 'none';
        });
        $('pubCount').textContent = search
          ? `Showing ${Math.min(searchLimit, okCount)} of ${okCount} place${okCount === 1 ? '' : 's'}`
          : `${shown} place${shown === 1 ? '' : 's'}`;
        if (fit && view) pubmap!.setView(view.center, view.zoom);
        else if (fit) {
          if (pts.length === 1) pubmap!.setView(pts[0], 13);
          else if (pts.length) pubmap!.fitBounds(L.latLngBounds(pts).pad(0.2));
          else pubmap!.setView([39.5, -98.35], 4);
        }
      }

      if (search) {
        // Scrolled to the bottom of the list: show 15 more.
        $('pubList').addEventListener('scroll', () => {
          const l = $('pubList');
          if (l.scrollTop + l.clientHeight < l.scrollHeight - 60) return;
          const total = PUBSET.filter((_, i) => visiblePub(i)).length;
          if (searchLimit < total) { searchLimit += SEARCH_STEP; applyPubFilter(); }
        });
      }
      ($('pubSearch') as HTMLInputElement).oninput = (e) => { pubQuery = (e.target as HTMLInputElement).value.toLowerCase(); applyPubFilter(); };
      // Pop-up sheet controls exist only in the embedded layout.
      const sheetHandle = document.getElementById('sheetHandle'), srchToggle = document.getElementById('srchToggle');
      if (sheetHandle) sheetHandle.onclick = () => $('pubLeft').classList.toggle('expanded');
      if (srchToggle) srchToggle.onclick = () => $('pubLeft').classList.toggle('expanded');
      $('clearBtn').onclick = () => {
        pubActive.clear();
        if (groupOn) setGroup('');
        document.querySelectorAll('#pubChips .pchip').forEach((chip) => { chip.classList.remove('on'); (chip as HTMLElement).style.background = ''; });
        applyPubFilter();
      };

      // ── Start: creator from URL, then focus a specific video if asked (?focus=<video id>) ──
      let start = CREATORS.some((c) => c.handle === want) ? want : null;
      const focusPlace = focusId ? ALL.find((p) => p.videos.some((v) => v.dbId === focusId)) : undefined;
      if (focusPlace && start && focusPlace.creator !== start && !embedded) start = null;
      if (mine) {
        const wantList = params.get('list');
        openMine(wantList && (wantList === 'all' || isList(wantList)) ? wantList : defaultKey());
      } else openPub(start);
      if (embedded && CUR) loadGroups(CUR);
      if (!mine && focusPlace && PUBSET.includes(focusPlace)) setTimeout(() => selectPub(PUBSET.indexOf(focusPlace), focusId!), 150);

      // Other parts of the page (the creator page's top 3) can open a spot here.
      onFocus = (e: Event) => {
        const { id, play } = (e as CustomEvent<{ id: string; play?: boolean }>).detail ?? {};
        const place = PUBSET.find((p) => p.videos.some((v) => v.dbId === id));
        if (!place) return;
        selectPub(PUBSET.indexOf(place), id);
        if (play) startPlayer();
      };
      window.addEventListener('povgo:focus', onFocus);
      // The group blocks under the creator's map (and the video grid below the page) narrow this map and list.
      onGroup = (e: Event) => setGroup(((e as CustomEvent<{ id: string | null }>).detail?.id) ?? '');
      window.addEventListener('povgo:group', onGroup);

      // Home page: tapping a spot card elsewhere on the page (/?focus=<id>) opens it on this map without a reload.
      if (home) {
        onDocClick = (e: MouseEvent) => {
          const a = (e.target as Element | null)?.closest?.('a[href^="/?focus="]') as HTMLAnchorElement | null;
          if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          const id = new URL(a.href).searchParams.get('focus');
          const place = id ? PUBSET.find((p) => p.videos.some((v) => v.dbId === id)) : undefined;
          if (!id || !place) return; // not on the map (no pin): let the link load normally
          e.preventDefault(); e.stopPropagation();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          selectPub(PUBSET.indexOf(place), id);
        };
        document.addEventListener('click', onDocClick, true); // capture: runs before the Link's own handler
      }
    })();

    return () => {
      disposed = true;
      if (onPlayerMessage) window.removeEventListener('message', onPlayerMessage);
      if (onFocus) window.removeEventListener('povgo:focus', onFocus);
      if (onDocClick) document.removeEventListener('click', onDocClick, true);
      if (onGroup) window.removeEventListener('povgo:group', onGroup);
      pubmap?.remove(); pubmap = null;
    };
  }, [initialCreator, embedded, home, view, mine, search]);

  if (!supabaseConfigured) return <p className="p-6 text-sm">Supabase isn&apos;t connected yet.</p>;

  if (!embedded) {
    // Full page: nav, map card (+ video panel), then search, chips and the scrolling list.
    return (
      <>
        <style>{FAN_CSS}</style>
        {!home && !mine && <SiteNav active={search ? undefined : 'home'} />}
        <div id="pub" className={home ? 'page home' : mine ? 'page mine' : search ? 'page search' : 'page'}>
          <div className="pagewrap">
            <div className="pubbar">
              <a className="pfp" id="pubPfp" href="/" title="POVGo home" />
              <div className="pubwho"><div className="nm" id="pubName">{mine ? 'All saved' : 'All Spots'}</div><div className="h" id="pubHandle">Loading…</div></div>
              <a className="pubview" id="pubView" href="/" hidden>View page</a>
              <select className="pubsel" id="pubCreator" style={mine ? { display: 'none' } : undefined} aria-label="Choose creator"><option>{mine ? 'All saved' : 'All creators'}</option></select>
            </div>
            <div className="pubmain">
              <div id="pubmap"><div className="pubload" id="pubLoading">Loading map…</div></div>
              <aside className="pubright" id="pubRight" />
            </div>
            {mine && <section className="gpick" id="pubGroups" aria-label="Groups" />}
            <section className="publist" id="pubLeft" aria-label="Places">
              <div className="srch"><input id="pubSearch" type="search" placeholder="Search places…" autoComplete="off" /></div>
              <div className="pubchips-wrapper">
                <button className="pchip clear-btn" id="clearBtn">✕ Clear Search</button>
                <div className="pubchips-bar" id="pubChips" />
              </div>
              <div id="pubCount" />
              <div id="pubList" />
            </section>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{FAN_CSS}</style>
      <div id="pub" className={embedded ? 'embed' : undefined}>
        <div className="pubbar" hidden={embedded}>
          <a className="publogo" href="/" aria-label="POVGo home"><Logo tone="onIce" className="h-[30px] w-auto" /></a>
          <span className="pubdiv" aria-hidden="true" />
          <a className="pfp" id="pubPfp" href="/" title="POVGo home" />
          <div className="pubwho"><div className="nm" id="pubName">All Spots</div><div className="h" id="pubHandle">Loading…</div></div>
          <NavLinks className="pubnav" />
          <span className="pubbreak" aria-hidden="true" />
          <a className="pubview" id="pubView" href="/" hidden>View page</a>
          <select className="pubsel" id="pubCreator" aria-label="Choose creator"><option>All creators</option></select>
        </div>
        <div className="pubmain">
          <aside className="publeft" id="pubLeft">
            <div className="sheethandle" id="sheetHandle" />
            <div className="pubchips-wrapper">
              <button className="pchip clear-btn" id="clearBtn">✕ Clear Search</button>
              <div className="pubchips-bar" id="pubChips" />
            </div>
            <section className="gpick" id="pubGroups" aria-label="Groups" hidden />
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
