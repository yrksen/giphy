import { useState, useEffect, useRef } from 'react';
import { Bell, X, UserPlus, MessageSquare, AtSign } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Link } from 'react-router-dom';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

export type NotifType = 'follow' | 'reply' | 'mention' | 'comment';

export interface Notification {
  id: string;
  type: NotifType;
  senderUsername: string;
  senderAvatar?: string;
  text: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const KV_TABLE = 'kv_store_ea58c774';

function getNotifs(username: string): Notification[] {
  try { return JSON.parse(localStorage.getItem(`notifs_${username}`) || '[]'); } catch { return []; }
}
function saveNotifs(username: string, notifs: Notification[]) {
  localStorage.setItem(`notifs_${username}`, JSON.stringify(notifs.slice(-50)));
}

// Load from KV and merge with localStorage (most-recent wins, deduped by id)
async function loadNotifsFromKV(username: string): Promise<Notification[]> {
  const { data, error } = await supabase.from(KV_TABLE).select('value').eq('key', `notifs:${username}`).maybeSingle();
  if (error) console.error('[Notif] loadNotifsFromKV error:', error.message, error.code);
  const remote: Notification[] = Array.isArray(data?.value) ? data.value : [];
  const local = getNotifs(username);
  const seen = new Set<string>();
  const merged = [...remote, ...local]
    .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
  if (merged.length > 0) saveNotifs(username, merged);
  return merged;
}

// Write to localStorage, Supabase KV, and broadcast realtime.
// Returns a Promise so callers can await or .catch() it.
export async function addNotification(recipientUsername: string, notif: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<void> {
  const newNotif: Notification = {
    ...notif,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  console.log('[Notif] addNotification →', recipientUsername, newNotif.type, newNotif.text?.slice(0, 60));

  // 1. localStorage (instant, same device)
  const local = getNotifs(recipientUsername);
  saveNotifs(recipientUsername, [newNotif, ...local].slice(0, 50));

  // 2. Supabase KV (cross-device persistence)
  const { data: existing } = await supabase.from(KV_TABLE).select('value').eq('key', `notifs:${recipientUsername}`).maybeSingle();
  const kvList: Notification[] = Array.isArray(existing?.value) ? existing.value : [];
  const merged = [newNotif, ...kvList].slice(0, 50);
  const { error: writeErr } = await supabase.from(KV_TABLE).upsert({ key: `notifs:${recipientUsername}`, value: merged }, { onConflict: 'key' });
  if (writeErr) console.error('[Notif] KV write error:', writeErr.message, writeErr.code, '— check RLS on', KV_TABLE);
  else console.log('[Notif] KV write OK for', recipientUsername);

  // 3. Realtime broadcast (instant delivery when recipient tab is open)
  supabase.channel(`notifs:${recipientUsername}`)
    .send({ type: 'broadcast', event: 'notification', payload: newNotif })
    .catch(err => console.error('[Notif] realtime broadcast error:', err));
}

function formatNotifTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const NOTIF_ICONS: Record<NotifType, React.ReactNode> = {
  follow: <UserPlus className="size-4 text-[#d07339]" />,
  reply: <MessageSquare className="size-4 text-[#316ac5]" />,
  mention: <AtSign className="size-4 text-purple-500" />,
  comment: <MessageSquare className="size-4 text-green-500" />,
};

const NOTIF_COLORS: Record<NotifType, string> = {
  follow: 'bg-orange-100 dark:bg-orange-900/30',
  reply: 'bg-blue-100 dark:bg-blue-900/30',
  mention: 'bg-purple-100 dark:bg-purple-900/30',
  comment: 'bg-green-100 dark:bg-green-900/30',
};

// ── Normal theme notification bell ───────────────────────────────────────────

export function NotificationBell({ currentUser, isDarkMode }: { currentUser: any; isDarkMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifs.filter(n => !n.read).length;

  const loadNotifs = () => {
    if (!currentUser?.username) return;
    // Show local cache immediately, then merge from KV
    setNotifs(getNotifs(currentUser.username));
    loadNotifsFromKV(currentUser.username).then(merged => setNotifs(merged)).catch(() => {});
  };

  useEffect(() => {
    loadNotifs();
  }, [currentUser?.username]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!currentUser?.username) return;
    const ch = supabase
      .channel(`notifs:${currentUser.username}`)
      .on('broadcast', { event: 'notification' }, ({ payload }: { payload: Notification }) => {
        setNotifs(prev => {
          const updated = [payload, ...prev];
          saveNotifs(currentUser.username, updated);
          return updated;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser?.username]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const persistNotifs = (updated: Notification[]) => {
    if (!currentUser?.username) return;
    saveNotifs(currentUser.username, updated);
    supabase.from(KV_TABLE).upsert({ key: `notifs:${currentUser.username}`, value: updated }, { onConflict: 'key' })
      .then(({ error }) => { if (error) console.error('[Notif] persist error:', error.message); });
  };

  const markAllRead = () => {
    const updated = notifs.map(n => ({ ...n, read: true }));
    setNotifs(updated); persistNotifs(updated);
  };

  const deleteNotif = (id: string) => {
    const updated = notifs.filter(n => n.id !== id);
    setNotifs(updated); persistNotifs(updated);
  };

  const markRead = (id: string) => {
    const updated = notifs.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifs(updated); persistNotifs(updated);
  };

  if (!currentUser) return null;

  const muted = 'text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]';
  const textMain = 'text-[#100b09] dark:text-[#f7f1ed]';

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifs(); }}
        className="relative flex items-center justify-center transition-colors text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:text-[#d07339] dark:hover:text-[#c36a32]"
        style={{ width: 20, height: 20 }}
        title="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-[9999] overflow-hidden`}
          style={{
            background: isDarkMode ? '#18110c' : '#fdfaf8',
            border: isDarkMode ? '1px solid rgba(126,62,21,0.4)' : '1px solid rgba(208,115,57,0.25)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.25)]">
            <span className={`text-sm font-semibold ${textMain}`}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#d07339] dark:text-[#f99251] hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {notifs.length === 0 && (
              <div className={`p-4 text-sm text-center ${muted}`}>No notifications yet</div>
            )}
            {notifs.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`flex items-start gap-3 px-4 py-3 border-b border-[rgba(208,115,57,0.08)] dark:border-[rgba(126,62,21,0.12)] transition-colors ${!n.read ? (isDarkMode ? 'bg-[rgba(126,62,21,0.1)]' : 'bg-[rgba(208,115,57,0.06)]') : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${NOTIF_COLORS[n.type]}`}>
                  {NOTIF_ICONS[n.type]}
                </div>
                <div className="flex-1 min-w-0">
                  {n.link ? (
                    <Link to={n.link} className={`text-xs ${textMain} hover:text-[#d07339] leading-relaxed`}>{n.text}</Link>
                  ) : (
                    <p className={`text-xs ${textMain} leading-relaxed`}>{n.text}</p>
                  )}
                  <p className={`text-[10px] ${muted} mt-0.5`}>{formatNotifTime(n.createdAt)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#d07339] flex-shrink-0 mt-1" />}
                <button onClick={e => { e.stopPropagation(); deleteNotif(n.id); }} className={`${muted} hover:text-red-500 flex-shrink-0`}>
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── XP-style notification popup ───────────────────────────────────────────────

export function XPNotifBell({ currentUser }: { currentUser: any }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const F = '"Tahoma", "MS Sans Serif", Arial, sans-serif';

  const unreadCount = notifs.filter(n => !n.read).length;

  useEffect(() => {
    if (!currentUser?.username) return;
    // Load local cache immediately, then merge from KV
    setNotifs(getNotifs(currentUser.username));
    loadNotifsFromKV(currentUser.username).then(merged => setNotifs(merged)).catch(() => {});
    // Same channel name as NotificationBell so both receive the same broadcasts
    const ch = supabase
      .channel(`notifs:${currentUser.username}`)
      .on('broadcast', { event: 'notification' }, ({ payload }: { payload: Notification }) => {
        setNotifs(prev => { const u = [payload, ...prev]; saveNotifs(currentUser.username, u); return u; });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentUser?.username]);

  if (!currentUser) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => setOpen(!open)}
        title="Notifications"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontFamily: F, fontSize: 13, display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#c8352a', color: 'white', fontSize: 8, fontFamily: F, fontWeight: 'bold', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid white' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, width: 260, background: '#f0eeeb', border: '2px outset #fff', boxShadow: '4px 4px 10px rgba(0,0,0,0.4)', zIndex: 9999, fontFamily: F }}>
          <div style={{ background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>🔔 Notifications</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {notifs.length === 0 && <div style={{ padding: 12, fontSize: 11, color: '#808080' }}>No notifications</div>}
            {notifs.map(n => (
              <div key={n.id} style={{ padding: '5px 8px', borderBottom: '1px solid #d4d0c8', background: n.read ? 'white' : '#e8f0ff', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontFamily: F }}>{n.text}</div>
                  <div style={{ fontSize: 9, color: '#808080', fontFamily: F, marginTop: 2 }}>{formatNotifTime(n.createdAt)}</div>
                </div>
                {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#316ac5', flexShrink: 0, marginTop: 3 }} />}
              </div>
            ))}
          </div>
          {unreadCount > 0 && (
            <div style={{ padding: '4px 8px', borderTop: '1px solid #c0bdb8' }}>
              <button
                onClick={() => { const u = notifs.map(n => ({ ...n, read: true })); setNotifs(u); saveNotifs(currentUser.username, u); }}
                style={{ fontSize: 10, fontFamily: F, background: '#d4d0c8', border: '1px outset #fff', padding: '2px 8px', cursor: 'pointer' }}>
                Mark all read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
