import { useState, useEffect, useRef, useCallback } from 'react';

function useAboveFooter(base: number) {
  const [bottom, setBottom] = useState(base);
  useEffect(() => {
    function update() {
      const footer = document.querySelector('footer');
      if (!footer) { setBottom(base); return; }
      const visible = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top);
      setBottom(base + visible);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [base]);
  return bottom;
}
import { supabase } from '../utils/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';
const GIPHY_API = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;
import {
  X, Send, MessageSquare, ChevronDown, Maximize2, Image,
  Reply, Flag, Ban, Clock, CornerDownRight, Mic, MicOff, PhoneOff, Users,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { addNotificationDB } from '../utils/socialDB';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_username: string;
  sender_avatar?: string;
  text?: string;
  image_url?: string;
  reply_to_id?: string;
  reply_to_username?: string;
  reply_to_text?: string;
  is_guest?: boolean;
  created_at: string;
}

interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  type: 'text' | 'voice';
  created_by?: string;
  voice_password?: string;
  is_default?: boolean;
}

interface PrivateMessage {
  id: string;
  sender_username: string;
  recipient_username: string;
  text?: string;
  image_url?: string;
  read: boolean;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_CHANNELS: ChatChannel[] = [
  { id: 'global',     name: '# Global',          description: 'General chat for everyone', type: 'text',  is_default: true },
  { id: 'movies',     name: '# Movies',           description: 'Discuss movies',            type: 'text',  is_default: true },
  { id: 'tv',         name: '# TV Shows',         description: 'Discuss TV shows',          type: 'text',  is_default: true },
  { id: 'recs',       name: '# Recommendations',  description: "Movie/TV recs",             type: 'text',  is_default: true },
  { id: 'trending',   name: '# Trending',         description: "What's hot right now",      type: 'text',  is_default: true },
  { id: 'voice-chat', name: '🎙 Voice Chat',       description: 'Live voice communication',  type: 'voice', is_default: true },
];

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  // Force all media into one bundle so only one audio track flows per peer
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Disable Opus DTX (discontinuous transmission) so trailing audio isn't
// classified as silence and cut off at the end of sentences.
function fixOpusSDP(sdp: string): string {
  return sdp.replace(/a=fmtp:(\d+) (.+)$/gm, (line, pt, params) => {
    if (!new RegExp(`a=rtpmap:${pt} opus`, 'i').test(sdp)) return line;
    const p = params.includes('usedtx') ? params.replace(/usedtx=\d/, 'usedtx=0') : params + ';usedtx=0';
    const p2 = p.includes('useinbandfec') ? p : p + ';useinbandfec=1';
    return `a=fmtp:${pt} ${p2}`;
  });
}

const XP_FONT = '"Tahoma", "MS Sans Serif", Arial, sans-serif';

function getSavedGuestNick(): string {
  return localStorage.getItem('chat-guest-nick') || '';
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function loadMessages(channelId: string, limit = 80): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages').select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true }).limit(limit);
    if (!error && data) return data as ChatMessage[];
  } catch {}
  return [];
}

async function saveMessage(msg: Omit<ChatMessage, 'id' | 'created_at'>): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('chat_messages').insert([msg]).select('id').single();
    if (!error && data) return data.id;
  } catch {}
  return null;
}

// Returns messages between me and other, using two separate queries to avoid
// PostgREST compound-and-inside-or syntax issues on older Supabase versions.
async function loadPrivateMessages(me: string, other: string): Promise<PrivateMessage[]> {
  const [{ data: sent, error: e1 }, { data: received, error: e2 }] = await Promise.all([
    supabase.from('private_messages').select('*').eq('sender_username', me).eq('recipient_username', other).limit(100),
    supabase.from('private_messages').select('*').eq('sender_username', other).eq('recipient_username', me).limit(100),
  ]);
  if (e1) console.error('[DM] loadPrivateMessages sent query error:', e1);
  if (e2) console.error('[DM] loadPrivateMessages received query error:', e2);
  const combined = [...(sent || []), ...(received || [])] as PrivateMessage[];
  return combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

// Returns { ok: true } on success, or { ok: false, error: string } on failure.
// Never swallows errors — callers must surface them to the user.
export async function sendPrivateMessage(
  sender: string, recipient: string, text: string, imageUrl?: string
): Promise<{ ok: boolean; error?: string }> {
  const payload = { sender_username: sender, recipient_username: recipient, text, image_url: imageUrl || null, read: false };
  console.log('[DM] sendPrivateMessage payload:', payload);
  const { data, error } = await supabase
    .from('private_messages')
    .insert([payload])
    .select('id, created_at')
    .single();
  if (error) {
    console.error('[DM] sendPrivateMessage INSERT error:', error);
    console.error('[DM] error.message:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
    return { ok: false, error: error.message || 'Message failed to send' };
  }
  console.log('[DM] sendPrivateMessage INSERT success, row:', data);
  return { ok: true };
}

async function loadCustomChannels(): Promise<ChatChannel[]> {
  try {
    const { data, error } = await supabase.from('chat_channels').select('*').eq('is_default', false).order('created_at');
    if (!error && data) return data as ChatChannel[];
  } catch {}
  return [];
}

async function checkIsUserBanned(username: string): Promise<boolean> {
  try {
    const { data } = await supabase.from('user_bans').select('*').eq('username', username).eq('active', true)
      .order('created_at', { ascending: false }).limit(1).single();
    if (data) {
      if (data.ban_type === 'ban') return true;
      if (data.expires_at && new Date(data.expires_at) > new Date()) return true;
      await supabase.from('user_bans').update({ active: false }).eq('id', data.id);
    }
  } catch {}
  return false;
}

async function banUser(username: string, bannedBy: string, type: 'ban' | 'timeout', reason: string, durationMinutes?: number) {
  try {
    const expiresAt = type === 'timeout' && durationMinutes
      ? new Date(Date.now() + durationMinutes * 60000).toISOString() : null;
    await supabase.from('user_bans').insert([{ username, banned_by: bannedBy, ban_type: type, reason, expires_at: expiresAt, active: true }]);
  } catch {}
}

async function reportMessage(messageId: string, reporter: string, reason: string) {
  try {
    await supabase.from('message_reports').insert([{ message_id: messageId, reporter_username: reporter, reason }]);
    // Notify all admins and mods
    const { data: mods } = await supabase.from('profiles').select('username').in('role', ['admin', 'moderator']);
    if (mods) {
      await Promise.all(mods.map((m: { username: string }) =>
        addNotificationDB(m.username, {
          type: 'report',
          message: `${reporter} reported a message: "${reason}"`,
          fromUser: reporter,
          read: false,
        }).catch(() => {})
      ));
    }
  } catch {}
}

async function checkNicknameAvailability(nick: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('profiles').select('username').ilike('username', nick).limit(1);
    if (!error && data && data.length > 0) return false;
  } catch {}
  return true;
}

// ── GuestNicknameDialog ───────────────────────────────────────────────────────

function GuestNicknameDialog({ onConfirm, isXP = false }: { onConfirm: (nick: string) => void; isXP?: boolean }) {
  const [nick, setNick] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleConfirm = async () => {
    const t = nick.trim();
    if (!t || t.length < 2) { setError('At least 2 characters.'); return; }
    if (t.length > 20) { setError('Max 20 characters.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(t)) { setError('Letters, numbers and _ only.'); return; }
    setChecking(true);
    const ok = await checkNicknameAvailability(t);
    setChecking(false);
    if (!ok) { setError('That name belongs to a registered user — choose another.'); return; }
    localStorage.setItem('chat-guest-nick', t);
    onConfirm(t);
  };

  if (isXP) {
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, fontFamily: XP_FONT }}>
        <div style={{ background: '#d4d0c8', border: '2px outset #fff', boxShadow: '4px 4px 10px rgba(0,0,0,0.5)', width: 280 }}>
          <div style={{ background: 'linear-gradient(180deg,#0a246a,#3c6eb4)', padding: '4px 8px', color: 'white', fontSize: 12, fontWeight: 'bold' }}>👤 Choose a Nickname</div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11 }}>Enter a nickname. You are chatting as a guest.</div>
            <input autoFocus value={nick} onChange={e => { setNick(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()} placeholder="YourNickname"
              style={{ height: 22, padding: '0 4px', fontSize: 11, background: 'white', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            {error && <div style={{ fontSize: 10, color: '#c00' }}>{error}</div>}
            <button onClick={handleConfirm} disabled={checking}
              style={{ height: 24, background: '#d4d0c8', border: '2px outset #fff', fontSize: 11, cursor: 'pointer' }}>
              {checking ? 'Checking…' : 'Join Chat'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 p-6 bg-[#fdfaf8] dark:bg-[#18110c]">
      <div className="w-full max-w-xs space-y-4 text-center">
        <MessageSquare className="size-10 mx-auto text-[#d07339]" />
        <h3 className="font-semibold text-[#100b09] dark:text-[#f7f1ed]">Pick a chat nickname</h3>
        <p className="text-xs text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">You are chatting as a guest.</p>
        <input autoFocus value={nick} onChange={e => { setNick(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleConfirm()} placeholder="YourNickname"
          className="w-full text-sm border border-[rgba(208,115,57,0.3)] dark:border-[rgba(126,62,21,0.4)] rounded-lg px-3 py-2 bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.1)] outline-none focus:border-[#d07339] text-[#100b09] dark:text-[#f7f1ed]" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={handleConfirm} disabled={checking}
          className="w-full py-2 bg-[#d07339] hover:bg-[#c36a32] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {checking ? 'Checking…' : 'Join Chat'}
        </button>
      </div>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ msg, currentUser, onReply, onReport, onBan, onTimeout, isXP = false }: {
  msg: ChatMessage; currentUser?: any;
  onReply: (msg: ChatMessage) => void; onReport: (msg: ChatMessage) => void;
  onBan: (u: string) => void; onTimeout: (u: string) => void;
  isXP?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const canMod = currentUser?.role === 'admin' || currentUser?.role === 'moderator';
  const F = XP_FONT;

  if (isXP) {
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ display: 'flex', gap: 5, alignItems: 'flex-start', padding: '2px 0', position: 'relative' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: '1px solid #808080', flexShrink: 0, background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
          {msg.sender_avatar ? <img src={msg.sender_avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '👤'}
        </div>
        <div style={{ flex: 1, background: 'white', border: '1px inset #808080', padding: '2px 5px', boxShadow: 'inset 1px 1px 0 #808080', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 1 }}>
            {msg.is_guest
              ? <span style={{ fontSize: 10, fontWeight: 'bold', color: '#808080', fontFamily: F }}>{msg.sender_username}</span>
              : <Link to={`/users/${msg.sender_username}`} style={{ fontSize: 10, fontWeight: 'bold', color: '#316ac5', fontFamily: F, textDecoration: 'none' }}>{msg.sender_username}</Link>
            }
            {msg.is_guest && <span style={{ fontSize: 9, color: '#aaa', fontFamily: F }}>(guest)</span>}
            <span style={{ fontSize: 9, color: '#aaa', fontFamily: F, marginLeft: 'auto' }}>{formatTime(msg.created_at)}</span>
          </div>
          {msg.reply_to_username && (
            <div style={{ fontSize: 10, color: '#808080', borderLeft: '2px solid #316ac5', paddingLeft: 4, marginBottom: 2, fontFamily: F }}>
              ↩ {msg.reply_to_username}: {msg.reply_to_text?.slice(0, 50)}
            </div>
          )}
          {msg.text && <div style={{ fontSize: 11, fontFamily: F, color: '#000', lineHeight: 1.4, wordBreak: 'break-word' }}>{msg.text}</div>}
          {msg.image_url && <img src={msg.image_url} alt="" style={{ maxWidth: 160, maxHeight: 120, display: 'block', marginTop: 2, border: '1px inset #808080' }} />}
        </div>
        {hover && (
          <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: 2, background: '#f0eeeb', border: '1px outset #fff', padding: '2px 4px', zIndex: 99, fontFamily: F }}>
            <button onClick={() => onReply(msg)} title="Reply" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>↩</button>
            <button onClick={() => onReport(msg)} title="Report" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>⚑</button>
            {canMod && msg.sender_username !== currentUser?.username && (
              <>
                <button onClick={() => onTimeout(msg.sender_username)} title="Timeout" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}>⏱</button>
                <button onClick={() => onBan(msg.sender_username)} title="Ban" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#c00' }}>🔨</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="flex gap-2.5 items-start hover:bg-[rgba(208,115,57,0.03)] dark:hover:bg-[rgba(126,62,21,0.05)] px-2 py-1 rounded-lg relative transition-colors">
      <div className="w-7 h-7 rounded-full bg-[rgba(208,115,57,0.15)] dark:bg-[rgba(126,62,21,0.3)] flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
        {msg.sender_avatar
          ? <img src={msg.sender_avatar} className="w-full h-full object-cover" alt="" />
          : <span className="text-[10px]">👤</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {msg.is_guest
            ? <span className="text-[11px] font-semibold text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]">{msg.sender_username}</span>
            : <Link to={`/users/${msg.sender_username}`} className="text-[11px] font-semibold text-[#d07339] dark:text-[#f99251] hover:underline">{msg.sender_username}</Link>
          }
          {msg.is_guest && <span className="text-[9px] text-[rgba(16,11,9,0.3)] dark:text-[rgba(247,241,237,0.3)]">guest</span>}
          <span className="text-[9px] text-[rgba(16,11,9,0.3)] dark:text-[rgba(247,241,237,0.3)]">{formatTime(msg.created_at)}</span>
        </div>
        {msg.reply_to_username && (
          <div className="text-[9px] border-l-2 border-[#d07339] pl-1.5 mb-0.5 text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)]">
            ↩ {msg.reply_to_username}: {msg.reply_to_text?.slice(0, 60)}
          </div>
        )}
        {msg.text && <p className="text-[11px] text-[rgba(16,11,9,0.85)] dark:text-[rgba(247,241,237,0.85)] leading-relaxed break-words">{msg.text}</p>}
        {msg.image_url && <img src={msg.image_url} alt="media" className="mt-1 max-h-36 max-w-full rounded object-contain border border-[rgba(208,115,57,0.2)]" />}
      </div>
      {hover && (
        <div className="absolute right-1 top-0 flex items-center gap-0.5 bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded shadow-sm px-1 py-0.5 z-10">
          <button onClick={() => onReply(msg)} title="Reply" className="p-0.5 hover:text-[#d07339] text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] transition-colors"><Reply className="size-3" /></button>
          <button onClick={() => onReport(msg)} title="Report" className="p-0.5 hover:text-red-500 text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] transition-colors"><Flag className="size-3" /></button>
          {canMod && msg.sender_username !== currentUser?.username && (
            <>
              <button onClick={() => onTimeout(msg.sender_username)} title="Timeout" className="p-0.5 hover:text-yellow-600 text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] transition-colors"><Clock className="size-3" /></button>
              <button onClick={() => onBan(msg.sender_username)} title="Ban" className="p-0.5 hover:text-red-600 text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] transition-colors"><Ban className="size-3" /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Accordion Sidebar (used in compact floating popup) ────────────────────────

function CompactSidebar({ channels, activeChannel, activeDM, dmPartners, onSelectChannel, onSelectDM, canMod, showNewChannel, setShowNewChannel, newChannelName, setNewChannelName, onCreateChannel, onRenameChannel, onDeleteChannel, currentUser }: {
  channels: ChatChannel[]; activeChannel: string; activeDM: string | null;
  dmPartners: string[]; onSelectChannel: (id: string) => void; onSelectDM: (u: string) => void;
  canMod: boolean; showNewChannel: boolean; setShowNewChannel: (v: boolean) => void;
  newChannelName: string; setNewChannelName: (v: string) => void; onCreateChannel: () => void;
  onRenameChannel?: (ch: ChatChannel, name: string) => void; onDeleteChannel?: (ch: ChatChannel) => void;
  currentUser?: any;
}) {
  const [chatOpen, setChatOpen] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);
  const isLoggedIn = !!currentUser;

  return (
    <div style={{ width: 108, minWidth: 108, maxWidth: 108 }} className="flex-shrink-0 flex flex-col border-r border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.2)] bg-[rgba(208,115,57,0.03)] dark:bg-[rgba(126,62,21,0.06)] overflow-y-auto overflow-x-hidden">
      {/* ── Main Chat ── */}
      <button onClick={() => setChatOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-1.5 w-full text-left hover:bg-[rgba(208,115,57,0.08)] dark:hover:bg-[rgba(126,62,21,0.12)] transition-colors flex-shrink-0">
        <ChevronDown className={`size-2.5 text-[#d07339] flex-shrink-0 transition-transform duration-200 ${chatOpen ? 'rotate-0' : '-rotate-90'}`} />
        <span className="text-[9px] font-bold uppercase tracking-wide text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] truncate">Chat</span>
      </button>
      {chatOpen && (
        <div className="flex flex-col">
          {channels.map(ch => (
            <div key={ch.id} className="group/ch flex items-center">
              <button onClick={() => onSelectChannel(ch.id)}
                className={`flex items-center gap-0.5 px-2 py-0.5 text-left text-[10px] transition-colors flex-1 min-w-0 ${activeChannel === ch.id && !activeDM ? 'bg-[#d07339] text-white font-medium' : 'text-[rgba(16,11,9,0.65)] dark:text-[rgba(247,241,237,0.65)] hover:bg-[rgba(208,115,57,0.1)] dark:hover:bg-[rgba(126,62,21,0.15)]'}`}>
                {ch.type === 'voice' && <Mic className="size-2 flex-shrink-0 opacity-60" />}
                <span className="truncate">{ch.name.replace('# ', '#')}</span>
              </button>
              {canMod && !ch.is_default && (
                <div className="hidden group-hover/ch:flex flex-shrink-0 gap-px pr-0.5">
                  <button onClick={() => { const n = window.prompt('Rename channel:', ch.name.replace('# ','')); if (n?.trim()) onRenameChannel?.(ch, n.trim()); }} title="Rename" className="text-[8px] text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)] hover:text-[#d07339] px-0.5">✏</button>
                  <button onClick={() => { if (window.confirm('Delete this channel?')) onDeleteChannel?.(ch); }} title="Delete" className="text-[8px] text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)] hover:text-red-500 px-0.5">✕</button>
                </div>
              )}
            </div>
          ))}
          {canMod && (
            showNewChannel ? (
              <div className="flex gap-0.5 mx-1 mt-0.5">
                <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onCreateChannel()} placeholder="Name"
                  className="flex-1 text-[9px] px-1 py-0.5 rounded border border-[rgba(208,115,57,0.3)] bg-white dark:bg-[#18110c] outline-none text-[#100b09] dark:text-[#f7f1ed] min-w-0" />
                <button onClick={onCreateChannel} className="text-[9px] bg-[#d07339] text-white px-1 rounded flex-shrink-0">+</button>
              </div>
            ) : (
              <button onClick={() => setShowNewChannel(true)} className="text-[9px] text-[rgba(16,11,9,0.3)] dark:text-[rgba(247,241,237,0.3)] hover:text-[#d07339] px-2 py-0.5 text-left w-full">+ New</button>
            )
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <button onClick={() => setMsgOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-1.5 w-full text-left hover:bg-[rgba(208,115,57,0.08)] dark:hover:bg-[rgba(126,62,21,0.12)] transition-colors border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.15)] flex-shrink-0 mt-0.5">
        <ChevronDown className={`size-2.5 text-[#d07339] flex-shrink-0 transition-transform duration-200 ${msgOpen ? 'rotate-0' : '-rotate-90'}`} />
        <span className="text-[9px] font-bold uppercase tracking-wide text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] truncate">DMs</span>
      </button>
      {msgOpen && (
        <div className="flex flex-col">
          {!isLoggedIn ? (
            <div className="px-2 py-1.5 text-[9px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] leading-tight">
              <Link to="/" className="text-[#d07339] underline">Log in</Link> for DMs
            </div>
          ) : dmPartners.length === 0 ? (
            <p className="px-2 py-0.5 text-[9px] text-[rgba(16,11,9,0.3)] dark:text-[rgba(247,241,237,0.3)]">No DMs yet</p>
          ) : (
            dmPartners.map(u => (
              <button key={u} onClick={() => onSelectDM(u)}
                className={`flex items-center gap-1 px-2 py-0.5 text-left text-[10px] transition-colors w-full truncate ${activeDM === u ? 'bg-[#d07339] text-white font-medium' : 'text-[rgba(16,11,9,0.65)] dark:text-[rgba(247,241,237,0.65)] hover:bg-[rgba(208,115,57,0.1)] dark:hover:bg-[rgba(126,62,21,0.15)]'}`}>
                <span className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0" />
                <span className="truncate">{u}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── XP Sidebar ────────────────────────────────────────────────────────────────

function XPSidebar({ channels, activeChannel, activeDM, onSelectChannel, onSelectDM, dmPartners, canMod, showNewChannel, setShowNewChannel, newChannelName, setNewChannelName, onCreateChannel, onRenameChannel, onDeleteChannel, currentUser }: {
  channels: ChatChannel[]; activeChannel: string; activeDM: string | null;
  dmPartners: string[]; onSelectChannel: (id: string) => void; onSelectDM: (u: string) => void;
  canMod: boolean; showNewChannel: boolean; setShowNewChannel: (v: boolean) => void;
  newChannelName: string; setNewChannelName: (v: string) => void; onCreateChannel: () => void;
  onRenameChannel?: (ch: ChatChannel, name: string) => void; onDeleteChannel?: (ch: ChatChannel) => void;
  currentUser?: any;
}) {
  const [chatOpen, setChatOpen] = useState(true);
  const [msgOpen, setMsgOpen] = useState(false);
  const F = XP_FONT;
  const isLoggedIn = !!currentUser;

  return (
    <div style={{ width: 120, minWidth: 120, maxWidth: 120, background: '#c8c4bc', borderRight: '2px solid #808080', display: 'flex', flexDirection: 'column', fontFamily: F, flexShrink: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Main Chat */}
      <button onClick={() => setChatOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: '#0a246a', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', color: 'white', fontSize: 10, fontFamily: F, fontWeight: 'bold' }}>
        <span style={{ display: 'inline-block', transform: chatOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: 8 }}>▶</span>
        💬 Main Chat
      </button>
      {chatOpen && channels.map(ch => (
        <div key={ch.id} style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => onSelectChannel(ch.id)}
            style={{ flex: 1, minWidth: 0, padding: '3px 10px', fontSize: 10, fontFamily: F, textAlign: 'left', background: activeChannel === ch.id && !activeDM ? '#316ac5' : 'transparent', color: activeChannel === ch.id && !activeDM ? 'white' : '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            {ch.type === 'voice' && <span style={{ fontSize: 8 }}>🎙</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
          </button>
          {canMod && !ch.is_default && (
            <div style={{ display: 'flex', flexShrink: 0 }}>
              <button onClick={() => { const n = window.prompt('Rename:', ch.name.replace('# ','')); if (n?.trim()) onRenameChannel?.(ch, n.trim()); }} title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: '#555', padding: '0 2px', fontFamily: F }}>✏</button>
              <button onClick={() => { if (window.confirm('Delete channel?')) onDeleteChannel?.(ch); }} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: '#c00', padding: '0 2px', fontFamily: F }}>✕</button>
            </div>
          )}
        </div>
      ))}
      {chatOpen && canMod && (
        showNewChannel ? (
          <div style={{ padding: '2px 4px', display: 'flex', gap: 2 }}>
            <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} onKeyDown={e => e.key === 'Enter' && onCreateChannel()}
              placeholder="Name" style={{ flex: 1, height: 18, fontSize: 10, padding: '0 3px', border: 'none', boxShadow: 'inset 1px 1px 0 #808080', background: 'white', minWidth: 0 }} />
            <button onClick={onCreateChannel} style={{ fontSize: 9, background: '#d4d0c8', border: '1px outset #fff', cursor: 'pointer', padding: '1px 4px', fontFamily: F }}>+</button>
          </div>
        ) : (
          <button onClick={() => setShowNewChannel(true)} style={{ fontSize: 9, fontFamily: F, color: '#555', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 10px' }}>+ New Channel</button>
        )
      )}

      {/* Messages */}
      <button onClick={() => setMsgOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', background: '#0a246a', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', color: 'white', fontSize: 10, fontFamily: F, fontWeight: 'bold', marginTop: 4 }}>
        <span style={{ display: 'inline-block', transform: msgOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', fontSize: 8 }}>▶</span>
        ✉ Messages
      </button>
      {msgOpen && (
        !isLoggedIn ? (
          <div style={{ fontSize: 10, fontFamily: F, color: '#555', padding: '4px 8px', lineHeight: 1.4 }}>
            Log in to access private messages.
          </div>
        ) : dmPartners.length === 0 ? (
          <div style={{ fontSize: 10, fontFamily: F, color: '#808080', padding: '4px 8px' }}>No conversations yet.</div>
        ) : (
          dmPartners.map(u => (
            <button key={u} onClick={() => onSelectDM(u)}
              style={{ padding: '3px 10px', fontSize: 10, fontFamily: F, textAlign: 'left', background: activeDM === u ? '#316ac5' : 'transparent', color: activeDM === u ? 'white' : '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c800', display: 'inline-block', flexShrink: 0 }} />
              {u}
            </button>
          ))
        )
      )}
    </div>
  );
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export interface ChatPanelProps {
  currentUser?: any;
  isXP?: boolean;
  style?: React.CSSProperties;
  initialChannel?: string;
  initialDM?: string | null;
  showSidebar?: boolean;
  onExpandToPage?: () => void;
}

export function ChatPanel({ currentUser, isXP = false, style, initialChannel = 'global', initialDM = null, showSidebar = false, onExpandToPage }: ChatPanelProps) {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<ChatChannel[]>(DEFAULT_CHANNELS);
  const [activeChannel, setActiveChannel] = useState(initialChannel);
  const [activeDM, setActiveDM] = useState<string | null>(initialDM);
  const [dmPartners, setDmPartners] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dmMessages, setDmMessages] = useState<PrivateMessage[]>([]);
  const [input, setInput] = useState('');
  const [imageInput, setImageInput] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [guestNick, setGuestNick] = useState(getSavedGuestNick);
  const [needsNick, setNeedsNick] = useState(!currentUser && !getSavedGuestNick());
  const [reportingMsg, setReportingMsg] = useState<ChatMessage | null>(null);
  const [banningUser, setBanningUser] = useState<string | null>(null);
  const [timeoutUser, setTimeoutUser] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showGifPanel, setShowGifPanel] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const gifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [xpSidebarVisible, setXpSidebarVisible] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dmChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const F = XP_FONT;

  const displayName = currentUser?.username || guestNick;
  const isGuest = !currentUser;
  const avatar = currentUser?.profilePicture || localStorage.getItem(`userPic_${displayName}`) || '';
  const canMod = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  // Restore past DM conversations from Supabase on mount so they survive refresh
  useEffect(() => {
    if (!currentUser?.username) return;
    const me = currentUser.username;
    console.log('[DM] Loading partner list for', me);
    Promise.all([
      supabase.from('private_messages').select('sender_username').eq('recipient_username', me).order('created_at', { ascending: false }).limit(100),
      supabase.from('private_messages').select('recipient_username').eq('sender_username', me).order('created_at', { ascending: false }).limit(100),
    ]).then(([{ data: received, error: e1 }, { data: sent, error: e2 }]) => {
      if (e1) console.error('[DM] partner load (received) error:', e1);
      if (e2) console.error('[DM] partner load (sent) error:', e2);
      const partners = new Set<string>();
      (received || []).forEach(r => { if (r.sender_username !== me) partners.add(r.sender_username); });
      (sent || []).forEach(r => { if (r.recipient_username !== me) partners.add(r.recipient_username); });
      console.log('[DM] Loaded', partners.size, 'past partners:', [...partners]);
      if (partners.size > 0) setDmPartners(prev => [...new Set([...prev, ...partners])]);
    }).catch(err => console.error('[DM] partner load exception:', err));
  }, [currentUser?.username]);

  // Load custom channels once on mount (separate from messages so switching channels doesn't wipe them)
  useEffect(() => {
    if (!displayName) return;
    loadCustomChannels().then(custom => {
      setChannels(prev => {
        const defaultIds = new Set(DEFAULT_CHANNELS.map(c => c.id));
        const prevCustom = prev.filter(c => !defaultIds.has(c.id));
        const serverIds = new Set(custom.map((c: ChatChannel) => c.id));
        // Keep any locally-optimistic channels not yet in Supabase
        const pendingLocal = prevCustom.filter(c => !serverIds.has(c.id));
        return [...DEFAULT_CHANNELS, ...custom, ...pendingLocal];
      });
    });
    if (currentUser?.username) checkIsUserBanned(currentUser.username).then(b => setIsBanned(b));
  }, [displayName]);

  // Load messages when active channel changes
  useEffect(() => {
    if (!displayName) return;
    setIsLoading(true);
    loadMessages(activeChannel).then(msgs => {
      setMessages(msgs);
      setIsLoading(false);
    });
  }, [activeChannel, displayName]);

  // Realtime for active channel
  useEffect(() => {
    if (!displayName) return;
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const ch = supabase.channel(`chat:${activeChannel}`)
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (payload.username !== displayName) setTypingUsers(p => ({ ...p, [payload.username]: Date.now() }));
      })
      .on('broadcast', { event: 'presence' }, ({ payload }: any) => {
        if (payload.users) setOnlineUsers(payload.users);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannel}` }, (payload: any) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as ChatMessage];
        });
      })
      .subscribe(() => {
        // Announce presence
        ch.send({ type: 'broadcast', event: 'presence', payload: { users: [...onlineUsers.filter(u => u !== displayName), displayName] } }).catch(() => {});
      });

    realtimeRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [activeChannel, displayName]);

  // Load DM messages whenever activeDM changes (including initial load from URL param)
  useEffect(() => {
    if (!activeDM || !displayName) { setDmMessages([]); return; }
    loadPrivateMessages(displayName, activeDM).then(msgs => setDmMessages(msgs)).catch(() => {});
  }, [activeDM, displayName]);

  // DM realtime
  useEffect(() => {
    if (!displayName) return;
    if (dmChannelRef.current) supabase.removeChannel(dmChannelRef.current);
    const dc = supabase.channel(`dm:inbox:${displayName}`)
      .on('broadcast', { event: 'dm' }, ({ payload }: any) => {
        const pm = payload as PrivateMessage;
        if (!dmPartners.includes(pm.sender_username)) {
          setDmPartners(prev => [...new Set([...prev, pm.sender_username])]);
        }
        if (activeDM === pm.sender_username) {
          setDmMessages(prev => [...prev, pm]);
        }
      })
      .subscribe();
    dmChannelRef.current = dc;
    return () => { supabase.removeChannel(dc); };
  }, [displayName, activeDM]);


  // Clear stale typing
  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const next = { ...prev };
        let changed = false;
        for (const k in next) { if (now - next[k] > 3000) { delete next[k]; changed = true; } }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, dmMessages]);

  const broadcastTyping = useCallback(() => {
    realtimeRef.current?.send({ type: 'broadcast', event: 'typing', payload: { username: displayName } }).catch(() => {});
  }, [displayName]);

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `chat/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
        setUploadingImage(false);
        return urlData.publicUrl;
      }
    } catch {}
    // Fallback: data URL for images under 1MB
    try {
      if (file.size <= 1024 * 1024) {
        const url = await new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = e => res(e.target?.result as string);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        setUploadingImage(false);
        return url;
      }
    } catch {}
    setUploadingImage(false);
    return null;
  };

  const searchGifs = async (q: string) => {
    if (!q.trim()) { setGifResults([]); return; }
    try {
      const r = await fetch(`${GIPHY_API}/giphy/search?q=${encodeURIComponent(q)}&limit=18&offset=0`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const d = await r.json();
      setGifResults(d.data || []);
    } catch {}
  };

  const searchGifsDebounced = (q: string) => {
    setGifQuery(q);
    if (gifDebounceRef.current) clearTimeout(gifDebounceRef.current);
    gifDebounceRef.current = setTimeout(() => searchGifs(q), 400);
  };

  const sendGif = async (gifUrl: string) => {
    if (!displayName || isBanned) return;
    const payload: Omit<ChatMessage, 'id' | 'created_at'> = {
      channel_id: activeChannel, sender_username: displayName, sender_avatar: avatar,
      text: input.trim() || undefined, image_url: gifUrl,
      reply_to_id: replyTo?.id, reply_to_username: replyTo?.sender_username, reply_to_text: replyTo?.text?.slice(0, 80),
      is_guest: isGuest,
    };
    setInput(''); setShowGifPanel(false); setGifResults([]); setGifQuery(''); setReplyTo(null);
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = { ...payload, id: tempId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    const savedId = await saveMessage(payload);
    if (savedId && savedId !== tempId) setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: savedId } : m));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) setImageInput(url);
    e.target.value = '';
  };

  const sendMessage = async () => {
    const text = input.trim();
    const imgUrl = imageInput.trim();
    if (!text && !imgUrl) return;
    if (!displayName || isBanned) return;
    setInput(''); setImageInput(''); setShowImageInput(false);

    const payload: Omit<ChatMessage, 'id' | 'created_at'> = {
      channel_id: activeChannel, sender_username: displayName, sender_avatar: avatar,
      text: text || undefined, image_url: imgUrl || undefined,
      reply_to_id: replyTo?.id, reply_to_username: replyTo?.sender_username, reply_to_text: replyTo?.text?.slice(0, 80),
      is_guest: isGuest,
    };
    setReplyTo(null);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = { ...payload, id: tempId, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);

    const savedId = await saveMessage(payload);
    if (savedId && savedId !== tempId) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: savedId } : m));
    }

    // Generate notifications for @mentions (registered users only)
    if (!isGuest && text) {
      const mentions = [...new Set((text.match(/@([a-zA-Z0-9_]+)/g) || []).map(m => m.slice(1)))];
      mentions.forEach(mentionedUser => {
        if (mentionedUser.toLowerCase() !== displayName.toLowerCase()) {
          addNotificationDB(mentionedUser, {
            type: 'mention',
            message: `${displayName} mentioned you in #${activeChannel}: "${text.slice(0, 80)}"`,
            fromUser: displayName,
            read: false,
          }).catch(() => {});
        }
      });
    }
  };

  const sendDM = async () => {
    if (!activeDM || !displayName || !input.trim()) return;
    const text = input.trim();
    const imgUrl = imageInput.trim();
    setInput(''); setImageInput(''); setShowImageInput(false);

    // Optimistic: show the message immediately so the sender has instant feedback
    const tempId = `temp-${Date.now()}`;
    const tempMsg: PrivateMessage = { id: tempId, sender_username: displayName, recipient_username: activeDM, text, read: false, created_at: new Date().toISOString() };
    setDmMessages(prev => [...prev, tempMsg]);

    const result = await sendPrivateMessage(displayName, activeDM, text, imgUrl || undefined);
    if (result.ok) {
      // Realtime delivery to recipient's inbox channel
      supabase.channel(`dm:inbox:${activeDM}`).send({ type: 'broadcast', event: 'dm', payload: tempMsg }).catch(() => {});
      // Persistent notification for the recipient
      addNotification(activeDM, {
        type: 'reply',
        senderUsername: displayName,
        senderAvatar: avatar,
        text: `${displayName} sent you a message: "${text.slice(0, 60)}"`,
        link: `/chat?dm=${displayName}`,
      }).catch(() => {});
    } else {
      // Remove the optimistic message and show the exact DB error
      setDmMessages(prev => prev.filter(m => m.id !== tempId));
      const errText = result.error || 'Unknown error';
      // Show error as a system message in the DM thread
      const errMsg: PrivateMessage = {
        id: `err-${Date.now()}`,
        sender_username: '__system__',
        recipient_username: displayName,
        text: `⚠️ Message failed: ${errText}. Check browser console for details.`,
        read: true,
        created_at: new Date().toISOString(),
      };
      setDmMessages(prev => [...prev, errMsg]);
    }
  };

  const handleSend = () => activeDM ? sendDM() : sendMessage();

  const createChannel = async () => {
    if (!canMod || !newChannelName.trim()) return;
    const newCh: ChatChannel = { id: `ch-${Date.now()}`, name: `# ${newChannelName.trim()}`, type: 'text', created_by: currentUser?.username };
    // Add optimistically so it persists even if the channel-load useEffect fires
    setChannels(prev => prev.find(c => c.id === newCh.id) ? prev : [...prev, newCh]);
    setNewChannelName(''); setShowNewChannel(false);
    try {
      await supabase.from('chat_channels').insert([{ ...newCh, is_default: false }]);
    } catch {}
    setActiveChannel(newCh.id); setActiveDM(null);
  };

  const renameChannel = async (ch: ChatChannel, newName: string) => {
    if (!canMod || ch.is_default) return;
    const name = `# ${newName.trim()}`;
    setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, name } : c));
    try { await supabase.from('chat_channels').update({ name }).eq('id', ch.id); } catch {}
  };

  const deleteChannel = async (ch: ChatChannel) => {
    if (!canMod || ch.is_default) return;
    setChannels(prev => prev.filter(c => c.id !== ch.id));
    if (activeChannel === ch.id) { setActiveChannel('global'); setActiveDM(null); }
    try { await supabase.from('chat_channels').delete().eq('id', ch.id); } catch {}
  };

  const openDM = async (username: string) => {
    if (!displayName || !currentUser) return;
    setActiveDM(username);
    if (!dmPartners.includes(username)) setDmPartners(prev => [...new Set([...prev, username])]);
    const msgs = await loadPrivateMessages(displayName, username);
    setDmMessages(msgs);
  };

  const typingList = Object.keys(typingUsers).filter(u => Date.now() - typingUsers[u] < 3000);
  const currentMessages = activeDM ? dmMessages : messages;
  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const isVoiceChannel = !activeDM && activeChannelObj?.type === 'voice';

  const sidebarProps = {
    channels, activeChannel, activeDM, dmPartners,
    onSelectChannel: (id: string) => { setActiveChannel(id); setActiveDM(null); },
    onSelectDM: openDM, canMod, showNewChannel, setShowNewChannel, newChannelName, setNewChannelName,
    onCreateChannel: createChannel, onRenameChannel: renameChannel, onDeleteChannel: deleteChannel, currentUser,
  };

  const renderInput = () => {
    if (isBanned) {
      if (isXP) return <div style={{ padding: '6px 8px', fontSize: 11, fontFamily: F, color: '#c00', background: '#f0eeeb', borderTop: '1px solid #808080', flexShrink: 0 }}>You are banned from this chat.</div>;
      return <div className="p-3 text-xs text-red-500 border-t border-[rgba(208,115,57,0.15)] flex-shrink-0">You are banned from this chat.</div>;
    }

    if (isXP) {
      return (
        <div style={{ padding: '4px 6px', background: '#c0bdb8', borderTop: '1px solid #808080', display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          <input ref={imageFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          {replyTo && (
            <div style={{ fontSize: 10, fontFamily: F, color: '#444', background: '#e0dcd4', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
              ↩ {replyTo.sender_username}: {replyTo.text?.slice(0, 40)}
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto', color: '#808080' }}>×</button>
            </div>
          )}
          {imageInput && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: F, color: '#444' }}>
              <img src={imageInput} alt="" style={{ width: 20, height: 20, objectFit: 'cover', border: '1px inset #808080' }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Image ready</span>
              <button onClick={() => setImageInput('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00', fontSize: 12 }}>×</button>
            </div>
          )}
          {showGifPanel && (
            <div style={{ background: '#f0eeea', border: '1px inset #808080', padding: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', gap: 3 }}>
                <input value={gifQuery} onChange={e => searchGifsDebounced(e.target.value)}
                  placeholder="Search GIFs…" style={{ flex: 1, height: 18, fontSize: 10, fontFamily: F, background: 'white', border: 'none', boxShadow: 'inset 1px 1px 0 #808080', padding: '0 3px', outline: 'none' }} />
                <button onClick={() => { setShowGifPanel(false); setGifResults([]); setGifQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00', fontSize: 12, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, maxHeight: 100, overflowY: 'auto' }}>
                {gifResults.map((g: any) => (
                  <img key={g.id} src={g.images?.fixed_height?.url} alt={g.title || 'gif'} style={{ width: '100%', height: 40, objectFit: 'cover', cursor: 'pointer', border: '1px solid #c0bdb8' }}
                    onClick={() => sendGif(g.images?.original?.url || g.images?.fixed_height?.url)} />
                ))}
                {gifResults.length === 0 && <div style={{ gridColumn: '1/-1', fontSize: 9, fontFamily: F, color: '#808080', textAlign: 'center', padding: 4 }}>{gifQuery ? 'Searching…' : 'Type to search GIFs'}</div>}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontFamily: F, color: '#444', whiteSpace: 'nowrap', flexShrink: 0 }}>{activeDM ? `→ ${activeDM}:` : `${displayName}:`}</span>
            <input value={input} onChange={e => { setInput(e.target.value); broadcastTyping(); }} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Type a message..." style={{ flex: 1, minWidth: 0, height: 22, padding: '0 4px', fontSize: 11, fontFamily: F, background: 'white', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', outline: 'none' }} />
            <button onClick={() => imageFileRef.current?.click()} disabled={uploadingImage} title="Upload image" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, flexShrink: 0, opacity: uploadingImage ? 0.4 : 1 }}>🖼</button>
            <button onClick={() => { setShowGifPanel(v => !v); setGifResults([]); setGifQuery(''); }} style={{ height: 22, padding: '0 5px', fontSize: 9, fontFamily: F, fontWeight: 'bold', background: showGifPanel ? '#d07339' : '#d4d0c8', color: showGifPanel ? 'white' : '#000', border: '2px outset #fff', cursor: 'pointer', flexShrink: 0 }}>GIF</button>
            <button onClick={handleSend} style={{ height: 22, padding: '0 8px', fontSize: 11, fontFamily: F, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', fontWeight: 'bold', flexShrink: 0 }}>Send</button>
          </div>
        </div>
      );
    }

    return (
      <div className="border-t border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.25)] p-1.5 flex-shrink-0">
        {/* Hidden file input */}
        <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {replyTo && (
          <div className="flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded bg-[rgba(208,115,57,0.08)] dark:bg-[rgba(126,62,21,0.12)] text-[9px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
            <CornerDownRight className="size-2.5 flex-shrink-0" />
            <span className="flex-1 truncate">↩ <strong>{replyTo.sender_username}</strong>: {replyTo.text?.slice(0, 50)}</span>
            <button onClick={() => setReplyTo(null)} className="hover:text-red-500 flex-shrink-0"><X className="size-2.5" /></button>
          </div>
        )}
        {imageInput && (
          <div className="flex items-center gap-1 mb-1">
            <img src={imageInput} alt="" className="h-10 w-10 object-cover rounded border border-[rgba(208,115,57,0.2)]" onError={() => {}} />
            <span className="text-[9px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] flex-1 truncate">Image ready</span>
            <button onClick={() => setImageInput('')} className="hover:text-red-500 text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]"><X className="size-2.5" /></button>
          </div>
        )}
        {showGifPanel && (
          <div className="mb-1 rounded border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] bg-[rgba(208,115,57,0.03)] dark:bg-[rgba(126,62,21,0.06)] p-1.5">
            <div className="flex gap-1 mb-1.5">
              <input value={gifQuery} onChange={e => searchGifsDebounced(e.target.value)}
                placeholder="Search GIFs… (results appear as you type)"
                className="flex-1 text-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded px-2 py-0.5 outline-none bg-transparent text-[#100b09] dark:text-[#f7f1ed] focus:border-[#d07339]" />
              <button onClick={() => { setShowGifPanel(false); setGifResults([]); setGifQuery(''); }} className="text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)] hover:text-red-500"><X className="size-3" /></button>
            </div>
            <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto">
              {gifResults.map((g: any) => (
                <img key={g.id} src={g.images?.fixed_height?.url || g.images?.fixed_width_small?.url} alt={g.title || 'gif'}
                  className="w-full h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => sendGif(g.images?.original?.url || g.images?.fixed_height?.url)} />
              ))}
              {gifResults.length === 0 && <p className="col-span-3 text-[9px] text-center text-[rgba(16,11,9,0.3)] dark:text-[rgba(247,241,237,0.3)] py-2">{gifQuery ? 'Searching…' : 'Type to search GIFs'}</p>}
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => imageFileRef.current?.click()} disabled={uploadingImage}
            title="Upload image" className="p-1 rounded hover:bg-[rgba(208,115,57,0.1)] text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)] hover:text-[#d07339] transition-colors flex-shrink-0 disabled:opacity-40">
            {uploadingImage ? <span className="text-[8px]">…</span> : <Image className="size-3" />}
          </button>
          <button onClick={() => { setShowGifPanel(!showGifPanel); setGifResults([]); setGifQuery(''); }} title="GIF"
            className={`p-1 rounded text-[9px] font-bold transition-colors flex-shrink-0 ${showGifPanel ? 'bg-[#d07339] text-white' : 'text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)] hover:bg-[rgba(208,115,57,0.1)] hover:text-[#d07339]'}`}>
            GIF
          </button>
          <input value={input} onChange={e => { setInput(e.target.value); broadcastTyping(); }}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={activeDM ? `Message ${activeDM}…` : 'Message…'}
            className="flex-1 min-w-0 text-[11px] bg-[rgba(208,115,57,0.06)] dark:bg-[rgba(126,62,21,0.12)] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded px-2 py-1 outline-none focus:border-[#d07339] dark:focus:border-[#c36a32] text-[#100b09] dark:text-[#f7f1ed] placeholder-[rgba(16,11,9,0.35)] dark:placeholder-[rgba(247,241,237,0.35)]" />
          <button onClick={handleSend} className="p-1.5 rounded bg-[#d07339] hover:bg-[#c36a32] text-white transition-colors flex-shrink-0"><Send className="size-3" /></button>
        </div>
      </div>
    );
  };

  if (needsNick) {
    return (
      <div className="flex flex-col h-full relative" style={style}>
        <GuestNicknameDialog onConfirm={nick => { setGuestNick(nick); setNeedsNick(false); }} isXP={isXP} />
      </div>
    );
  }

  // ── XP render ────────────────────────────────────────────────────────────────
  if (isXP) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#d4d0c8', fontFamily: F, overflow: 'hidden', ...style }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {xpSidebarVisible && <XPSidebar {...sidebarProps} />}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* XP channel header with sidebar toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: '#e0dcd4', borderBottom: '1px solid #808080', flexShrink: 0 }}>
              <button onClick={() => setXpSidebarVisible(v => !v)} style={{ background: '#d4d0c8', border: '1px outset #fff', fontSize: 10, fontFamily: F, cursor: 'pointer', padding: '1px 5px', flexShrink: 0 }}>
                {xpSidebarVisible ? '◀' : '▶'}
              </button>
              <span style={{ fontSize: 11, fontFamily: F, color: '#000', fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeDM ? `✉ ${activeDM}` : activeChannelObj?.name || '# Global'}
              </span>
            </div>
            {isVoiceChannel && currentUser ? (
              <VoiceChat currentUser={currentUser} channelId={activeChannel} channelName={activeChannelObj?.name || 'Voice'} onLeave={() => { setActiveChannel('global'); }} isXP />
            ) : isVoiceChannel ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10, fontFamily: XP_FONT }}>
                <span style={{ fontSize: 28 }}>🎙</span>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000' }}>{activeChannelObj?.name || 'Voice Chat'}</div>
                <div style={{ fontSize: 10, color: '#808080', textAlign: 'center' }}>You must be logged in to join voice channels.</div>
              </div>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {isLoading && <div style={{ fontSize: 11, fontFamily: F, color: '#808080', padding: 8 }}>Loading…</div>}
                  {!isLoading && currentMessages.length === 0 && <div style={{ fontSize: 11, fontFamily: F, color: '#808080', padding: 8 }}>No messages yet.</div>}
                  {currentMessages.map(m => (
                    <MessageBubble key={m.id} msg={m as ChatMessage} currentUser={currentUser} isXP
                      onReply={setReplyTo} onReport={setReportingMsg}
                      onBan={setBanningUser} onTimeout={setTimeoutUser} />
                  ))}
                  {typingList.length > 0 && <div style={{ fontSize: 10, fontFamily: F, color: '#808080' }}>{typingList.join(', ')} typing…</div>}
                  <div ref={bottomRef} />
                </div>
                {renderInput()}
              </>
            )}
          </div>
        </div>
        {reportingMsg && <XPModModal title="Report Message" onClose={() => setReportingMsg(null)} onConfirm={async r => { await reportMessage(reportingMsg.id, displayName, r); setReportingMsg(null); }} />}
        {banningUser && <XPModModal title={`Ban ${banningUser}`} onClose={() => setBanningUser(null)} onConfirm={async r => { await banUser(banningUser, displayName, 'ban', r); setBanningUser(null); }} />}
        {timeoutUser && <XPModModal title={`Timeout ${timeoutUser}`} onClose={() => setTimeoutUser(null)} onConfirm={async r => { await banUser(timeoutUser, displayName, 'timeout', r, 60); setTimeoutUser(null); }} />}
      </div>
    );
  }

  // ── Normal render ─────────────────────────────────────────────────────────────
  // Full-page mode uses full sidebar; compact (popup) uses accordion compact sidebar
  const renderFullSidebar = () => (
    <div className="w-44 flex-shrink-0 border-r border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.25)] flex flex-col overflow-hidden bg-[rgba(208,115,57,0.02)] dark:bg-[rgba(126,62,21,0.05)]">
      <div className="px-2 pt-2.5 pb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)] px-1 mb-1">Channels</p>
        {channels.map(ch => (
          <div key={ch.id} className="group/ch flex items-center mb-0.5">
            <button onClick={() => { setActiveChannel(ch.id); setActiveDM(null); }}
              className={`flex-1 min-w-0 text-left px-2 py-1 rounded text-[11px] transition-colors flex items-center gap-1 ${activeChannel === ch.id && !activeDM ? 'bg-[#d07339] text-white font-medium' : 'text-[rgba(16,11,9,0.65)] dark:text-[rgba(247,241,237,0.65)] hover:bg-[rgba(208,115,57,0.1)] dark:hover:bg-[rgba(126,62,21,0.15)]'}`}>
              {ch.type === 'voice' && <Mic className="size-2.5 opacity-60 flex-shrink-0" />}
              <span className="truncate">{ch.name}</span>
            </button>
            {canMod && !ch.is_default && (
              <div className="hidden group-hover/ch:flex flex-shrink-0 gap-px">
                <button onClick={() => { const n = window.prompt('Rename:', ch.name.replace('# ','')); if (n?.trim()) renameChannel(ch, n.trim()); }} title="Rename" className="text-[9px] px-1 text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)] hover:text-[#d07339]">✏</button>
                <button onClick={() => { if (window.confirm('Delete this channel?')) deleteChannel(ch); }} title="Delete" className="text-[9px] px-0.5 text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)] hover:text-red-500">✕</button>
              </div>
            )}
          </div>
        ))}
        {canMod && (
          showNewChannel ? (
            <div className="flex gap-1 mt-1">
              <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createChannel()} placeholder="Name"
                className="flex-1 text-[9px] px-1 py-0.5 rounded border border-[rgba(208,115,57,0.3)] bg-white dark:bg-[#18110c] outline-none text-[#100b09] dark:text-[#f7f1ed] min-w-0" />
              <button onClick={createChannel} className="text-[9px] bg-[#d07339] text-white px-1.5 rounded flex-shrink-0">+</button>
            </div>
          ) : (
            <button onClick={() => setShowNewChannel(true)} className="text-[9px] text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)] hover:text-[#d07339] mt-0.5 px-2 w-full text-left">+ New channel</button>
          )
        )}
      </div>
      <div className="border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.15)] px-2 pt-2 pb-1">
        <p className="text-[9px] font-bold uppercase tracking-widest text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)] px-1 mb-1">Messages</p>
        {!currentUser ? (
          <p className="text-[9px] text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] px-1 leading-snug">
            <Link to="/" className="text-[#d07339] underline">Log in</Link> to send private messages.
          </p>
        ) : dmPartners.length === 0 ? (
          <p className="text-[9px] text-[rgba(16,11,9,0.3)] dark:text-[rgba(247,241,237,0.3)] px-1">No conversations yet.</p>
        ) : (
          dmPartners.map(u => (
            <button key={u} onClick={() => openDM(u)}
              className={`w-full text-left px-2 py-1 rounded text-[11px] transition-colors mb-0.5 flex items-center gap-1.5 ${activeDM === u ? 'bg-[#d07339] text-white' : 'text-[rgba(16,11,9,0.65)] dark:text-[rgba(247,241,237,0.65)] hover:bg-[rgba(208,115,57,0.1)] dark:hover:bg-[rgba(126,62,21,0.15)]'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              <span className="truncate">{u}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={style}>
      <div className="flex flex-1 overflow-hidden min-h-0">
        {showSidebar
          ? (sidebarVisible ? renderFullSidebar() : null)
          : (sidebarVisible ? <CompactSidebar {...sidebarProps} /> : null)
        }
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Channel name bar */}
          <div className="flex items-center gap-2 px-2 py-1 border-b border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.15)] flex-shrink-0 min-h-[28px]">
            <button onClick={() => setSidebarVisible(v => !v)} title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
              className="flex-shrink-0 text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)] hover:text-[#d07339] transition-colors p-0.5">
              <span className="text-[10px] leading-none">{sidebarVisible ? '◀' : '▶'}</span>
            </button>
            <span className="text-[10px] font-semibold text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] truncate flex-1">
              {activeDM ? `✉ ${activeDM}` : channels.find(c => c.id === activeChannel)?.name || '# Global'}
            </span>
            {onExpandToPage && (
              <button onClick={onExpandToPage} title="Full page" className="flex-shrink-0 text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)] hover:text-[#d07339] transition-colors">
                <Maximize2 className="size-3" />
              </button>
            )}
          </div>
          {/* Messages or Voice UI */}
          {isVoiceChannel && currentUser ? (
            <VoiceChat currentUser={currentUser} channelId={activeChannel} channelName={activeChannelObj?.name || 'Voice'} onLeave={() => setActiveChannel('global')} />
          ) : isVoiceChannel ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <Mic className="size-8 mx-auto mb-3 text-[#d07339]" />
                <p className="text-sm font-medium text-[#100b09] dark:text-[#f7f1ed] mb-1">{activeChannelObj?.name}</p>
                <p className="text-xs text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">Log in to join this voice channel.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto py-1 min-h-0">
                {isLoading && <p className="text-[10px] text-center text-[rgba(16,11,9,0.35)] p-3">Loading…</p>}
                {!isLoading && currentMessages.length === 0 && <p className="text-[10px] text-center text-[rgba(16,11,9,0.3)] p-3">No messages yet.</p>}
                {currentMessages.map(m => (
                  <MessageBubble key={m.id} msg={m as ChatMessage} currentUser={currentUser}
                    onReply={setReplyTo} onReport={setReportingMsg}
                    onBan={setBanningUser} onTimeout={setTimeoutUser} />
                ))}
                {typingList.length > 0 && <p className="text-[9px] text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)] italic px-3 py-0.5">{typingList.join(', ')} typing…</p>}
                <div ref={bottomRef} />
              </div>
              {renderInput()}
            </>
          )}
        </div>
      </div>
      {reportingMsg && <ReportModal msg={reportingMsg} onClose={() => setReportingMsg(null)} onConfirm={async r => { await reportMessage(reportingMsg.id, displayName, r); setReportingMsg(null); }} />}
      {banningUser && <BanModal username={banningUser} type="ban" onClose={() => setBanningUser(null)} onConfirm={async (r) => { await banUser(banningUser, currentUser?.username || '', 'ban', r); setBanningUser(null); }} />}
      {timeoutUser && <BanModal username={timeoutUser} type="timeout" onClose={() => setTimeoutUser(null)} onConfirm={async (r, dur) => { await banUser(timeoutUser, currentUser?.username || '', 'timeout', r, dur || 60); setTimeoutUser(null); }} />}
    </div>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function XPModModal({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: (r: string) => void }) {
  const [reason, setReason] = useState('');
  const F = XP_FONT;
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: '#d4d0c8', border: '2px outset #fff', boxShadow: '4px 4px 10px rgba(0,0,0,0.4)', width: 240, fontFamily: F }}>
        <div style={{ background: 'linear-gradient(180deg,#0a246a,#3c6eb4)', padding: '3px 8px', color: 'white', fontSize: 11, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>⚠ {title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason..." rows={3}
            style={{ width: '100%', fontSize: 11, fontFamily: F, boxSizing: 'border-box', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', padding: 4, resize: 'none', background: 'white' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onConfirm(reason)} style={{ flex: 1, height: 22, fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer' }}>Confirm</button>
            <button onClick={onClose} style={{ flex: 1, height: 22, fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ msg, onClose, onConfirm }: { msg: ChatMessage; onClose: () => void; onConfirm: (r: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.25)] rounded-xl shadow-2xl w-64 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-[#100b09] dark:text-[#f7f1ed]">Report Message</h3>
        <div className="text-[10px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] bg-[rgba(208,115,57,0.06)] rounded p-2 italic">"{msg.text?.slice(0, 100)}"</div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason…" rows={2}
          className="w-full text-xs border border-[rgba(208,115,57,0.2)] rounded p-2 resize-none outline-none bg-transparent text-[#100b09] dark:text-[#f7f1ed] focus:border-[#d07339]" />
        <div className="flex gap-2">
          <button onClick={() => onConfirm(reason)} className="flex-1 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Report</button>
          <button onClick={onClose} className="flex-1 py-1.5 text-xs border border-[rgba(208,115,57,0.3)] rounded text-[#100b09] dark:text-[#f7f1ed] transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function BanModal({ username, type, onClose, onConfirm }: { username: string; type: 'ban' | 'timeout'; onClose: () => void; onConfirm: (r: string, dur?: number) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(60);
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.25)] rounded-xl shadow-2xl w-64 p-4 space-y-3">
        <h3 className="font-semibold text-sm text-[#100b09] dark:text-[#f7f1ed]">{type === 'ban' ? '🔨 Ban' : '⏱ Timeout'} {username}</h3>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason…" rows={2}
          className="w-full text-xs border border-[rgba(208,115,57,0.2)] rounded p-2 resize-none outline-none bg-transparent text-[#100b09] dark:text-[#f7f1ed] focus:border-[#d07339]" />
        {type === 'timeout' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] flex-shrink-0">Duration (min):</label>
            <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} min={1} max={10080}
              className="w-16 text-xs border border-[rgba(208,115,57,0.2)] rounded px-2 py-0.5 outline-none bg-transparent text-[#100b09] dark:text-[#f7f1ed]" />
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => onConfirm(reason, type === 'timeout' ? duration : undefined)} className="flex-1 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors">{type === 'ban' ? 'Ban' : 'Timeout'}</button>
          <button onClick={onClose} className="flex-1 py-1.5 text-xs border border-[rgba(208,115,57,0.3)] rounded text-[#100b09] dark:text-[#f7f1ed] transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── FloatingChat ──────────────────────────────────────────────────────────────

const GLOBAL_PRESENCE_CHANNEL = 'site-presence-v1';

export function FloatingChat({ currentUser, isDarkMode }: { currentUser?: any; isDarkMode: boolean }) {
  const [open, setOpen] = useState(false);
  const fabBottom = useAboveFooter(24);
  const [unread, setUnread] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const navigate = useNavigate();
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Track global online count via Supabase Presence
  useEffect(() => {
    const displayName = currentUser?.username || localStorage.getItem('chat-guest-nick') || `visitor-${Math.random().toString(36).slice(2,6)}`;
    const ch = supabase.channel(GLOBAL_PRESENCE_CHANNEL, { config: { presence: { key: displayName } } })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on('presence', { event: 'join' }, () => {
        const state = ch.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = ch.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ username: displayName, online_at: new Date().toISOString() });
        }
      });
    presenceRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [currentUser?.username]);

  // Unread counter when closed
  useEffect(() => {
    if (open) { setUnread(0); return; }
    const ch = supabase.channel('chat-unread-floating-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => setUnread(n => n + 1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open]);

  return (
    <>
      {/* FAB button */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed left-5 z-[9000] p-4 rounded-full shadow-lg transition-all hover:scale-110 bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] shadow-[0_6px_18px_rgba(208,115,57,0.35)]"
  style={{ bottom: fabBottom }}
        title="Live Chat">
        <MessageSquare className="w-6 h-6 text-white" />
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed z-[8999] rounded-xl shadow-2xl overflow-hidden flex flex-col left-2 right-2 sm:left-5 sm:right-auto sm:w-[420px]"
          style={{
            bottom: fabBottom + 56,
            height: 'min(520px, calc(100svh - 120px))',
            border: isDarkMode ? '1px solid rgba(126,62,21,0.4)' : '1px solid rgba(208,115,57,0.25)',
            background: isDarkMode ? '#18110c' : '#fdfaf8',
          }}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #d07339, #c36a32)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="size-4 text-white flex-shrink-0" />
              <span className="text-sm font-semibold text-white">Live Chat</span>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <span className="text-[10px] text-white/80 flex items-center gap-0.5 flex-shrink-0">
                <Users className="size-2.5" /> {onlineCount}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => { setOpen(false); navigate('/chat'); }} title="Full page"
                className="text-white/70 hover:text-white transition-colors">
                <Maximize2 className="size-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanel currentUser={currentUser} onExpandToPage={() => { setOpen(false); navigate('/chat'); }} style={{ height: '100%' }} />
          </div>
        </div>
      )}
    </>
  );
}

// ── Voice Chat ─────────────────────────────────────────────────────────────────

export function VoiceChat({ currentUser, channelId, channelName, onLeave, isXP = false }: { currentUser: any; channelId: string; channelName: string; onLeave: () => void; isXP?: boolean }) {
  const [participants, setParticipants] = useState<string[]>([]);
  const [participantPics, setParticipantPics] = useState<Record<string, string>>({});
  const [remoteMuted, setRemoteMuted] = useState<Record<string, boolean>>({});
  const [talkingUsers, setTalkingUsers] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const remoteAudioRef = useRef<Record<string, HTMLAudioElement>>({});
  const signalingRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const talkingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidateQueueRef = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const username = currentUser?.username;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const loadPic = (u: string) => {
    const pic = localStorage.getItem(`userPic_${u}`) || '';
    setParticipantPics(p => ({ ...p, [u]: pic }));
  };

  useEffect(() => {
    const sig = supabase.channel(`voice:${channelId}`)
      .on('broadcast', { event: 'join' }, async ({ payload }: any) => {
        if (payload.username === username) return;
        setParticipants(p => [...new Set([...p, payload.username])]);
        loadPic(payload.username);
        if (localStreamRef.current) await createOffer(payload.username, sig);
        // Tell the new joiner our mute state and pic
        sig.send({ type: 'broadcast', event: 'state', payload: { username, muted, pic: localStorage.getItem(`userPic_${username}`) || '' } }).catch(() => {});
      })
      .on('broadcast', { event: 'leave' }, ({ payload }: any) => {
        setParticipants(p => p.filter(u => u !== payload.username));
        setTalkingUsers(s => { const n = new Set(s); n.delete(payload.username); return n; });
        peersRef.current[payload.username]?.close();
        delete peersRef.current[payload.username];
        const ra = remoteAudioRef.current[payload.username];
        if (ra) { ra.srcObject = null; ra.pause(); delete remoteAudioRef.current[payload.username]; }
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        // Must check both from (self-filter) AND to (only process offers directed at us)
        if (payload.from === username) return;
        if (payload.to !== username) return;
        const pc = getOrCreatePeer(payload.from, sig);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        const fixedAnswer = { ...answer, sdp: fixOpusSDP(answer.sdp || '') };
        await pc.setLocalDescription(fixedAnswer);
        sig.send({ type: 'broadcast', event: 'answer', payload: { from: username, to: payload.from, sdp: fixedAnswer } }).catch(() => {});
        // Drain any ICE candidates that arrived before remote description was set
        const queued = iceCandidateQueueRef.current[payload.from] || [];
        iceCandidateQueueRef.current[payload.from] = [];
        for (const c of queued) { pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}); }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        if (payload.to !== username) return;
        const pc = peersRef.current[payload.from];
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        // Drain queued ICE candidates
        const queued = iceCandidateQueueRef.current[payload.from] || [];
        iceCandidateQueueRef.current[payload.from] = [];
        for (const c of queued) { pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}); }
      })
      .on('broadcast', { event: 'ice' }, ({ payload }: any) => {
        if (payload.to !== username) return;
        const pc = peersRef.current[payload.from];
        if (!pc) return;
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        } else {
          // Queue candidate until remote description is set
          if (!iceCandidateQueueRef.current[payload.from]) iceCandidateQueueRef.current[payload.from] = [];
          iceCandidateQueueRef.current[payload.from].push(payload.candidate);
        }
      })
      .on('broadcast', { event: 'state' }, ({ payload }: any) => {
        if (payload.username === username) return;
        setRemoteMuted(m => ({ ...m, [payload.username]: !!payload.muted }));
        if (payload.pic) setParticipantPics(p => ({ ...p, [payload.username]: payload.pic }));
      })
      .on('broadcast', { event: 'talking' }, ({ payload }: any) => {
        if (payload.username === username) return;
        setTalkingUsers(s => {
          const n = new Set(s);
          payload.talking ? n.add(payload.username) : n.delete(payload.username);
          return n;
        });
      })
      .on('broadcast', { event: 'admin_mute' }, ({ payload }: any) => {
        if (payload.target !== username) return;
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = false; });
          setMuted(true);
          sig.send({ type: 'broadcast', event: 'state', payload: { username, muted: true, pic: localStorage.getItem(`userPic_${username}`) || '' } }).catch(() => {});
        }
      })
      .on('broadcast', { event: 'kick' }, ({ payload }: any) => {
        if (payload.target !== username) return;
        doLeave(sig);
      })
      .subscribe();
    signalingRef.current = sig;
    return () => { supabase.removeChannel(sig); };
  }, [channelId, username]);

  const getOrCreatePeer = (remoteUser: string, sig: ReturnType<typeof supabase.channel>): RTCPeerConnection => {
    if (peersRef.current[remoteUser]) return peersRef.current[remoteUser];
    const pc = new RTCPeerConnection(STUN_SERVERS);
    peersRef.current[remoteUser] = pc;
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    pc.onicecandidate = e => {
      if (e.candidate) sig.send({ type: 'broadcast', event: 'ice', payload: { from: username, to: remoteUser, candidate: e.candidate.toJSON() } }).catch(() => {});
    };
    pc.ontrack = e => {
      if (!e.streams[0]) return;
      let a = remoteAudioRef.current[remoteUser];
      if (!a) {
        a = new Audio();
        a.autoplay = true;
        remoteAudioRef.current[remoteUser] = a;
      }
      a.srcObject = e.streams[0];
      a.play().catch(() => {});
    };
    return pc;
  };

  const createOffer = async (remoteUser: string, sig: ReturnType<typeof supabase.channel>) => {
    const pc = getOrCreatePeer(remoteUser, sig);
    const offer = await pc.createOffer();
    const fixedOffer = { ...offer, sdp: fixOpusSDP(offer.sdp || '') };
    await pc.setLocalDescription(fixedOffer);
    sig.send({ type: 'broadcast', event: 'offer', payload: { from: username, to: remoteUser, sdp: fixedOffer } }).catch(() => {});
  };

  const startTalkingDetection = (stream: MediaStream) => {
    try {
      // Clone the stream so the AudioContext node doesn't share the same tracks
      // that WebRTC is using. A shared MediaStreamSource disrupts the browser's
      // AEC reference signal and causes high-frequency chirping artifacts.
      const cloned = stream.clone();
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(cloned).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      // Store cloned stream on the context so doLeave() can stop its tracks
      (ctx as any)._clonedStream = cloned;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let wasTalking = false;
      talkingTimerRef.current = setInterval(() => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        const talking = avg > 15;
        if (talking !== wasTalking) {
          wasTalking = talking;
          setTalkingUsers(s => { const n = new Set(s); talking ? n.add(username) : n.delete(username); return n; });
          signalingRef.current?.send({ type: 'broadcast', event: 'talking', payload: { username, talking } }).catch(() => {});
        }
      }, 100);
    } catch {}
  };

  const join = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          // Disable browser-side noise suppression and AGC — these apply aggressive
          // VAD that cuts off the trailing edge of sentences. Opus handles this better.
          noiseSuppression: false,
          autoGainControl: false,
          // Do not force a sampleRate — forced conversion on mobile can cause
          // buffer starvation and audio artifacts; let the device choose.
          channelCount: 1,
        },
        video: false,
      });
      localStreamRef.current = stream;
      setConnected(true);
      setParticipants([username]);
      loadPic(username);
      startTalkingDetection(stream);
      signalingRef.current?.send({ type: 'broadcast', event: 'join', payload: { username, pic: localStorage.getItem(`userPic_${username}`) || '' } }).catch(() => {});
    } catch {
      setError('Microphone access denied. Please allow microphone in your browser settings.');
    }
  };

  const doLeave = (sig?: ReturnType<typeof supabase.channel> | null) => {
    if (talkingTimerRef.current) clearInterval(talkingTimerRef.current);
    // Stop cloned stream tracks before closing the AudioContext
    const cloned = (audioCtxRef.current as any)?._clonedStream as MediaStream | undefined;
    cloned?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    iceCandidateQueueRef.current = {};
    Object.values(remoteAudioRef.current).forEach(a => { a.srcObject = null; a.pause(); });
    remoteAudioRef.current = {};
    const ch = sig || signalingRef.current;
    ch?.send({ type: 'broadcast', event: 'leave', payload: { username } }).catch(() => {});
    setConnected(false);
    onLeave();
  };

  const leave = () => doLeave();

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const newMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setMuted(newMuted);
    signalingRef.current?.send({ type: 'broadcast', event: 'state', payload: { username, muted: newMuted, pic: localStorage.getItem(`userPic_${username}`) || '' } }).catch(() => {});
  };

  const adminMute = (target: string) => {
    signalingRef.current?.send({ type: 'broadcast', event: 'admin_mute', payload: { target } }).catch(() => {});
    setRemoteMuted(m => ({ ...m, [target]: true }));
  };

  const adminKick = (target: string) => {
    signalingRef.current?.send({ type: 'broadcast', event: 'kick', payload: { target } }).catch(() => {});
    setParticipants(p => p.filter(u => u !== target));
    peersRef.current[target]?.close();
    delete peersRef.current[target];
    const ra = remoteAudioRef.current[target];
    if (ra) { ra.srcObject = null; ra.pause(); delete remoteAudioRef.current[target]; }
  };

  const F = XP_FONT;

  const ParticipantCard = ({ u, xp }: { u: string; xp: boolean }) => {
    const pic = participantPics[u] || '';
    const isMutedRemote = u === username ? muted : (remoteMuted[u] || false);
    const isTalking = talkingUsers.has(u) && !isMutedRemote;
    const isMe = u === username;
    if (xp) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: isTalking ? '2px solid #00c800' : '2px solid #808080', overflow: 'hidden', background: '#c0bdb8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: isTalking ? '0 0 6px #00c800' : undefined }}>
              {pic ? <img src={pic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: 16 }}>👤</span>}
            </div>
            {isMutedRemote && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 10 }}>🔇</span>}
          </div>
          <span style={{ fontSize: 9, fontFamily: F, color: '#000', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{u}{isMe ? ' (you)' : ''}</span>
          {isAdmin && !isMe && (
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={() => isMutedRemote ? undefined : adminMute(u)} title="Mute" style={{ fontSize: 9, fontFamily: F, height: 14, padding: '0 4px', background: '#d4d0c8', border: '1px outset #fff', cursor: 'pointer', color: '#000' }}>🔇</button>
              <button onClick={() => adminKick(u)} title="Kick" style={{ fontSize: 9, fontFamily: F, height: 14, padding: '0 4px', background: '#d4d0c8', border: '1px outset #fff', cursor: 'pointer', color: '#c00' }}>✕</button>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative">
          <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-2 transition-all ${isTalking ? 'border-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'border-[rgba(16,11,9,0.15)] dark:border-[rgba(247,241,237,0.15)]'}`} style={{ background: 'rgba(208,115,57,0.1)' }}>
            {pic ? <img src={pic} className="w-full h-full object-cover" alt="" /> : <span className="text-xl">👤</span>}
          </div>
          {isMutedRemote && <span className="absolute -bottom-1 -right-1 text-xs">🔇</span>}
        </div>
        <span className="text-[10px] text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)] max-w-[60px] overflow-hidden text-ellipsis whitespace-nowrap">{u}{isMe ? ' (you)' : ''}</span>
        {isAdmin && !isMe && (
          <div className="flex gap-1">
            <button onClick={() => adminMute(u)} title="Mute user" className="text-[9px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800/40 transition-colors">Mute</button>
            <button onClick={() => adminKick(u)} title="Kick user" className="text-[9px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors">Kick</button>
          </div>
        )}
      </div>
    );
  };

  if (isXP) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, fontFamily: F, background: '#d4d0c8' }}>
        <span style={{ fontSize: 28 }}>🎙</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: F, fontSize: 12, fontWeight: 'bold', color: '#000' }}>{channelName}</div>
          <div style={{ fontFamily: F, fontSize: 10, color: '#444' }}>Voice Channel</div>
        </div>
        {error && <div style={{ fontSize: 10, fontFamily: F, color: '#c00', textAlign: 'center', maxWidth: 200 }}>{error}</div>}
        {!connected ? (
          <button onClick={join} style={{ height: 24, padding: '0 16px', fontSize: 11, fontFamily: F, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', fontWeight: 'bold' }}>
            Join Voice
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280 }}>
              {participants.map(u => <ParticipantCard key={u} u={u} xp />)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={toggleMute} style={{ height: 24, padding: '0 10px', fontSize: 11, fontFamily: F, background: muted ? '#ffdddd' : '#ddffdd', border: '2px outset #fff', cursor: 'pointer' }}>
                {muted ? '🔇 Unmute' : '🎙 Mute'}
              </button>
              <button onClick={leave} style={{ height: 24, padding: '0 10px', fontSize: 11, fontFamily: F, background: '#ffaaaa', border: '2px outset #fff', cursor: 'pointer', fontWeight: 'bold' }}>
                Leave
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
      <Mic className="size-8 text-[#d07339]" />
      <div className="text-center">
        <h3 className="font-semibold text-[#100b09] dark:text-[#f7f1ed]">{channelName}</h3>
        <p className="text-xs text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">Voice Channel — click Join to connect your microphone</p>
      </div>
      {error && <p className="text-xs text-red-500 text-center max-w-xs">{error}</p>}
      {!connected ? (
        <button onClick={join} className="px-6 py-2.5 bg-[#d07339] hover:bg-[#c36a32] text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
          <Mic className="size-4" /> Join Voice
        </button>
      ) : (
        <>
          <div className="flex items-start gap-4 flex-wrap justify-center max-w-sm">
            {participants.map(u => <ParticipantCard key={u} u={u} xp={false} />)}
          </div>
          <div className="flex gap-3">
            <button onClick={toggleMute} className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${muted ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
              {muted ? <><MicOff className="size-4" /> Unmute</> : <><Mic className="size-4" /> Mute</>}
            </button>
            <button onClick={leave} className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-2 text-sm font-medium">
              <PhoneOff className="size-4" /> Leave
            </button>
          </div>
        </>
      )}
    </div>
  );
}
