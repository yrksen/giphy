/**
 * socialDB.ts — Supabase-first social data persistence
 *
 * All social data is stored in two places:
 *   1. Supabase KV store (kv_store_ea58c774 table) — server-side, persists across devices
 *   2. localStorage — local cache for instant reads
 *
 * NOTE: For the KV store to be readable/writable by clients, run the following SQL
 * in your Supabase SQL editor:
 *
 *   ALTER TABLE kv_store_ea58c774 ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Public select" ON kv_store_ea58c774 FOR SELECT USING (true);
 *   CREATE POLICY "Public insert" ON kv_store_ea58c774 FOR INSERT WITH CHECK (true);
 *   CREATE POLICY "Public update" ON kv_store_ea58c774 FOR UPDATE USING (true);
 *   CREATE POLICY "Public delete" ON kv_store_ea58c774 FOR DELETE USING (true);
 *
 * If RLS policies are not set, Supabase reads will fail silently and localStorage
 * is used as the fallback so the UI still works (data is just not cross-device).
 */

import { supabase } from './supabaseClient';

const TABLE = 'kv_store_ea58c774';

// ── Low-level KV helpers ──────────────────────────────────────────────────────

async function kvGet(key: string): Promise<any> {
  const { data, error } = await supabase
    .from(TABLE).select('value').eq('key', key).maybeSingle();
  if (error) console.error(`[KV] GET "${key}" error:`, error.message, error.code);
  return data?.value ?? null;
}

async function kvSet(key: string, value: any): Promise<boolean> {
  const { error } = await supabase
    .from(TABLE).upsert({ key, value }, { onConflict: 'key' });
  if (error) console.error(`[KV] SET "${key}" error:`, error.message, error.code, '— RLS may be blocking writes');
  return !error;
}

async function kvDelete(key: string): Promise<void> {
  try {
    await supabase.from(TABLE).delete().eq('key', key);
  } catch {}
}

// ── User profile ──────────────────────────────────────────────────────────────

export interface UserProfile {
  bio?: string;
  country?: string;
  showCountry?: boolean;
  profilePic?: string;
  bannerUrl?: string;
  collections?: any[];
  joinDate?: string;
  lastLogin?: string;
}

export async function loadUserProfile(username: string): Promise<UserProfile | null> {
  const serverData = await kvGet(`profile:${username}`);
  if (serverData) {
    Object.entries(serverData).forEach(([k, v]) => {
      if (k === 'bio') localStorage.setItem(`userBio_${username}`, v as string);
      if (k === 'country') localStorage.setItem(`userCountry_${username}`, v as string);
      if (k === 'showCountry') localStorage.setItem(`showCountry_${username}`, String(v));
      if (k === 'profilePic') localStorage.setItem(`userPic_${username}`, v as string);
      if (k === 'bannerUrl') localStorage.setItem(`userBanner_${username}`, v as string);
      if (k === 'collections') localStorage.setItem(`collections_${username}`, JSON.stringify(v));
      if (k === 'joinDate') localStorage.setItem(`joinDate_${username}`, v as string);
      if (k === 'lastLogin') localStorage.setItem(`lastLogin_${username}`, v as string);
    });
    return serverData as UserProfile;
  }
  const local: UserProfile = {
    bio: localStorage.getItem(`userBio_${username}`) || '',
    country: localStorage.getItem(`userCountry_${username}`) || '',
    showCountry: localStorage.getItem(`showCountry_${username}`) !== 'false',
    profilePic: localStorage.getItem(`userPic_${username}`) || '',
    bannerUrl: localStorage.getItem(`userBanner_${username}`) || '',
    collections: JSON.parse(localStorage.getItem(`collections_${username}`) || '[]'),
    joinDate: localStorage.getItem(`joinDate_${username}`) || '',
    lastLogin: localStorage.getItem(`lastLogin_${username}`) || '',
  };
  return local;
}

export async function saveUserProfile(username: string, profile: UserProfile): Promise<void> {
  await kvSet(`profile:${username}`, profile);
  // Register in global directory so this user appears in search results
  registerInDirectory(username, profile.profilePic).catch(() => {});
  if (profile.bio !== undefined) localStorage.setItem(`userBio_${username}`, profile.bio);
  if (profile.country !== undefined) localStorage.setItem(`userCountry_${username}`, profile.country);
  if (profile.showCountry !== undefined) localStorage.setItem(`showCountry_${username}`, String(profile.showCountry));
  if (profile.profilePic !== undefined) localStorage.setItem(`userPic_${username}`, profile.profilePic);
  if (profile.bannerUrl !== undefined) localStorage.setItem(`userBanner_${username}`, profile.bannerUrl);
  if (profile.collections !== undefined) localStorage.setItem(`collections_${username}`, JSON.stringify(profile.collections));
  if (profile.joinDate !== undefined) localStorage.setItem(`joinDate_${username}`, profile.joinDate);
  if (profile.lastLogin !== undefined) localStorage.setItem(`lastLogin_${username}`, profile.lastLogin);
}

// ── Followers / following ─────────────────────────────────────────────────────

export async function loadFollowers(username: string): Promise<string[]> {
  const serverData = await kvGet(`followers:${username}`);
  if (serverData && Array.isArray(serverData)) {
    localStorage.setItem(`followers_${username}`, JSON.stringify(serverData));
    return serverData;
  }
  return JSON.parse(localStorage.getItem(`followers_${username}`) || '[]');
}

export async function loadFollowing(username: string): Promise<string[]> {
  const serverData = await kvGet(`following:${username}`);
  if (serverData && Array.isArray(serverData)) {
    localStorage.setItem(`following_${username}`, JSON.stringify(serverData));
    return serverData;
  }
  return JSON.parse(localStorage.getItem(`following_${username}`) || '[]');
}

export async function followUser(myUsername: string, targetUsername: string): Promise<void> {
  // Record follow in the activity feed
  recordActivity(myUsername, { type: 'follow', targetUsername }).catch(() => {});
  // Update following list for me
  const myFollowing = await loadFollowing(myUsername);
  if (!myFollowing.includes(targetUsername)) {
    const updated = [...myFollowing, targetUsername];
    localStorage.setItem(`following_${myUsername}`, JSON.stringify(updated));
    await kvSet(`following:${myUsername}`, updated);
  }
  // Update followers list for target
  const theirFollowers = await loadFollowers(targetUsername);
  if (!theirFollowers.includes(myUsername)) {
    const updated = [...theirFollowers, myUsername];
    localStorage.setItem(`followers_${targetUsername}`, JSON.stringify(updated));
    await kvSet(`followers:${targetUsername}`, updated);
  }
}

export async function unfollowUser(myUsername: string, targetUsername: string): Promise<void> {
  const myFollowing = (await loadFollowing(myUsername)).filter(u => u !== targetUsername);
  localStorage.setItem(`following_${myUsername}`, JSON.stringify(myFollowing));
  await kvSet(`following:${myUsername}`, myFollowing);

  const theirFollowers = (await loadFollowers(targetUsername)).filter(u => u !== myUsername);
  localStorage.setItem(`followers_${targetUsername}`, JSON.stringify(theirFollowers));
  await kvSet(`followers:${targetUsername}`, theirFollowers);
}

// ── Profile comments ──────────────────────────────────────────────────────────

export interface ProfileComment {
  id: string;
  commenter: string;
  text: string;
  timestamp: number;
}

export async function loadProfileComments(username: string): Promise<ProfileComment[]> {
  const serverData = await kvGet(`profile_comments:${username}`);
  if (serverData && Array.isArray(serverData)) {
    localStorage.setItem(`profileComments_${username}`, JSON.stringify(serverData));
    return serverData;
  }
  try { return JSON.parse(localStorage.getItem(`profileComments_${username}`) || '[]'); } catch { return []; }
}

export async function saveProfileComments(username: string, comments: ProfileComment[]): Promise<void> {
  localStorage.setItem(`profileComments_${username}`, JSON.stringify(comments));
  await kvSet(`profile_comments:${username}`, comments);
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  message: string;
  fromUser?: string;
  read: boolean;
  timestamp: number;
}

export async function loadNotifications(username: string): Promise<Notification[]> {
  const serverData = await kvGet(`notifications:${username}`);
  if (serverData && Array.isArray(serverData)) {
    localStorage.setItem(`notifs_${username}`, JSON.stringify(serverData));
    return serverData;
  }
  try { return JSON.parse(localStorage.getItem(`notifs_${username}`) || '[]'); } catch { return []; }
}

export async function saveNotifications(username: string, notifs: Notification[]): Promise<void> {
  const trimmed = notifs.slice(-50);
  localStorage.setItem(`notifs_${username}`, JSON.stringify(trimmed));
  await kvSet(`notifications:${username}`, trimmed);
}

export async function addNotificationDB(username: string, notif: Omit<Notification, 'id' | 'timestamp'>): Promise<void> {
  const existing = await loadNotifications(username);
  const newNotif: Notification = { ...notif, id: `n-${Date.now()}`, timestamp: Date.now() };
  await saveNotifications(username, [...existing, newNotif]);
}

// ── User directory (for search) ───────────────────────────────────────────────

export interface DirectoryEntry { username: string; profilePic?: string; }

export async function loadUserDirectory(): Promise<DirectoryEntry[]> {
  const data = await kvGet('user_directory');
  if (Array.isArray(data) && data.length > 0) {
    console.log('[Search] user_directory loaded from KV:', data.length, 'entries. Samples:', data.slice(0, 3).map((e: DirectoryEntry) => e.username));
    return data as DirectoryEntry[];
  }
  // Directory is empty or missing — seed it by scanning all profile:* KV keys.
  // This is a one-time migration for users who existed before the directory feature.
  console.log('[Search] user_directory empty. Seeding from profile:* KV keys…');
  try {
    const { data: rows, error } = await supabase.from(TABLE).select('key, value').like('key', 'profile:%');
    if (error) {
      console.error('[Search] profile:* scan error:', error);
      return [];
    }
    const seeded: DirectoryEntry[] = (rows || []).map((r: any) => ({
      username: String(r.key).replace('profile:', ''),
      profilePic: (r.value as any)?.profilePic || '',
    })).filter((e: DirectoryEntry) => e.username);
    console.log('[Search] Seeded', seeded.length, 'users into user_directory:', seeded.slice(0, 5).map((e: DirectoryEntry) => e.username));
    if (seeded.length > 0) await kvSet('user_directory', seeded);
    return seeded;
  } catch (err) {
    console.error('[Search] user_directory seed exception:', err);
    return [];
  }
}

export async function registerInDirectory(username: string, profilePic?: string): Promise<void> {
  console.log('[Search] registerInDirectory:', username);
  const dir = await loadUserDirectory();
  const filtered = dir.filter((e: DirectoryEntry) => e.username !== username);
  const updated = [{ username, profilePic: profilePic || '' }, ...filtered].slice(0, 2000);
  const ok = await kvSet('user_directory', updated);
  if (!ok) console.error('[Search] registerInDirectory kvSet FAILED for', username, '— check RLS on kv_store_ea58c774');
}

// ── Activity feed ─────────────────────────────────────────────────────────────

export interface UserActivity {
  id: string;
  type: 'follow' | 'rating' | 'comment';
  timestamp: number;
  targetUsername?: string;
  movieId?: number | string;
  movieTitle?: string;
  movieImage?: string;
  rating?: number;
  comment?: string;
}

export async function loadUserActivity(username: string): Promise<UserActivity[]> {
  const data = await kvGet(`activity:${username}`);
  return Array.isArray(data) ? data : [];
}

export async function recordActivity(username: string, event: Omit<UserActivity, 'id' | 'timestamp'>): Promise<void> {
  const existing = await loadUserActivity(username);
  const newEvent: UserActivity = { ...event, id: `act-${Date.now()}`, timestamp: Date.now() };
  await kvSet(`activity:${username}`, [newEvent, ...existing].slice(0, 50));
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function loadCollections(username: string): Promise<any[]> {
  const serverData = await kvGet(`collections:${username}`);
  if (serverData && Array.isArray(serverData)) {
    localStorage.setItem(`collections_${username}`, JSON.stringify(serverData));
    return serverData;
  }
  try { return JSON.parse(localStorage.getItem(`collections_${username}`) || '[]'); } catch { return []; }
}

export async function saveCollectionsDB(username: string, collections: any[]): Promise<void> {
  localStorage.setItem(`collections_${username}`, JSON.stringify(collections));
  await kvSet(`collections:${username}`, collections);
}

// ── XP reactions ──────────────────────────────────────────────────────────────

export async function loadReactions(userId: string): Promise<Record<number, string>> {
  const serverData = await kvGet(`reactions:${userId}`);
  if (serverData && typeof serverData === 'object') {
    localStorage.setItem('xp-reactions', JSON.stringify(serverData));
    return serverData;
  }
  try { return JSON.parse(localStorage.getItem('xp-reactions') || '{}'); } catch { return {}; }
}

export async function saveReactions(userId: string, reactions: Record<number, string>): Promise<void> {
  localStorage.setItem('xp-reactions', JSON.stringify(reactions));
  await kvSet(`reactions:${userId}`, reactions);
}

// ── XP layout (desktop icon positions) ───────────────────────────────────────

export async function loadXpIconPositions(userId: string): Promise<Record<string, { x: number; y: number }>> {
  const serverData = await kvGet(`xp_icon_pos:${userId}`);
  if (serverData && typeof serverData === 'object') {
    try { localStorage.setItem('xp-icon-pos', JSON.stringify(serverData)); } catch {}
    return serverData;
  }
  try { return JSON.parse(localStorage.getItem('xp-icon-pos') || '{}'); } catch { return {}; }
}

export async function saveXpIconPositions(userId: string, positions: Record<string, { x: number; y: number }>): Promise<void> {
  try { localStorage.setItem('xp-icon-pos', JSON.stringify(positions)); } catch {}
  await kvSet(`xp_icon_pos:${userId}`, positions);
}

// ── XP custom icons ───────────────────────────────────────────────────────────

export async function loadXpCustomIcons(userId: string): Promise<any[]> {
  const serverData = await kvGet(`xp_custom_icons:${userId}`);
  if (serverData && Array.isArray(serverData)) {
    localStorage.setItem('xp-custom-icons', JSON.stringify(serverData));
    return serverData;
  }
  try { return JSON.parse(localStorage.getItem('xp-custom-icons') || '[]'); } catch { return []; }
}

export async function saveXpCustomIcons(userId: string, icons: any[]): Promise<void> {
  localStorage.setItem('xp-custom-icons', JSON.stringify(icons));
  await kvSet(`xp_custom_icons:${userId}`, icons);
}

// ── XP shared icons (admin/mod managed, visible to all) ──────────────────────

export interface SharedIcon {
  id: string;
  label: string;
  iconUrl: string;
  linkUrl?: string;
  description?: string;
  addedBy: string;
  createdAt: string;
}

export async function loadXpSharedIcons(): Promise<SharedIcon[]> {
  const serverData = await kvGet('xp_shared_icons');
  if (serverData && Array.isArray(serverData)) return serverData;
  return [];
}

export async function saveXpSharedIcons(icons: SharedIcon[]): Promise<void> {
  await kvSet('xp_shared_icons', icons);
}

// ── XP built-in icon overrides (admin/mod edits to built-in icons) ────────────

export interface BuiltinOverride {
  label?: string;
  iconUrl?: string;
}

export async function loadXpBuiltinOverrides(): Promise<Record<string, BuiltinOverride>> {
  const serverData = await kvGet('xp_builtin_overrides');
  if (serverData && typeof serverData === 'object') return serverData;
  return {};
}

export async function saveXpBuiltinOverrides(overrides: Record<string, BuiltinOverride>): Promise<void> {
  await kvSet('xp_builtin_overrides', overrides);
}

// ── XP built-in icon view counts ──────────────────────────────────────────────

export async function loadXpBuiltinViews(userId: string): Promise<Record<string, number>> {
  const serverData = await kvGet(`xp_builtin_views:${userId}`);
  if (serverData && typeof serverData === 'object') {
    try { localStorage.setItem('xp-builtin-views', JSON.stringify(serverData)); } catch {}
    return serverData;
  }
  try { return JSON.parse(localStorage.getItem('xp-builtin-views') || '{}'); } catch { return {}; }
}

export async function saveXpBuiltinViews(userId: string, views: Record<string, number>): Promise<void> {
  try { localStorage.setItem('xp-builtin-views', JSON.stringify(views)); } catch {}
  await kvSet(`xp_builtin_views:${userId}`, views);
}
