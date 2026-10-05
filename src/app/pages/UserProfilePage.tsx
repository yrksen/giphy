import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  User, Star, MessageSquare, Film, Folder, Plus, X,
  LogOut, Settings, Heart, Users, Search, ChevronRight, Camera,
  Globe, BookOpen, Eye, EyeOff, Mail, Send, Flag, Paperclip,
} from 'lucide-react';
import { createSlug } from '../utils/slugify';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../utils/supabaseClient';
import { addNotification } from '../components/Notifications';
import { SiteHeader, SiteFooter } from '../components/SiteLayout';
import {
  loadUserProfile as loadUserProfileDB, saveUserProfile,
  loadFollowers, loadFollowing, followUser, unfollowUser,
  loadProfileComments, saveProfileComments,
  loadUserDirectory, loadUserActivity, registerInDirectory,
  type DirectoryEntry, type UserActivity,
} from '../utils/socialDB';
import { sendPrivateMessage } from '../components/LiveChat';
import { GifPicker } from '../components/GifPicker';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

interface Movie {
  id: number; title: string; year: number; genre?: string;
  imdbRating?: number; rating?: number; userRating?: number;
  image?: string; runtime?: string; plot?: string; dateAdded?: number;
}
interface Comment {
  id: number | string; movieId: number; username: string;
  text: string; timestamp: number;
}
interface Collection {
  id: string; name: string; movieIds: number[]; createdAt: string; updatedAt: string;
}
interface ActivityItem {
  type: 'rating' | 'comment' | 'follow'; timestamp: number;
  movie?: Movie; rating?: number; comment?: string; movieId?: number | string;
  targetUsername?: string;
}
interface ProfileComment {
  id: string; commenter: string; text: string; timestamp: number; imageUrl?: string;
}

export interface UserProfilePageProps {
  currentUser: any;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  setCurrentUser: (u: any) => void;
}

type Tab = 'profile' | 'comments' | 'ratings' | 'collections' | 'privacy' | 'messages' | 'followers' | 'following';

const favGenre = (movies: Movie[]): string => {
  const rated = movies.filter(m => m.userRating && m.userRating > 0 && m.genre);
  const freq: Record<string, number> = {};
  rated.forEach(m => (m.genre || '').split(',').map(g => g.trim()).filter(Boolean).forEach(g => { freq[g] = (freq[g] || 0) + 1; }));
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return top.length ? top[0][0] : 'N/A';
};

const initials = (name: string) =>
  name.split(/[\s_]/).map(p => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join('');

function Avatar({ username, picture, size = 80, onClick }: { username: string; picture?: string; size?: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      style={{ width: size, height: size, background: picture ? 'transparent' : 'linear-gradient(135deg,#d07339,#e8934a)', fontSize: size * 0.35, fontWeight: 700, color: 'white' }}
    >
      {picture
        ? <img src={picture} alt={username} className="w-full h-full object-cover" />
        : <span>{initials(username)}</span>}
    </div>
  );
}

// Generate flag emoji from 2-letter ISO code using Unicode regional indicators.
// This avoids storing emoji literals in source (which can get mangled by editors/encoding).
function isoToFlagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return '';
  const base = 0x1F1E6; // regional indicator A
  return String.fromCodePoint(base + upper.charCodeAt(0) - 65) +
         String.fromCodePoint(base + upper.charCodeAt(1) - 65);
}

// [name, iso2, ...aliases] — no emoji stored here
const COUNTRY_TABLE: [string, string, ...string[]][] = [
  ['United States','US','USA','United States of America'],
  ['United Kingdom','GB','UK','Britain','Great Britain'],
  ['Canada','CA'],['Australia','AU'],['Germany','DE'],
  ['France','FR'],['Spain','ES'],['Italy','IT'],['Japan','JP'],
  ['China','CN'],['Russia','RU'],['Brazil','BR'],['Mexico','MX'],
  ['India','IN'],['Netherlands','NL'],['Sweden','SE'],['Norway','NO'],
  ['Denmark','DK'],['Finland','FI'],['Poland','PL'],['Portugal','PT'],
  ['Switzerland','CH'],['Austria','AT'],['Belgium','BE'],['Greece','GR'],
  ['Turkey','TR'],['South Korea','KR'],['Argentina','AR'],['Chile','CL'],
  ['Colombia','CO'],['Ukraine','UA'],['Ireland','IE'],['Philippines','PH'],
  ['Indonesia','ID'],['Thailand','TH'],['Vietnam','VN'],['Malaysia','MY'],
  ['Singapore','SG'],['Nigeria','NG'],['Ghana','GH'],['Kenya','KE'],
  ['Morocco','MA'],['Saudi Arabia','SA'],['UAE','AE'],['Israel','IL'],
  ['Iceland','IS'],['Slovakia','SK'],['Slovenia','SI'],['Bulgaria','BG'],
  ['Romania','RO'],['Hungary','HU'],['Czech Republic','CZ'],['Serbia','RS'],
  ['Croatia','HR'],['Luxembourg','LU'],['Algeria','DZ'],['Tunisia','TN'],
  ['Ethiopia','ET'],['Pakistan','PK'],['Bangladesh','BD'],['Egypt','EG'],
  ['South Africa','ZA'],['New Zealand','NZ'],['Colombia','CO'],
];

function resolveCountry(raw: string): { flag: string; name: string } {
  if (!raw) return { flag: '', name: '' };
  const q = raw.trim().toLowerCase();
  for (const [name, iso, ...aliases] of COUNTRY_TABLE) {
    if (
      name.toLowerCase() === q ||
      iso.toLowerCase() === q ||
      aliases.some(a => a.toLowerCase() === q)
    ) {
      return { flag: isoToFlagEmoji(iso), name };
    }
  }
  // If input looks like a 2-letter code not in our table, still try to generate a flag
  if (raw.trim().length === 2 && /^[A-Za-z]{2}$/.test(raw.trim())) {
    return { flag: isoToFlagEmoji(raw.trim()), name: raw.trim().toUpperCase() };
  }
  return { flag: '', name: raw.trim() };
}

function countryToFlag(c: string): string { return resolveCountry(c).flag; }
function countryDisplayName(c: string): string { return resolveCountry(c).name || c; }

function FlagImg({ country }: { country: string }) {
  const entry = COUNTRY_TABLE.find(([name, iso, ...aliases]) =>
    name.toLowerCase() === country.trim().toLowerCase() ||
    iso.toLowerCase() === country.trim().toLowerCase() ||
    (aliases as string[]).some((a: string) => a.toLowerCase() === country.trim().toLowerCase())
  );
  const iso = entry?.[1]?.toLowerCase() || (country.trim().length === 2 ? country.trim().toLowerCase() : '');
  if (!iso) return <></>;
  return (
    <img
      src={`https://flagcdn.com/w20/${iso}.png`}
      alt={iso.toUpperCase()}
      width={20}
      height={15}
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
}

// Load profile data for any user from localStorage + user metadata
function loadUserProfile(username: string, userMeta?: any) {
  return {
    bio: userMeta?.bio || localStorage.getItem(`userBio_${username}`) || '',
    country: userMeta?.country || localStorage.getItem(`userCountry_${username}`) || '',
    showCountry: userMeta?.showCountry !== undefined ? userMeta.showCountry : (localStorage.getItem(`showCountry_${username}`) !== 'false'),
    profilePic: userMeta?.profilePic || localStorage.getItem(`userPic_${username}`) || '',
    collections: userMeta?.collections || JSON.parse(localStorage.getItem(`collections_${username}`) || '[]'),
  };
}

export function UserProfilePage({ currentUser, isDarkMode, setIsDarkMode, setCurrentUser }: UserProfilePageProps) {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const isOwn = currentUser?.username === username;

  const [allMovies, setAllMovies] = useState<Movie[]>([]);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const [profilePic, setProfilePic] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [showCountry, setShowCountry] = useState(true);
  const [bioEdit, setBioEdit] = useState('');
  const [countryEdit, setCountryEdit] = useState('');

  const [tab, setTab] = useState<Tab>('profile');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [newColName, setNewColName] = useState('');
  const [showNewCol, setShowNewCol] = useState(false);
  const [openCollection, setOpenCollection] = useState<Collection | null>(null);
  const [colSearch, setColSearch] = useState('');

  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  // Live user search
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{ username: string; pic?: string }[]>([]);
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [userDirectory, setUserDirectory] = useState<DirectoryEntry[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  // KV-backed activity feed
  const [kvActivity, setKvActivity] = useState<UserActivity[]>([]);

  // DM inbox state
  interface DmMessage { id: string; sender_username: string; recipient_username: string; text: string; image_url?: string; read: boolean; created_at: string; }
  interface DmConversation { partner: string; profilePic: string; lastText: string; lastTime: string; unread: number; }
  const [dmConversations, setDmConversations] = useState<DmConversation[]>([]);
  const [dmActivePartner, setDmActivePartner] = useState<string | null>(null);
  const dmActivePartnerRef = useRef<string | null>(null); // ref so realtime callback never has stale closure
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [dmImagePreview, setDmImagePreview] = useState<string | null>(null);
  const [dmGifSearch, setDmGifSearch] = useState('');
  const [dmGifResults, setDmGifResults] = useState<{url: string; preview: string}[]>([]);
  const [dmGifOpen, setDmGifOpen] = useState(false);
  const dmFileRef = useRef<HTMLInputElement>(null);
  // Profile comment image + GIF state
  const [newCommentImage, setNewCommentImage] = useState<string | null>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const [commentGifOpen, setCommentGifOpen] = useState(false);
  const [dmSending, setDmSending] = useState(false);
  const [dmLoading, setDmLoading] = useState(false);
  const dmBottomRef = useRef<HTMLDivElement>(null);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);

  // Profile comments
  const [profileComments, setProfileComments] = useState<ProfileComment[]>([]);
  const [newProfileComment, setNewProfileComment] = useState('');
  const profileCommentsKey = `profileComments_${username}`;

  const [newEmail, setNewEmail] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [privacyMsg, setPrivacyMsg] = useState('');

  const [picUrl, setPicUrl] = useState('');
  const [showPicEdit, setShowPicEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [previewMode, setPreviewMode] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerEdit, setBannerEdit] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statsPanel, setStatsPanel] = useState<'ratings' | 'comments' | 'watched' | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null); // ISO string or null = online
  const [joinedDate, setJoinedDate] = useState<string>('');

  // Load user directory from KV for search — covers every user who has ever logged in or saved their profile
  useEffect(() => {
    loadUserDirectory().then(dir => {
      setUserDirectory(dir);
      setAllUsers(dir.map(e => e.username));
    }).catch(() => {});
  }, []);

  // Load profile data
  useEffect(() => {
    if (!username) return;
    const load = async () => {
    // For own profile, read from current user's Supabase metadata first
    if (isOwn && currentUser) {
      const meta = currentUser.user_metadata || {};
      setBio(meta.bio || localStorage.getItem(`userBio_${username}`) || '');
      setCountry(meta.country || localStorage.getItem(`userCountry_${username}`) || '');
      setShowCountry(meta.showCountry !== undefined ? meta.showCountry : (localStorage.getItem(`showCountry_${username}`) !== 'false'));
      const pic = meta.profilePic || currentUser.profilePicture || localStorage.getItem(`userPic_${username}`) || '';
      setProfilePic(pic);
      // Ensure this user is in the directory so others can find them via search
      registerInDirectory(username!, pic).catch(() => {});
      const cols = meta.collections || JSON.parse(localStorage.getItem(`collections_${username}`) || '[]');
      setCollections(cols);
      const bnr = meta.bannerUrl || localStorage.getItem(`userBanner_${username}`) || '';
      setBannerUrl(bnr);
      setBannerEdit(bnr);
    } else {
      // For other users, load from socialDB (server-first, localStorage fallback)
      const profile = await loadUserProfileDB(username!);
      if (profile) {
        setBio(profile.bio || '');
        setCountry(profile.country || '');
        setShowCountry(profile.showCountry !== false);
        setProfilePic(profile.profilePic || '');
        setCollections(profile.collections || []);
        setBannerUrl(profile.bannerUrl || '');
      }
    }

    // Load KV activity feed for this profile
    loadUserActivity(username!).then(acts => setKvActivity(acts)).catch(() => {});

    const [fol, fing] = await Promise.all([
      loadFollowers(username!),
      loadFollowing(username!),
    ]);
    setFollowers(fol);
    setFollowing(fing);
    if (currentUser && !isOwn) {
      const myFollowing = await loadFollowing(currentUser.username);
      setIsFollowing(myFollowing.includes(username!));
    }

    // Load profile comments from server
    const pc = await loadProfileComments(username!);
    setProfileComments(pc);

    setTab('profile');
    }; // end load
    load();
  }, [username, isOwn]);

  // Re-check isFollowing when currentUser becomes available (auth resolves after mount)
  useEffect(() => {
    if (!currentUser?.username || !username || isOwn) return;
    loadFollowing(currentUser.username)
      .then(f => setIsFollowing(f.includes(username)))
      .catch(() => {});
  }, [currentUser?.username, username, isOwn]);

  // Load joined date from auth metadata (own) or localStorage/KV (others)
  useEffect(() => {
    if (!username) return;
    if (isOwn && currentUser?.created_at) {
      setJoinedDate(currentUser.created_at);
      localStorage.setItem(`joinDate_${username}`, currentUser.created_at);
    } else {
      const ls = localStorage.getItem(`joinDate_${username}`);
      if (ls) { setJoinedDate(ls); return; }
      // Try KV for other users
      supabase.from('kv_store_ea58c774').select('value').eq('key', `joinDate:${username}`).maybeSingle()
        .then(({ data }) => { if (data?.value) setJoinedDate(String(data.value)); });
    }
  }, [username, isOwn, currentUser?.created_at]);

  // Load last-seen status for other users
  useEffect(() => {
    if (isOwn || !username) return;
    supabase.from('kv_store_ea58c774').select('value').eq('key', `lastSeen:${username}`).maybeSingle()
      .then(({ data }) => { setLastSeen(data?.value ? String(data.value) : null); });
  }, [username, isOwn]);

  // Sync own bio/country to bioEdit/countryEdit
  useEffect(() => {
    setBioEdit(bio);
    setCountryEdit(country);
  }, [bio, country]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API}/movies`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
          fetch(`${API}/movies?list=towatch`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        const movies: Movie[] = [...(d1.movies || d1 || []), ...(d2.movies || d2 || [])];
        setAllMovies(movies);
        const commentArr: Comment[] = [];
        movies.forEach((m: any) => (m.comments || []).forEach((c: any) => commentArr.push({ ...c, movieId: m.id })));
        setAllComments(commentArr);
      } catch {}
      setLoading(false);
    };
    fetchAll();
  }, [username]);

  const userComments = allComments.filter(c => c.username === username);
  // ratedMovies: prefer KV activity log (cross-device, username-scoped); fall back to API data filtered by username
  const kvRatings = kvActivity.filter(a => a.type === 'rating');
  const ratedMovies = kvRatings.length > 0
    ? kvRatings.map(a => allMovies.find(m => String(m.id) === String(a.movieId)) || ({ id: a.movieId, title: a.movieTitle || '', image: a.movieImage, userRating: a.rating, year: 0 } as any)).filter(Boolean)
    : allMovies.filter(m => m.userRating && m.userRating > 0);
  const watchedMovies = ratedMovies;
  const fav = favGenre(allMovies);

  // Merge KV activity (authoritative) with API-derived comment/rating data
  const activity: ActivityItem[] = [
    // KV-recorded follows
    ...kvActivity.filter(a => a.type === 'follow').map(a => ({
      type: 'follow' as const,
      timestamp: a.timestamp,
      targetUsername: a.targetUsername,
    } as ActivityItem)),
    // KV-recorded ratings
    ...kvActivity.filter(a => a.type === 'rating').map(a => ({
      type: 'rating' as const,
      timestamp: a.timestamp,
      movie: allMovies.find(m => String(m.id) === String(a.movieId)) || ({ id: a.movieId, title: a.movieTitle || '', image: a.movieImage, year: 0 } as any),
      rating: a.rating,
    } as ActivityItem)),
    // KV-recorded comments (if API didn't return them)
    ...kvActivity.filter(a => a.type === 'comment' && !userComments.find(c => c.text === a.comment)).map(a => ({
      type: 'comment' as const,
      timestamp: a.timestamp,
      movieId: a.movieId,
      movie: allMovies.find(m => String(m.id) === String(a.movieId)) || ({ id: a.movieId, title: a.movieTitle || '', image: a.movieImage, year: 0 } as any),
      comment: a.comment || '',
    } as ActivityItem)),
    // API-derived comments (these have full movie data)
    ...userComments.map(c => ({
      type: 'comment' as const,
      timestamp: c.timestamp,
      movieId: c.movieId,
      movie: allMovies.find(m => Number(m.id) === Number(c.movieId)),
      comment: c.text,
    })),
  ]
    .filter((a, i, arr) => arr.findIndex(b => b.type === a.type && b.timestamp === a.timestamp) === i) // dedupe
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  // Live user search — queries KV directory + falls back to allComments
  useEffect(() => {
    if (!userSearch.trim()) { setUserSearchResults([]); return; }
    const q = userSearch.toLowerCase().trim();
    setUserSearchLoading(true);
    console.log('[Search] term:', JSON.stringify(q), '| directory size:', userDirectory.length, '| allUsers size:', allUsers.length, '| allComments size:', allComments.length);

    const combined = new Map<string, { username: string; pic: string }>();

    // From KV directory (highest priority — all registered users)
    userDirectory
      .filter(e => e.username.toLowerCase().includes(q))
      .forEach(e => combined.set(e.username, { username: e.username, pic: e.profilePic || localStorage.getItem(`userPic_${e.username}`) || '' }));

    // From allUsers (edge-function fallback)
    allUsers
      .filter(u => u.toLowerCase().includes(q))
      .forEach(u => { if (!combined.has(u)) combined.set(u, { username: u, pic: localStorage.getItem(`userPic_${u}`) || '' }); });

    // From comment authors (legacy: users who commented before the directory existed)
    allComments
      .filter(c => c.username.toLowerCase().includes(q))
      .forEach(c => { if (!combined.has(c.username)) combined.set(c.username, { username: c.username, pic: localStorage.getItem(`userPic_${c.username}`) || '' }); });

    const beforeKV = combined.size;
    console.log('[Search] matched before KV fallback:', beforeKV);
    setUserSearchResults([...combined.values()].slice(0, 8));

    // Always also query KV store directly to catch users not yet in the loaded directory
    supabase.from('kv_store_ea58c774').select('key, value').like('key', 'profile:%')
      .then(({ data, error }) => {
        if (error) { console.error('[Search] profile:* KV scan error:', error); }
        (data || []).forEach(row => {
          const uname = String(row.key).replace('profile:', '');
          if (uname.toLowerCase().includes(q) && !combined.has(uname)) {
            const pic = (row.value as any)?.profilePic || localStorage.getItem(`userPic_${uname}`) || '';
            combined.set(uname, { username: uname, pic });
          }
        });
        console.log('[Search] matched after KV fallback:', combined.size, '| rendered:', Math.min(combined.size, 8), '| results:', [...combined.keys()].slice(0, 8));
        setUserSearchResults([...combined.values()].slice(0, 8));
        setUserSearchLoading(false);
      }).catch(err => {
        console.error('[Search] KV scan exception:', err);
        setUserSearchLoading(false);
      });
  }, [userSearch, userDirectory, allUsers, allComments]);

  // Helper: build conversations list from a flat array of DM rows
  function buildConversations(rows: DmMessage[], me: string): DmConversation[] {
    const map = new Map<string, DmConversation>();
    rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const msg of rows) {
      const partner = msg.sender_username === me ? msg.recipient_username : msg.sender_username;
      const existing = map.get(partner);
      const isUnread = !msg.read && msg.recipient_username === me;
      map.set(partner, {
        partner,
        profilePic: existing?.profilePic || localStorage.getItem(`userPic_${partner}`) || '',
        lastText: msg.text || '',
        lastTime: msg.created_at,
        unread: (existing?.unread || 0) + (isUnread ? 1 : 0),
      });
    }
    return [...map.values()].sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
  }

  // Load all DMs for inbox on mount when viewing own messages tab
  useEffect(() => {
    if (!isOwn || !currentUser?.username) return;
    const me = currentUser.username;
    const loadInbox = async () => {
      setDmLoading(true);
      const [{ data: sent }, { data: received }] = await Promise.all([
        supabase.from('private_messages').select('*').eq('sender_username', me).order('created_at', { ascending: false }).limit(200),
        supabase.from('private_messages').select('*').eq('recipient_username', me).order('created_at', { ascending: false }).limit(200),
      ]);
      const all = [...(sent || []), ...(received || [])] as DmMessage[];
      setDmConversations(buildConversations(all, me));
      setDmLoading(false);
    };
    loadInbox();

    // Realtime: new DMs appear instantly
    const ch = supabase
      .channel(`dm:inbox:${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `recipient_username=eq.${me}` }, (payload) => {
        const msg = payload.new as DmMessage;
        setDmConversations(prev => {
          const all = [...prev.map(c => c.partner === msg.sender_username ? { ...c, lastText: msg.text, lastTime: msg.created_at, unread: c.unread + 1 } : c)];
          if (!prev.find(c => c.partner === msg.sender_username)) {
            all.unshift({ partner: msg.sender_username, profilePic: localStorage.getItem(`userPic_${msg.sender_username}`) || '', lastText: msg.text, lastTime: msg.created_at, unread: 1 });
          }
          return all.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
        });
        // Use ref (not state) so closure always has the current partner value
        setDmMessages(prev => {
          if (dmActivePartnerRef.current === msg.sender_username) return [...prev, msg];
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isOwn, currentUser?.username]);

  // Keep ref in sync with state so realtime callbacks always see the current partner
  useEffect(() => { dmActivePartnerRef.current = dmActivePartner; }, [dmActivePartner]);

  // Load messages when active partner changes
  useEffect(() => {
    if (!dmActivePartner || !currentUser?.username) return;
    const me = currentUser.username;
    const load = async () => {
      const [{ data: sent }, { data: received }] = await Promise.all([
        supabase.from('private_messages').select('*').eq('sender_username', me).eq('recipient_username', dmActivePartner).order('created_at'),
        supabase.from('private_messages').select('*').eq('sender_username', dmActivePartner).eq('recipient_username', me).order('created_at'),
      ]);
      const msgs = [...(sent || []), ...(received || [])] as DmMessage[];
      msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setDmMessages(msgs);
      // Mark incoming as read
      const unreadIds = msgs.filter(m => !m.read && m.recipient_username === me).map(m => m.id);
      if (unreadIds.length > 0) {
        supabase.from('private_messages').update({ read: true }).in('id', unreadIds).then(() => {
          setDmConversations(prev => prev.map(c => c.partner === dmActivePartner ? { ...c, unread: 0 } : c));
        });
      }
    };
    load();
  }, [dmActivePartner, currentUser?.username]);

  // Scroll to bottom when messages update
  useEffect(() => {
    dmBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dmMessages]);

  // Also query profiles table in search for direct username lookup
  useEffect(() => {
    if (!userSearch.trim()) return;
    const q = userSearch.toLowerCase().trim();
    supabase.from('profiles').select('username').ilike('username', `%${q}%`).limit(20)
      .then(({ data, error }) => {
        if (error) { console.error('[Search] profiles table error:', error); return; }
        setUserSearchResults(prev => {
          const combined = new Map(prev.map(r => [r.username, r]));
          (data || []).forEach(row => {
            if (row.username && !combined.has(row.username)) {
              combined.set(row.username, { username: row.username, pic: localStorage.getItem(`userPic_${row.username}`) || '' });
            }
          });
          return [...combined.values()].slice(0, 8);
        });
      });
  }, [userSearch]);

  const handleFollow = async () => {
    if (!currentUser || !username) return;
    if (isFollowing) {
      await unfollowUser(currentUser.username, username!);
      setFollowers(prev => prev.filter(u => u !== currentUser.username));
      setIsFollowing(false);
    } else {
      await followUser(currentUser.username, username!);
      setFollowers(prev => prev.includes(currentUser.username) ? prev : [...prev, currentUser.username]);
      setIsFollowing(true);
      addNotification(username!, {
        type: 'follow',
        senderUsername: currentUser.username,
        senderAvatar: currentUser.profilePicture || '',
        text: `${currentUser.username} started following you`,
        link: `/users/${currentUser.username}`,
      });
    }
  };

  // Persist own user data to Supabase user_metadata + socialDB + localStorage
  const saveOwnData = async (patch: Record<string, any>) => {
    localStorage.setItem(`userBio_${username}`, patch.bio ?? bio);
    localStorage.setItem(`userCountry_${username}`, patch.country ?? country);
    localStorage.setItem(`showCountry_${username}`, String(patch.showCountry ?? showCountry));
    if (patch.profilePic) localStorage.setItem(`userPic_${username}`, patch.profilePic);
    if (patch.collections) localStorage.setItem(`collections_${username}`, JSON.stringify(patch.collections));
    if (patch.bannerUrl !== undefined) localStorage.setItem(`userBanner_${username}`, patch.bannerUrl);
    try {
      const current = currentUser?.user_metadata || {};
      await supabase.auth.updateUser({ data: { ...current, ...patch } });
    } catch {}
    // Also persist to socialDB so other users can see profile data
    if (username) {
      await saveUserProfile(username, {
        bio: patch.bio ?? bio,
        country: patch.country ?? country,
        showCountry: patch.showCountry ?? showCountry,
        profilePic: patch.profilePic ?? profilePic,
        bannerUrl: patch.bannerUrl ?? bannerUrl,
        collections: patch.collections ?? collections,
      });
    }
  };

  const uploadBannerFile = async (file: File) => {
    setUploadingBanner(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `banners/${username}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('user-uploads').upload(path, file, { upsert: true });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
        const url = urlData.publicUrl;
        setBannerUrl(url); setBannerEdit(url); saveOwnData({ bannerUrl: url });
        setUploadingBanner(false); return;
      }
    } catch {}
    // Fallback: data URL
    if (file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = e => { const url = e.target?.result as string; setBannerUrl(url); setBannerEdit(url); saveOwnData({ bannerUrl: url }); };
      reader.readAsDataURL(file);
    } else {
      alert('Image too large. Please use an image under 2MB.');
    }
    setUploadingBanner(false);
  };

  const saveCollections = (cols: Collection[]) => {
    setCollections(cols);
    saveOwnData({ collections: cols });
  };
  const createCollection = () => {
    if (!newColName.trim()) return;
    const col: Collection = { id: Date.now().toString(), name: newColName.trim(), movieIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveCollections([...collections, col]);
    setNewColName(''); setShowNewCol(false);
  };
  const deleteCollection = (id: string) => {
    if (!window.confirm('Delete this collection?')) return;
    saveCollections(collections.filter(c => c.id !== id));
    if (openCollection?.id === id) setOpenCollection(null);
  };
  const addMovieToCollection = (colId: string, movieId: number) => {
    const updated = collections.map(c => c.id === colId ? { ...c, movieIds: [...new Set([...c.movieIds, movieId])], updatedAt: new Date().toISOString() } : c);
    saveCollections(updated);
    setColSearch('');
    const updatedCol = updated.find(c => c.id === colId);
    if (updatedCol) setOpenCollection(updatedCol);
  };
  const removeMovieFromCollection = (colId: string, movieId: number) => {
    const updated = collections.map(c => c.id === colId ? { ...c, movieIds: c.movieIds.filter(id => id !== movieId), updatedAt: new Date().toISOString() } : c);
    saveCollections(updated);
    const updatedCol = updated.find(c => c.id === colId);
    if (updatedCol) setOpenCollection(updatedCol);
  };

  const handlePicFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `profile-pics/${username}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('user-uploads').upload(path, file, { upsert: true, contentType: file.type });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
        const url = urlData.publicUrl;
        setProfilePic(url);
        saveOwnData({ profilePic: url });
        setShowPicEdit(false);
        e.target.value = '';
        return;
      }
    } catch {}
    // fallback: base64 for small files
    if (file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = ev => {
        const url = ev.target?.result as string;
        setProfilePic(url);
        saveOwnData({ profilePic: url });
        setShowPicEdit(false);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Image too large. Please use an image under 2MB or check Storage permissions.');
    }
    e.target.value = '';
  };
  const handlePicUrl = () => {
    if (!picUrl.trim()) return;
    setProfilePic(picUrl.trim());
    saveOwnData({ profilePic: picUrl.trim() });
    setPicUrl(''); setShowPicEdit(false);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    try {
      await supabase.auth.updateUser({ email: newEmail });
      setPrivacyMsg('Confirmation email sent to ' + newEmail);
      setNewEmail('');
    } catch { setPrivacyMsg('Failed to update email'); }
  };
  const handleUpdatePassword = async () => {
    if (newPwd !== confirmPwd) { setPrivacyMsg('Passwords do not match'); return; }
    if (newPwd.length < 6) { setPrivacyMsg('Password must be at least 6 characters'); return; }
    try {
      await supabase.auth.updateUser({ password: newPwd });
      setPrivacyMsg('Password updated successfully');
      setNewPwd(''); setConfirmPwd('');
    } catch { setPrivacyMsg('Failed to update password'); }
  };
  const handleLogout = async () => {
    if (currentUser?.username) {
      const now = new Date().toISOString();
      localStorage.setItem(`lastSeen_${currentUser.username}`, now);
      try { await supabase.from('kv_store_ea58c774').upsert({ key: `lastSeen:${currentUser.username}`, value: now }, { onConflict: 'key' }); } catch {}
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
    navigate('/');
  };

  const handleSendReport = async () => {
    if (!reportReason.trim() || !currentUser?.username || !username) return;
    const reason = reportReason.trim();
    const link = `/user/${username}`;
    const text = `⚑ Report: ${currentUser.username} reported ${username} — "${reason}"`;
    // Notify all admins/mods via KV lookup
    const { data: mods } = await supabase.from('profiles').select('username').in('role', ['admin', 'moderator']);
    const targets = (mods || []).map((r: any) => r.username).filter(Boolean);
    for (const mod of targets) {
      await addNotification(mod, { type: 'mention', senderUsername: currentUser.username, text, link });
    }
    if (targets.length === 0) {
      // Fallback: write to KV so admins see it when they check
      const key = `reports:pending`;
      const { data: existing } = await supabase.from('kv_store_ea58c774').select('value').eq('key', key).maybeSingle();
      const list = Array.isArray(existing?.value) ? existing.value : [];
      await supabase.from('kv_store_ea58c774').upsert({ key, value: [{ reporter: currentUser.username, reported: username, reason, at: new Date().toISOString() }, ...list].slice(0, 200) }, { onConflict: 'key' });
    }
    setReportSent(true);
    setTimeout(() => { setShowReportModal(false); setReportReason(''); setReportSent(false); }, 1800);
  };

  const handleAddProfileComment = () => {
    if (!currentUser || (!newProfileComment.trim() && !newCommentImage)) return;
    const pc: ProfileComment = {
      id: Date.now().toString(),
      commenter: currentUser.username,
      text: newProfileComment.trim(),
      timestamp: Date.now(),
      imageUrl: newCommentImage || undefined,
    };
    const updated = [pc, ...profileComments];
    setProfileComments(updated);
    saveProfileComments(username!, updated);
    setNewProfileComment('');
    setNewCommentImage(null);
  };
  const handleDeleteProfileComment = (id: string) => {
    const updated = profileComments.filter(c => c.id !== id);
    setProfileComments(updated);
    saveProfileComments(username!, updated);
  };

  function fmtJoined(iso: string) {
    try {
      return new Date(iso).toLocaleDateString([], { month: 'long', year: 'numeric' });
    } catch { return ''; }
  }

  function fmtLastSeen(iso: string) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    // Online if heartbeat within last 6 minutes (3 min interval + 3 min buffer)
    if (diff < 6 * 60 * 1000) return 'Online';
    if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
    if (diff < 7 * 86400000) return `Last seen ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
    return `Last seen ${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  const resolvedLastSeen = lastSeen || localStorage.getItem(`lastSeen_${username}`);
  const onlineStatus = isOwn
    ? 'Online'  // viewing own profile = definitely online
    : (resolvedLastSeen ? fmtLastSeen(resolvedLastSeen) : 'Offline'); // no record = never seen
  const isOnline = onlineStatus === 'Online';

  const card = 'bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px]';
  const muted = 'text-[rgba(16,11,9,0.55)] dark:text-[rgba(247,241,237,0.55)]';
  const accent = 'text-[#d07339] dark:text-[#c36a32]';
  const textMain = 'text-[#100b09] dark:text-[#f7f1ed]';
  const inputCls = 'w-full px-3 py-2 text-sm border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.85)] focus:outline-none focus:ring-2 focus:ring-[#d07339]';
  const btnPrimary = 'px-4 py-2 text-sm font-medium rounded-lg bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white transition-colors';
  const btnGhost = `px-4 py-2 text-sm font-medium rounded-lg border border-[#eea77a] dark:border-[#7e3e15] ${textMain} hover:bg-[rgba(208,115,57,0.08)] transition-colors`;

  // Shared action buttons row (Follow / Message / Report) used on other-user profile and preview mode
  const renderActionButtons = (compact = false) => {
    if (isOwn && !previewMode) return null;
    const size = compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
    return (
      <div className={`flex flex-wrap gap-2 mt-3 ${compact ? '' : ''}`}>
        {!isOwn && currentUser && (
          <button
            onClick={handleFollow}
            className={`${size} font-medium rounded-lg transition-colors ${isFollowing ? 'border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'bg-[#d07339] hover:bg-[#b8622e] text-white'}`}
          >
            {isFollowing ? 'Unfollow' : '+ Follow'}
          </button>
        )}
        {!isOwn && (
          <button
            onClick={() => navigate(`/chat?dm=${username}`)}
            className={`${size} font-medium rounded-lg border border-[#eea77a] dark:border-[#7e3e15] ${textMain} hover:bg-[rgba(208,115,57,0.08)] transition-colors flex items-center gap-1.5`}
          >
            <Mail className="size-3.5" /> Message
          </button>
        )}
        {!isOwn && currentUser && (
          <button
            onClick={() => setShowReportModal(true)}
            className={`${size} font-medium rounded-lg border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-1.5`}
          >
            <Flag className="size-3.5" /> Report
          </button>
        )}
      </div>
    );
  };

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'My Profile', icon: <User className="size-4" /> },
    { id: 'comments', label: 'My Comments', icon: <MessageSquare className="size-4" /> },
    { id: 'ratings', label: 'My Ratings', icon: <Star className="size-4" /> },
    { id: 'collections', label: 'My Collections', icon: <Folder className="size-4" /> },
    { id: 'followers', label: `Followers (${followers.length})`, icon: <Users className="size-4" /> },
    { id: 'following', label: `Following (${following.length})`, icon: <Heart className="size-4" /> },
    { id: 'privacy', label: 'Privacy Settings', icon: <Settings className="size-4" /> },
    { id: 'messages', label: 'Messages', icon: <Mail className="size-4" /> },
  ];

  // Collections preview strip — render function (not component) so React never unmounts/remounts it
  const renderCollectionsPreview = () => (
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-base font-semibold ${textMain}`}>Collections ({collections.length})</h2>
        {isOwn && (
          <button onClick={() => setTab('collections')} className={`text-xs ${accent} hover:underline`}>
            Manage →
          </button>
        )}
      </div>
      {collections.length === 0 ? (
        <p className={`text-sm ${muted}`}>{isOwn ? 'No collections yet. Create one!' : 'No collections.'}</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {collections.slice(0, 6).map(col => {
            const firstMovie = col.movieIds.length > 0 ? allMovies.find(m => m.id === col.movieIds[0]) : null;
            return (
              <button
                key={col.id}
                onClick={() => { setOpenCollection(col); setColSearch(''); if (isOwn) setTab('collections'); }}
                className="flex-shrink-0 w-28 text-left group"
              >
                <div className="w-28 h-36 rounded-lg overflow-hidden bg-[rgba(208,115,57,0.1)] dark:bg-[rgba(126,62,21,0.15)] flex items-center justify-center mb-1.5 relative">
                  {firstMovie?.image
                    ? <img src={firstMovie.image} alt={firstMovie.title} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                    : <Folder className={`size-8 ${muted}`} />}
                  <div className="absolute inset-0 bg-black/40 flex items-end p-1.5">
                    <span className="text-white text-[10px] font-medium line-clamp-2 leading-tight">{col.name}</span>
                  </div>
                </div>
                <div className={`text-xs ${muted}`}>{col.movieIds.length} films</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // Activity section — render function (not component) so React never unmounts/remounts it
  const renderActivitySection = () => (
    <div className={`${card} p-5`}>
      <h2 className={`text-base font-semibold mb-4 ${textMain}`}>Recent Activity</h2>
      {activity.length === 0 && <p className={`text-sm ${muted}`}>No activity yet.</p>}
      <div className="space-y-4">
        {activity.map((a, i) => {
          // Follow activity — no movie involved
          if (a.type === 'follow' && a.targetUsername) {
            return (
              <div key={i} className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-full bg-[rgba(208,115,57,0.12)] flex items-center justify-center flex-shrink-0">
                  <Users className="size-4 text-[#d07339]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${textMain}`}>
                    Followed <Link to={`/users/${a.targetUsername}`} className={`font-medium hover:underline ${accent}`}>{a.targetUsername}</Link>
                  </p>
                  <p className={`text-[10px] ${muted} mt-0.5`}>{new Date(a.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
            );
          }
          const m = a.movie;
          if (!m) return null;
          return (
            <div key={i} className="flex gap-3">
              <Link to={`/movie/${createSlug(m.title, m.year)}`} className="flex-shrink-0">
                <img src={(m as any).image} alt={m.title} className="w-10 h-14 object-cover rounded bg-[rgba(208,115,57,0.1)]" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/movie/${createSlug(m.title, m.year)}`} className={`font-medium text-sm hover:underline ${accent}`}>{m.title}</Link>
                <div className={`text-xs ${muted} flex items-center gap-1.5 flex-wrap`}>
                  {(m.imdbRating || m.rating) ? <><Star className="size-3 fill-[#f99251] text-[#f99251]" /><span>{((m.imdbRating || m.rating) || 0).toFixed(1)}</span></> : null}
                  {m.year && <><span>•</span><span>{m.year}</span></>}
                  {m.genre && <><span>•</span><span className="truncate">{m.genre.split(',')[0]}</span></>}
                </div>
                {a.type === 'rating' && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`size-3 ${s <= (a.rating||0) ? 'fill-[#d07339] text-[#d07339]' : 'text-[rgba(16,11,9,0.2)] dark:text-[rgba(247,241,237,0.15)]'}`} />)}
                    <span className={`text-xs ${muted} ml-1`}>Rated</span>
                  </div>
                )}
                {a.type === 'comment' && a.comment && (
                  <p className={`text-xs mt-1 line-clamp-2 ${textMain} opacity-80`}>"{a.comment}"</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Profile comments section — render function (not component) so inputs keep focus
  const renderProfileComments = () => {
    const commentInput = (placeholder: string, pic: string) => (
      <div className="flex gap-2 mb-4">
        <Avatar username={currentUser!.username} picture={pic} size={32} />
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={newProfileComment}
              onChange={e => setNewProfileComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddProfileComment()}
              placeholder={placeholder}
              className={`${inputCls} flex-1`}
            />
            <button onClick={() => commentFileRef.current?.click()} title="Attach image" className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors hover:bg-[rgba(208,115,57,0.1)] ${muted}`} style={{ borderColor: 'rgba(208,115,57,0.2)', flexShrink: 0 }}>
              <Paperclip className="size-3.5" />
            </button>
            <button onClick={() => setCommentGifOpen(v => !v)} title="Attach GIF" className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors text-xs font-bold ${commentGifOpen ? 'bg-[rgba(208,115,57,0.15)]' : 'hover:bg-[rgba(208,115,57,0.1)]'} ${muted}`} style={{ borderColor: 'rgba(208,115,57,0.2)', flexShrink: 0 }}>
              GIF
            </button>
            <button onClick={handleAddProfileComment} className={`${btnPrimary} flex items-center gap-1.5 px-3`}>
              <Send className="size-3.5" />
            </button>
          </div>
          {newCommentImage && (
            <div className="relative inline-block">
              <img src={newCommentImage} alt="preview" className="max-h-32 rounded-lg object-contain border border-[rgba(208,115,57,0.2)]" />
              <button onClick={() => setNewCommentImage(null)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black/80 transition-colors">
                <X className="size-3 text-white" />
              </button>
            </div>
          )}
          {commentGifOpen && (
            <div className="mt-1">
              <GifPicker
                onSelect={(url: string) => {
                  setNewCommentImage(url);
                  setCommentGifOpen(false);
                }}
                onClose={() => setCommentGifOpen(false)}
              />
            </div>
          )}
        </div>
      </div>
    );
    return (
      <div className={`${card} p-5`}>
        <input ref={commentFileRef} type="file" accept="image/*,image/gif" className="hidden" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          if (file.size > 8 * 1024 * 1024) { alert('Image must be under 8MB'); return; }
          try {
            const ext = file.name.split('.').pop() || 'jpg';
            const path = `comment-imgs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { data: up } = await supabase.storage.from('chat-images').upload(path, file, { contentType: file.type, upsert: false });
            if (up?.path) {
              const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(up.path);
              if (pub?.publicUrl) { setNewCommentImage(pub.publicUrl); e.target.value = ''; return; }
            }
          } catch {}
          // fallback: base64
          const reader = new FileReader();
          reader.onload = ev => { if (ev.target?.result) setNewCommentImage(ev.target.result as string); };
          reader.readAsDataURL(file);
          e.target.value = '';
        }} />
        <h2 className={`text-base font-semibold mb-4 ${textMain}`}>Comments on {username}'s profile ({profileComments.length})</h2>
        {currentUser && !isOwn && commentInput(`Leave a comment on ${username}'s profile...`, localStorage.getItem(`userPic_${currentUser.username}`) || currentUser.profilePicture || '')}
        {!currentUser && (
          <p className={`text-sm ${muted} mb-4`}>
            <button onClick={() => navigate('/')} className={`${accent} hover:underline`}>Sign in</button> to leave a comment.
          </p>
        )}
        {isOwn && currentUser && commentInput('Write on your own profile...', profilePic || currentUser.profilePicture || '')}
        {profileComments.length === 0 && (
          <p className={`text-sm ${muted} text-center py-4`}>No comments yet. Be the first!</p>
        )}
        <div className="space-y-3">
          {profileComments.map(pc => (
            <div key={pc.id} className="flex gap-3">
              <Avatar username={pc.commenter} picture={localStorage.getItem(`userPic_${pc.commenter}`) || ''} size={32} />
              <div className={`flex-1 p-3 rounded-lg bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.08)]`}>
                <div className="flex items-center justify-between mb-1">
                  <Link to={`/users/${pc.commenter}`} className={`text-sm font-medium ${accent} hover:underline`}>{pc.commenter}</Link>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${muted}`}>{new Date(pc.timestamp).toLocaleDateString()}</span>
                    {(isOwn || currentUser?.username === pc.commenter) && (
                      <button onClick={() => handleDeleteProfileComment(pc.id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {pc.text && <p className={`text-sm ${textMain}`}>{pc.text}</p>}
                {pc.imageUrl && <img src={pc.imageUrl} alt="attachment" className="mt-1 max-h-48 rounded-lg object-contain border border-[rgba(208,115,57,0.2)]" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Collection modal (shared) ───
  const CollectionModal = () => {
    const modalCol = openCollection ? (collections.find(c => c.id === openCollection.id) || openCollection) : null;
    const modalMovies = modalCol ? modalCol.movieIds.map(id => allMovies.find(m => m.id === id)).filter(Boolean) as Movie[] : [];
    const filteredSearchMovies = colSearch.trim()
      ? allMovies.filter(m => m.title.toLowerCase().includes(colSearch.toLowerCase()) && !(modalCol?.movieIds.includes(m.id)))
      : [];
    if (!modalCol) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setOpenCollection(null)}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div
          className={`relative ${card} w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-5 border-b border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.15)]">
            <div>
              <h2 className={`text-lg font-bold ${textMain}`}>{modalCol.name}</h2>
              <p className={`text-xs ${muted}`}>by {username} · {modalMovies.length} movie{modalMovies.length !== 1 ? 's' : ''} · Updated {new Date(modalCol.updatedAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => setOpenCollection(null)} className={`${muted} hover:text-red-500 transition-colors`}><X className="size-5" /></button>
          </div>
          {isOwn && (
            <div className="px-5 pt-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 size-3.5 ${muted}`} />
                <input value={colSearch} onChange={e => setColSearch(e.target.value)} placeholder="Search movies to add..." className={`${inputCls} pl-9 text-sm`} />
              </div>
              {filteredSearchMovies.length > 0 && (
                <div className={`${card} mt-1 max-h-36 overflow-y-auto shadow-lg`}>
                  {filteredSearchMovies.slice(0, 8).map(m => (
                    <button key={m.id} onClick={() => addMovieToCollection(modalCol.id, m.id)} className={`w-full text-left px-3 py-2 text-sm ${textMain} hover:bg-[rgba(208,115,57,0.08)] flex items-center gap-3`}>
                      <img src={m.image} alt={m.title} className="w-7 h-10 object-cover rounded flex-shrink-0" />
                      <span className="truncate">{m.title} ({m.year})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5 pt-3">
            {modalMovies.length === 0 && (
              <div className="text-center py-10">
                <Folder className={`size-10 mx-auto mb-2 ${muted}`} />
                <p className={`text-sm ${muted}`}>{isOwn ? 'Empty. Search above to add movies!' : 'This collection is empty.'}</p>
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {modalMovies.map(m => (
                <div key={m.id} className="relative group/mv">
                  <Link to={`/movie/${createSlug(m.title, m.year)}`} className="block" onClick={() => setOpenCollection(null)}>
                    <img src={m.image} alt={m.title} className="w-full aspect-[2/3] object-cover rounded-lg hover:opacity-90 transition-opacity" />
                    <div className={`text-xs font-medium mt-1 truncate ${textMain}`}>{m.title}</div>
                    <div className={`text-xs ${muted}`}>{m.year}</div>
                  </Link>
                  {isOwn && (
                    <button onClick={() => removeMovieFromCollection(modalCol.id, m.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/80 flex items-center justify-center opacity-0 group-hover/mv:opacity-100 transition-opacity">
                      <X className="size-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Tab content for own profile ───
  const renderPreviewProfile = () => (
    <div className="space-y-5">
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-700 dark:text-amber-300">
        You are previewing your profile as other users see it.
        <button onClick={() => setPreviewMode(false)} className="ml-auto text-xs underline">Exit preview</button>
      </div>
      <div className={`${card} overflow-hidden`}>
        {/* Banner background */}
        <div className={`relative ${bannerUrl ? 'min-h-[160px] sm:min-h-[200px]' : ''}`}>
          {bannerUrl && (
            <>
              <img src={bannerUrl} alt="Profile banner" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/65" />
            </>
          )}
          <div className={`relative z-10 p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start ${bannerUrl ? 'pb-5 pt-10 sm:pt-14' : 'pt-5'}`}>
            <Avatar username={username!} picture={profilePic} size={88} />
            <div className="flex-1 min-w-0 text-center sm:text-left pb-1 w-full sm:w-auto">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className={`text-xl font-bold ${bannerUrl ? 'text-white drop-shadow-md' : textMain}`}>{username}</h1>
                {currentUser?.role && currentUser.role !== 'user' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${currentUser.role === 'admin' ? 'bg-purple-600 text-white' : 'bg-blue-500 text-white'}`}>
                    {currentUser.role === 'admin' ? 'Admin' : 'Mod'}
                  </span>
                )}
                <span className={`text-xs font-medium flex items-center gap-0.5 ${bannerUrl ? 'text-white/80' : muted}`}>
                  <span className="text-green-400">●</span> Online
                </span>
              </div>
              {(showCountry || isOwn) && country && (
                <div className={`flex items-center justify-center sm:justify-start gap-1 mt-1 text-xs ${bannerUrl ? 'text-white/90' : muted}`}><FlagImg country={country} /> {countryDisplayName(country)}</div>
              )}
              {joinedDate && (
                <div className={`text-xs mt-1 ${bannerUrl ? 'text-white/70' : muted}`}>Joined {fmtJoined(joinedDate)}</div>
              )}
              <div className={`flex items-center justify-center sm:justify-start gap-3 mt-1 text-xs ${bannerUrl ? 'text-white/80' : muted} flex-wrap`}>
                <button onClick={() => { setPreviewMode(false); setTab('followers'); }} className="hover:underline">{followers.length} followers</button>
                <button onClick={() => { setPreviewMode(false); setTab('following'); }} className="hover:underline">{following.length} following</button>
              </div>
              {/* Preview mode: show how action buttons look to visitors */}
              <div className="flex flex-wrap gap-2 mt-3 opacity-70 pointer-events-none justify-center sm:justify-start">
                <button className={`px-4 py-2 text-sm font-medium rounded-lg bg-[#d07339] text-white`}>+ Follow</button>
                <button className={`px-4 py-2 text-sm font-medium rounded-lg border border-[#eea77a] dark:border-[#7e3e15] ${textMain} flex items-center gap-1.5`}><Mail className="size-3.5" /> Message</button>
                <button className={`px-4 py-2 text-sm font-medium rounded-lg border border-[rgba(208,115,57,0.2)] text-red-500 flex items-center gap-1.5`}><Flag className="size-3.5" /> Report</button>
              </div>
              <p className={`text-[10px] ${muted} mt-1`}>Visitors see these buttons</p>
            </div>
          </div>
        </div>
        {bio && <div className="px-6 pb-4 pt-2"><p className={`text-sm leading-relaxed ${textMain}`}>{bio}</p></div>}
        {/* Statistics section */}
        <div className="px-6 pb-6 pt-2 border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.1)]">
          <h3 className={`text-xs font-semibold ${muted} uppercase tracking-wide mb-3`}>Statistics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ratings', value: ratedMovies.length, key: 'ratings' as const },
              { label: 'Comments', value: userComments.length, key: 'comments' as const },
              { label: 'Watched', value: watchedMovies.length, key: 'watched' as const },
              { label: 'Fav Genre', value: fav, key: null },
            ].map(s => (
              <div
                key={s.label}
                onClick={s.key ? () => setStatsPanel(statsPanel === s.key ? null : s.key!) : undefined}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${s.key ? `cursor-pointer ${statsPanel === s.key ? 'bg-[rgba(208,115,57,0.15)] dark:bg-[rgba(126,62,21,0.18)]' : 'bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.08)] hover:bg-[rgba(208,115,57,0.1)] dark:hover:bg-[rgba(126,62,21,0.12)]'}` : 'bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.08)]'}`}
              >
                <span className={`text-base font-bold ${textMain} truncate max-w-full`}>{s.value}</span>
                <span className={`text-xs ${muted}`}>{s.label}</span>
              </div>
            ))}
          </div>
          {statsPanel && (() => {
            const items = statsPanel === 'ratings'
              ? ratedMovies.map(m => ({ movie: m, extra: undefined as string | undefined }))
              : statsPanel === 'comments'
                ? (userComments.map(c => { const m = allMovies.find(mv => Number(mv.id) === Number(c.movieId)); return m ? { movie: m, extra: c.text } : null; }).filter(Boolean) as { movie: Movie; extra: string }[])
                : watchedMovies.map(m => ({ movie: m, extra: undefined as string | undefined }));
            const title = statsPanel === 'ratings' ? 'Rated Movies' : statsPanel === 'comments' ? 'Commented Movies' : 'Watched Movies';
            return (
              <div className="mt-3 pt-3 border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.1)]">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${muted} uppercase tracking-wide`}>{title} ({items.length})</span>
                  <button onClick={() => setStatsPanel(null)} className={`text-xs ${muted} hover:text-red-500 transition-colors`}>✕ Close</button>
                </div>
                {items.length === 0 && <p className={`text-sm ${muted} py-2`}>Nothing here yet.</p>}
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {items.map(({ movie: m, extra }, i) => (
                    <Link key={i} to={`/movie/${createSlug(m.title, m.year)}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-[rgba(208,115,57,0.06)] dark:hover:bg-[rgba(126,62,21,0.08)] transition-colors group">
                      <div className="w-8 h-11 rounded flex-shrink-0 overflow-hidden bg-[rgba(208,115,57,0.1)]">
                        {m.image && <img src={m.image} alt={m.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium truncate ${textMain} group-hover:text-[#d07339]`}>{m.title}</div>
                        <div className={`text-xs ${muted}`}>{m.year}{m.genre ? ` · ${m.genre.split(',')[0]}` : ''}</div>
                        {statsPanel === 'ratings' && m.userRating && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[1,2,3,4,5].map(s => <Star key={s} className={`size-3 ${s <= (m.userRating||0) ? 'fill-[#d07339] text-[#d07339]' : 'text-[rgba(16,11,9,0.2)] dark:text-[rgba(247,241,237,0.15)]'}`} />)}
                          </div>
                        )}
                        {statsPanel === 'comments' && extra && (
                          <div className={`text-xs ${muted} truncate mt-0.5`}>"{extra}"</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      {renderCollectionsPreview()}
      {renderActivitySection()}
      {renderProfileComments()}
    </div>
  );

  const renderProfile = () => {
    if (previewMode) return renderPreviewProfile();
    return (
    <div className="space-y-5">
      {/* Header card */}
      <div className={`${card} overflow-hidden`}>
        {/* Banner + avatar/info overlay section */}
        <div className={`relative ${bannerUrl ? 'min-h-[160px] sm:min-h-[200px]' : 'min-h-[56px]'}`}>
          {bannerUrl && (
            <>
              <img src={bannerUrl} alt="Profile banner" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/65" />
            </>
          )}
          {/* Banner change button — always visible to owner */}
          {isOwn && (
            <>
              <input ref={bannerFileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadBannerFile(f); e.target.value = ''; }} />
              <div className="absolute top-2 right-2 z-20 flex gap-1">
                <button
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={uploadingBanner}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${bannerUrl ? 'bg-black/40 hover:bg-black/60 text-white border border-white/30' : 'bg-[rgba(208,115,57,0.15)] hover:bg-[rgba(208,115,57,0.3)] text-[#d07339] border border-[rgba(208,115,57,0.4)]'}`}
                >
                  <Camera className="size-3" /> {uploadingBanner ? 'Uploading…' : (bannerUrl ? 'Change banner' : 'Add banner')}
                </button>
                {bannerUrl && (
                  <button onClick={() => { setBannerUrl(''); setBannerEdit(''); saveOwnData({ bannerUrl: '' }); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-black/40 hover:bg-black/60 text-white border border-white/30">
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </>
          )}
          <div className={`relative z-10 p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start ${bannerUrl ? 'pb-5 pt-10 sm:pt-14' : 'pt-5 sm:pt-5'}`}>
            <div className="relative flex-shrink-0">
              <Avatar username={username!} picture={profilePic} size={88} onClick={isOwn ? () => setShowPicEdit(v => !v) : undefined} />
              {isOwn && (
                <button onClick={() => setShowPicEdit(v => !v)} className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#d07339] flex items-center justify-center border-2 border-white dark:border-[#18110c]">
                  <Camera className="size-3.5 text-white" />
                </button>
              )}
              {isOwn && showPicEdit && (
                <div className={`absolute top-full left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-0 mt-2 ${card} p-3 z-30 w-60 shadow-lg`}>
                  <p className={`text-xs font-medium mb-2 ${textMain}`}>Change picture</p>
                  <button onClick={() => fileRef.current?.click()} className={`${btnGhost} w-full mb-2 text-xs`}>Upload image</button>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handlePicFile} />
                  <input type="url" value={picUrl} onChange={e => setPicUrl(e.target.value)} placeholder="Or paste image URL..." className={`${inputCls} text-xs mb-2`} />
                  <button onClick={handlePicUrl} className={`${btnPrimary} w-full text-xs`}>Set URL</button>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left pb-1 w-full sm:w-auto">
              {/* Name + role badge + online on one row */}
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className={`text-xl font-bold ${bannerUrl ? 'text-white drop-shadow-md' : textMain}`}>{username}</h1>
                {currentUser?.role && currentUser.role !== 'user' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${currentUser.role === 'admin' ? 'bg-purple-600 text-white' : 'bg-blue-500 text-white'}`}>
                    {currentUser.role === 'admin' ? 'Admin' : 'Mod'}
                  </span>
                )}
                <span className={`text-xs font-medium flex items-center gap-0.5 ${bannerUrl ? 'text-white/80' : muted}`}>
                  <span className={isOnline ? 'text-green-400' : 'text-gray-400'}>●</span> {onlineStatus}
                </span>
              </div>
              {/* Country flag */}
              {(showCountry || isOwn) && country && (
                <div className={`flex items-center justify-center sm:justify-start gap-1 mt-1 text-xs ${bannerUrl ? 'text-white/90 drop-shadow' : muted}`}>
                  <FlagImg country={country} /> {countryDisplayName(country)}
                </div>
              )}
              {/* Joined date */}
              {joinedDate && (
                <div className={`text-xs mt-1 ${bannerUrl ? 'text-white/70 drop-shadow' : muted}`}>
                  Joined {fmtJoined(joinedDate)}
                </div>
              )}
              {/* Followers / following */}
              <div className={`flex items-center justify-center sm:justify-start gap-3 mt-1 text-xs ${bannerUrl ? 'text-white/80 drop-shadow' : muted} flex-wrap`}>
                <button onClick={() => setTab('followers')} className="hover:underline">{followers.length} followers</button>
                <button onClick={() => setTab('following')} className="hover:underline">{following.length} following</button>
              </div>
              {/* Preview button — own line below info */}
              {isOwn && (
                <button
                  onClick={() => setPreviewMode(v => !v)}
                  className={`mt-2 text-xs px-3 py-1 rounded-full border ${bannerUrl ? 'border-white/70 text-white hover:bg-white/20' : 'border-[#d07339] text-[#d07339] hover:bg-[rgba(208,115,57,0.08)]'}`}
                >
                  {previewMode ? '← Back to editing' : 'Preview as visitor'}
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Bio + edit inputs below banner */}
        <div className="px-6 pb-6 pt-3">
          {isOwn ? (
            <>
              <textarea
                value={bioEdit}
                onChange={e => setBioEdit(e.target.value)}
                onBlur={() => { setBio(bioEdit); saveOwnData({ bio: bioEdit }); }}
                placeholder="Write a bio..."
                rows={3}
                className={`${inputCls} resize-none text-sm`}
              />
              <input
                value={countryEdit}
                onChange={e => setCountryEdit(e.target.value)}
                onBlur={() => { setCountry(countryEdit); saveOwnData({ country: countryEdit }); }}
                placeholder="Your country..."
                className={`${inputCls} text-sm mt-2`}
              />
            </>
          ) : (
            bio && <p className={`text-sm leading-relaxed ${textMain}`}>{bio}</p>
          )}
        </div>
        <div className="px-6 pb-2 pt-1">
          <h3 className={`text-xs font-semibold ${muted} uppercase tracking-wide mb-3`}>Statistics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Ratings', value: ratedMovies.length, key: 'ratings' as const },
              { label: 'Comments', value: userComments.length, key: 'comments' as const },
              { label: 'Watched', value: watchedMovies.length, key: 'watched' as const },
              { label: 'Fav Genre', value: fav, key: null },
            ].map(s => (
              <div
                key={s.label}
                onClick={s.key ? () => setStatsPanel(statsPanel === s.key ? null : s.key!) : undefined}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${s.key ? `cursor-pointer ${statsPanel === s.key ? 'bg-[rgba(208,115,57,0.15)] dark:bg-[rgba(126,62,21,0.18)]' : 'bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.08)] hover:bg-[rgba(208,115,57,0.1)] dark:hover:bg-[rgba(126,62,21,0.12)]'}` : 'bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.08)]'}`}
              >
                <span className={`text-base font-bold ${textMain} truncate max-w-full`}>{s.value}</span>
                <span className={`text-xs ${muted}`}>{s.label}</span>
              </div>
            ))}
          </div>
          {statsPanel && (() => {
            const items = statsPanel === 'ratings'
              ? ratedMovies.map(m => ({ movie: m, extra: undefined as string | undefined }))
              : statsPanel === 'comments'
                ? (userComments.map(c => { const m = allMovies.find(mv => Number(mv.id) === Number(c.movieId)); return m ? { movie: m, extra: c.text } : null; }).filter(Boolean) as { movie: Movie; extra: string }[])
                : watchedMovies.map(m => ({ movie: m, extra: undefined as string | undefined }));
            const title = statsPanel === 'ratings' ? 'Rated Movies' : statsPanel === 'comments' ? 'Commented Movies' : 'Watched Movies';
            return (
              <div className="mt-3 pt-3 border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.1)]">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold ${muted} uppercase tracking-wide`}>{title} ({items.length})</span>
                  <button onClick={() => setStatsPanel(null)} className={`text-xs ${muted} hover:text-red-500 transition-colors`}>✕ Close</button>
                </div>
                {items.length === 0 && <p className={`text-sm ${muted} py-2`}>Nothing here yet.</p>}
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {items.map(({ movie: m, extra }, i) => (
                    <Link key={i} to={`/movie/${createSlug(m.title, m.year)}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-[rgba(208,115,57,0.06)] dark:hover:bg-[rgba(126,62,21,0.08)] transition-colors group">
                      <div className="w-8 h-11 rounded flex-shrink-0 overflow-hidden bg-[rgba(208,115,57,0.1)]">
                        {m.image && <img src={m.image} alt={m.title} className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium truncate ${textMain} group-hover:text-[#d07339]`}>{m.title}</div>
                        <div className={`text-xs ${muted}`}>{m.year}{m.genre ? ` · ${m.genre.split(',')[0]}` : ''}</div>
                        {statsPanel === 'ratings' && m.userRating && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {[1,2,3,4,5].map(s => <Star key={s} className={`size-3 ${s <= (m.userRating||0) ? 'fill-[#d07339] text-[#d07339]' : 'text-[rgba(16,11,9,0.2)] dark:text-[rgba(247,241,237,0.15)]'}`} />)}
                          </div>
                        )}
                        {statsPanel === 'comments' && extra && (
                          <div className={`text-xs ${muted} truncate mt-0.5`}>"{extra}"</div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {renderCollectionsPreview()}
      {renderActivitySection()}
      {renderProfileComments()}
    </div>
    );
  };

  const renderComments = () => (
    <div className="space-y-3">
      <h2 className={`text-base font-semibold ${textMain}`}>Comments ({userComments.length})</h2>
      {userComments.length === 0 && <p className={`text-sm ${muted}`}>No comments yet.</p>}
      {userComments.map((c, i) => {
        const m = allMovies.find(m => Number(m.id) === Number(c.movieId));
        return (
          <div key={i} className={`${card} p-4`}>
            {m && (
              <div className="flex gap-3 mb-3">
                <Link to={`/movie/${createSlug(m.title, m.year)}`}><img src={m.image} alt={m.title} className="w-10 h-14 object-cover rounded" /></Link>
                <div className="min-w-0">
                  <Link to={`/movie/${createSlug(m.title, m.year)}`} className={`font-semibold text-sm hover:underline ${accent}`}>{m.title}</Link>
                  <div className={`text-xs ${muted} flex items-center gap-1.5 flex-wrap`}>
                    {(m.imdbRating || m.rating) ? <><Star className="size-3 fill-[#f99251] text-[#f99251]" />{((m.imdbRating || m.rating)||0).toFixed(1)}</> : null}
                    {m.year && <><span>•</span>{m.year}</>}
                    {m.genre && <><span>•</span>{m.genre.split(',')[0]}</>}
                  </div>
                </div>
              </div>
            )}
            <p className={`text-sm leading-relaxed ${textMain}`}>"{c.text}"</p>
            <p className={`text-xs mt-1.5 ${muted}`}>{new Date(c.timestamp).toLocaleDateString()}</p>
          </div>
        );
      })}
    </div>
  );

  const renderRatings = () => (
    <div className="space-y-3">
      <h2 className={`text-base font-semibold ${textMain}`}>Ratings ({ratedMovies.length})</h2>
      {ratedMovies.length === 0 && <p className={`text-sm ${muted}`}>No ratings yet.</p>}
      {ratedMovies.map((m, i) => (
        <Link key={i} to={`/movie/${createSlug(m.title, m.year)}`} className={`flex gap-3 p-3 ${card} hover:bg-[rgba(208,115,57,0.04)] transition-colors no-underline`}>
          <img src={m.image} alt={m.title} className="w-12 h-16 object-cover rounded flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className={`font-semibold text-sm truncate ${textMain}`}>{m.title}</div>
            <div className={`text-xs flex items-center gap-1.5 mt-0.5 ${muted}`}>
              {(m.imdbRating || m.rating) ? <><Star className="size-3 fill-[#f99251] text-[#f99251]" /><span>{((m.imdbRating || m.rating)||0).toFixed(1)}</span></> : null}
              {m.year && <><span>•</span><span>{m.year}</span></>}
              {m.genre && <><span>•</span><span className="truncate">{m.genre.split(',')[0]}</span></>}
            </div>
            <div className="flex items-center gap-0.5 mt-1.5">
              {[1,2,3,4,5].map(s => <Star key={s} className={`size-3 ${s <= (m.userRating||0) ? 'fill-[#d07339] text-[#d07339]' : 'text-[rgba(16,11,9,0.2)] dark:text-[rgba(247,241,237,0.15)]'}`} />)}
              <span className={`text-xs ${muted} ml-1`}>{m.userRating}/5</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );

  const renderCollections = () => {
    const modalCol = openCollection ? (collections.find(c => c.id === openCollection.id) || openCollection) : null;
    const modalMovies = modalCol ? modalCol.movieIds.map(id => allMovies.find(m => m.id === id)).filter(Boolean) as Movie[] : [];
    const filteredSearchMovies = colSearch.trim()
      ? allMovies.filter(m => m.title.toLowerCase().includes(colSearch.toLowerCase()) && !(modalCol?.movieIds.includes(m.id)))
      : [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className={`text-base font-semibold ${textMain}`}>Collections ({collections.length})</h2>
          {isOwn && (
            <button onClick={() => setShowNewCol(v => !v)} className={btnPrimary}>
              <Plus className="size-4 inline mr-1" />New Collection
            </button>
          )}
        </div>
        {isOwn && showNewCol && (
          <div className={`${card} p-4 flex gap-2`}>
            <input value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCollection()} placeholder="Collection name..." className={`${inputCls} flex-1`} autoFocus />
            <button onClick={createCollection} className={btnPrimary}>Create</button>
            <button onClick={() => setShowNewCol(false)} className={btnGhost}>Cancel</button>
          </div>
        )}
        {collections.length === 0 && <p className={`text-sm ${muted}`}>No collections yet.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map(col => {
            const count = col.movieIds.length;
            return (
              <button key={col.id} onClick={() => { setOpenCollection(col); setColSearch(''); }} className={`${card} p-4 text-left hover:bg-[rgba(208,115,57,0.04)] transition-colors group relative`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(208,115,57,0.12)] dark:bg-[rgba(126,62,21,0.2)] flex items-center justify-center flex-shrink-0">
                    <Folder className={`size-5 ${accent}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm truncate ${textMain}`}>{col.name}</div>
                    <div className={`text-xs ${muted} mt-0.5`}>by {username}</div>
                    <div className={`text-xs ${muted}`}>{count} movie{count !== 1 ? 's' : ''}</div>
                    <div className={`text-xs ${muted}`}>Updated {new Date(col.updatedAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {isOwn && (
                  <button onClick={e => { e.stopPropagation(); deleteCollection(col.id); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600">
                    <X className="size-4" />
                  </button>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFollowerList = (list: string[], title: string) => (
    <div className="space-y-3">
      <h2 className={`text-base font-semibold ${textMain}`}>{title} ({list.length})</h2>
      {list.length === 0 && <p className={`text-sm ${muted}`}>None yet.</p>}
      {list.map(u => (
        <Link key={u} to={`/users/${u}`} className={`flex items-center gap-3 p-3 ${card} hover:bg-[rgba(208,115,57,0.04)] transition-colors no-underline`}>
          <Avatar username={u} picture={localStorage.getItem(`userPic_${u}`) || ''} size={36} />
          <span className={`font-medium text-sm ${textMain}`}>{u}</span>
        </Link>
      ))}
    </div>
  );

  const renderPrivacy = () => (
    <div className="space-y-5">
      <h2 className={`text-base font-semibold ${textMain}`}>Privacy Settings</h2>
      <div className={`${card} p-5 space-y-4`}>
        <h3 className={`text-sm font-semibold ${textMain}`}>Account</h3>
        <div>
          <label className={`text-xs font-medium ${muted} block mb-1`}>Change Email</label>
          <div className="flex gap-2">
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="New email address" className={`${inputCls} flex-1`} />
            <button onClick={handleUpdateEmail} className={btnPrimary}>Update</button>
          </div>
        </div>
        <div>
          <label className={`text-xs font-medium ${muted} block mb-1`}>Change Password</label>
          <div className="space-y-2">
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="New password" className={inputCls} />
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Confirm new password" className={inputCls} />
            <button onClick={handleUpdatePassword} className={btnPrimary}>Update Password</button>
          </div>
        </div>
        {privacyMsg && <p className={`text-sm ${accent}`}>{privacyMsg}</p>}
      </div>
      <div className={`${card} p-5 space-y-3`}>
        <h3 className={`text-sm font-semibold ${textMain}`}>Profile Visibility</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => { const next = !showCountry; setShowCountry(next); saveOwnData({ showCountry: next }); }}
            className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${showCountry ? 'bg-[#d07339]' : 'bg-[rgba(16,11,9,0.2)] dark:bg-[rgba(247,241,237,0.2)]'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${showCountry ? 'left-5' : 'left-1'}`} />
          </div>
          <span className={`text-sm ${textMain}`}>Show country on profile</span>
          {showCountry ? <Eye className={`size-4 ${muted}`} /> : <EyeOff className={`size-4 ${muted}`} />}
        </label>
      </div>
    </div>
  );

  const dmSend = async (gifUrl?: string) => {
    const text = dmInput.trim();
    const imageToSend = gifUrl || dmImagePreview || null;
    if (!text && !imageToSend) return;
    if (!dmActivePartner || !currentUser?.username || dmSending) return;
    const me = currentUser.username;
    const tempMsg: DmMessage = { id: `temp-${Date.now()}`, sender_username: me, recipient_username: dmActivePartner, text: text || '', image_url: imageToSend || undefined, read: false, created_at: new Date().toISOString() };
    setDmMessages(prev => [...prev, tempMsg]);
    setDmInput('');
    setDmImagePreview(null);
    setDmGifOpen(false);
    setDmGifSearch('');
    setDmGifResults([]);
    setDmSending(true);
    const { error } = await supabase.from('private_messages').insert({ sender_username: me, recipient_username: dmActivePartner, text: text || null, image_url: imageToSend, read: false });
    if (error) {
      setDmMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      setDmMessages(prev => [...prev, { ...tempMsg, id: `err-${Date.now()}`, sender_username: 'system', text: `Failed to send.` }]);
    } else {
      setDmConversations(prev => {
        const exists = prev.find(c => c.partner === dmActivePartner);
        const lastText = text || (imageToSend ? '📷 Image' : '');
        if (exists) return [{ ...exists, lastText, lastTime: new Date().toISOString() }, ...prev.filter(c => c.partner !== dmActivePartner)];
        return [{ partner: dmActivePartner!, profilePic: '', lastText, lastTime: new Date().toISOString(), unread: 0 }, ...prev];
      });
    }
    setDmSending(false);
  };

  const dmSearchGifs = async (q: string) => {
    if (!q.trim()) { setDmGifResults([]); return; }
    try {
      const res = await fetch(`${API}/giphy/search?q=${encodeURIComponent(q)}&limit=12&offset=0`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      setDmGifResults((data.data || []).map((r: any) => ({
        url: r.images?.original?.url || r.images?.fixed_height?.url || '',
        preview: r.images?.fixed_height?.url || r.images?.fixed_width_small?.url || '',
      })).filter((r: any) => r.url));
    } catch { setDmGifResults([]); }
  };

  function fmtDmTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const renderMessages = () => {
    if (!isOwn) return (
      <div className={`${card} p-8 text-center`}>
        <Mail className={`size-10 mx-auto mb-3 ${muted}`} />
        <p className={`text-sm ${muted}`}>Messages are private.</p>
      </div>
    );

    return (
      <div className={`${card} overflow-hidden flex flex-col flex-1 min-h-0`} style={{ minHeight: 480 }}>
        <div className="flex flex-1 min-h-0">
          {/* Conversation list */}
          <div
            className={`border-r ${dmActivePartner ? 'hidden md:flex' : 'flex'} flex-col min-h-0`}
            style={{ width: dmActivePartner ? 260 : '100%', minWidth: dmActivePartner ? 200 : undefined, maxWidth: dmActivePartner ? 260 : undefined, flexShrink: 0, borderColor: 'rgba(208,115,57,0.15)' }}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(208,115,57,0.15)' }}>
              <span className={`text-sm font-semibold ${textMain}`}>Messages</span>
              {dmLoading && <span className={`text-xs ${muted}`}>Loading…</span>}
            </div>
            <div className="flex-1 overflow-y-auto">
              {!dmLoading && dmConversations.length === 0 && (
                <div className="p-6 text-center">
                  <Mail className={`size-8 mx-auto mb-2 ${muted}`} />
                  <p className={`text-xs ${muted}`}>No conversations yet.</p>
                  <p className={`text-xs ${muted} mt-1`}>Send a message from someone{"'"}s profile to start a chat.</p>
                </div>
              )}
              {dmConversations.map(conv => (
                <button
                  key={conv.partner}
                  onClick={() => setDmActivePartner(conv.partner)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b transition-colors ${dmActivePartner === conv.partner ? 'bg-[rgba(208,115,57,0.1)]' : 'hover:bg-[rgba(208,115,57,0.05)]'}`}
                  style={{ borderColor: 'rgba(208,115,57,0.08)' }}
                >
                  <div className="w-9 h-9 rounded-full bg-[rgba(208,115,57,0.15)] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {conv.profilePic
                      ? <img src={conv.profilePic} alt="" className="w-full h-full object-cover" />
                      : <User className={`size-4 ${muted}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${textMain} truncate`}>{conv.partner}</span>
                      <span className={`text-[10px] ${muted} flex-shrink-0 ml-1`}>{fmtDmTime(conv.lastTime)}</span>
                    </div>
                    <p className={`text-xs ${muted} truncate`}>{conv.lastText}</p>
                  </div>
                  {conv.unread > 0 && (
                    <span className="min-w-[18px] h-[18px] bg-[#d07339] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                      {conv.unread > 9 ? '9+' : conv.unread}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Message thread */}
          {dmActivePartner && (
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              {/* Thread header */}
              <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: 'rgba(208,115,57,0.15)' }}>
                <button onClick={() => setDmActivePartner(null)} className={`md:hidden ${muted} hover:text-[#d07339] mr-1`}>
                  ←
                </button>
                <div className="w-8 h-8 rounded-full bg-[rgba(208,115,57,0.15)] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {dmConversations.find(c => c.partner === dmActivePartner)?.profilePic
                    ? <img src={dmConversations.find(c => c.partner === dmActivePartner)!.profilePic} alt="" className="w-full h-full object-cover" />
                    : <User className={`size-3.5 ${muted}`} />}
                </div>
                <Link to={`/users/${dmActivePartner}`} className={`text-sm font-semibold ${textMain} hover:text-[#d07339]`}>{dmActivePartner}</Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                {dmMessages.map(msg => {
                  const isMe = msg.sender_username === currentUser?.username;
                  const isSystem = msg.sender_username === 'system';
                  if (isSystem) return (
                    <div key={msg.id} className="text-center">
                      <span className={`text-xs ${muted} italic`}>{msg.text}</span>
                    </div>
                  );
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                        style={isMe
                          ? { background: '#d07339', color: 'white' }
                          : { background: 'rgba(208,115,57,0.12)', color: 'inherit' }}
                      >
                        {msg.image_url && (
                          <img src={msg.image_url} alt="attachment" className="max-w-full rounded-xl mb-1 max-h-48 object-contain" style={{ display: 'block' }} />
                        )}
                        {msg.text && <span>{msg.text}</span>}
                        <div className={`text-[9px] mt-0.5 ${isMe ? 'text-white/60' : muted} text-right`}>{fmtDmTime(msg.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={dmBottomRef} />
              </div>

              {/* GIF picker */}
              {dmGifOpen && (
                <div className="px-4 pb-2 border-t" style={{ borderColor: 'rgba(208,115,57,0.15)' }}>
                  <input
                    className={`w-full rounded-lg px-3 py-1.5 text-sm outline-none border mt-2 ${textMain}`}
                    style={{ background: 'rgba(208,115,57,0.07)', borderColor: 'rgba(208,115,57,0.2)' }}
                    placeholder="Search GIFs…"
                    value={dmGifSearch}
                    onChange={e => { setDmGifSearch(e.target.value); dmSearchGifs(e.target.value); }}
                    autoFocus
                  />
                  <div className="grid grid-cols-3 gap-1.5 mt-2 max-h-48 overflow-y-auto">
                    {dmGifResults.map((g, i) => (
                      <button key={i} onClick={() => dmSend(g.url)} className="rounded overflow-hidden hover:opacity-80 transition-opacity">
                        <img src={g.preview} alt="gif" className="w-full h-20 object-cover" />
                      </button>
                    ))}
                    {dmGifSearch && dmGifResults.length === 0 && <p className={`text-xs ${muted} col-span-3 text-center py-2`}>No GIFs found</p>}
                  </div>
                </div>
              )}

              {/* Image preview */}
              {dmImagePreview && (
                <div className="px-4 pb-1 flex items-center gap-2">
                  <img src={dmImagePreview} alt="preview" className="h-16 rounded-lg object-contain border border-[rgba(208,115,57,0.3)]" />
                  <button onClick={() => setDmImagePreview(null)} className="text-red-400 hover:text-red-600 text-xs">✕ Remove</button>
                </div>
              )}

              {/* Compose */}
              <input ref={dmFileRef} type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                const reader = new FileReader();
                reader.onload = ev => setDmImagePreview(ev.target?.result as string);
                reader.readAsDataURL(file);
              }} />
              <div className="px-4 py-3 border-t flex gap-2 items-center" style={{ borderColor: 'rgba(208,115,57,0.15)' }}>
                <button onClick={() => dmFileRef.current?.click()} title="Attach image" className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors hover:bg-[rgba(208,115,57,0.1)] ${muted}`} style={{ borderColor: 'rgba(208,115,57,0.2)' }}>
                  <Paperclip className="size-3.5" />
                </button>
                <button onClick={() => { setDmGifOpen(v => !v); setDmGifSearch(''); setDmGifResults([]); }} title="Send GIF" className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border text-xs font-bold transition-colors ${dmGifOpen ? 'bg-[rgba(208,115,57,0.15)]' : 'hover:bg-[rgba(208,115,57,0.1)]'} ${muted}`} style={{ borderColor: 'rgba(208,115,57,0.2)' }}>
                  GIF
                </button>
                <input
                  className={`flex-1 rounded-full px-4 py-2 text-sm outline-none border ${textMain}`}
                  style={{ background: 'rgba(208,115,57,0.07)', borderColor: 'rgba(208,115,57,0.2)' }}
                  placeholder={`Message ${dmActivePartner}…`}
                  value={dmInput}
                  onChange={e => setDmInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); dmSend(); } }}
                  disabled={dmSending}
                />
                <button
                  onClick={() => dmSend()}
                  disabled={(!dmInput.trim() && !dmImagePreview) || dmSending}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
                  style={{ background: '#d07339' }}
                >
                  <Send className="size-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const tabContent: Record<Tab, React.ReactNode> = {
    profile: renderProfile(),
    comments: renderComments(),
    ratings: renderRatings(),
    collections: renderCollections(),
    followers: renderFollowerList(followers, 'Followers'),
    following: renderFollowerList(following, 'Following'),
    privacy: isOwn ? renderPrivacy() : <p className={`text-sm ${muted}`}>Private</p>,
    messages: renderMessages(),
  };

  // ─── Other user full-page layout ───
  const renderOtherUserProfile = () => (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6">
      {/* Top section: banner bg + avatar + info */}
      <div className={`${card} overflow-hidden mb-5`}>
        <div className={`relative ${bannerUrl ? 'min-h-[170px] sm:min-h-[210px]' : ''}`}>
          {bannerUrl && (
            <>
              <img src={bannerUrl} alt="Profile banner" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/65" />
            </>
          )}
          <div className={`relative z-10 p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-5 items-center sm:items-start ${bannerUrl ? 'pt-10 sm:pt-16 pb-5' : 'pt-5'}`}>
            {/* Avatar */}
            <div className="flex flex-col items-center sm:items-start flex-shrink-0">
              <Avatar username={username!} picture={profilePic} size={96} />
            </div>

            {/* Name + role + online + country + followers + action buttons */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className={`text-2xl font-bold ${bannerUrl ? 'text-white drop-shadow-md' : textMain}`}>{username}</h1>
                {(() => {
                  const role = localStorage.getItem(`userRole_${username}`) || '';
                  if (!role || role === 'user') return null;
                  return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${role === 'admin' ? 'bg-purple-600 text-white' : 'bg-blue-500 text-white'}`}>{role === 'admin' ? 'Admin' : 'Mod'}</span>;
                })()}
                <span className={`text-xs font-medium flex items-center gap-0.5 ${bannerUrl ? 'text-white/80' : muted}`}>
                  <span className={isOnline ? 'text-green-400' : 'text-gray-400'}>●</span> {onlineStatus}
                </span>
              </div>
              {showCountry && country && (
                <div className={`flex items-center justify-center sm:justify-start gap-1.5 text-sm mt-1 ${bannerUrl ? 'text-white/90 drop-shadow' : muted}`}>
                  <FlagImg country={country} /> {countryDisplayName(country)}
                </div>
              )}
              {joinedDate && (
                <div className={`text-xs mt-1 ${bannerUrl ? 'text-white/70 drop-shadow' : muted}`}>Joined {fmtJoined(joinedDate)}</div>
              )}
              <div className={`flex items-center justify-center sm:justify-start gap-3 text-xs mt-1 ${bannerUrl ? 'text-white/80 drop-shadow' : muted} flex-wrap`}>
                <button onClick={() => setTab('followers')} className="hover:underline">{followers.length} followers</button>
                <button onClick={() => setTab('following')} className="hover:underline">{following.length} following</button>
              </div>
              {renderActionButtons()}
            </div>
          </div>
        </div>
        {/* Bio + stats below banner */}
        <div className="p-6 pt-4">
          {bio && <p className={`text-sm leading-relaxed ${textMain} mb-4`}>{bio}</p>}
          <div className="mt-2">
            <h3 className={`text-xs font-semibold ${muted} uppercase tracking-wide mb-3`}>Statistics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Ratings', value: ratedMovies.length, key: 'ratings' as const },
                { label: 'Comments', value: userComments.length, key: 'comments' as const },
                { label: 'Watched', value: watchedMovies.length, key: 'watched' as const },
                { label: 'Fav Genre', value: fav, key: null },
              ].map(s => (
                <div
                  key={s.label}
                  onClick={s.key ? () => setStatsPanel(statsPanel === s.key ? null : s.key!) : undefined}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${s.key ? `cursor-pointer ${statsPanel === s.key ? 'bg-[rgba(208,115,57,0.15)] dark:bg-[rgba(126,62,21,0.18)]' : 'bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.08)] hover:bg-[rgba(208,115,57,0.1)] dark:hover:bg-[rgba(126,62,21,0.12)]'}` : 'bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.08)]'}`}
                >
                  <span className={`text-base font-bold ${textMain} truncate max-w-full`}>{s.value}</span>
                  <span className={`text-xs ${muted}`}>{s.label}</span>
                </div>
              ))}
            </div>
            {statsPanel && (() => {
              const items = statsPanel === 'ratings'
                ? ratedMovies.map(m => ({ movie: m, extra: undefined as string | undefined }))
                : statsPanel === 'comments'
                  ? (userComments.map(c => { const m = allMovies.find(mv => Number(mv.id) === Number(c.movieId)); return m ? { movie: m, extra: c.text } : null; }).filter(Boolean) as { movie: Movie; extra: string }[])
                  : watchedMovies.map(m => ({ movie: m, extra: undefined as string | undefined }));
              const title = statsPanel === 'ratings' ? 'Rated Movies' : statsPanel === 'comments' ? 'Commented Movies' : 'Watched Movies';
              return (
                <div className="mt-3 pt-3 border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.1)]">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-semibold ${muted} uppercase tracking-wide`}>{title} ({items.length})</span>
                    <button onClick={() => setStatsPanel(null)} className={`text-xs ${muted} hover:text-red-500 transition-colors`}>✕ Close</button>
                  </div>
                  {items.length === 0 && <p className={`text-sm ${muted} py-2`}>Nothing here yet.</p>}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {items.map(({ movie: m, extra }, i) => (
                      <Link key={i} to={`/movie/${createSlug(m.title, m.year)}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[rgba(208,115,57,0.06)] dark:hover:bg-[rgba(126,62,21,0.08)] transition-colors group">
                        <div className="w-8 h-11 rounded flex-shrink-0 overflow-hidden bg-[rgba(208,115,57,0.1)]">
                          {m.image && <img src={m.image} alt={m.title} className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-medium truncate ${textMain} group-hover:text-[#d07339]`}>{m.title}</div>
                          <div className={`text-xs ${muted}`}>{m.year}{m.genre ? ` · ${m.genre.split(',')[0]}` : ''}</div>
                          {statsPanel === 'ratings' && m.userRating && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {[1,2,3,4,5].map(s => <Star key={s} className={`size-3 ${s <= (m.userRating||0) ? 'fill-[#d07339] text-[#d07339]' : 'text-[rgba(16,11,9,0.2)] dark:text-[rgba(247,241,237,0.15)]'}`} />)}
                            </div>
                          )}
                          {statsPanel === 'comments' && extra && (
                            <div className={`text-xs ${muted} truncate mt-0.5`}>"{extra}"</div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="space-y-5">
        {renderActivitySection()}
        {renderCollectionsPreview()}
        {renderProfileComments()}
      </div>
    </div>
  );

  // ─── Own profile layout with sidebar ───
  const renderOwnProfile = () => (
    <div className={`flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-6 ${tab === 'messages' ? 'flex flex-col min-h-0' : ''}`}>
      {/* Mobile hamburger */}
      <div className="flex md:hidden items-center gap-3 mb-4">
        <button onClick={() => setSidebarOpen(true)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgba(208,115,57,0.3)] text-sm ${textMain}`}>
          ☰ Menu
        </button>
        <span className={`text-sm font-semibold ${textMain}`}>{tab === 'profile' ? 'Profile' : navItems.find(n => n.id === tab)?.label}</span>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className={`relative w-72 max-w-[85vw] h-full ${isDarkMode ? 'bg-[#120d09]' : 'bg-[#fdfaf8]'} shadow-2xl overflow-y-auto flex flex-col`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(208,115,57,0.15)]">
              <div className="flex items-center gap-3">
                <Avatar username={username!} picture={profilePic} size={36} />
                <div>
                  <div className={`font-semibold text-sm ${textMain}`}>{username}</div>
                  {currentUser?.email && <div className={`text-xs ${muted} truncate max-w-[140px]`}>{currentUser.email}</div>}
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className={`${muted} hover:text-red-500`}>✕</button>
            </div>
            <div className="p-4 mb-2">
              <div className={`${card} p-4 mb-4`}>
                <h3 className={`text-xs font-semibold ${muted} uppercase tracking-wide mb-2`}>Find Users</h3>
                <div className="relative">
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by username..." className={`${inputCls} text-xs`} />
                </div>
                {userSearchResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {userSearchResults.map(u => (
                      <Link key={u.username} to={`/users/${u.username}`} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 p-1.5 rounded-lg hover:bg-[rgba(208,115,57,0.08)] no-underline ${textMain}`}>
                        <Avatar username={u.username} picture={u.pic} size={24} />
                        <span className="text-xs">{u.username}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <nav className={`${card} overflow-hidden`}>
                {navItems.map(item => (
                  <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-[rgba(208,115,57,0.08)] last:border-b-0 ${tab === item.id ? `bg-[rgba(208,115,57,0.1)] ${accent} font-medium` : `${textMain} hover:bg-[rgba(208,115,57,0.05)]`}`}>
                    {item.icon}<span className="flex-1 text-left">{item.label}</span>
                  </button>
                ))}
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <LogOut className="size-4" /><span>Log out</span>
                </button>
              </nav>
            </div>
          </aside>
        </div>
      )}

      <div className={`flex flex-col md:flex-row gap-6 ${tab === 'messages' ? 'flex-1 min-h-0' : ''}`}>

        {/* Desktop sidebar */}
        <aside className="hidden md:block md:w-60 flex-shrink-0">
          <div className={`${card} p-4 mb-4 flex items-center gap-3`}>
            <Avatar username={username!} picture={profilePic} size={40} />
            <div className="min-w-0">
              <div className={`font-semibold text-sm truncate ${textMain}`}>{username}</div>
              {isOwn && currentUser?.email && <div className={`text-xs ${muted} truncate`}>{currentUser.email}</div>}
            </div>
          </div>

          {/* Live User search */}
          <div className={`${card} p-4 mb-4`}>
            <h3 className={`text-xs font-semibold ${muted} uppercase tracking-wide mb-2`}>Find Users</h3>
            <div className="relative">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 ${muted}`} />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search by username..."
                className={`${inputCls} pl-8 text-xs`}
              />
            </div>
            {userSearchLoading && <p className={`text-xs ${muted} mt-1`}>Searching...</p>}
            {userSearchResults.length > 0 && (
              <div className="mt-2 space-y-1">
                {userSearchResults.map(u => (
                  <Link key={u.username} to={`/users/${u.username}`} className={`flex items-center gap-2 p-1.5 rounded-lg hover:bg-[rgba(208,115,57,0.08)] no-underline ${textMain}`}>
                    <Avatar username={u.username} picture={u.pic} size={24} />
                    <span className="text-xs">{u.username}</span>
                  </Link>
                ))}
              </div>
            )}
            {userSearch.trim() && userSearchResults.length === 0 && !userSearchLoading && (
              <p className={`text-xs ${muted} mt-2`}>No users found.</p>
            )}
          </div>

          {/* Nav */}
          <nav className={`${card} overflow-hidden`}>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-[rgba(208,115,57,0.08)] dark:border-[rgba(126,62,21,0.08)] last:border-b-0 ${
                  tab === item.id
                    ? `bg-[rgba(208,115,57,0.1)] dark:bg-[rgba(126,62,21,0.15)] ${accent} font-medium`
                    : `${textMain} hover:bg-[rgba(208,115,57,0.05)]`
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {tab === item.id && <ChevronRight className="size-3.5" />}
              </button>
            ))}
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <LogOut className="size-4" />
              <span>Log out</span>
            </button>
          </nav>
        </aside>

        {/* Main */}
        <main className={`flex-1 min-w-0 ${tab === 'messages' ? 'flex flex-col min-h-0' : ''}`}>
          {loading ? (
            <div className={`${card} p-8 text-center ${muted} text-sm`}>Loading...</div>
          ) : (
            tabContent[tab]
          )}
        </main>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex flex-col bg-[#fdfaf8] dark:bg-[#120d09] ${isDarkMode ? 'dark' : ''}`}>
      <SiteHeader currentUser={currentUser} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

      {/* Collection modal - shared */}
      <CollectionModal />

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${card} p-6 w-full max-w-sm`}>
            {reportSent ? (
              <div className="text-center py-4">
                <div className="text-2xl mb-2">✓</div>
                <p className={`text-sm font-medium ${textMain}`}>Report submitted</p>
                <p className={`text-xs ${muted} mt-1`}>Moderators have been notified.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-base font-semibold ${textMain} flex items-center gap-2`}><Flag className="size-4 text-red-500" /> Report {username}</h2>
                  <button onClick={() => { setShowReportModal(false); setReportReason(''); }} className={`${muted} hover:text-red-500`}><X className="size-4" /></button>
                </div>
                <p className={`text-xs ${muted} mb-3`}>Describe why you are reporting this user. Moderators will review your report.</p>
                <textarea
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  placeholder="e.g. Harassment, spam, inappropriate content..."
                  rows={3}
                  className={`${inputCls} resize-none text-sm mb-4`}
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowReportModal(false); setReportReason(''); }} className={btnGhost}>Cancel</button>
                  <button onClick={handleSendReport} disabled={!reportReason.trim()} className={`${btnPrimary} disabled:opacity-40 flex items-center gap-1.5`}>
                    <Flag className="size-3.5" /> Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-sm ${muted}`}>Loading profile...</div>
        </div>
      ) : isOwn ? renderOwnProfile() : renderOtherUserProfile()}

      <SiteFooter isDarkMode={isDarkMode} />
    </div>
  );
}

export default UserProfilePage;
