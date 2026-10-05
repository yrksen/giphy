import { useState, useEffect, useRef, useCallback } from 'react';
import { Star, X, Minus, Square, Maximize2 } from 'lucide-react';
import { Movie } from './MovieCard';
import { createSlug } from '../utils/slugify';
import { useNavigate } from 'react-router-dom';
import { fetchMovieFromIMDb } from './AddMovieDialog';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase, mapSupabaseUser } from '../utils/supabaseClient';
import { ChatPanel } from './LiveChat';
import { XPNotifBell, addNotification } from './Notifications';
import { saveXpIconPositions, loadXpIconPositions, saveReactions, loadReactions, loadXpBuiltinViews, saveXpBuiltinViews, loadXpSharedIcons, saveXpSharedIcons, SharedIcon, saveUserProfile, loadUserProfile, loadXpBuiltinOverrides, saveXpBuiltinOverrides, BuiltinOverride, saveProfileComments, loadProfileComments } from '../utils/socialDB';

interface XPComment {
  id: string | number;
  movieId: number;
  username: string;
  text: string;
  timestamp: number;
  userId?: string;
  profilePicture?: string;
}

const logoImage   = 'https://i.imgur.com/vUiVqow.png?direct';
const WALLPAPER   = 'https://i.imgur.com/aLNDcoa.jpeg';
const XP_FONT     = '"Tahoma", "MS Sans Serif", Arial, sans-serif';

const ICON_COMPUTER   = 'https://i.imgur.com/gSJpiOC.png';
const ICON_EXPLORER   = 'https://i.imgur.com/gkxGH68.png';
const ICON_FOLDER     = 'https://i.imgur.com/QepKiF5.png';
const ICON_TRASH      = 'https://i.imgur.com/t89uyTc.png';
const ICON_SSD        = 'https://i.imgur.com/XIdd2qF.png';
const ICON_SEARCH     = 'https://i.imgur.com/htrTE97.png';
const ICON_FLOPPY     = 'https://i.imgur.com/qOjG3yB.png';
const ICON_HUMAN      = 'https://i.imgur.com/Wq2Ndko.png';
const ICON_ASSISTANT  = 'https://i.imgur.com/shzsI6U.png';
const ICON_MILK       = 'https://i.imgur.com/oVdvL1C.png';
const ICON_COD_MW     = 'https://i.imgur.com/w5pukLj.png';
const ICON_COD_WAW    = 'https://i.imgur.com/SsT8sgx.png';
const ICON_STARGATE   = 'https://i.imgur.com/cvExi0Q.png';
const ICON_STARGATE2  = 'https://i.imgur.com/YG4bhHm.png';

// Desktop icon grid constants
const ICON_CELL_W  = 86;
const ICON_CELL_H  = 88;
const ICON_GRID_X  = 12;
const ICON_GRID_Y  = 12;
const ICON_MAX_ROWS = 8;

const snapIconToGrid = (x: number, y: number) => ({
  x: ICON_GRID_X + Math.max(0, Math.round((x - ICON_GRID_X) / ICON_CELL_W)) * ICON_CELL_W,
  y: ICON_GRID_Y + Math.max(0, Math.round((y - ICON_GRID_Y) / ICON_CELL_H)) * ICON_CELL_H,
});

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const TASKBAR_H   = 40;
const TAB_BAR_H   = 46;

function wmoEmoji(code: number) {
  if (code === 0) return '☀️';
  if (code <= 3)  return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

// ── Types ────────────────────────────────────────────────────────────────────

interface XPLibFilters {
  sortBy: 'newest' | 'oldest' | 'titleAsc' | 'titleDesc' | 'ratingHigh' | 'ratingLow';
  genres: string[];
  showMovies: boolean;
  showTv: boolean;
  runtime: 'all' | 'short' | 'medium' | 'long';
  minRating: number;
}

const DEFAULT_LIB_FILTERS: XPLibFilters = {
  sortBy: 'newest',
  genres: [],
  showMovies: true,
  showTv: true,
  runtime: 'all',
  minRating: 0,
};

interface XPWin {
  id: string;
  type: 'library' | 'watchlist' | 'detail' | 'tickets' | 'search' | 'assistant' | 'login' | 'profile' | 'chat' | 'privacy' | 'terms';
  title: string;
  x: number; y: number; w: number; h: number; z: number;
  minimized: boolean;
  maximized: boolean;
  prevX: number; prevY: number; prevW: number; prevH: number;
  movie?: Movie;
  profileUsername?: string;
}

interface XPDesktopProps {
  movies: Movie[];
  toWatchMovies: Movie[];
  onExit: () => void;
  onAddMovie?: (movie: Movie) => void;
  onMarkWatched?: (movie: Movie) => void;
  onUpdateRating?: (movieId: number, rating: number) => void;
  comments?: XPComment[];
  onAddComment?: (movieId: number, text: string) => void;
  onDeleteComment?: (movieId: number, commentId: string) => void;
  currentUser?: any;
  setCurrentUser?: (u: any) => void;
}

// ── Main component ───────────────────────────────────────────────────────────

export function XPDesktop({ movies, toWatchMovies, onExit, onAddMovie, onMarkWatched, onUpdateRating, comments, onAddComment, onDeleteComment, currentUser, setCurrentUser }: XPDesktopProps) {
  const navigate = useNavigate();
  const [wins, setWins]             = useState<XPWin[]>([]);
  const [topZ, setTopZ]             = useState(10);
  const [sleeping, setSleeping]     = useState(false);
  const [clock, setClock]           = useState(new Date());
  const [showCal, setShowCal]       = useState(false);
  const [weather, setWeather]       = useState<{ temp: string; icon: string; city: string } | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [showTaskDrop, setShowTaskDrop] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [isMobile, setIsMobile]         = useState(() => window.innerWidth < 900);
  const [battery, setBattery]           = useState<{ level: number; charging: boolean } | null>(null);
  const [isOnline, setIsOnline]         = useState(navigator.onLine);
  const [netType, setNetType]           = useState<string>(() => { try { return (navigator as any).connection?.type || 'unknown'; } catch { return 'unknown'; } });
  const [volume, setVolume]             = useState<number>(75);
  const [showVolume, setShowVolume]     = useState(false);
  const [kbLang, setKbLang]            = useState(() => {
    try { return ((navigator.languages?.[0] || navigator.language || 'EN')).split('-')[0].toUpperCase().slice(0, 3); } catch { return 'EN'; }
  });
  const dragRef      = useRef<{ id: string; ox: number; oy: number; wx: number; wy: number } | null>(null);
  const resizeRef    = useRef<{ id: string; ox: number; oy: number; ow: number; oh: number } | null>(null);
  const iconDragRef  = useRef<{ key: string; ox: number; oy: number; ix: number; iy: number; moved: boolean } | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const dragRef2 = useRef<{ key: string; sourceType: 'grid'|'dock'; sourceIdx: number; floatEl: HTMLElement | null; startX: number; startY: number } | null>(null);

  const defaultIconPos = (index: number) => ({
    x: ICON_GRID_X + Math.floor(index / ICON_MAX_ROWS) * ICON_CELL_W,
    y: ICON_GRID_Y + (index % ICON_MAX_ROWS) * ICON_CELL_H,
  });
  const [iconPos, setIconPos] = useState<Record<string, { x: number; y: number }>>(() => {
    try {
      const saved = localStorage.getItem('xp-icon-pos');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Right-click context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [showAddIconDialog, setShowAddIconDialog] = useState(false);
  const [newIconLabel, setNewIconLabel] = useState('');
  const [newIconUrl, setNewIconUrl] = useState('');
  const [newIconLink, setNewIconLink] = useState('');
  const [newIconDesc, setNewIconDesc] = useState('');
  // Shared icons visible to all users (replaces per-user custom icons)
  const [sharedIcons, setSharedIcons] = useState<SharedIcon[]>([]);
  // Admin/mod overrides for built-in icon names/images
  const [builtinOverrides, setBuiltinOverrides] = useState<Record<string, BuiltinOverride>>({});
  const [showSharedIconDialog, setShowSharedIconDialog] = useState(false);
  const [editingSharedIcon, setEditingSharedIcon] = useState<SharedIcon | null>(null);
  const [sharedIconLabel, setSharedIconLabel] = useState('');
  const [sharedIconUrl, setSharedIconUrl] = useState('');
  const [sharedIconLink, setSharedIconLink] = useState('');
  const [sharedIconDesc, setSharedIconDesc] = useState('');
  const sharedIconFileRef = useRef<HTMLInputElement>(null);
  const newIconFileRef = useRef<HTMLInputElement>(null);
  const [newIconUploading, setNewIconUploading] = useState(false);
  // Mobile home screen state
  const [mobileHiddenIcons, setMobileHiddenIcons] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('xp-mobile-hidden') || '[]'); } catch { return []; }
  });
  const [mobileIconOrder, setMobileIconOrder] = useState<string[]>(() => {
    try { const s = JSON.parse(localStorage.getItem('xp-mobile-order') || '[]'); return Array.isArray(s) && s.length ? s : []; } catch { return []; }
  });
  const [mobileDockOrder, setMobileDockOrder] = useState<string[]>(() => {
    try { const s = JSON.parse(localStorage.getItem('xp-mobile-dock') || '[]'); return Array.isArray(s) && s.length ? s : ['library', 'watchlist', 'exit', 'random']; } catch { return ['library', 'watchlist', 'exit', 'random']; }
  });
  const [mobileEditMode, setMobileEditMode] = useState(false);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  // Mobile wallpaper — per logged-in user, persisted in KV + localStorage
  const mobileWallpaperKV = currentUser?.username ? `mobileWallpaper:${currentUser.username}` : null;
  const [mobileWallpaper, setMobileWallpaper] = useState<string>(() => {
    if (!currentUser?.username) return WALLPAPER;
    return localStorage.getItem(`mobileWallpaper_${currentUser.username}`) || WALLPAPER;
  });
  const [wallpaperLoading, setWallpaperLoading] = useState(false);
  const mobileWallpaperFileRef = useRef<HTMLInputElement>(null);
  const [dragOverIdx, setDragOverIdx] = useState<{ type: 'grid'|'dock'; idx: number } | null>(null);
  const [selectedMobileKey, setSelectedMobileKey] = useState<string | null>(null);

  // Per-icon right-click context menu
  const [iconCtxMenu, setIconCtxMenu] = useState<{ x: number; y: number; iconId: string; isBuiltIn?: boolean; isShared?: boolean } | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  // Properties dialog
  type AnyIconData = { id: string; label: string; iconUrl: string; addedBy: string; description?: string; createdAt?: string; views?: number; linkUrl?: string; isSystem?: boolean; };
  const [propsIcon, setPropsIcon] = useState<AnyIconData | null>(null);

  const uploadIconImage = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `icons/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
        return urlData.publicUrl;
      }
    } catch {}
    // Fallback: base64 for small files
    if (file.size <= 512 * 1024) {
      return new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target?.result as string ?? null);
        reader.onerror = () => res(null);
        reader.readAsDataURL(file);
      });
    }
    return null;
  };

  const addCustomIcon = () => {
    if (!newIconUrl.trim() || !newIconLabel.trim()) return;
    if (!currentUser) return;
    const icon: SharedIcon = { id: `custom-${Date.now()}`, label: newIconLabel.trim(), iconUrl: newIconUrl.trim(), linkUrl: newIconLink.trim() || undefined, addedBy: currentUser.username, description: newIconDesc.trim() || undefined, createdAt: new Date().toISOString() };
    saveSharedIcons([...sharedIcons, icon]);
    setNewIconLabel(''); setNewIconUrl(''); setNewIconLink(''); setNewIconDesc('');
    setShowAddIconDialog(false);
  };

  const removeCustomIcon = (id: string) => {
    const icon = sharedIcons.find(i => i.id === id);
    if (!icon) return;
    if (canModIcons || icon.addedBy === currentUser?.username) {
      saveSharedIcons(sharedIcons.filter(i => i.id !== id));
    }
  };

  const canModIcons = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const saveSharedIcons = (icons: SharedIcon[]) => {
    setSharedIcons(icons);
    saveXpSharedIcons(icons).catch(() => {});
  };

  const saveBuiltinOverrides = (overrides: Record<string, BuiltinOverride>) => {
    setBuiltinOverrides(overrides);
    saveXpBuiltinOverrides(overrides).catch(() => {});
  };

  const openEditSharedIcon = (icon: SharedIcon) => {
    setEditingSharedIcon(icon);
    setSharedIconLabel(icon.label);
    setSharedIconUrl(icon.iconUrl);
    setSharedIconLink(icon.linkUrl || '');
    setSharedIconDesc(icon.description || '');
    setShowSharedIconDialog(true);
  };

  const openEditBuiltinIcon = (key: string, label: string, iconUrl: string) => {
    // Re-use shared icon dialog with a sentinel editingSharedIcon id = `builtin:${key}`
    setEditingSharedIcon({ id: `builtin:${key}`, label, iconUrl, addedBy: 'System', createdAt: '' });
    setSharedIconLabel(builtinOverrides[key]?.label ?? label);
    setSharedIconUrl(builtinOverrides[key]?.iconUrl ?? iconUrl);
    setSharedIconLink(''); setSharedIconDesc('');
    setShowSharedIconDialog(true);
  };

  const saveSharedIconForm = () => {
    if (!sharedIconLabel.trim() || !sharedIconUrl.trim()) return;
    if (editingSharedIcon) {
      if (editingSharedIcon.id.startsWith('builtin:')) {
        const key = editingSharedIcon.id.replace('builtin:', '');
        saveBuiltinOverrides({ ...builtinOverrides, [key]: { label: sharedIconLabel.trim(), iconUrl: sharedIconUrl.trim() } });
      } else {
        saveSharedIcons(sharedIcons.map(i => i.id === editingSharedIcon.id ? { ...i, label: sharedIconLabel.trim(), iconUrl: sharedIconUrl.trim(), linkUrl: sharedIconLink.trim() || undefined, description: sharedIconDesc.trim() || undefined } : i));
      }
    } else {
      const icon: SharedIcon = { id: `custom-${Date.now()}`, label: sharedIconLabel.trim(), iconUrl: sharedIconUrl.trim(), linkUrl: sharedIconLink.trim() || undefined, description: sharedIconDesc.trim() || undefined, addedBy: currentUser?.username || '', createdAt: new Date().toISOString() };
      saveSharedIcons([...sharedIcons, icon]);
    }
    setShowSharedIconDialog(false);
  };

  const deleteSharedIcon = (id: string) => {
    saveSharedIcons(sharedIcons.filter(i => i.id !== id));
  };

  const getBuiltInViews = (key: string): number => {
    try { const v = JSON.parse(localStorage.getItem('xp-builtin-views') || '{}'); return v[key] || 0; } catch { return 0; }
  };
  const incrementBuiltInViews = (key: string) => {
    try {
      const v = JSON.parse(localStorage.getItem('xp-builtin-views') || '{}');
      v[key] = (v[key] || 0) + 1;
      localStorage.setItem('xp-builtin-views', JSON.stringify(v));
      if (currentUser?.id) saveXpBuiltinViews(currentUser.id, v).catch(() => {});
    } catch {}
  };

  const formatRelativeDate = (iso?: string) => {
    if (!iso) return 'Unknown';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  };

  const saveMobileHiddenIcons = async (hidden: string[]) => {
    setMobileHiddenIcons(hidden);
    localStorage.setItem('xp-mobile-hidden', JSON.stringify(hidden));
    if (currentUser) {
      try {
        const meta = currentUser.user_metadata || {};
        await supabase.auth.updateUser({ data: { ...meta, mobile_hidden_icons: hidden } });
      } catch {}
    }
  };

  const saveMobileLayout = async (iconOrder: string[], dockOrder: string[]) => {
    localStorage.setItem('xp-mobile-order', JSON.stringify(iconOrder));
    localStorage.setItem('xp-mobile-dock', JSON.stringify(dockOrder));
    if (currentUser) {
      try {
        await supabase.auth.updateUser({ data: { ...(currentUser.user_metadata || {}), mobile_icon_order: iconOrder, mobile_dock_order: dockOrder } });
      } catch {}
    }
  };

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const nav = navigator as any;
    if (nav.getBattery) {
      nav.getBattery().then((b: any) => {
        setBattery({ level: b.level, charging: b.charging });
        b.addEventListener('levelchange', () => setBattery({ level: b.level, charging: b.charging }));
        b.addEventListener('chargingchange', () => setBattery({ level: b.level, charging: b.charging }));
      });
    }
    const goOnline  = () => { setIsOnline(true); try { setNetType((navigator as any).connection?.type || 'unknown'); } catch {} };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    try {
      const conn = (navigator as any).connection;
      if (conn) { const onChange = () => setNetType(conn.type || 'unknown'); conn.addEventListener('change', onChange); }
    } catch {}
    // Keyboard language via input event
    const onInput = () => {
      try { setKbLang(((navigator.languages?.[0] || navigator.language || 'EN')).split('-')[0].toUpperCase().slice(0, 3)); } catch {}
    };
    window.addEventListener('languagechange', onInput);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('languagechange', onInput);
    };
  }, []);

  // Load shared icons for ALL visitors (including guests) and subscribe to live updates
  useEffect(() => {
    loadXpSharedIcons().then(icons => setSharedIcons(icons)).catch(() => {});
    loadXpBuiltinOverrides().then(ov => setBuiltinOverrides(ov)).catch(() => {});
    // Real-time subscription: reload shared icons when any user saves them
    const ch = supabase
      .channel('xp-shared-icons')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kv_store_ea58c774', filter: 'key=eq.xp_shared_icons' }, () => {
        loadXpSharedIcons().then(icons => setSharedIcons(icons)).catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Load mobile layout + icon positions from Supabase on login
  useEffect(() => {
    if (!currentUser) return;
    const meta = currentUser.user_metadata || {};
    const savedHidden = meta.mobile_hidden_icons;
    if (Array.isArray(savedHidden)) {
      setMobileHiddenIcons(savedHidden);
      localStorage.setItem('xp-mobile-hidden', JSON.stringify(savedHidden));
    }
    if (Array.isArray(meta.mobile_icon_order) && meta.mobile_icon_order.length) {
      setMobileIconOrder(meta.mobile_icon_order);
    }
    if (Array.isArray(meta.mobile_dock_order) && meta.mobile_dock_order.length) {
      setMobileDockOrder(meta.mobile_dock_order);
    }
    // Load icon positions and built-in view counts from socialDB
    if (currentUser.id) {
      loadXpIconPositions(currentUser.id).then(pos => { if (Object.keys(pos).length) setIconPos(pos); }).catch(() => {});
      loadXpBuiltinViews(currentUser.id).then(views => {
        if (Object.keys(views).length) {
          try { localStorage.setItem('xp-builtin-views', JSON.stringify(views)); } catch {}
        }
      }).catch(() => {});
    }
    // Load mobile wallpaper from KV for this user
    if (currentUser.username) {
      supabase.from('kv_store_ea58c774').select('value').eq('key', `mobileWallpaper:${currentUser.username}`).maybeSingle()
        .then(({ data }) => {
          if (data?.value && typeof data.value === 'string') {
            setMobileWallpaper(data.value);
            localStorage.setItem(`mobileWallpaper_${currentUser.username}`, data.value);
          }
        }).catch(() => {});
    }
  }, [currentUser?.username]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const [wRes, gRes] = await Promise.all([
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code`),
          fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`),
        ]);
        const w = await wRes.json();
        const g = await gRes.json();
        setWeather({
          temp: `${Math.round(w.current.temperature_2m)}°C`,
          icon: wmoEmoji(w.current.weather_code),
          city: g.address?.city || g.address?.town || g.address?.village || '',
        });
      } catch {}
    });
  }, []);

  const today   = clock;
  const yr      = today.getFullYear();
  const mo      = today.getMonth();
  const firstDow   = new Date(yr, mo, 1).getDay();
  const daysInMo   = new Date(yr, mo + 1, 0).getDate();
  const calCells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];

  const taskResults = taskSearch.length > 0
    ? [...movies, ...toWatchMovies].filter(m => m.title.toLowerCase().includes(taskSearch.toLowerCase())).slice(0, 7)
    : [];

  const bringToFront = useCallback((id: string) => {
    setTopZ(z => {
      const next = z + 1;
      setWins(ws => ws.map(w => w.id === id ? { ...w, z: next } : w));
      return next;
    });
  }, []);

  const openWin = useCallback((type: XPWin['type'], movie?: Movie) => {
    if (type !== 'detail') {
      const existing = wins.find(w => w.type === type);
      if (existing) {
        bringToFront(existing.id);
        setWins(ws => ws.map(w => w.id === existing.id ? { ...w, minimized: false } : w));
        return;
      }
    }
    const id    = `${type}-${Date.now()}`;
    const vw    = window.innerWidth;
    const vh    = window.innerHeight - TASKBAR_H;
    const small = vw < 900;
    const winW  = small ? vw          : Math.min(vw - 80, type === 'detail' || type === 'tickets' ? 720 : type === 'search' ? 640 : type === 'login' ? 400 : type === 'profile' ? 820 : 940);
    const winH  = small ? vh          : Math.min(vh - 60, type === 'detail' || type === 'tickets' ? 520 : type === 'search' ? 420 : type === 'login' ? 380 : type === 'profile' ? 620 : 600);
    const x     = small ? 0           : 60 + Math.random() * Math.max(0, vw - winW - 80);
    const y     = small ? 0           : 24 + Math.random() * Math.max(0, vh - winH - 60);
    const labels: Record<XPWin['type'], string> = { library: 'Library', watchlist: 'Watchlist', detail: movie?.title ?? 'Movie', tickets: 'My Tickets', search: 'Search - Command Prompt', assistant: 'assistant.exe', login: 'Human.exe', profile: 'User Profile', chat: 'Live Chat', privacy: 'Privacy Policy', terms: 'Terms of Service' };
    setTopZ(z => {
      const next = z + 1;
      setWins(ws => [...ws, {
        id, type, title: labels[type],
        x, y, w: winW, h: winH, z: next,
        minimized: false, maximized: small,
        prevX: x, prevY: y, prevW: winW, prevH: winH,
        movie,
      }]);
      return next;
    });
  }, [wins, bringToFront]);

  const closeWin    = (id: string) => setWins(ws => ws.filter(w => w.id !== id));
  const minimizeWin = (id: string) => setWins(ws => ws.map(w => w.id === id ? { ...w, minimized: true } : w));
  const restoreWin  = (id: string) => { bringToFront(id); setWins(ws => ws.map(w => w.id === id ? { ...w, minimized: false } : w)); };

  const toggleMaximize = (id: string) => {
    setWins(ws => ws.map(w => {
      if (w.id !== id) return w;
      if (w.maximized) {
        return { ...w, maximized: false, x: w.prevX, y: w.prevY, w: w.prevW, h: w.prevH };
      }
      return { ...w, maximized: true, prevX: w.x, prevY: w.y, prevW: w.w, prevH: w.h };
    }));
  };

  const startDrag = (id: string, e: React.MouseEvent, win: XPWin) => {
    if (win.maximized) return;
    e.preventDefault();
    bringToFront(id);
    dragRef.current = { id, ox: e.clientX, oy: e.clientY, wx: win.x, wy: win.y };
  };

  const startResize = (id: string, e: React.MouseEvent, win: XPWin) => {
    if (win.maximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { id, ox: e.clientX, oy: e.clientY, ow: win.w, oh: win.h };
  };

  const startIconDrag = (key: string, e: React.MouseEvent, ix: number, iy: number) => {
    e.preventDefault();
    iconDragRef.current = { key, ox: e.clientX, oy: e.clientY, ix, iy, moved: false };
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const { id, ox, oy, wx, wy } = dragRef.current;
      setWins(ws => ws.map(w => w.id === id
        ? { ...w, x: Math.max(0, wx + e.clientX - ox), y: Math.max(0, wy + e.clientY - oy) }
        : w));
    }
    if (resizeRef.current) {
      const { id, ox, oy, ow, oh } = resizeRef.current;
      const newW = Math.max(300, ow + e.clientX - ox);
      const newH = Math.max(200, oh + e.clientY - oy);
      setWins(ws => ws.map(w => w.id === id ? { ...w, w: newW, h: newH } : w));
    }
    if (iconDragRef.current) {
      const { key, ox, oy, ix, iy } = iconDragRef.current;
      const dx = e.clientX - ox, dy = e.clientY - oy;
      if (!iconDragRef.current.moved && Math.sqrt(dx * dx + dy * dy) > 5) {
        iconDragRef.current.moved = true;
      }
      if (iconDragRef.current.moved) {
        setIconPos(prev => ({ ...prev, [key]: { x: Math.max(0, ix + dx), y: Math.max(0, iy + dy) } }));
      }
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
    if (iconDragRef.current?.moved) {
      const key = iconDragRef.current.key;
      setIconPos(prev => {
        const cur = prev[key];
        if (!cur) return prev;
        const snapped = snapIconToGrid(cur.x, cur.y);
        const next = { ...prev, [key]: snapped };
        try { localStorage.setItem('xp-icon-pos', JSON.stringify(next)); } catch {}
        if (currentUser?.id) saveXpIconPositions(currentUser.id, next).catch(() => {});
        return next;
      });
    }
    iconDragRef.current = null;
  }, []);

  const startTouchDrag = (id: string, e: React.TouchEvent, win: XPWin) => {
    if (win.maximized) return;
    const t = e.touches[0];
    bringToFront(id);
    dragRef.current = { id, ox: t.clientX, oy: t.clientY, wx: win.x, wy: win.y };
  };
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const t = e.touches[0];
    const { id, ox, oy, wx, wy } = dragRef.current;
    setWins(ws => ws.map(w => w.id === id
      ? { ...w, x: Math.max(0, wx + t.clientX - ox), y: Math.max(0, wy + t.clientY - oy) }
      : w));
  }, []);
  const onTouchEnd = useCallback(() => { dragRef.current = null; }, []);

  const randomMovie = () => {
    const pool = [...movies, ...toWatchMovies];
    const m = pool[Math.floor(Math.random() * pool.length)];
    if (m) openWin('detail', m);
  };

  const desktopIcons = [
    { key: 'library',   label: 'Library',             icon: ICON_SSD,       description: 'Browse the full movie library.', action: () => openWin('library') },
    { key: 'watchlist', label: 'Watchlist',            icon: ICON_EXPLORER,  description: 'Movies you want to watch next.', action: () => openWin('watchlist') },
    { key: 'assistant', label: 'assistant.exe',        icon: ICON_ASSISTANT, description: 'AI movie assistant.', action: () => openWin('assistant') },
    { key: 'random',    label: 'Random Movie',         icon: ICON_FOLDER,    description: 'Opens a random movie from the library.', action: randomMovie },
    { key: 'tickets',   label: 'My Tickets',           icon: ICON_TRASH,     description: 'Generate and view cinema-style tickets.', action: () => openWin('tickets') },
    { key: 'exit',      label: 'My Computer',          icon: ICON_COMPUTER,  description: 'Return to normal website mode.', action: onExit },
    { key: 'floppy',    label: 'Floppy disk',          icon: ICON_FLOPPY,    description: 'A classic floppy disk. Purely decorative.', action: () => {} },
    { key: 'myprofile', label: 'My Profile',           icon: ICON_HUMAN,     description: 'View and edit your user profile.', action: () => { if (currentUser) { setTopZ(z => { const next = z+1; const vw2 = window.innerWidth; const vh2 = window.innerHeight - TASKBAR_H; setWins(ws => [...ws, { id: `profile-${Date.now()}`, type: 'profile', title: `${currentUser.username} - Profile`, x: 80, y: 30, w: Math.min(820, vw2-80), h: Math.min(620, vh2-60), z: next, minimized: false, maximized: false, prevX: 80, prevY: 30, prevW: 820, prevH: 620, profileUsername: currentUser.username }]); return next; }); } else { openWin('login'); } } },
    { key: 'chat',      label: 'Live Chat',            icon: ICON_ASSISTANT, description: 'Join the community live chat.', action: () => openWin('chat') },
    { key: 'milk',      label: 'milk.exe',             icon: ICON_MILK,      description: 'Got milk? A mysterious executable.', action: () => {} },
    { key: 'cod_mw',    label: 'Call of Duty:\nMW.exe', icon: ICON_COD_MW,  description: 'Call of Duty Modern Warfare shortcut.', action: () => {} },
    { key: 'cod_waw',   label: 'Call of Duty:\nWaW.exe', icon: ICON_COD_WAW, description: 'Call of Duty World at War shortcut.', action: () => {} },
    { key: 'stargate',  label: 'Policy.exe',            icon: ICON_STARGATE,  description: 'Privacy Policy document.', action: () => openWin('privacy') },
    { key: 'stargate2', label: 'Terms of Service.exe', icon: ICON_STARGATE2, description: 'Terms of Service document.', action: () => openWin('terms') },
  ].map(ic => ({
    ...ic,
    label: builtinOverrides[ic.key]?.label ?? ic.label,
    icon: builtinOverrides[ic.key]?.iconUrl ?? ic.icon,
  }));

  const mobileDockIcons = [
    { key: 'library',   label: 'Library',      icon: ICON_SSD,      action: () => openWin('library') },
    { key: 'watchlist', label: 'Watchlist',     icon: ICON_EXPLORER, action: () => openWin('watchlist') },
    { key: 'exit',      label: 'My Computer',   icon: ICON_COMPUTER, action: onExit },
    { key: 'random',    label: 'Random',        icon: ICON_FOLDER,   action: randomMovie },
  ];

  const mobileHomeIcons = [
    { key: 'search',  label: 'Search',      icon: ICON_SEARCH, action: () => openWin('search') },
    { key: 'tickets', label: 'My Tickets',  icon: ICON_TRASH,  action: () => openWin('tickets') },
    { key: 'myprofile', label: 'My Profile', icon: ICON_HUMAN, action: () => { if (currentUser) { setTopZ(z => { const next = z+1; const vw2 = window.innerWidth; const vh2 = window.innerHeight - TASKBAR_H; setWins(ws => [...ws, { id: `profile-${Date.now()}`, type: 'profile', title: `${currentUser.username} - Profile`, x: 0, y: 0, w: vw2, h: vh2, z: next, minimized: false, maximized: true, prevX: 0, prevY: 0, prevW: vw2, prevH: vh2, profileUsername: currentUser.username }]); return next; }); } else { openWin('login'); } } },
  ];

  const clockStr = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr  = clock.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{ zIndex: 300, fontFamily: XP_FONT, cursor: dragRef.current ? 'grabbing' : 'default' }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <style>{`
        .xp-scroll::-webkit-scrollbar { width: 16px; }
        .xp-scroll::-webkit-scrollbar-track { background: #d4d0c8; border-left: 1px solid #808080; }
        .xp-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #f4f2ef 0%, #d8d4cc 40%, #c8c4bc 100%);
          border: 1px solid #808080;
          box-shadow: inset 1px 1px 0 #fff, inset -1px -1px 0 #888;
          min-height: 20px;
        }
        .xp-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #e8e5e0 0%, #c8c4bc 40%, #b8b4ac 100%);
        }
        .xp-scroll::-webkit-scrollbar-button {
          height: 16px; width: 16px;
          background: linear-gradient(180deg, #f4f2ef 0%, #d0ccc4 100%);
          border: 1px solid #808080;
          box-shadow: inset 1px 1px 0 #fff, inset -1px -1px 0 #888;
        }
        .xp-scroll::-webkit-scrollbar-button:vertical:start:decrement {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M8 5l4 6H4z' fill='%23000'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: center;
        }
        .xp-scroll::-webkit-scrollbar-button:vertical:end:increment {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M8 11l4-6H4z' fill='%23000'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: center;
        }
        .xp-scroll::-webkit-scrollbar-button:vertical:start:increment,
        .xp-scroll::-webkit-scrollbar-button:vertical:end:decrement { display: none; }

        /* XP trackbar slider */
        .xp-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 22px; background: transparent; cursor: pointer; margin: 0; padding: 0; }
        .xp-slider::-webkit-slider-runnable-track {
          height: 4px;
          background: #c0bdb8;
          border-top: 1px solid #808080; border-left: 1px solid #808080;
          border-bottom: 1px solid #ffffff; border-right: 1px solid #ffffff;
        }
        .xp-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 11px; height: 21px;
          margin-top: -9px;
          background: linear-gradient(180deg, #f4f2ef 0%, #e0dcd4 50%, #d0ccc4 100%);
          border-top: 1px solid #ffffff; border-left: 1px solid #ffffff;
          border-bottom: 1px solid #808080; border-right: 1px solid #808080;
          box-shadow: inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #a8a49c;
          cursor: pointer;
        }
        .xp-slider::-moz-range-track {
          height: 4px;
          background: #c0bdb8;
          border-top: 1px solid #808080; border-left: 1px solid #808080;
          border-bottom: 1px solid #ffffff; border-right: 1px solid #ffffff;
        }
        .xp-slider::-moz-range-thumb {
          width: 11px; height: 21px;
          background: linear-gradient(180deg, #f4f2ef 0%, #e0dcd4 50%, #d0ccc4 100%);
          border-top: 1px solid #ffffff; border-left: 1px solid #ffffff;
          border-bottom: 1px solid #808080; border-right: 1px solid #808080;
          box-shadow: inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #a8a49c;
          border-radius: 0;
          cursor: pointer;
        }
      `}</style>
      {/* Wallpaper */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url(${isMobile ? mobileWallpaper : WALLPAPER})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        onClick={() => { setSelectedIcon(null); setShowCal(false); setCtxMenu(null); setIconCtxMenu(null); setPropsIcon(null); }}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); setSelectedIcon(null); }}
      />

      {/* Sleep screen */}
      {sleeping && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black cursor-pointer"
          style={{ zIndex: 500 }}
          onClick={() => setSleeping(false)}
        >
          <img src={logoImage} alt="logo" className="w-20 h-20 opacity-50"
            style={{ animation: 'spin 5s linear infinite' }} />
          <p className="mt-8 text-white/40 text-3xl tracking-[0.3em]" style={{ fontFamily: XP_FONT }}>Zzz...</p>
          <p className="mt-3 text-white/25 text-xs tracking-widest" style={{ fontFamily: XP_FONT }}>Click anywhere to wake up</p>
        </div>
      )}

      {/* Desktop icons — draggable (desktop only) */}
      {!isMobile && desktopIcons.map((icon, idx) => {
        const pos = iconPos[icon.key] ?? defaultIconPos(idx);
        return (
          <div key={icon.key} className="absolute" style={{ left: pos.x, top: pos.y, zIndex: 10 }}
            onMouseEnter={e => setHoverTooltip({ x: e.clientX, y: e.clientY, content: (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{icon.label}</div>
                <div>By: System</div>
                <div style={{ marginTop: 2, color: '#555' }}>{icon.description}</div>
                <div style={{ marginTop: 2, color: '#808080', fontSize: 10 }}>Double-click to open · {getBuiltInViews(icon.key)} views</div>
              </>
            ) })}
            onMouseMove={e => setHoverTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
            onMouseLeave={() => setHoverTooltip(null)}
          >
            <button
              onMouseDown={e => startIconDrag(icon.key, e, pos.x, pos.y)}
              onClick={() => { if (!iconDragRef.current?.moved) setSelectedIcon(icon.key); }}
              onDoubleClick={() => { if (!iconDragRef.current?.moved) { incrementBuiltInViews(icon.key); icon.action(); } }}
              onContextMenu={e => {
                e.preventDefault(); e.stopPropagation();
                setCtxMenu(null);
                setHoverTooltip(null);
                setIconCtxMenu({ x: e.clientX, y: e.clientY, iconId: icon.key, isBuiltIn: true });
              }}
              className="flex flex-col items-center w-[82px] rounded"
              style={{
                gap: 3, padding: '3px 4px 4px',
                background: selectedIcon === icon.key ? 'rgba(49,105,206,0.45)' : 'transparent',
                border: selectedIcon === icon.key ? '1px dashed rgba(255,255,255,0.8)' : '1px solid transparent',
                cursor: 'default',
              }}
            >
              <img src={icon.icon} alt={icon.label} className="w-10 h-10 object-contain" draggable={false} />
              <span className="text-white text-[11px] text-center leading-tight px-0.5"
                style={{ fontFamily: XP_FONT, textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 0 1px 4px #000', wordBreak: 'normal', overflowWrap: 'anywhere', maxWidth: '100%' }}>
                {icon.label}
              </span>
            </button>
          </div>
        );
      })}

      {/* All custom icons (globally visible to all users) */}
      {!isMobile && sharedIcons.map((icon, idx) => {
        const baseIdx = desktopIcons.length + idx;
        const pos = iconPos[icon.id] ?? defaultIconPos(baseIdx);
        return (
          <div key={icon.id} className="absolute" style={{ left: pos.x, top: pos.y, zIndex: 10 }}
            onMouseEnter={e => setHoverTooltip({ x: e.clientX, y: e.clientY, content: (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{icon.label}</div>
                <div>By: {icon.addedBy}</div>
                {icon.description && <div style={{ marginTop: 2, color: '#555' }}>{icon.description}</div>}
                {icon.linkUrl && <div style={{ marginTop: 2, color: '#555', fontSize: 10, wordBreak: 'break-all' }}>{icon.linkUrl}</div>}
                <div style={{ marginTop: 2, color: '#808080', fontSize: 10 }}>Double-click to open</div>
              </>
            ) })}
            onMouseMove={e => setHoverTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
            onMouseLeave={() => setHoverTooltip(null)}
            onMouseDown={e => {
              if (e.button === 0) { setSelectedIcon(icon.id); startIconDrag(icon.id, e, pos.x, pos.y); }
            }}>
            <button
              onContextMenu={e => {
                e.preventDefault(); e.stopPropagation();
                setCtxMenu(null); setHoverTooltip(null);
                setIconCtxMenu({ x: e.clientX, y: e.clientY, iconId: icon.id, isShared: true });
              }}
              onDoubleClick={() => { if (!iconDragRef.current?.moved) { if (icon.linkUrl) window.open(icon.linkUrl, '_blank'); } }}
              className="flex flex-col items-center w-[82px] rounded"
              style={{ gap: 3, padding: '3px 4px 4px', background: selectedIcon === icon.id ? 'rgba(49,105,206,0.45)' : 'transparent', border: selectedIcon === icon.id ? '1px dashed rgba(255,255,255,0.8)' : '1px solid transparent', cursor: 'default' }}>
              <img src={icon.iconUrl} alt={icon.label} className="w-10 h-10 object-contain" draggable={false} onError={e => { (e.target as HTMLImageElement).src = ICON_FOLDER; }} />
              <span className="text-white text-[11px] text-center leading-tight px-0.5" style={{ fontFamily: XP_FONT, textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 0 1px 4px #000', wordBreak: 'normal', overflowWrap: 'anywhere', maxWidth: '100%' }}>{icon.label}</span>
            </button>
          </div>
        );
      })}

      {/* Per-icon right-click context menu */}
      {iconCtxMenu && (() => {
        const isBuiltIn = iconCtxMenu.isBuiltIn;
        const builtInIcon = isBuiltIn ? desktopIcons.find(i => i.key === iconCtxMenu.iconId) : null;
        // All non-built-in icons are now in sharedIcons
        const sharedIcon = !isBuiltIn ? sharedIcons.find(i => i.id === iconCtxMenu.iconId) : null;
        if (!builtInIcon && !sharedIcon) return null;

        const label = builtInIcon?.label ?? sharedIcon!.label;
        const iconUrl = builtInIcon?.icon ?? sharedIcon!.iconUrl;
        const addedBy = isBuiltIn ? 'System' : sharedIcon!.addedBy;
        const description = builtInIcon?.description ?? sharedIcon?.description;
        const views = isBuiltIn ? getBuiltInViews(iconCtxMenu.iconId) : 0;

        const canManageCustom = !isBuiltIn && (canModIcons || sharedIcon!.addedBy === currentUser?.username);

        const menuItems: ({ label: string; action: () => void } | null)[] = [
          { label: 'Open', action: () => {
            if (isBuiltIn) { incrementBuiltInViews(iconCtxMenu.iconId); builtInIcon!.action(); }
            else if (sharedIcon?.linkUrl) window.open(sharedIcon.linkUrl, '_blank');
            setIconCtxMenu(null);
          }},
          ...(!isBuiltIn ? [{ label: 'View Creator', action: () => {
            const vw2 = window.innerWidth; const vh2 = window.innerHeight - TASKBAR_H;
            setTopZ(z => { const next = z+1; setWins(ws => [...ws, { id: `profile-${Date.now()}`, type: 'profile' as const, title: `${sharedIcon!.addedBy} - Profile`, x: 60, y: 30, w: Math.min(820, vw2-80), h: Math.min(620, vh2-60), z: next, minimized: false, maximized: false, prevX: 60, prevY: 30, prevW: 820, prevH: 620, profileUsername: sharedIcon!.addedBy }]); return next; });
            setIconCtxMenu(null);
          }}] : []),
          null,
          { label: 'Properties', action: () => {
            setPropsIcon({
              id: isBuiltIn ? iconCtxMenu.iconId : sharedIcon!.id,
              label, iconUrl, addedBy, description, views,
              createdAt: isBuiltIn ? undefined : sharedIcon!.createdAt,
              isSystem: isBuiltIn,
            });
            setIconCtxMenu(null);
          }},
          null,
          ...(isBuiltIn && canModIcons ? [
            { label: '✎ Edit Name / Image', action: () => { openEditBuiltinIcon(iconCtxMenu.iconId, label, iconUrl); setIconCtxMenu(null); } },
          ] : []),
          ...(!isBuiltIn && canManageCustom ? [
            { label: '✎ Edit Icon', action: () => { openEditSharedIcon(sharedIcon!); setIconCtxMenu(null); } },
            { label: 'Delete Icon', action: () => { removeCustomIcon(sharedIcon!.id); setIconCtxMenu(null); } },
          ] : []),
          ...(!isBuiltIn && !canManageCustom ? [{ label: 'Report Icon', action: () => setIconCtxMenu(null) }] : []),
        ].filter(Boolean) as ({ label: string; action: () => void } | null)[];

        return (
          <div style={{ position: 'fixed', left: iconCtxMenu.x, top: iconCtxMenu.y, zIndex: 9999, background: '#f0eeeb', border: '2px outset #fff', boxShadow: '2px 2px 6px rgba(0,0,0,0.4)', minWidth: 170, fontFamily: XP_FONT, fontSize: 12 }} onClick={e => e.stopPropagation()}>
            {menuItems.map((item, i) => item === null ? (
              <div key={i} style={{ height: 1, background: '#808080', margin: '2px 0' }} />
            ) : (
              <div key={i} onClick={item.action}
                style={{ padding: '4px 20px', cursor: 'pointer' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = '#316ac5'; (e.target as HTMLElement).style.color = 'white'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = '#000'; }}>
                {item.label}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Global fixed hover tooltip — always on top of all icons */}
      {hoverTooltip && (
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: hoverTooltip.x + 16,
            top: hoverTooltip.y + 8,
            zIndex: 99999,
            minWidth: 160,
            maxWidth: 240,
            background: '#ffffe1',
            border: '1px solid #808080',
            padding: '3px 6px',
            fontFamily: XP_FONT,
            fontSize: 11,
            color: '#000',
            boxShadow: '2px 2px 4px rgba(0,0,0,0.2)',
            lineHeight: 1.5,
          }}
        >
          {hoverTooltip.content}
        </div>
      )}

      {/* Properties dialog */}
      {propsIcon && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPropsIcon(null)}>
          <div style={{ background: '#d4d0c8', border: '2px outset #fff', boxShadow: '4px 4px 12px rgba(0,0,0,0.5)', width: 320, fontFamily: XP_FONT }} onClick={e => e.stopPropagation()}>
            <div style={{ background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img src={propsIcon.iconUrl} style={{ width: 16, height: 16, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).src = ICON_FOLDER; }} alt="" />
                <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>Icon Properties</span>
              </div>
              <button onClick={() => setPropsIcon(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
            {/* Tabs */}
            <div style={{ borderBottom: '1px solid #808080', padding: '0 4px', display: 'flex', gap: 2, marginTop: 2 }}>
              <div style={{ padding: '4px 12px', fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', borderBottom: 'none', marginBottom: -1, fontFamily: XP_FONT }}>General</div>
            </div>
            {/* Content */}
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <img src={propsIcon.iconUrl} style={{ width: 40, height: 40, objectFit: 'contain', border: '1px inset #808080', padding: 2, background: 'white' }} onError={e => { (e.target as HTMLImageElement).src = ICON_FOLDER; }} alt="" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 'bold', fontFamily: XP_FONT }}>{propsIcon.label}</div>
                  <div style={{ fontSize: 10, color: '#808080', fontFamily: XP_FONT }}>Desktop Icon</div>
                </div>
              </div>
              <div style={{ height: 1, background: '#808080' }} />
              {[
                { label: 'Name:', value: propsIcon.label },
                { label: 'Created by:', value: propsIcon.addedBy },
                { label: 'Date:', value: propsIcon.createdAt ? new Date(propsIcon.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Unknown' },
                { label: 'Description:', value: propsIcon.description || '(none)' },
                { label: 'Views:', value: String(propsIcon.views || 0) },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: XP_FONT }}>
                  <span style={{ width: 90, color: '#444', flexShrink: 0 }}>{row.label}</span>
                  <span style={{ flex: 1, wordBreak: 'break-word' }}>{row.value}</span>
                </div>
              ))}
              <div style={{ height: 1, background: '#808080', marginTop: 4 }} />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                {!propsIcon.isSystem && (
                  <button
                    onClick={() => { const vw2 = window.innerWidth; const vh2 = window.innerHeight - TASKBAR_H; setTopZ(z => { const next = z+1; setWins(ws => [...ws, { id: `profile-${Date.now()}`, type: 'profile' as const, title: `${propsIcon.addedBy} - Profile`, x: 60, y: 30, w: Math.min(820, vw2-80), h: Math.min(620, vh2-60), z: next, minimized: false, maximized: false, prevX: 60, prevY: 30, prevW: 820, prevH: 620, profileUsername: propsIcon.addedBy }]); return next; }); setPropsIcon(null); }}
                    style={{ height: 24, padding: '0 14px', fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', fontFamily: XP_FONT }}>View Profile</button>
                )}
                <button onClick={() => setPropsIcon(null)} style={{ height: 24, padding: '0 14px', fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', fontFamily: XP_FONT }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999, background: '#f0eeeb', border: '2px outset #fff', boxShadow: '2px 2px 6px rgba(0,0,0,0.4)', minWidth: 180, fontFamily: XP_FONT, fontSize: 12 }}
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: 'Refresh', action: () => { localStorage.removeItem('xp-icon-pos'); setIconPos({}); setCtxMenu(null); } },
            null,
            ...(currentUser ? [{ label: 'Add Icon (Visible to Everyone)', action: () => { setShowAddIconDialog(true); setCtxMenu(null); } }] : [{ label: 'Sign in to add icons', action: () => { openWin('login'); setCtxMenu(null); } }]),
            ...(currentUser?.role === 'admin' && sharedIcons.length > 0 ? [null, { label: 'Admin: Clear All Custom Icons', action: () => { saveSharedIcons([]); setCtxMenu(null); } }] : []),
          ].map((item, i) => item === null ? (
            <div key={i} style={{ height: 1, background: '#808080', margin: '2px 0' }} />
          ) : (
            <div key={i} onClick={item.action}
              style={{ padding: '4px 20px', cursor: 'pointer', color: '#000' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = '#316ac5'; (e.target as HTMLElement).style.color = 'white'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = '#000'; }}>
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* Add Custom Icon Dialog */}
      {showAddIconDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#d4d0c8', border: '2px outset #fff', boxShadow: '4px 4px 12px rgba(0,0,0,0.5)', width: 320, fontFamily: XP_FONT }}>
            <div style={{ background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>🖼 Add Desktop Icon</span>
              <button onClick={() => setShowAddIconDialog(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, color: '#555', background: '#efe', border: '1px solid #aca', padding: '3px 6px' }}>This icon will be visible to ALL users on the desktop.</div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Icon Label *</div>
                <input value={newIconLabel} onChange={e => setNewIconLabel(e.target.value)} placeholder="My Website" style={{ height: 22, padding: '0 4px', fontSize: 11, width: '100%', boxSizing: 'border-box', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Icon Image * (upload or paste URL)</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input value={newIconUrl} onChange={e => setNewIconUrl(e.target.value)} placeholder="https://..." style={{ flex: 1, height: 22, padding: '0 4px', fontSize: 11, border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
                  <button disabled={newIconUploading} onClick={() => newIconFileRef.current?.click()} style={{ height: 22, padding: '0 8px', fontSize: 10, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', flexShrink: 0, opacity: newIconUploading ? 0.5 : 1 }}>{newIconUploading ? '…' : 'Upload'}</button>
                </div>
                <input ref={newIconFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  if (file.size > 4 * 1024 * 1024) { alert('Image must be under 4MB'); return; }
                  setNewIconUploading(true);
                  const url = await uploadIconImage(file);
                  if (url) setNewIconUrl(url);
                  setNewIconUploading(false);
                  e.target.value = '';
                }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Link URL (optional)</div>
                <input value={newIconLink} onChange={e => setNewIconLink(e.target.value)} placeholder="https://..." style={{ height: 22, padding: '0 4px', fontSize: 11, width: '100%', boxSizing: 'border-box', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Description (optional)</div>
                <input value={newIconDesc} onChange={e => setNewIconDesc(e.target.value)} placeholder="Short description..." style={{ height: 22, padding: '0 4px', fontSize: 11, width: '100%', boxSizing: 'border-box', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
              </div>
              {newIconUrl && <img src={newIconUrl} alt="preview" style={{ width: 40, height: 40, objectFit: 'contain', border: '1px inset #808080' }} onError={e => { (e.target as HTMLImageElement).alt = 'Invalid image'; }} />}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={addCustomIcon} style={{ height: 24, padding: '0 14px', fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer' }}>OK</button>
                <button onClick={() => setShowAddIconDialog(false)} style={{ height: 24, padding: '0 14px', fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shared Icon Dialog (Admin/Mod only) */}
      {showSharedIconDialog && canModIcons && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#d4d0c8', border: '2px outset #fff', boxShadow: '4px 4px 12px rgba(0,0,0,0.5)', width: 340, fontFamily: XP_FONT }}>
            <div style={{ background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>★ {editingSharedIcon ? 'Edit Global Icon' : 'Pin Global Icon (All Users)'}</span>
              <button onClick={() => setShowSharedIconDialog(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, color: '#555', background: '#efe', border: '1px solid #aca', padding: '3px 6px' }}>This icon will be visible to ALL users on the desktop.</div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Icon Label *</div>
                <input value={sharedIconLabel} onChange={e => setSharedIconLabel(e.target.value)} placeholder="My Website" style={{ height: 22, padding: '0 4px', fontSize: 11, width: '100%', boxSizing: 'border-box', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Icon Image *</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input value={sharedIconUrl} onChange={e => setSharedIconUrl(e.target.value)} placeholder="https://... or upload below" style={{ flex: 1, height: 22, padding: '0 4px', fontSize: 11, border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
                  <button onClick={() => sharedIconFileRef.current?.click()} style={{ height: 22, padding: '0 8px', fontSize: 10, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', flexShrink: 0 }}>Upload</button>
                </div>
                <input ref={sharedIconFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  if (file.size > 4 * 1024 * 1024) { alert('Image must be under 4MB'); return; }
                  const url = await uploadIconImage(file);
                  if (url) setSharedIconUrl(url);
                  e.target.value = '';
                }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Link URL (optional)</div>
                <input value={sharedIconLink} onChange={e => setSharedIconLink(e.target.value)} placeholder="https://..." style={{ height: 22, padding: '0 4px', fontSize: 11, width: '100%', boxSizing: 'border-box', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Description (optional)</div>
                <input value={sharedIconDesc} onChange={e => setSharedIconDesc(e.target.value)} placeholder="Short description..." style={{ height: 22, padding: '0 4px', fontSize: 11, width: '100%', boxSizing: 'border-box', border: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset 2px 2px 0 #404040', background: 'white' }} />
              </div>
              {sharedIconUrl && <img src={sharedIconUrl} alt="preview" style={{ width: 40, height: 40, objectFit: 'contain', border: '1px inset #808080' }} onError={e => { (e.target as HTMLImageElement).alt = 'Invalid image'; }} />}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={saveSharedIconForm} disabled={!sharedIconLabel.trim() || !sharedIconUrl.trim()} style={{ height: 24, padding: '0 14px', fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', opacity: (!sharedIconLabel.trim() || !sharedIconUrl.trim()) ? 0.5 : 1 }}>OK</button>
                <button onClick={() => setShowSharedIconDialog(false)} style={{ height: 24, padding: '0 14px', fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile home screen — shown when no windows open */}
      {isMobile && wins.filter(w => !w.minimized).length === 0 && (() => {
        // All available icons (built-in + custom)
        const allAvailableIcons = [
          { key: 'search', label: 'Search', iconUrl: ICON_SEARCH, action: () => openWin('search'), isBuiltIn: true },
          ...desktopIcons.map(ic => ({ key: ic.key, label: ic.label, iconUrl: ic.icon, action: ic.action, isBuiltIn: true })),
          ...sharedIcons.map(ic => ({ key: ic.id, label: ic.label, iconUrl: ic.iconUrl, action: () => { if (ic.linkUrl) window.open(ic.linkUrl, '_blank'); }, isBuiltIn: false })),
        ];

        const COLS = 4;
        const DOCK_H = 84;

        // Effective icon order: use saved order if available, otherwise all icons not in dock
        const effectiveIconOrder = mobileIconOrder.length
          ? mobileIconOrder.filter(k => allAvailableIcons.some(ic => ic.key === k))
          : allAvailableIcons.filter(ic => !mobileDockOrder.includes(ic.key)).map(ic => ic.key);

        // Resolve dock icons from order
        const dockIcons = mobileDockOrder
          .map(k => allAvailableIcons.find(ic => ic.key === k))
          .filter(Boolean) as typeof allAvailableIcons;

        // Icons available to add (not in grid or dock)
        const availableToAdd = allAvailableIcons.filter(ic =>
          !effectiveIconOrder.includes(ic.key) && !mobileDockOrder.includes(ic.key)
        );

        // Touch drag handlers for grid icons
        const handleGridTouchStart = (e: React.TouchEvent, icon: typeof allAvailableIcons[0], idx: number) => {
          if (!mobileEditMode) return;
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const clone = (e.currentTarget as HTMLElement).cloneNode(true) as HTMLElement;
          clone.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;opacity:0.8;zIndex:99999;pointerEvents:none;transition:none;`;
          document.body.appendChild(clone);
          dragRef2.current = { key: icon.key, sourceType: 'grid', sourceIdx: idx, floatEl: clone, startX: e.touches[0].clientX, startY: e.touches[0].clientY };
        };
        const handleGridTouchMove = (e: React.TouchEvent) => {
          if (!dragRef2.current?.floatEl) return;
          const dx = e.touches[0].clientX - dragRef2.current.startX;
          const dy = e.touches[0].clientY - dragRef2.current.startY;
          dragRef2.current.floatEl.style.transform = `translate(${dx}px,${dy}px)`;
          dragRef2.current.floatEl.style.display = 'none';
          const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
          dragRef2.current.floatEl.style.display = '';
          const cell = el?.closest('[data-grid-idx]');
          const dockCell = el?.closest('[data-dock-idx]');
          if (cell) setDragOverIdx({ type: 'grid', idx: Number(cell.getAttribute('data-grid-idx')) });
          else if (dockCell) setDragOverIdx({ type: 'dock', idx: Number(dockCell.getAttribute('data-dock-idx')) });
          else setDragOverIdx(null);
        };
        const handleGridTouchEnd = () => {
          if (!dragRef2.current) return;
          const { key, sourceType, sourceIdx, floatEl } = dragRef2.current;
          floatEl?.remove();
          if (dragOverIdx) {
            if (sourceType === 'grid' && dragOverIdx.type === 'grid') {
              const newOrder = [...effectiveIconOrder];
              newOrder.splice(sourceIdx, 1);
              newOrder.splice(dragOverIdx.idx, 0, key);
              setMobileIconOrder(newOrder);
              saveMobileLayout(newOrder, mobileDockOrder);
            } else if (sourceType === 'grid' && dragOverIdx.type === 'dock') {
              if (mobileDockOrder.length < 4 || mobileDockOrder.includes(key)) {
                const newDock = mobileDockOrder.includes(key) ? mobileDockOrder : [...mobileDockOrder.slice(0, 3), key];
                const newOrder = effectiveIconOrder.filter(k => k !== key);
                setMobileDockOrder(newDock);
                setMobileIconOrder(newOrder);
                saveMobileLayout(newOrder, newDock);
              }
            } else if (sourceType === 'dock' && dragOverIdx.type === 'grid') {
              const newDock = mobileDockOrder.filter(k => k !== key);
              const newOrder = [...effectiveIconOrder];
              newOrder.splice(dragOverIdx.idx, 0, key);
              setMobileDockOrder(newDock);
              setMobileIconOrder(newOrder);
              saveMobileLayout(newOrder, newDock);
            } else if (sourceType === 'dock' && dragOverIdx.type === 'dock') {
              const newDock = [...mobileDockOrder];
              const fromIdx = newDock.indexOf(key);
              newDock.splice(fromIdx, 1);
              newDock.splice(dragOverIdx.idx, 0, key);
              setMobileDockOrder(newDock);
              saveMobileLayout(effectiveIconOrder, newDock);
            }
          }
          dragRef2.current = null;
          setDragOverIdx(null);
        };

        return (
          <div
            className="absolute inset-0"
            style={{ top: 0, bottom: 0, left: 0, right: 0, overflowY: mobileEditMode ? 'auto' : 'hidden', overflowX: 'hidden', zIndex: 10, display: 'flex', flexDirection: 'column' }}
          >
            {/* CSS wiggle for edit mode */}
            {mobileEditMode && (
              <style>{`
                @keyframes xp-wiggle { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
                .xp-icon-wiggle { animation: xp-wiggle 0.25s ease-in-out infinite; }
              `}</style>
            )}

            {/* Permanent header bar — Edit/Done/Wallpaper */}
            <input ref={mobileWallpaperFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
              const file = e.target.files?.[0]; if (!file) return;
              setWallpaperLoading(true);
              const reader = new FileReader();
              reader.onload = async ev => {
                const dataUrl = ev.target?.result as string;
                setMobileWallpaper(dataUrl);
                if (currentUser?.username) {
                  localStorage.setItem(`mobileWallpaper_${currentUser.username}`, dataUrl);
                  void (async () => { try { await supabase.from('kv_store_ea58c774').upsert({ key: `mobileWallpaper:${currentUser.username}`, value: dataUrl }, { onConflict: 'key' }); } catch {} })();
                }
                setWallpaperLoading(false);
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }} />
            <div style={{ background: 'rgba(30,30,60,0.55)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.18)', gap: 8 }}>
              <span style={{ fontFamily: XP_FONT, fontSize: 13, color: 'rgba(255,255,255,0.7)', flex: 1, minWidth: 0 }}>
                {mobileEditMode ? (selectedMobileKey ? 'Tap destination to move icon' : 'Tap icon to select, × to remove') : 'Trash Bin XP'}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {!mobileEditMode && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (mobileWallpaper !== WALLPAPER) {
                        // show sub-menu options: change or revert
                      }
                      mobileWallpaperFileRef.current?.click();
                    }}
                    title={wallpaperLoading ? 'Uploading…' : 'Change wallpaper'}
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)', fontFamily: XP_FONT, fontSize: 11, color: 'white', cursor: 'pointer', padding: '3px 8px', borderRadius: 6 }}
                  >{wallpaperLoading ? '…' : '🖼'}</button>
                )}
                {!mobileEditMode && mobileWallpaper !== WALLPAPER && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setMobileWallpaper(WALLPAPER);
                      if (currentUser?.username) {
                        localStorage.removeItem(`mobileWallpaper_${currentUser.username}`);
                        void (async () => { try { await supabase.from('kv_store_ea58c774').delete().eq('key', `mobileWallpaper:${currentUser.username}`); } catch {} })();
                      }
                    }}
                    title="Revert to default wallpaper"
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)', fontFamily: XP_FONT, fontSize: 11, color: 'rgba(255,200,100,0.9)', cursor: 'pointer', padding: '3px 8px', borderRadius: 6 }}
                  >↩</button>
                )}
                {mobileEditMode ? (
                  <button
                    onClick={e => { e.stopPropagation(); setMobileEditMode(false); setSelectedMobileKey(null); saveMobileLayout(effectiveIconOrder, mobileDockOrder); }}
                    style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', fontFamily: XP_FONT, fontSize: 13, fontWeight: 'bold', color: 'white', cursor: 'pointer', padding: '3px 14px', borderRadius: 6 }}
                  >Done</button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setMobileEditMode(true); }}
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)', fontFamily: XP_FONT, fontSize: 13, color: 'white', cursor: 'pointer', padding: '3px 14px', borderRadius: 6 }}
                  >Edit</button>
                )}
              </div>
            </div>

            {/* Icon grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 2,
              rowGap: 6,
              padding: '10px 2px 4px',
              alignContent: 'start',
              flex: 1,
              overflowY: mobileEditMode ? 'auto' : 'hidden',
              overflowX: 'hidden',
            }}>
              {effectiveIconOrder.map((key, idx) => {
                const icon = allAvailableIcons.find(ic => ic.key === key);
                if (!icon) return null;
                const isSelected = selectedMobileKey === icon.key;
                return (
                  <div
                    key={icon.key}
                    data-grid-idx={idx}
                    className={mobileEditMode && !isSelected ? 'xp-icon-wiggle' : ''}
                    style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 8, outline: isSelected ? '2px solid #6af' : 'none', background: isSelected ? 'rgba(100,180,255,0.18)' : 'transparent', transition: 'outline 0.1s, background 0.1s' }}
                  >
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        if (!mobileEditMode) {
                          if (icon.isBuiltIn) incrementBuiltInViews(icon.key);
                          icon.action();
                          return;
                        }
                        // Tap-to-select-and-swap
                        if (selectedMobileKey === null) {
                          setSelectedMobileKey(icon.key);
                        } else if (selectedMobileKey === icon.key) {
                          setSelectedMobileKey(null);
                        } else {
                          // Swap the two icons in the grid
                          const newOrder = [...effectiveIconOrder];
                          const idxA = newOrder.indexOf(selectedMobileKey);
                          const idxB = newOrder.indexOf(icon.key);
                          if (idxA >= 0 && idxB >= 0) {
                            [newOrder[idxA], newOrder[idxB]] = [newOrder[idxB], newOrder[idxA]];
                            setMobileIconOrder(newOrder);
                            saveMobileLayout(newOrder, mobileDockOrder);
                          }
                          setSelectedMobileKey(null);
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 4px 8px', width: '100%', cursor: 'default' }}
                    >
                      <img src={icon.iconUrl} alt={icon.label} style={{ width: 52, height: 52, objectFit: 'contain' }} draggable={false}
                        onError={e2 => { (e2.target as HTMLImageElement).src = ICON_FOLDER; }} />
                      <span style={{ fontFamily: XP_FONT, fontSize: 11, color: 'white', textAlign: 'center', lineHeight: 1.2, textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 0 1px 4px #000', wordBreak: 'break-word', maxWidth: '100%' }}>
                        {icon.label.replace('\n', ' ')}
                      </span>
                    </button>
                    {/* Edit mode: × badge (top-left) */}
                    {mobileEditMode && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const newOrder = effectiveIconOrder.filter(k => k !== icon.key);
                          setMobileIconOrder(newOrder);
                          setSelectedMobileKey(null);
                          saveMobileLayout(newOrder, mobileDockOrder);
                        }}
                        style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#c8352a', border: '2px solid white', color: 'white', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, lineHeight: 1 }}
                      >×</button>
                    )}
                  </div>
                );
              })}

              {/* Edit mode: Ghost/Add cell */}
              {mobileEditMode && (
                <div
                  data-grid-idx={effectiveIconOrder.length}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); setMobileAddOpen(true); }}
                    style={{ background: 'rgba(255,255,255,0.1)', border: '2px dashed rgba(255,255,255,0.5)', borderRadius: 12, width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>+</button>
                  <span style={{ fontFamily: XP_FONT, fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 4, textShadow: '1px 1px 2px #000' }}>Add</span>
                </div>
              )}
            </div>

            {/* Add icon panel (fullscreen overlay) */}
            {mobileAddOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', flexDirection: 'column', fontFamily: XP_FONT }}
                onClick={() => setMobileAddOpen(false)}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxHeight: '100%' }} onClick={e => e.stopPropagation()}>
                  {/* XP-style title bar */}
                  <div style={{ background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontSize: 13, fontWeight: 'bold' }}>Add Icon</span>
                    <button onClick={() => setMobileAddOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                  {/* Available icons grid */}
                  <div style={{ overflowY: 'auto', flex: 1, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                    {/* Create new icon cell — only for logged-in users */}
                    {currentUser && (
                      <button
                        onClick={() => { setMobileAddOpen(false); setShowAddIconDialog(true); }}
                        style={{ background: 'rgba(208,115,57,0.25)', border: '2px dashed rgba(208,115,57,0.7)', borderRadius: 8, padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <span style={{ fontSize: 28, lineHeight: 1, color: 'rgba(255,200,120,0.9)' }}>＋</span>
                        <span style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.2, color: 'rgba(255,200,120,0.9)', textShadow: '1px 1px 2px #000' }}>Create Icon</span>
                      </button>
                    )}
                    {availableToAdd.length === 0 && !currentUser ? (
                      <div style={{ gridColumn: '1/-1', color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: 24, fontSize: 13 }}>All icons are on your screen</div>
                    ) : availableToAdd.map(icon => (
                      <button key={icon.key}
                        onClick={() => {
                          const newOrder = [...effectiveIconOrder, icon.key];
                          setMobileIconOrder(newOrder);
                          saveMobileLayout(newOrder, mobileDockOrder);
                          setMobileAddOpen(false);
                        }}
                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <img src={icon.iconUrl} style={{ width: 40, height: 40, objectFit: 'contain' }} alt=""
                          onError={e => { (e.target as HTMLImageElement).src = ICON_FOLDER; }} />
                        <span style={{ fontSize: 10, textAlign: 'center', lineHeight: 1.2, color: 'white', textShadow: '1px 1px 2px #000' }}>{icon.label.replace('\n', ' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom dock */}
            <div style={{
              height: DOCK_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              background: 'rgba(30,30,60,0.55)',
              backdropFilter: 'blur(14px)',
              borderTop: '1px solid rgba(255,255,255,0.22)',
              flexShrink: 0,
              paddingBottom: 'env(safe-area-inset-bottom)',
              marginTop: 'auto',
              overflowX: 'hidden',
            }}>
              {Array.from({ length: Math.max(dockIcons.length, mobileEditMode ? 4 : dockIcons.length) }).map((_, idx) => {
                const icon = dockIcons[idx];
                const isGhost = !icon;
                const isDockSelected = !isGhost && selectedMobileKey === icon.key;
                const selectedIsInDock = selectedMobileKey ? mobileDockOrder.includes(selectedMobileKey) : false;
                const selectedIsInGrid = selectedMobileKey ? effectiveIconOrder.includes(selectedMobileKey) : false;

                if (isGhost) {
                  return (
                    <button
                      key={`ghost-${idx}`}
                      onClick={e => {
                        e.stopPropagation();
                        if (!selectedMobileKey) return;
                        if (selectedIsInGrid) {
                          // Move grid icon into this empty dock slot
                          const newDock = [...mobileDockOrder];
                          newDock.splice(idx, 0, selectedMobileKey);
                          const newOrder = effectiveIconOrder.filter(k => k !== selectedMobileKey);
                          setMobileDockOrder(newDock.slice(0, 4));
                          setMobileIconOrder(newOrder);
                          saveMobileLayout(newOrder, newDock.slice(0, 4));
                          setSelectedMobileKey(null);
                        } else if (selectedIsInDock) {
                          // Move dock icon to this position
                          const newDock = mobileDockOrder.filter(k => k !== selectedMobileKey);
                          newDock.splice(idx, 0, selectedMobileKey);
                          setMobileDockOrder(newDock.slice(0, 4));
                          saveMobileLayout(effectiveIconOrder, newDock.slice(0, 4));
                          setSelectedMobileKey(null);
                        }
                      }}
                      style={{
                        background: selectedMobileKey ? 'rgba(100,180,255,0.12)' : 'rgba(255,255,255,0.06)',
                        border: selectedMobileKey ? '2px dashed rgba(100,180,255,0.7)' : '2px dashed rgba(255,255,255,0.2)',
                        borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: 3, flex: 1, cursor: selectedMobileKey ? 'pointer' : 'default',
                        height: 60, margin: '0 2px',
                      }}
                    >
                      <span style={{ fontSize: 20, opacity: 0.35 }}>+</span>
                      <span style={{ fontFamily: XP_FONT, fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>Empty</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={icon.key}
                    data-dock-idx={idx}
                    onClick={e => {
                      e.stopPropagation();
                      if (!mobileEditMode) {
                        if (icon.isBuiltIn) incrementBuiltInViews(icon.key);
                        icon.action();
                        return;
                      }
                      if (!selectedMobileKey) {
                        // Select this dock icon for rearranging
                        setSelectedMobileKey(icon.key);
                      } else if (selectedMobileKey === icon.key) {
                        setSelectedMobileKey(null);
                      } else if (selectedIsInDock) {
                        // Swap two dock icons
                        const newDock = [...mobileDockOrder];
                        const idxA = newDock.indexOf(selectedMobileKey);
                        const idxB = newDock.indexOf(icon.key);
                        if (idxA >= 0 && idxB >= 0) [newDock[idxA], newDock[idxB]] = [newDock[idxB], newDock[idxA]];
                        setMobileDockOrder(newDock);
                        saveMobileLayout(effectiveIconOrder, newDock);
                        setSelectedMobileKey(null);
                      } else if (selectedIsInGrid) {
                        // Grid icon → replace this dock slot, bumped dock icon → grid
                        const newDock = [...mobileDockOrder];
                        newDock[idx] = selectedMobileKey;
                        const newOrder = effectiveIconOrder.filter(k => k !== selectedMobileKey);
                        if (mobileDockOrder[idx]) newOrder.push(mobileDockOrder[idx]);
                        setMobileDockOrder(newDock);
                        setMobileIconOrder(newOrder);
                        saveMobileLayout(newOrder, newDock);
                        setSelectedMobileKey(null);
                      }
                    }}
                    className={mobileEditMode && !isDockSelected ? 'xp-icon-wiggle' : ''}
                    style={{
                      background: 'none', border: 'none', borderRadius: 8,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      cursor: mobileEditMode ? 'pointer' : 'default', flex: 1, position: 'relative',
                      outline: isDockSelected ? '2px solid #6af' : 'none',
                    }}
                  >
                    {mobileEditMode && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const newDock = mobileDockOrder.filter(k => k !== icon.key);
                          const newOrder = [...effectiveIconOrder, icon.key];
                          setMobileDockOrder(newDock);
                          setMobileIconOrder(newOrder);
                          saveMobileLayout(newOrder, newDock);
                          if (selectedMobileKey === icon.key) setSelectedMobileKey(null);
                        }}
                        style={{ position: 'absolute', top: -4, left: 4, width: 18, height: 18, borderRadius: '50%', background: '#c8352a', border: '2px solid white', color: 'white', fontSize: 11, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, lineHeight: 1 }}
                      >×</button>
                    )}
                    <img src={icon.iconUrl} alt={icon.label} style={{ width: 44, height: 44, objectFit: 'contain' }} draggable={false}
                      onError={e2 => { (e2.target as HTMLImageElement).src = ICON_FOLDER; }} />
                    <span style={{ fontFamily: XP_FONT, fontSize: 10, color: 'white', textShadow: '1px 1px 2px #000, -1px -1px 2px #000', lineHeight: 1 }}>
                      {icon.label.replace('\n', ' ')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Mobile XP Shell — full-screen when any window is open */}
      {isMobile && wins.filter(w => !w.minimized).length > 0 && (
        <MobileXPShell
          wins={wins}
          movies={movies}
          toWatchMovies={toWatchMovies}
          openWin={openWin}
          closeWin={closeWin}
          bringToFront={bringToFront}
          onExit={onExit}
          onAddMovie={onAddMovie}
          onMarkWatched={onMarkWatched}
          onUpdateRating={onUpdateRating}
          onOpenMoviePage={m => { onExit(); navigate(`/movie/${createSlug(m.title, m.year)}`); }}
          comments={comments}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
        />
      )}

      {/* Desktop windows */}
      {!isMobile && wins.map(win => !win.minimized && (
        <XPWindowFrame
          key={win.id}
          win={win}
          isMobile={false}
          onClose={() => closeWin(win.id)}
          onMinimize={() => minimizeWin(win.id)}
          onMaximize={() => toggleMaximize(win.id)}
          onFocus={() => bringToFront(win.id)}
          onDragStart={e => startDrag(win.id, e, win)}
          onTouchDragStart={e => startTouchDrag(win.id, e, win)}
          onResizeStart={e => startResize(win.id, e, win)}
        >
          {win.type === 'library' && <LibraryContent movies={movies} onMovieClick={m => openWin('detail', m)} winWidth={win.w} comments={comments} allMovies={[...movies, ...toWatchMovies]} onCommentClick={m => openWin('detail', m)} />}
          {win.type === 'watchlist' && <LibraryContent movies={toWatchMovies} onMovieClick={m => openWin('detail', m)} winWidth={win.w} comments={comments} allMovies={[...movies, ...toWatchMovies]} onCommentClick={m => openWin('detail', m)} />}
          {win.type === 'detail' && win.movie && (
            <DetailContent movie={win.movie} onOpenPage={() => { onExit(); navigate(`/movie/${createSlug(win.movie!.title, win.movie!.year)}`); }} comments={comments} onAddComment={onAddComment} onDeleteComment={onDeleteComment} onUpdateRating={onUpdateRating} currentUser={currentUser} />
          )}
          {win.type === 'tickets' && <XPTicketContent movies={[...movies, ...toWatchMovies]} />}
          {win.type === 'search' && <CMDSearchContent allMovies={[...movies, ...toWatchMovies]} onOpen={m => openWin('detail', m)} />}
          {win.type === 'assistant' && <ICQAssistantContent allMovies={[...movies, ...toWatchMovies]} />}
          {win.type === 'login' && (
            currentUser
              ? <XPProfileContent username={currentUser.username} currentUser={currentUser} allMovies={[...movies, ...toWatchMovies]} onOpenProfile={u => { const id2 = `profile-${Date.now()}`; const vw2 = window.innerWidth; const vh2 = window.innerHeight - TASKBAR_H; setTopZ(z => { const next = z+1; setWins(ws => [...ws, { id: id2, type: 'profile', title: `${u} - Profile`, x: 80, y: 30, w: Math.min(820, vw2-80), h: Math.min(620, vh2-60), z: next, minimized: false, maximized: false, prevX: 80, prevY: 30, prevW: 820, prevH: 620, profileUsername: u }]); return next; }); }} onFollow={() => {}} />
              : <XPLoginContent currentUser={currentUser} setCurrentUser={setCurrentUser} />
          )}
          {win.type === 'profile' && <XPProfileContent username={win.profileUsername || currentUser?.username || ''} currentUser={currentUser} allMovies={[...movies, ...toWatchMovies]} onOpenProfile={u => { const id2 = `profile-${Date.now()}`; const vw2 = window.innerWidth; const vh2 = window.innerHeight - TASKBAR_H; setTopZ(z => { const next = z+1; setWins(ws => [...ws, { id: id2, type: 'profile', title: `${u} - Profile`, x: 80, y: 30, w: Math.min(820, vw2-80), h: Math.min(620, vh2-60), z: next, minimized: false, maximized: false, prevX: 80, prevY: 30, prevW: 820, prevH: 620, profileUsername: u }]); return next; }); }} onFollow={() => {}} />}
          {win.type === 'chat' && <ChatPanel currentUser={currentUser} isXP={true} style={{ height: '100%' }} />}
          {win.type === 'privacy' && <XPPrivacyContent />}
          {win.type === 'terms' && <XPTermsContent />}
        </XPWindowFrame>
      ))}

      {/* XP Taskbar — desktop only */}
      {!isMobile && (
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-1.5"
        style={{
          height: TASKBAR_H, zIndex: 200,
          background: 'linear-gradient(180deg, #245edb 0%, #3b8eed 4%, #1d54c8 10%, #1a4faa 100%)',
          boxShadow: '0 -2px 6px rgba(0,0,0,0.5)',
          borderTop: '1px solid #1a3fad',
          fontFamily: XP_FONT,
        }}
      >
        {/* Start button */}
        <button
          onClick={() => setSleeping(true)}
          className="flex items-center gap-1.5 flex-shrink-0 text-white font-bold rounded-r-full pr-4 pl-2"
          style={{
            height: 34, fontStyle: 'italic', fontSize: 15, letterSpacing: 0.5, fontFamily: XP_FONT,
            background: 'linear-gradient(180deg, #5db843 0%, #3c9e24 45%, #267516 100%)',
            border: '1px solid #1a5c0e',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}
        >
          <img src={logoImage} alt="" className="w-5 h-5" />
          <span>start</span>
        </button>

        {/* Open windows strip — hidden on mobile */}
        {!isMobile && (
          <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
            {wins.map(win => {
              const winIcons: Record<XPWin['type'], string> = { library: ICON_SSD, watchlist: ICON_EXPLORER, detail: ICON_FOLDER, tickets: ICON_TRASH, search: ICON_SEARCH, assistant: ICON_ASSISTANT, login: ICON_HUMAN, profile: ICON_HUMAN, chat: ICON_ASSISTANT, privacy: ICON_STARGATE, terms: ICON_STARGATE2 };
              const iconSrc = win.type === 'profile'
                ? (localStorage.getItem(`userPic_${win.profileUsername || currentUser?.username}`) || currentUser?.profilePicture || ICON_HUMAN)
                : winIcons[win.type];
              return (
                <button key={win.id}
                  onClick={() => win.minimized ? restoreWin(win.id) : minimizeWin(win.id)}
                  className="flex items-center gap-1.5 px-2 text-white h-[30px] rounded-sm max-w-[150px] flex-shrink-0"
                  style={{
                    fontSize: 11, fontFamily: XP_FONT,
                    background: win.minimized ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.25)',
                  }}
                >
                  {win.type === 'chat'
                    ? <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>💬</span>
                    : <img src={iconSrc} alt="" style={{ width: 16, height: 16, objectFit: win.type === 'profile' ? 'cover' : 'contain', borderRadius: win.type === 'profile' ? '50%' : 0, flexShrink: 0 }} />
                  }
                  <span className="truncate">{win.title}</span>
                </button>
              );
            })}
          </div>
        )}
        {isMobile && <div className="flex-1" />}

        {/* Search */}
        <div className="relative flex-shrink-0" style={{ width: isMobile ? 150 : 220 }}>
          <input
            type="text" value={taskSearch}
            onChange={e => { setTaskSearch(e.target.value); setShowTaskDrop(e.target.value.length > 0); }}
            onFocus={() => taskSearch.length > 0 && setShowTaskDrop(true)}
            onBlur={() => setTimeout(() => setShowTaskDrop(false), 150)}
            placeholder="Search movies..."
            className="w-full h-[26px] px-2 text-white placeholder:text-white/40 outline-none"
            style={{ fontSize: 11, fontFamily: XP_FONT, background: 'rgba(0,0,20,0.55)', border: 'none', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.55), inset -1px -1px 1px rgba(255,255,255,0.08)', borderRadius: 1 }}
          />
          {showTaskDrop && taskResults.length > 0 && (
            <div className="xp-scroll absolute bottom-full left-0 right-0 mb-1 overflow-hidden"
              style={{ background: 'white', border: '2px solid #0831d9', maxHeight: 320, overflowY: 'auto', zIndex: 999 }}>
              {taskResults.map(m => (
                <div key={m.id} onMouseDown={() => openWin('detail', m)}
                  className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#3169ce] hover:text-white group"
                  style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', fontFamily: XP_FONT }}>
                  <img src={m.image} alt="" className="w-7 h-10 object-cover rounded flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold truncate group-hover:text-white text-gray-900">{m.title}</p>
                    <p className="text-[10px] text-gray-500 group-hover:text-white/70">{m.year} · {m.genre?.split(',')[0]}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System tray */}
        <div className="flex items-center gap-2 px-2 h-full flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.18)', borderLeft: '1px solid rgba(255,255,255,0.12)' }}>
          {weather && (
            <div className="flex items-center gap-1 text-white" title={weather.city}
              style={{ fontSize: 11, fontFamily: XP_FONT }}>
              <span>{weather.icon}</span><span>{weather.temp}</span>
            </div>
          )}
          {/* Keyboard language */}
          <div title="Keyboard language" style={{ fontSize: 10, fontFamily: XP_FONT, color: 'white', cursor: 'default', letterSpacing: 0.5, fontWeight: 'bold', lineHeight: '14px' }}>
            {kbLang}
          </div>
          {currentUser && <XPNotifBell currentUser={currentUser} />}
          {/* Network icon — WiFi arcs or Ethernet plug depending on connection type */}
          <div title={isOnline ? (netType === 'ethernet' ? 'Ethernet' : 'Wi-Fi') : 'Offline'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
            {!isOnline ? (
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                <rect x="1" y="9" width="14" height="4" rx="1" fill="rgba(255,255,255,0.25)" />
                <line x1="3" y1="3" x2="13" y2="11" stroke="#ff6060" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="13" y1="3" x2="3" y2="11" stroke="#ff6060" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : netType === 'ethernet' ? (
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                <rect x="4" y="0.5" width="8" height="5" rx="1" stroke="white" strokeOpacity="0.85" strokeWidth="1.2" fill="none"/>
                <line x1="6" y1="0.5" x2="6" y2="3.5" stroke="white" strokeOpacity="0.7" strokeWidth="1"/>
                <line x1="8" y1="0.5" x2="8" y2="3.5" stroke="white" strokeOpacity="0.7" strokeWidth="1"/>
                <line x1="10" y1="0.5" x2="10" y2="3.5" stroke="white" strokeOpacity="0.7" strokeWidth="1"/>
                <rect x="5" y="5.5" width="6" height="8" rx="1" fill="rgba(255,255,255,0.5)" stroke="white" strokeOpacity="0.7" strokeWidth="1.2"/>
                <line x1="8" y1="5.5" x2="8" y2="13.5" stroke="white" strokeOpacity="0.5" strokeWidth="1"/>
              </svg>
            ) : (
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                <path d="M3 7 Q8 2 13 7" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M5 5 Q8 1 11 5" stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <path d="M6.5 3.5 Q8 1.5 9.5 3.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <circle cx="8" cy="11" r="1.5" fill="white" />
              </svg>
            )}
          </div>
          {/* Volume icon — click opens popup */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowVolume(v => !v)} title={`Volume: ${volume}%`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                <path d="M2 5H5L9 2V12L5 9H2V5Z" fill="white" opacity="0.85" />
                {volume > 50 ? (
                  <>
                    <path d="M11 4 Q14 7 11 10" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.8" />
                    <path d="M12.5 2.5 Q16.5 7 12.5 11.5" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.5" />
                  </>
                ) : volume > 0 ? (
                  <path d="M11 4 Q14 7 11 10" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.8" />
                ) : (
                  <>
                    <line x1="11" y1="4" x2="15" y2="10" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
                    <line x1="15" y1="4" x2="11" y2="10" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
                  </>
                )}
              </svg>
            </button>
            {showVolume && (
              <div
                style={{ position:'fixed', inset:0, zIndex:9998 }}
                onClick={() => setShowVolume(false)}
              >
                <div
                  style={{ position:'absolute', bottom: TASKBAR_H + 4, right: 80, background:'#d4d0c8', border:'2px outset #fff', boxShadow:'2px 2px 6px rgba(0,0,0,0.4)', padding:'10px 14px', zIndex:9999, fontFamily:XP_FONT, width:52, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ fontSize:11, fontWeight:'bold', color:'#000' }}>Vol</div>
                  <div style={{ position:'relative', height:100, width:22, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', height:'100%', width:4, background:'#808080', boxShadow:'inset 1px 1px 0 #404040' }} />
                    <input
                      type="range" min={0} max={100} value={volume}
                      style={{ writingMode:'vertical-lr' as any, direction:'rtl', appearance:'slider-vertical' as any, WebkitAppearance:'slider-vertical', width:22, height:100, cursor:'pointer', position:'relative', zIndex:1, accentColor:'#316ac5', background:'transparent' }}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setVolume(v);
                        try { document.querySelectorAll<HTMLMediaElement>('video,audio').forEach(el => { el.volume = v/100; el.muted = v===0; }); } catch {}
                      }}
                    />
                  </div>
                  <div style={{ fontSize:10, color:'#000', fontWeight:'bold' }}>{volume}%</div>
                </div>
              </div>
            )}
          </div>
          {/* Battery icon */}
          {battery !== null && (
            <div title={`Battery: ${Math.round(battery.level * 100)}%${battery.charging ? ' (charging)' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <svg width="20" height="11" viewBox="0 0 20 11" fill="none">
                <rect x="0.5" y="0.5" width="17" height="10" rx="1.5" stroke="white" strokeOpacity="0.8" />
                <rect x="17.5" y="3.5" width="2" height="4" rx="1" fill="white" fillOpacity="0.6" />
                <rect x="1.5" y="1.5" width={Math.round(battery.level * 15)} height="8" rx="1"
                  fill={battery.level < 0.2 ? '#ff4444' : battery.level < 0.4 ? '#ffaa00' : '#55cc55'} />
                {battery.charging && (
                  <text x="9" y="9.5" textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">⚡</text>
                )}
              </svg>
            </div>
          )}
          <div className="relative">
            <button onClick={() => setShowCal(c => !c)}
              className="flex flex-col items-end text-white text-right leading-tight"
              style={{ fontSize: 11, fontFamily: XP_FONT }}>
              <span className="font-medium">{clockStr}</span>
              <span style={{ fontSize: 10, opacity: 0.75 }}>{dateStr}</span>
            </button>
            {showCal && (
              <div className="absolute bottom-11 right-0 p-3 rounded shadow-2xl"
                style={{ background: 'white', border: '2px solid #0831d9', width: 196, zIndex: 999, fontFamily: XP_FONT }}>
                <p className="text-center text-xs font-bold mb-2" style={{ color: '#0054b5' }}>
                  {MONTH_NAMES[mo]} {yr}
                </p>
                <div className="grid grid-cols-7 gap-y-0.5 text-center">
                  {DAY_NAMES.map(d => (
                    <div key={d} className="text-[10px] font-bold pb-1" style={{ color: '#0054b5' }}>{d}</div>
                  ))}
                  {calCells.map((d, i) => (
                    <div key={i} className="text-[11px] leading-5 rounded-full"
                      style={d === today.getDate()
                        ? { background: '#0054b5', color: 'white', fontWeight: 'bold' }
                        : { color: '#333' }}>
                      {d ?? ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── Window frame ─────────────────────────────────────────────────────────────

function XPWindowFrame({ win, isMobile = false, onClose, onMinimize, onMaximize, onFocus, onDragStart, onTouchDragStart, onResizeStart, children }: {
  win: XPWin;
  isMobile?: boolean;
  onClose: () => void; onMinimize: () => void; onMaximize: () => void;
  onFocus: () => void; onDragStart: (e: React.MouseEvent) => void;
  onTouchDragStart: (e: React.TouchEvent) => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const style = win.maximized
    ? { left: 0, top: isMobile ? TAB_BAR_H : 0, width: '100%', height: isMobile ? `calc(100% - ${TAB_BAR_H}px)` : `calc(100% - ${TASKBAR_H}px)` }
    : { left: win.x, top: win.y, width: win.w, height: win.h };

  const titleBarH = isMobile ? 44 : 28;

  return (
    <div
      className="absolute flex flex-col"
      style={{
        ...style, zIndex: win.z,
        borderRadius: win.maximized ? 0 : '8px 8px 4px 4px',
        border: '2px solid #0831d9',
        boxShadow: win.maximized ? 'none' : '4px 6px 16px rgba(0,0,0,0.45), 1px 1px 0 rgba(255,255,255,0.15) inset',
        overflow: 'hidden',
        fontFamily: XP_FONT,
      }}
      onClick={onFocus}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-2 flex-shrink-0"
        style={{
          height: titleBarH, userSelect: 'none',
          cursor: win.maximized ? 'default' : 'move',
          background: 'linear-gradient(180deg, #0997ff 0%, #0164ef 3%, #0050db 55%, #0044bf 100%)',
        }}
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart}
        onDoubleClick={onMaximize}
      >
        <span className="text-white font-bold truncate"
          style={{ fontSize: isMobile ? 15 : 12, textShadow: '1px 1px 2px rgba(0,0,0,0.5)', fontFamily: XP_FONT }}>
          {win.title}
        </span>
        <div className="flex items-center ml-2 flex-shrink-0" style={{ gap: isMobile ? 6 : 4 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
          <WinBtn onClick={onMinimize} color="blue" isMobile={isMobile} icon={<Minus style={{ width: isMobile ? 14 : 10, height: isMobile ? 14 : 10 }} />} />
          <WinBtn onClick={onMaximize} color="blue" isMobile={isMobile} icon={
            win.maximized
              ? <Maximize2 style={{ width: isMobile ? 13 : 9, height: isMobile ? 13 : 9 }} />
              : <Square style={{ width: isMobile ? 13 : 9, height: isMobile ? 13 : 9 }} />
          } />
          <WinBtn onClick={onClose} color="red" isMobile={isMobile} icon={<X style={{ width: isMobile ? 14 : 10, height: isMobile ? 14 : 10 }} />} />
        </div>
      </div>

      {/* Window body */}
      <div className="flex-1 overflow-hidden" style={{ background: 'white', fontFamily: XP_FONT, fontSize: isMobile ? 13 : undefined }}>
        {children}
      </div>

      {/* Resize handle — bottom-right corner (desktop non-maximized only) */}
      {!win.maximized && !isMobile && onResizeStart && (
        <div
          onMouseDown={e => { e.stopPropagation(); onResizeStart(e); }}
          style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, cursor: 'se-resize', zIndex: 20,
            background: 'linear-gradient(135deg, transparent 50%, #a0a0a0 50%)',
          }}
        />
      )}
    </div>
  );
}

function WinBtn({ onClick, color, isMobile = false, icon }: { onClick: () => void; color: 'blue' | 'red'; isMobile?: boolean; icon: React.ReactNode }) {
  const sz = isMobile ? 32 : 17;
  return (
    <button onClick={onClick}
      className="flex items-center justify-center rounded-sm text-white hover:opacity-80 active:opacity-70"
      style={{
        width: sz, height: sz,
        background: color === 'red'
          ? 'linear-gradient(180deg,#f97676 0%,#e02020 100%)'
          : 'linear-gradient(180deg,#7ab5f7 0%,#2d7aef 100%)',
        border: color === 'red' ? '1px solid #aa1010' : '1px solid #1044aa',
        borderRadius: isMobile ? 6 : 2,
      }}>
      {icon}
    </button>
  );
}

// ── Filter sidebar primitives ─────────────────────────────────────────────────

function XPSquare({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(); }}
      style={{
        width: 13, height: 13, flexShrink: 0,
        background: 'white',
        boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #dfdfdf, inset 2px 2px 0 #404040',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
          <path d="M1.5 4.5L3.5 6.5L7.5 2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function XPCircle({ selected, onChange }: { selected: boolean; onChange: () => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(); }}
      style={{
        width: 12, height: 12, flexShrink: 0,
        border: '2px inset #808080',
        borderRadius: '50%',
        background: 'white',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {selected && <div style={{ width: 6, height: 6, background: '#316ac5', borderRadius: '50%' }} />}
    </div>
  );
}

function XPSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: '1px solid #c0bdb8' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '2px 6px',
          background: '#316ac5', color: 'white',
          fontSize: 11, fontFamily: XP_FONT,
          cursor: 'pointer', userSelect: 'none',
          fontWeight: 'bold',
        }}
      >
        <span>{label}</span>
        <span style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: -1 }}>{open ? '[-]' : '[+]'}</span>
      </div>
      {open && (
        <div style={{ padding: '4px 6px', background: '#f0eeeb' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── XP-style custom select ────────────────────────────────────────────────────

function XPSelect({ value, onChange, options, width = 152 }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: number;
}) {
  return (
    <div style={{
      position: 'relative', width, height: 22, flexShrink: 0,
      background: 'white',
      boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #dfdfdf, inset 2px 2px 0 #404040',
    }}>
      {/* Select fills the entire box — clicking anywhere (incl. arrow) opens dropdown */}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          paddingLeft: 4, paddingRight: 20,
          fontSize: 11, fontFamily: XP_FONT,
          background: 'transparent',
          border: 'none', outline: 'none',
          color: '#000', cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none',
          textAlign: 'center', textAlignLast: 'center',
          zIndex: 1,
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {/* Arrow — decorative only, pointer-events: none */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: 17,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderLeft: '1px solid #c0bdb8',
        background: 'linear-gradient(180deg,#f4f2ef 0%,#d4d0c8 100%)',
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <svg width="8" height="5" viewBox="0 0 8 5">
          <path d="M0 0L4 5L8 0Z" fill="#000" />
        </svg>
      </div>
    </div>
  );
}

// ── Library window content ────────────────────────────────────────────────────

const DESKTOP_PAGE_SIZE = 40;

function DesktopPagination({ page, total, onChange, count }: { page: number; total: number; onChange: (fn: (p: number) => number) => void; count: number }) {
  const [input, setInput] = useState(String(page + 1));
  useEffect(() => { setInput(String(page + 1)); }, [page]);
  const commit = () => {
    const n = parseInt(input) - 1;
    if (!isNaN(n)) onChange(() => Math.max(0, Math.min(total - 1, n)));
    else setInput(String(page + 1));
  };
  const btnStyle: React.CSSProperties = { height: 22, padding: '0 16px', fontSize: 11, fontFamily: XP_FONT, background: 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', border: '2px outset #fff', color: '#000', cursor: 'pointer' };
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f0eeeb', borderTop: '1px solid #c0bdb8' }}>
      <button onClick={() => onChange(p => Math.max(0, p - 1))} disabled={page === 0}
        style={{ ...btnStyle, opacity: page === 0 ? 0.5 : 1, cursor: page === 0 ? 'default' : 'pointer' }}>◀ Prev</button>
      <span style={{ fontSize: 11, fontFamily: XP_FONT, color: '#555' }}>Page</span>
      <input type="text" value={input} onChange={e => setInput(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        style={{ width: 38, height: 20, textAlign: 'center', fontSize: 11, fontFamily: XP_FONT, border: 'none', outline: 'none', background: 'white', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #fff, inset 2px 2px 0 #404040', color: '#000' }} />
      <span style={{ fontSize: 11, fontFamily: XP_FONT, color: '#555' }}>of {total}</span>
      <button onClick={() => onChange(p => Math.min(total - 1, p + 1))} disabled={page >= total - 1}
        style={{ ...btnStyle, opacity: page >= total - 1 ? 0.5 : 1, cursor: page >= total - 1 ? 'default' : 'pointer' }}>Next ▶</button>
      <span style={{ fontSize: 10, color: '#888', fontFamily: XP_FONT, marginLeft: 4 }}>{count} titles</span>
    </div>
  );
}

function LibraryContent({ movies, onMovieClick, winWidth, comments, allMovies, onCommentClick }: {
  movies: Movie[];
  onMovieClick: (m: Movie) => void;
  winWidth?: number;
  comments?: XPComment[];
  allMovies?: Movie[];
  onCommentClick?: (m: Movie) => void;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<XPLibFilters>(DEFAULT_LIB_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [desktopPage, setDesktopPage] = useState(0);

  const setF = (patch: Partial<XPLibFilters>) => setFilters(f => ({ ...f, ...patch }));

  const allGenres = [...new Set(movies.flatMap(m => m.genre?.split(',').map(g => g.trim()) ?? []))].filter(Boolean).sort();
  const genreCount = (genre: string) => movies.filter(m => m.genre?.split(',').map(g => g.trim()).includes(genre)).length;

  const displayed = (() => {
    let list = movies.filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()));

    // Genre multi-select
    if (filters.genres.length > 0) {
      list = list.filter(m => {
        const mg = m.genre?.split(',').map(g => g.trim()) ?? [];
        return filters.genres.some(g => mg.includes(g));
      });
    }

    // Show movies / TV
    const isTv = (m: Movie) => !!m.runtime?.toLowerCase().includes('season');
    if (!filters.showMovies && !filters.showTv) {
      // both off — show nothing
      list = [];
    } else if (!filters.showMovies) {
      list = list.filter(isTv);
    } else if (!filters.showTv) {
      list = list.filter(m => !isTv(m));
    }

    // Runtime (only applies to movies when TV series are excluded or mixed)
    if (filters.runtime !== 'all') {
      list = list.filter(m => {
        if (isTv(m)) return true; // don't hide TV by runtime selector
        const mins = parseInt(m.runtime ?? '0') || 0;
        if (filters.runtime === 'short')  return mins > 0 && mins <= 90;
        if (filters.runtime === 'medium') return mins > 90 && mins <= 150;
        if (filters.runtime === 'long')   return mins > 150;
        return true;
      });
    }

    // Ratings
    if (filters.minRating > 0) {
      list = list.filter(m => (m.imdbRating || m.rating || 0) >= filters.minRating);
    }

    // Sort
    list = [...list].sort((a, b) => {
      switch (filters.sortBy) {
        case 'oldest':    return (a.dateAdded ?? 0) - (b.dateAdded ?? 0);
        case 'titleAsc':  return a.title.localeCompare(b.title);
        case 'titleDesc': return b.title.localeCompare(a.title);
        case 'ratingHigh': return (b.imdbRating || b.rating || 0) - (a.imdbRating || a.rating || 0);
        case 'ratingLow':  return (a.imdbRating || a.rating || 0) - (b.imdbRating || b.rating || 0);
        default:          return (b.dateAdded ?? 0) - (a.dateAdded ?? 0); // newest
      }
    });

    return list;
  })();

  const isAnime = (m: Movie) => !!(m.genre?.toLowerCase().includes('anime') || m.genre?.toLowerCase().includes('animation'));
  const isTvSeries = (m: Movie) => !!m.runtime?.toLowerCase().includes('season');
  const movieCount = movies.filter(m => !isTvSeries(m) && !isAnime(m)).length;
  const animeCount = movies.filter(isAnime).length;
  const tvCount    = movies.filter(isTvSeries).length;

  const activeFilterCount =
    filters.genres.length +
    (!filters.showMovies || !filters.showTv ? 1 : 0) +
    (filters.runtime !== 'all' ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0);

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, cursor: 'pointer', fontSize: 11, fontFamily: XP_FONT, color: '#000', userSelect: 'none' };

  const toggleGenre = (g: string) =>
    setF({ genres: filters.genres.includes(g) ? filters.genres.filter(x => x !== g) : [...filters.genres, g] });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white', fontFamily: XP_FONT }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', flexShrink: 0, background: '#f0eeeb', borderBottom: '1px solid #c0bdb8' }}>
        <input
          type="text" placeholder="Search titles..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ height: 22, padding: '0 6px', flex: 1, outline: 'none', fontSize: 11, fontFamily: XP_FONT, background: 'white', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #dfdfdf, inset 2px 2px 0 #404040', border: 'none', color: '#000' }}
        />
        <XPSelect
          value={filters.sortBy}
          onChange={v => setF({ sortBy: v as XPLibFilters['sortBy'] })}
          width={152}
          options={[
            { value: 'newest',      label: 'Newest First'       },
            { value: 'oldest',      label: 'Oldest First'       },
            { value: 'titleAsc',    label: 'Title (A - Z)'      },
            { value: 'titleDesc',   label: 'Title (Z - A)'      },
            { value: 'ratingHigh',  label: 'IMDb (High - Low)'  },
            { value: 'ratingLow',   label: 'IMDb (Low - High)'  },
          ]}
        />
      </div>

      {/* Body: LEFT filter panel + movie grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left filter panel */}
        {showFilters && <div className="xp-scroll" style={{ width: 158, borderRight: '2px solid #c0bdb8', overflowY: 'auto', flexShrink: 0, background: '#f0eeeb', display: 'flex', flexDirection: 'column' }}>

          {/* Genre — only the list scrolls */}
          <XPSection label="Genre">
            <div className="xp-scroll" style={{ maxHeight: 130, overflowY: 'auto', paddingRight: 2 }}>
              {allGenres.map(g => (
                <div key={g} style={rowStyle} onClick={() => toggleGenre(g)}>
                  <XPSquare checked={filters.genres.includes(g)} onChange={() => toggleGenre(g)} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                    {g} <span style={{ color: '#666' }}>({genreCount(g)})</span>
                  </span>
                </div>
              ))}
              {allGenres.length === 0 && <span style={{ fontSize: 10, color: '#888' }}>No genres</span>}
            </div>
          </XPSection>

          {/* Runtime */}
          <XPSection label="Runtime">
            <div style={rowStyle} onClick={() => setF({ showMovies: !filters.showMovies })}>
              <XPSquare checked={filters.showMovies} onChange={() => setF({ showMovies: !filters.showMovies })} />
              <span>Movies</span>
            </div>
            <div style={rowStyle} onClick={() => setF({ showTv: !filters.showTv })}>
              <XPSquare checked={filters.showTv} onChange={() => setF({ showTv: !filters.showTv })} />
              <span>TV series</span>
            </div>
            <div style={{ borderTop: '1px solid #aaa', margin: '4px 0' }} />
            {(['all','short','medium','long'] as const).map(r => (
              <div key={r} style={rowStyle} onClick={() => setF({ runtime: r })}>
                <XPCircle selected={filters.runtime === r} onChange={() => setF({ runtime: r })} />
                <span style={{ fontSize: 10 }}>{r === 'all' ? 'All lengths' : r === 'short' ? '< 90 min' : r === 'medium' ? '90–150 min' : '> 150 min'}</span>
              </div>
            ))}
          </XPSection>

          {/* Ratings — 2 columns + slider */}
          <XPSection label="Ratings">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 4px', marginBottom: 5 }}>
              {([0, 8, 7, 6] as const).map(rating => (
                <div key={rating} style={{ ...rowStyle, marginBottom: 1 }} onClick={() => setF({ minRating: rating })}>
                  <XPCircle selected={filters.minRating === rating} onChange={() => setF({ minRating: rating })} />
                  <span style={{ fontSize: 10 }}>{rating === 0 ? 'All' : `${rating}+`}</span>
                </div>
              ))}
            </div>
            {/* XP-style slider */}
            <div style={{ paddingTop: 2, borderTop: '1px solid #c0bdb8' }}>
              <input
                type="range" min={0} max={10} step={1}
                value={filters.minRating}
                onChange={e => setF({ minRating: parseInt(e.target.value) })}
                className="xp-slider"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#777', fontFamily: XP_FONT }}>
                <span>0</span>
                <span style={{ color: '#316ac5', fontWeight: 'bold' }}>{filters.minRating > 0 ? `${filters.minRating}+` : 'Any'}</span>
                <span>10</span>
              </div>
            </div>
          </XPSection>

          {/* Spacer to push reset to bottom if content is short */}
          <div style={{ flex: 1 }} />

          {/* Reset button + active filter count */}
          <div style={{ padding: '5px 6px 4px', borderTop: '1px solid #c0bdb8' }}>
            <button
              onClick={() => setFilters(DEFAULT_LIB_FILTERS)}
              style={{ width: '100%', height: 22, fontSize: 11, fontFamily: XP_FONT, background: 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', border: '2px outset #fff', color: '#000', cursor: 'pointer', marginBottom: 3 }}
            >
              Reset Filters
            </button>
            {/* Active filter mini-status */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 4px', padding: '2px 0', borderTop: '1px solid #c0bdb8', paddingTop: 3 }}>
              <span style={{ fontSize: 10, color: activeFilterCount > 0 ? '#316ac5' : '#888', fontFamily: XP_FONT, fontWeight: activeFilterCount > 0 ? 'bold' : 'normal' }}>
                {activeFilterCount === 0 ? 'No filters active' : `${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
              </span>
              {filters.genres.length > 0 && (
                <span style={{ fontSize: 10, color: '#555', fontFamily: XP_FONT }}>{filters.genres.length} genre{filters.genres.length !== 1 ? 's' : ''}</span>
              )}
              {filters.minRating > 0 && (
                <span style={{ fontSize: 10, color: '#555', fontFamily: XP_FONT }}>{filters.minRating}+ rating</span>
              )}
              {filters.runtime !== 'all' && (
                <span style={{ fontSize: 10, color: '#555', fontFamily: XP_FONT }}>runtime set</span>
              )}
            </div>
          </div>

          {/* Recent Comments section */}
          {comments && comments.length > 0 && onCommentClick && (
            <div style={{ borderTop: '2px solid #808080', marginTop: 2 }}>
              <div style={{ padding: '2px 6px', background: '#316ac5', color: 'white', fontSize: 11, fontFamily: XP_FONT, fontWeight: 'bold' }}>Recent Comments</div>
              <div style={{ padding: '4px 4px', background: '#f0eeeb' }}>
                {[...comments].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5).map(c => {
                  const movie = (allMovies || []).find(m => m.id === c.movieId);
                  if (!movie) return null;
                  const words = c.text.split(' ');
                  const preview = words.length > 6 ? words.slice(0, 6).join(' ') + '...' : c.text;
                  const date = new Date(c.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                  return (
                    <div key={c.id}
                      onClick={() => onCommentClick(movie)}
                      style={{ padding: '3px 4px', marginBottom: 3, background: 'white', border: '1px inset #808080', cursor: 'pointer', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #fff' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dbe8f7'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; }}>
                      <div style={{ fontSize: 10, fontWeight: 'bold', color: '#000', fontFamily: XP_FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{movie.title}</div>
                      <div style={{ fontSize: 10, color: '#444', fontFamily: XP_FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
                      <div style={{ fontSize: 9, color: '#888', fontFamily: XP_FONT, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{c.username}</span><span>{date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>}

        {/* Movie grid — desktop: 6-10 per row (responsive to window width), 40 per page */}
        {(() => {
          const cols = Math.max(6, Math.min(10, Math.floor(((winWidth ?? 960) - 170) / 110)));
          const totalPages = Math.ceil(displayed.length / DESKTOP_PAGE_SIZE);
          const pageMovies = displayed.slice(desktopPage * DESKTOP_PAGE_SIZE, (desktopPage + 1) * DESKTOP_PAGE_SIZE);
          return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'hidden', overflowX: 'hidden', background: 'white' }}>
              <div className="xp-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 8, background: 'white' }}>
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {pageMovies.map(m => (
                    <button
                      key={m.id}
                      onDoubleClick={() => onMovieClick(m)}
                      title={m.title}
                      style={{ background: 'transparent', border: '1px solid transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 3 }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#dbe8f7'; e.currentTarget.style.border = '1px dotted #316ac5'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; }}
                    >
                      <div style={{ width: '100%', aspectRatio: '2/3', border: '1px solid #aaa', overflow: 'hidden' }}>
                        <img src={m.image} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      </div>
                      <p style={{ fontSize: 9, fontFamily: XP_FONT, marginTop: 3, color: '#111', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', width: '100%' }}>{m.title}</p>
                      <div style={{ marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <Star style={{ width: 7, height: 7 }} className="fill-[#d07339] text-[#d07339] flex-shrink-0" />
                        <span style={{ fontSize: 9, color: '#555', fontFamily: XP_FONT }}>{(m.imdbRating || m.rating)?.toFixed(1)}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {displayed.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 12, color: '#666', fontFamily: XP_FONT }}>No movies found</div>
                )}
              </div>
              {/* Desktop pagination */}
              {totalPages > 1 && (
                <DesktopPagination page={desktopPage} total={totalPages} onChange={setDesktopPage} count={displayed.length} />
              )}
            </div>
          );
        })()}
      </div>

      {/* XP Status bar */}
      <div style={{ height: 22, flexShrink: 0, display: 'flex', alignItems: 'stretch', background: '#f0eeeb', borderTop: '1px solid #c0bdb8', fontFamily: XP_FONT }}>
        {[
          'Ready',
          `${movies.length} titles`,
          `${movieCount} movies`,
          `${animeCount} anime`,
          `${tvCount} TV series`,
        ].map((text, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 11, color: '#000', borderRight: '1px solid #c0bdb8', borderTop: '1px solid #fff', whiteSpace: 'nowrap' }}>
            {text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── XP Comments Section ───────────────────────────────────────────────────────

const XP_EMOTICONS = ['😊', '😁', '😛', '😢', '😉', '❤️', '😂', '😮', '😈', '😐', '😎', '🤔', '😅', '🥲', '😤'];
const XP_REACTIONS = ['👍', '❤️', '😂', '😮'];

function XPCommentsSection({ movie, comments, onAddComment, onDeleteComment, currentUser }: {
  movie: Movie;
  comments?: XPComment[];
  onAddComment?: (movieId: number, text: string) => void;
  onDeleteComment?: (movieId: number, commentId: string) => void;
  currentUser?: any;
}) {
  const F = XP_FONT;
  const [text, setText] = useState('');
  const [postUsername, setPostUsername] = useState('');
  const [imgError, setImgError] = useState('');
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string | number; username: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyUsername, setReplyUsername] = useState('');
  const [showAdminDelete, setShowAdminDelete] = useState(false);
  const [adminDeleteId, setAdminDeleteId] = useState<string | null>(null);
  const [adminDeletePassword, setAdminDeletePassword] = useState('');
  const [adminDeleteError, setAdminDeleteError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<any[]>([]);
  const gifDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyGifOpen, setReplyGifOpen] = useState(false);
  const [replyGifQuery, setReplyGifQuery] = useState('');
  const [replyGifResults, setReplyGifResults] = useState<any[]>([]);
  const [replyImgPreview, setReplyImgPreview] = useState<string | null>(null);
  const XP_GIF_API = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

  const searchGifsXP = async (q: string, setResults: (r: any[]) => void) => {
    if (!q.trim()) { setResults([]); return; }
    try {
      const r = await fetch(`${XP_GIF_API}/giphy/search?q=${encodeURIComponent(q)}&limit=12&offset=0`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const d = await r.json();
      setResults(d.data || []);
    } catch { setResults([]); }
  };

  const debouncedSearchGifs = (q: string, setResults: (r: any[]) => void) => {
    if (gifDebounceRef.current) clearTimeout(gifDebounceRef.current);
    gifDebounceRef.current = setTimeout(() => searchGifsXP(q, setResults), 400);
  };

  const xpBtn: React.CSSProperties = { height: 24, padding: '0 10px', fontSize: 11, fontFamily: F, background: 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', border: '2px outset #fff', color: '#000', cursor: 'pointer' };

  const getAnonymousUserId = () => {
    let id = localStorage.getItem('anonymousUserId');
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('anonymousUserId', id);
    }
    return id;
  };

  const allMovieComments = [...(comments || [])].filter(c => c.id && Number(c.movieId) === Number(movie.id));
  const topLevelComments = allMovieComments.filter(c => !(c as any).parentId).sort((a, b) => b.timestamp - a.timestamp);
  const repliesByParent = allMovieComments.filter(c => (c as any).parentId).reduce((acc, r) => {
    const pid = String((r as any).parentId);
    acc[pid] = [...(acc[pid] || []), r];
    return acc;
  }, {} as Record<string, XPComment[]>);

  const getReactions = (commentId: string): Record<string, string[]> => {
    try {
      const stored = localStorage.getItem('xp-reactions');
      const all = stored ? JSON.parse(stored) : {};
      return all[commentId] || {};
    } catch { return {}; }
  };

  const toggleReaction = (commentId: string, emoji: string) => {
    try {
      const stored = localStorage.getItem('xp-reactions');
      const all = stored ? JSON.parse(stored) : {};
      const cr = all[commentId] || {};
      const userId = currentUser?.username || 'guest';
      const users = cr[emoji] || [];
      if (users.includes(userId)) {
        cr[emoji] = users.filter((u: string) => u !== userId);
      } else {
        cr[emoji] = [...users, userId];
      }
      all[commentId] = cr;
      localStorage.setItem('xp-reactions', JSON.stringify(all));
      const reactUserId = currentUser?.id || localStorage.getItem('anonymousUserId') || 'guest';
      saveReactions(reactUserId, all).catch(() => {});
      setText(t => t);
    } catch {}
  };

  const canModerate = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const canDeleteComment = (commentUserId?: string) => {
    if (canModerate) return true;
    if (!currentUser) return false;
    const currentUserId = `user_${currentUser.username}`;
    return commentUserId === currentUserId;
  };

  const handleDeleteClick = (commentId: string | number, commentUserId?: string) => {
    const currentUserId = currentUser ? `user_${currentUser.username}` : getAnonymousUserId();
    const userOwnsComment = commentUserId === currentUserId;
    if (userOwnsComment || canModerate) {
      if (window.confirm('Delete this comment?')) {
        onDeleteComment?.(movie.id, String(commentId));
      }
    } else {
      setAdminDeleteId(String(commentId));
      setAdminDeletePassword('');
      setAdminDeleteError('');
      setShowAdminDelete(true);
    }
  };

  const handleAdminDeleteSubmit = () => {
    if (adminDeletePassword !== 'hassle') {
      setAdminDeleteError('Incorrect password');
      return;
    }
    if (adminDeleteId) {
      onDeleteComment?.(movie.id, adminDeleteId);
    }
    setShowAdminDelete(false);
    setAdminDeleteId(null);
    setAdminDeletePassword('');
    setAdminDeleteError('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `comment-imgs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: up } = await supabase.storage.from('chat-images').upload(path, file, { contentType: file.type, upsert: false });
      if (up?.path) {
        const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(up.path);
        if (pub?.publicUrl) { setImgPreview(pub.publicUrl); e.target.value = ''; return; }
      }
    } catch {}
    // fallback: base64
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = () => {
    if (!text.trim() && !imgPreview) return;
    const username = currentUser?.username || postUsername.trim() || 'Guest';
    if (onAddComment) {
      onAddComment(movie.id, JSON.stringify({ text: text.trim() || '', username, imageUrl: imgPreview || undefined }));
    }
    setText('');
    setImgPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplySubmit = (parentId: string | number) => {
    if (!replyText.trim() && !replyImgPreview) return;
    const username = currentUser?.username || replyUsername.trim() || 'Guest';
    if (onAddComment) {
      onAddComment(movie.id, JSON.stringify({ text: replyText.trim() || '', username, parentId: String(parentId), imageUrl: replyImgPreview || undefined }));
    }
    setReplyText('');
    setReplyUsername('');
    setReplyTo(null);
    setReplyImgPreview(null);
    setReplyGifOpen(false);
  };

  return (
    <div style={{ marginTop: 8, border: '2px inset #808080', background: '#f0eeeb', fontFamily: F }}>
      {/* Header */}
      <div style={{ background: '#316ac5', color: 'white', fontSize: 11, fontWeight: 'bold', padding: '2px 6px', fontFamily: F }}>
        Comments ({allMovieComments.length})
      </div>

      {/* Existing comments */}
      <div style={{ maxHeight: 220, overflowY: 'auto', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 4 }} className="xp-scroll">
        {topLevelComments.length === 0 && (
          <div style={{ fontSize: 11, color: '#888', fontFamily: F, padding: '4px 0' }}>No comments yet. Be the first!</div>
        )}
        {topLevelComments.map(c => {
          const reactions = getReactions(String(c.id));
          const date = new Date(c.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
          const cReplies = repliesByParent[String(c.id)] || [];
          const isReplyingToThis = replyTo?.id === c.id;
          return (
            <div key={c.id}>
              {/* Main comment */}
              <div style={{ background: 'white', border: '1px inset #808080', padding: '4px 6px', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, alignItems: 'flex-start' }}>
                  {(c as any).userId?.startsWith?.('user_') ? (
                    <span
                      onClick={() => window.open(`/users/${c.username}`, '_blank')}
                      style={{ fontSize: 10, fontWeight: 'bold', color: '#316ac5', fontFamily: F, cursor: 'pointer', textDecoration: 'underline' }}
                    >{c.username}</span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 'bold', color: '#444', fontFamily: F }}>{c.username}</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: '#888', fontFamily: F }}>{date}</span>
                    {canDeleteComment((c as any).userId) && (
                      <button onClick={() => handleDeleteClick(c.id, (c as any).userId)}
                        title="Delete comment"
                        style={{ width: 14, height: 14, background: '#c8352a', color: 'white', border: '1px outset #fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: F, flexShrink: 0 }}>
                        ×
                      </button>
                    )}
                  </div>
                </div>
                {c.text && <div style={{ fontSize: 11, color: '#000', fontFamily: F, lineHeight: 1.4, wordBreak: 'break-word' }}>{c.text}</div>}
                {(c as any).imageUrl && <img src={(c as any).imageUrl} alt="attachment" style={{ maxHeight: 80, maxWidth: 140, display: 'block', marginTop: 3, border: '1px solid #808080' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {XP_REACTIONS.map(emoji => {
                    const users = reactions[emoji] || [];
                    const count = users.length;
                    const userId = currentUser?.username || 'guest';
                    const reacted = users.includes(userId);
                    return (
                      <button key={emoji} onClick={() => toggleReaction(String(c.id), emoji)}
                        style={{ fontSize: 11, fontFamily: F, padding: '1px 5px', cursor: 'pointer', background: reacted ? '#dbe8f7' : '#d4d0c8', border: reacted ? '2px inset #808080' : '2px outset #fff', color: '#000' }}>
                        {emoji}{count > 0 ? ` ${count}` : ''}
                      </button>
                    );
                  })}
                  <button onClick={() => { setReplyTo(isReplyingToThis ? null : { id: c.id, username: c.username }); setReplyText(''); setReplyUsername(''); }}
                    style={{ fontSize: 10, fontFamily: F, padding: '1px 6px', cursor: 'pointer', background: isReplyingToThis ? '#dbe8f7' : '#d4d0c8', border: isReplyingToThis ? '2px inset #808080' : '2px outset #fff', color: '#316ac5', marginLeft: 2 }}>
                    ↩ Reply{cReplies.length > 0 ? ` (${cReplies.length})` : ''}
                  </button>
                </div>
              </div>
              {/* Replies */}
              {cReplies.length > 0 && (
                <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                  {cReplies.sort((a,b) => a.timestamp - b.timestamp).map(r => (
                    <div key={r.id} style={{ background: '#f8f6f2', border: '1px solid #c0bdb8', padding: '3px 6px', borderLeft: '3px solid #316ac5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                        {(r as any).userId?.startsWith?.('user_') ? (
                          <span onClick={() => window.open(`/users/${r.username}`, '_blank')} style={{ fontSize: 10, fontWeight: 'bold', color: '#316ac5', fontFamily: F, cursor: 'pointer', textDecoration: 'underline' }}>{r.username}</span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 'bold', color: '#444', fontFamily: F }}>{r.username}</span>
                        )}
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: '#aaa', fontFamily: F }}>{new Date(r.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          {canDeleteComment((r as any).userId) && (
                            <button onClick={() => handleDeleteClick(r.id, (r as any).userId)}
                              style={{ width: 12, height: 12, background: '#c8352a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: F }}>×</button>
                          )}
                        </div>
                      </div>
                      {r.text && <div style={{ fontSize: 11, color: '#000', fontFamily: F, lineHeight: 1.4, wordBreak: 'break-word' }}>{r.text}</div>}
                      {(r as any).imageUrl && <img src={(r as any).imageUrl} alt="attachment" style={{ maxHeight: 60, maxWidth: 100, display: 'block', marginTop: 2, border: '1px solid #808080' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    </div>
                  ))}
                </div>
              )}
              {/* Inline reply form */}
              {isReplyingToThis && (
                <div style={{ marginLeft: 12, marginTop: 2, background: '#e8e4dc', border: '1px solid #c0bdb8', padding: '4px 6px', borderLeft: '3px solid #316ac5' }}>
                  <div style={{ fontSize: 10, color: '#555', fontFamily: F, marginBottom: 2 }}>Replying to <strong>{c.username}</strong></div>
                  {!currentUser && (
                    <input value={replyUsername} onChange={e => setReplyUsername(e.target.value)}
                      placeholder="Your name..." maxLength={30}
                      style={{ width: '100%', fontSize: 11, fontFamily: F, background: 'white', border: 'none', outline: 'none', boxSizing: 'border-box', padding: '2px 4px', boxShadow: 'inset 1px 1px 0 #808080', color: '#000', display: 'block', marginBottom: 3 }} />
                  )}
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder={`Reply to ${c.username}...`} rows={2}
                    style={{ width: '100%', resize: 'none', fontSize: 11, fontFamily: F, background: 'white', border: 'none', outline: 'none', boxSizing: 'border-box', padding: '2px 4px', boxShadow: 'inset 1px 1px 0 #808080', color: '#000', display: 'block', marginBottom: 4 }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReplySubmit(c.id); } }}
                  />
                  {replyImgPreview && (
                    <div style={{ marginBottom: 4, position: 'relative', display: 'inline-block' }}>
                      <img src={replyImgPreview} alt="preview" style={{ maxHeight: 50, maxWidth: 70, border: '1px solid #808080', display: 'block' }} />
                      <button onClick={() => setReplyImgPreview(null)} style={{ position: 'absolute', top: -5, right: -5, width: 12, height: 12, background: '#e02020', color: 'white', border: 'none', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: F }}>×</button>
                    </div>
                  )}
                  {replyGifOpen && (
                    <div style={{ marginBottom: 4, background: '#f0eeea', border: '1px inset #808080', padding: 3 }}>
                      <input value={replyGifQuery} onChange={e => { setReplyGifQuery(e.target.value); debouncedSearchGifs(e.target.value, setReplyGifResults); }}
                        placeholder="Search GIFs…" style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, fontFamily: F, padding: '2px 4px', border: '2px inset #808080', background: 'white', color: '#000', marginBottom: 3, display: 'block', outline: 'none' }} />
                      {replyGifResults.length === 0 && <div style={{ fontSize: 9, color: '#808080', fontFamily: F, textAlign: 'center', padding: 3 }}>{replyGifQuery ? 'No GIFs found' : 'Type to search…'}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, maxHeight: 80, overflowY: 'auto' }}>
                        {replyGifResults.map((g: any, i: number) => (
                          <img key={i} src={g.images?.fixed_height_small?.url || g.images?.fixed_height?.url} alt="gif"
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', cursor: 'pointer', border: '1px solid #c0bdb8' }}
                            onClick={() => { setReplyImgPreview(g.images?.original?.url || g.images?.fixed_height?.url); setReplyGifOpen(false); setReplyGifQuery(''); setReplyGifResults([]); }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleReplySubmit(c.id)} disabled={!replyText.trim() && !replyImgPreview} style={{ ...xpBtn, opacity: (replyText.trim() || replyImgPreview) ? 1 : 0.5 }}>Post Reply</button>
                    <button onClick={() => { setReplyGifOpen(v => !v); setReplyGifQuery(''); setReplyGifResults([]); }}
                      style={{ ...xpBtn, background: replyGifOpen ? '#d07339' : 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', color: replyGifOpen ? 'white' : '#000', fontWeight: 'bold' }}>GIF</button>
                    <button onClick={() => { setReplyTo(null); setReplyText(''); setReplyUsername(''); setReplyImgPreview(null); setReplyGifOpen(false); }} style={xpBtn}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div style={{ borderTop: '1px solid #c0bdb8', padding: '5px 6px', background: '#d4d0c8' }}>
        {currentUser ? (
          <div style={{ fontSize: 10, color: '#555', fontFamily: F, marginBottom: 3 }}>
            Posting as: <strong>{currentUser.username}</strong>
          </div>
        ) : (
          <input value={postUsername} onChange={e => setPostUsername(e.target.value)}
            placeholder="Your name..." maxLength={30}
            style={{ width: '100%', fontSize: 11, fontFamily: F, background: 'white', border: 'none', outline: 'none', boxSizing: 'border-box', padding: '2px 4px', boxShadow: 'inset 1px 1px 0 #808080', color: '#000', display: 'block', marginBottom: 4 }} />
        )}
        {/* Emoticon row */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 4, flexWrap: 'wrap' }}>
          {XP_EMOTICONS.map(em => (
            <button key={em} onClick={() => setText(t => t + em)}
              style={{ fontSize: 11, fontFamily: '"Courier New", monospace', padding: '1px 4px', cursor: 'pointer', background: '#f0eeeb', border: '1px outset #fff', color: '#000', whiteSpace: 'nowrap' }}>
              {em}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write a comment..."
          rows={2}
          style={{ width: '100%', resize: 'vertical', fontSize: 11, fontFamily: F, background: 'white', border: 'none', outline: 'none', boxSizing: 'border-box', padding: '3px 5px', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #fff, inset 2px 2px 0 #404040', color: '#000', display: 'block', marginBottom: 4 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
        />
        {imgError && <div style={{ fontSize: 10, color: '#cc0000', fontFamily: F, marginBottom: 3 }}>{imgError}</div>}
        {imgPreview && (
          <div style={{ marginBottom: 4, position: 'relative', display: 'inline-block' }}>
            <img src={imgPreview} alt="preview" style={{ maxHeight: 60, maxWidth: 80, border: '1px solid #808080', display: 'block' }} />
            <button onClick={() => { setImgPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              style={{ position: 'absolute', top: -6, right: -6, width: 14, height: 14, background: '#e02020', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: F }}>×</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleSubmit} disabled={!text.trim() && !imgPreview}
            style={{ ...xpBtn, opacity: (!text.trim() && !imgPreview) ? 0.5 : 1 }}>Post</button>
          <button onClick={() => fileInputRef.current?.click()} style={xpBtn}>📎 Attach</button>
          <button onClick={() => { setGifOpen(v => !v); setGifQuery(''); setGifResults([]); }}
            style={{ ...xpBtn, background: gifOpen ? '#d07339' : 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', color: gifOpen ? 'white' : '#000', fontWeight: 'bold' }}>GIF</button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
        {gifOpen && (
          <div style={{ marginTop: 4, background: '#f0eeea', border: '1px inset #808080', padding: 4 }}>
            <input value={gifQuery} onChange={e => { setGifQuery(e.target.value); debouncedSearchGifs(e.target.value, setGifResults); }}
              placeholder="Search GIFs…" style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, fontFamily: F, padding: '2px 4px', border: '2px inset #808080', background: 'white', color: '#000', marginBottom: 4, display: 'block', outline: 'none' }} />
            {gifResults.length === 0 && <div style={{ fontSize: 9, color: '#808080', fontFamily: F, textAlign: 'center', padding: 4 }}>{gifQuery ? 'No GIFs found' : 'Type to search…'}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, maxHeight: 100, overflowY: 'auto' }}>
              {gifResults.map((g: any, i: number) => (
                <img key={i} src={g.images?.fixed_height_small?.url || g.images?.fixed_height?.url} alt="gif"
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', cursor: 'pointer', border: '1px solid #c0bdb8' }}
                  onClick={() => {
                    const url = g.images?.original?.url || g.images?.fixed_height?.url;
                    setImgPreview(url);
                    setGifOpen(false);
                    setGifQuery('');
                    setGifResults([]);
                  }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admin delete modal */}
      {showAdminDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
          <div style={{ background: '#d4d0c8', border: '2px outset #fff', boxShadow: '3px 3px 0 #000', width: 280, fontFamily: F }}>
            <div style={{ background: 'linear-gradient(90deg,#000080,#1084d0)', color: 'white', fontSize: 11, fontWeight: 'bold', padding: '3px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔒 Delete Comment</span>
              <button onClick={() => setShowAdminDelete(false)} style={{ background: '#d4d0c8', border: '2px outset #fff', color: '#000', cursor: 'pointer', fontWeight: 'bold', width: 16, height: 14, fontSize: 10, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: F }}>×</button>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 11, color: '#000', marginBottom: 8, fontFamily: F }}>Enter admin password to delete this comment:</div>
              <input type="password" value={adminDeletePassword} onChange={e => setAdminDeletePassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdminDeleteSubmit()}
                placeholder="Password" autoFocus
                style={{ width: '100%', boxSizing: 'border-box', fontSize: 11, fontFamily: F, padding: '2px 4px', border: '2px inset #808080', background: 'white', color: '#000', marginBottom: 4, display: 'block', outline: 'none' }} />
              {adminDeleteError && <div style={{ fontSize: 10, color: '#cc0000', fontFamily: F, marginBottom: 6 }}>{adminDeleteError}</div>}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={handleAdminDeleteSubmit} style={xpBtn}>OK</button>
                <button onClick={() => setShowAdminDelete(false)} style={xpBtn}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail window content ─────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{ width: 82, padding: '2px 6px', background: '#f0eeeb', borderRight: '1px solid #c0bdb8', fontWeight: 'bold', fontSize: 11, whiteSpace: 'nowrap', verticalAlign: 'top', fontFamily: XP_FONT, color: '#000' }}>
        {label}
      </td>
      <td style={{ padding: '2px 6px', fontSize: 11, fontFamily: XP_FONT, color: '#000', verticalAlign: 'top' }}>
        {value}
      </td>
    </tr>
  );
}

const XP_API = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

function DetailContent({ movie, isMobile = false, inWatchlist = false, onOpenPage, onMarkWatched, comments, onAddComment, onDeleteComment, onUpdateRating, currentUser }: { movie: Movie; isMobile?: boolean; inWatchlist?: boolean; onOpenPage: () => void; onMarkWatched?: () => void; comments?: XPComment[]; onAddComment?: (movieId: number, text: string) => void; onDeleteComment?: (movieId: number, commentId: string) => void; onUpdateRating?: (movieId: number, rating: number) => void; currentUser?: any; }) {
  const genres = movie.genre?.split(',').map(g => g.trim()).filter(Boolean) ?? [];
  const border = '1px solid #808080';
  const F = XP_FONT;
  const xpGrey = '#d4d0c8';
  const xpBtn: React.CSSProperties = { height: 28, padding: '0 14px', fontSize: 12, fontFamily: F, background: xpGrey, border: '2px outset #ffffff', color: '#000', cursor: 'pointer', whiteSpace: 'nowrap' };

  const [xpUserRating, setXpUserRating] = useState<number>(movie.userRating || 0);
  const [xpHoverRating, setXpHoverRating] = useState<number>(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const userIdentifier = currentUser.username || currentUser.id;
    fetch(`${XP_API}/user-ratings/${userIdentifier}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.userRatings?.[movie.id]) {
          setXpUserRating(data.userRatings[movie.id]);
        }
      })
      .catch(() => {});
  }, [movie.id, currentUser?.username]);

  const handleXpRate = async (star: number) => {
    if (ratingLoading) return;
    setXpUserRating(star);
    setRatingLoading(true);
    if (onUpdateRating) onUpdateRating(movie.id, star);
    if (currentUser) {
      const userIdentifier = currentUser.username || currentUser.id;
      await fetch(`${XP_API}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ movieId: movie.id, rating: star, userIdentifier }),
      }).catch(() => {});
    }
    setRatingLoading(false);
  };

  if (isMobile) {
    const imdbLink = movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/` : null;
    return (
      <div className="xp-scroll" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', background: xpGrey, fontFamily: F, color: '#000' }}>
        {/* Top section: poster + info */}
        <div style={{ display: 'flex', gap: 0, padding: 10, borderBottom: '2px solid #808080', background: xpGrey }}>
          {/* Poster */}
          <div style={{ flexShrink: 0, marginRight: 10 }}>
            <img src={movie.image} alt={movie.title}
              style={{ width: 110, height: 163, objectFit: 'cover', border: '2px inset #808080', display: 'block' }} />
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Title */}
            <div style={{ fontSize: 15, fontWeight: 'bold', color: '#000', fontFamily: F, lineHeight: 1.2, marginBottom: 2 }}>
              {movie.title}
            </div>
            {/* Underline */}
            <div style={{ height: 1, background: '#808080', marginBottom: 6 }} />
            {/* Info rows */}
            {[
              { label: 'Year', value: String(movie.year) },
              { label: 'Length', value: movie.runtime || '—' },
              { label: 'Genre', value: genres.join(', ') || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, color: '#444', fontFamily: F, width: 52, flexShrink: 0, fontWeight: 'bold' }}>{label}:</span>
                <span style={{ fontSize: 11, color: '#111', fontFamily: F, flex: 1, lineHeight: 1.3 }}>{value}</span>
              </div>
            ))}
            {/* IMDb + user stars inline under genre */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {(movie.imdbRating || movie.rating) && (
                <span style={{ fontSize: 11, fontFamily: F, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ color: '#f5c518', fontSize: 13 }}>★</span>
                  <span style={{ fontWeight: 'bold' }}>{(movie.imdbRating || movie.rating)?.toFixed(1)}</span>
                  <span style={{ color: '#666', fontSize: 10 }}>IMDb</span>
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star}
                    onMouseEnter={() => setXpHoverRating(star)}
                    onMouseLeave={() => setXpHoverRating(0)}
                    onClick={() => handleXpRate(star)}
                    style={{ background: 'none', border: 'none', cursor: ratingLoading ? 'wait' : 'pointer', fontSize: 20, lineHeight: 1, padding: '0 1px', color: star <= (xpHoverRating || xpUserRating) ? '#f5c518' : '#888' }}>
                    ★
                  </button>
                ))}
                {xpUserRating > 0 && (
                  <span style={{ fontSize: 10, color: '#555', fontFamily: F, marginLeft: 3 }}>{xpUserRating}/5</span>
                )}
                {!currentUser && (
                  <span style={{ fontSize: 10, color: '#888', fontFamily: F, marginLeft: 3 }}>sign in</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Plot — label outside, text in white box */}
        {(movie.plot || movie.description) && (
          <>
            <div style={{ padding: '6px 10px 3px', fontSize: 11, fontWeight: 'bold', color: '#316ac5', fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>Plot</div>
            <div style={{ margin: '0 10px 10px', padding: 8, background: 'white', border: '2px inset #808080' }}>
              <div style={{ fontSize: 12, color: '#111', lineHeight: 1.55, fontFamily: F }}>
                {movie.plot || movie.description}
              </div>
            </div>
          </>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 10px', flexWrap: 'wrap' }}>
          {inWatchlist && onMarkWatched && (
            <button onClick={onMarkWatched} style={xpBtn}>✓ Mark as Watched</button>
          )}
          {imdbLink && (
            <button onClick={() => window.open(imdbLink, '_blank')} style={xpBtn}>IMDb</button>
          )}
          <button onClick={onOpenPage} style={xpBtn}>Full Page</button>
        </div>

        {/* Comments section */}
        <XPCommentsSection movie={movie} comments={comments} onAddComment={onAddComment} onDeleteComment={onDeleteComment} currentUser={currentUser} />
      </div>
    );
  }

  return (
    <div className="xp-scroll flex flex-col h-full overflow-auto" style={{ background: 'white', fontFamily: XP_FONT, color: '#000' }}>
      {/* Top: poster + title/meta side by side */}
      <div className="flex gap-0 flex-shrink-0" style={{ borderBottom: border, padding: 8 }}>
        <div className="flex-shrink-0 mr-3">
          <img src={movie.image} alt={movie.title}
            style={{ width: 96, aspectRatio: '2/3', objectFit: 'cover', border, display: 'block' }} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div style={{ fontSize: 14, fontWeight: 'bold', color: '#000', fontFamily: XP_FONT, lineHeight: 1.3, marginBottom: 4 }}>
              {movie.title}
            </div>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}>
              {movie.year}{movie.runtime ? ` · ${movie.runtime}` : ''}
            </div>
            {genres.length > 0 && (
              <div style={{ fontSize: 11, color: '#333', marginBottom: 6 }}>
                {genres.join(' / ')}
              </div>
            )}
            {/* IMDb rating + interactive stars inline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              {(movie.imdbRating || movie.rating) && (
                <span style={{ fontSize: 11, fontFamily: XP_FONT, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Star style={{ width: 11, height: 11, fill: '#f5c518', color: '#f5c518' }} />
                  <span style={{ fontWeight: 'bold' }}>{(movie.imdbRating || movie.rating)?.toFixed(1)}</span>
                  <span style={{ color: '#666' }}>IMDb</span>
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star}
                    onMouseEnter={() => setXpHoverRating(star)}
                    onMouseLeave={() => setXpHoverRating(0)}
                    onClick={() => handleXpRate(star)}
                    title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    style={{ background: 'none', border: 'none', cursor: ratingLoading ? 'wait' : 'pointer', fontSize: 17, lineHeight: 1, padding: '0 1px', color: star <= (xpHoverRating || xpUserRating) ? '#f5c518' : '#888' }}>
                    ★
                  </button>
                ))}
                {xpUserRating > 0 && (
                  <span style={{ fontSize: 10, color: '#555', fontFamily: XP_FONT, marginLeft: 3 }}>{xpUserRating}/5</span>
                )}
                {!currentUser && (
                  <span style={{ fontSize: 10, color: '#888', fontFamily: XP_FONT, marginLeft: 3 }}>sign in to rate</span>
                )}
              </span>
            </div>
            {movie.imdbID && (
              <a href={`https://www.imdb.com/title/${movie.imdbID}/`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', fontSize: 11, fontFamily: XP_FONT, background: '#f5c518', border: '2px outset #fff', padding: '1px 8px', cursor: 'pointer', color: '#000', fontWeight: 'bold', textDecoration: 'none', marginBottom: 4 }}>
                IMDb
              </a>
            )}
          </div>
          <button onClick={onOpenPage}
            style={{ alignSelf: 'flex-start', fontSize: 11, fontFamily: XP_FONT, background: '#f0eeeb', border: '2px outset #fff', padding: '2px 10px', cursor: 'pointer', color: '#000' }}>
            Open Full Page
          </button>
        </div>
      </div>

      <div className="xp-scroll" style={{ padding: '0 8px 8px', flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, border }}>
          <tbody>
            <tr>
              <td colSpan={2} style={{ background: '#316ac5', color: 'white', fontSize: 11, fontWeight: 'bold', padding: '2px 6px', fontFamily: XP_FONT }}>Details</td>
            </tr>
            {movie.director && <DetailRow label="Director" value={movie.director} />}
            {movie.cast && movie.cast.length > 0 && <DetailRow label="Cast" value={movie.cast.join(', ')} />}
            {movie.runtime && <DetailRow label="Runtime" value={movie.runtime} />}
            {movie.year && <DetailRow label="Year" value={movie.year} />}
            {genres.length > 0 && <DetailRow label="Genre" value={genres.join(', ')} />}
            {movie.communityRating && movie.communityRating > 0 && <DetailRow label="Community" value={`${movie.communityRating.toFixed(1)} / 10`} />}
            {movie.tags && movie.tags.length > 0 && <DetailRow label="Tags" value={movie.tags.join(', ')} />}
            {(movie.plot || movie.description) && (
              <>
                <tr><td colSpan={2} style={{ background: '#316ac5', color: 'white', fontSize: 11, fontWeight: 'bold', padding: '2px 6px', fontFamily: XP_FONT, borderTop: '2px solid #c0bdb8' }}>Plot</td></tr>
                <tr><td colSpan={2} style={{ padding: '4px 6px', fontSize: 11, fontFamily: XP_FONT, color: '#000', lineHeight: 1.5, background: 'white' }}>{movie.plot || movie.description}</td></tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '0 8px 8px' }}>
        <XPCommentsSection movie={movie} comments={comments} onAddComment={onAddComment} onDeleteComment={onDeleteComment} currentUser={currentUser} />
      </div>

      <div className="flex-shrink-0 flex items-center px-2"
        style={{ height: 22, background: '#f0eeeb', borderTop: '1px solid #c0bdb8', fontSize: 11, fontFamily: XP_FONT }}>
        <span style={{ color: '#000' }}>Ready</span>
      </div>
    </div>
  );
}

function MobileDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #e8e4dc' }}>
      <span style={{ fontSize: 12, color: '#888', fontFamily: XP_FONT, flexShrink: 0, width: 72 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111', fontFamily: XP_FONT, flex: 1, lineHeight: 1.4 }}>{value}</span>
    </div>
  );
}

// ── XP Ticket Generator ───────────────────────────────────────────────────────

const XP_GREEK = ['Zeus','Hera','Poseidon','Demeter','Athena','Apollo','Artemis','Ares','Hephaestus','Aphrodite','Hermes','Dionysus'];
const XP_ROWS  = ['A','B','C','D','E','F','G','H','J','K','L','M'];
const XP_TIMES = ['10:15','12:30','14:45','17:00','19:30','21:15','22:00','11:00','16:20','20:45'];
function xpRand<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }
function xpRandInt(lo: number, hi: number) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }
function xpPrice(): number {
  const d = xpRandInt(6, 9); let c = xpRandInt(1, 99);
  while (c === 0 || c === 50) c = xpRandInt(1, 99);
  return d + c / 100;
}

interface XPTicketData {
  hall: string; row: string; seat: number;
  price: number; time: string; date: string; ref: string;
}

function xpMakeData(): XPTicketData {
  return {
    hall:  `Dumpster Hall ${xpRand(XP_GREEK)}`,
    row:   xpRand(XP_ROWS),
    seat:  xpRandInt(1, 22),
    price: xpPrice(),
    time:  xpRand(XP_TIMES),
    date:  new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }),
    ref:   `TRB-${Math.random().toString(36).substring(2,8).toUpperCase()}`,
  };
}

function xpLoadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = reject;
    img.src = src.includes('?') ? `${src}&_xp=1` : `${src}?_xp=1`;
  });
}

function xpHBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Classic horizontal barcode (vertical bars)
  const seq = [2,1,3,1,1,2,1,3,2,1,1,2,3,1,2,1,1,3,1,2,1,1,2,3,1,2,1,3,1,2,1,1,2,3,1,2,2,1,3,1];
  let cx = x;
  seq.forEach((bw, i) => {
    if (i % 2 === 0) ctx.fillRect(cx, y, bw, h);
    cx += bw + (i % 3 === 0 ? 2 : 1);
  });
  while (cx < x + w - 3) {
    const bw = ((cx * 7 + 3) % 3) + 1;
    if ((cx * 13) % 3 !== 0) ctx.fillRect(cx, y, bw, h);
    cx += bw + 1;
  }
}

async function xpDrawTicket(canvas: HTMLCanvasElement, movie: Movie, data: XPTicketData) {
  const W = 660, H = 270, R = 14;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Match the main site font
  const F = '"Atkinson Hyperlegible", Arial, sans-serif';

  // Helper: rounded rect path
  const rrPath = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();
  };

  // Clip entire canvas to rounded ticket shape
  rrPath(0, 0, W, H, R);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.save(); rrPath(0, 0, W, H, R); ctx.clip();

  // ── Poster — 75% downscale → minimal ~1.3× pixelation
  const PW = 150, PH = H;
  try {
    const img = await xpLoadImg(movie.image);
    const iAR = img.naturalWidth/img.naturalHeight, cAR = PW/PH;
    let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
    if (iAR>cAR){sw=sh*cAR;sx=(img.naturalWidth-sw)/2;}
    else        {sh=sw/cAR;sy=(img.naturalHeight-sh)/2;}
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,sx,sy,sw,sh,0,0,PW,PH);
  } catch {
    ctx.fillStyle='#c0c0c0'; ctx.fillRect(0,0,PW,PH);
    ctx.fillStyle='#555'; ctx.font=`bold 10px ${F}`; ctx.textAlign='center';
    ctx.fillText('NO IMAGE',PW/2,PH/2);
  }

  // Poster right-edge fade to white
  const fadeG = ctx.createLinearGradient(PW-40,0,PW,0);
  fadeG.addColorStop(0,'rgba(255,255,255,0)'); fadeG.addColorStop(1,'#fff');
  ctx.fillStyle=fadeG; ctx.fillRect(PW-40,0,42,PH);

  // Vertical divider
  ctx.strokeStyle='#ccc'; ctx.lineWidth=1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(PW,0); ctx.lineTo(PW,H); ctx.stroke();

  // Dashed tear line
  const TEAR_X = W-128;
  ctx.strokeStyle='#bbb'; ctx.setLineDash([4,3]);
  ctx.beginPath(); ctx.moveTo(TEAR_X,0); ctx.lineTo(TEAR_X,H); ctx.stroke();
  ctx.setLineDash([]);

  // ── Middle content ────────────────────────────────────────────────────────
  const MX = PW+14, MW = TEAR_X-MX-10;
  ctx.textAlign='left';

  // Title — starts near top
  const titleRaw = movie.title.toUpperCase();
  const tSize = titleRaw.length>26 ? 13 : titleRaw.length>18 ? 15 : 18;
  ctx.font=`700 ${tSize}px ${F}`; ctx.fillStyle='#111';
  let tLines:string[]=[];
  if(ctx.measureText(titleRaw).width<=MW){tLines=[titleRaw];}
  else{
    const words=titleRaw.split(' ');let l1='',l2='',brk=false;
    for(const w of words){
      if(!brk&&ctx.measureText(l1+w+' ').width<MW)l1+=w+' ';
      else{brk=true;l2+=w+' ';}
    }
    tLines=[l1.trim(),l2.trim()].filter(Boolean);
  }
  let ty=22;
  tLines.forEach(line=>{ctx.fillText(line,MX,ty);ty+=tSize+3;});

  // Meta line immediately after title
  ty+=2;
  const genres=(movie.genre||'Film').split(',').map(g=>g.trim()).filter(Boolean).join(', ');
  const rt=movie.runtime??'';
  const imdb=(movie.imdbRating||movie.rating||0).toFixed(1);
  const meta=[String(movie.year),rt,genres,`IMDb ${imdb}`].filter(Boolean).join('  ·  ');
  ctx.font=`400 10px ${F}`; ctx.fillStyle='#555';
  ctx.fillText(meta.length>68?meta.slice(0,66)+'…':meta, MX, ty);

  // Rule 1 — sits directly on top of Date section
  const rule1Y = ty+10;
  const rule2Y = H-50;
  const hRule=(y:number,x1=MX,x2=MX+MW)=>{
    ctx.strokeStyle='#ddd'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x1,y); ctx.lineTo(x2,y); ctx.stroke();
  };
  hRule(rule1Y);

  // Date / Time / Hall — centered between rule1 and rule2
  const info=[{l:'Date',v:data.date},{l:'Time',v:data.time},{l:'Hall',v:data.hall}];
  const rowH=18, blockH=info.length*rowH;
  const infoStart=rule1Y+Math.round((rule2Y-rule1Y-blockH)/2)+rowH;
  info.forEach(({l,v},i)=>{
    const iy=infoStart+i*rowH;
    ctx.fillStyle='#888'; ctx.font=`400 9px ${F}`; ctx.fillText(l+':',MX,iy);
    ctx.fillStyle='#111'; ctx.font=`700 10px ${F}`; ctx.fillText(v,MX+40,iy);
  });

  hRule(rule2Y);

  // Row / Seat / Price — below rule2 at bottom
  const col3=MW/3, lblY=rule2Y+14, valY=rule2Y+30;
  ctx.fillStyle='#888'; ctx.font=`400 9px ${F}`;
  ctx.fillText('ROW',MX,lblY); ctx.fillText('SEAT',MX+col3,lblY); ctx.fillText('PRICE',MX+col3*2,lblY);
  ctx.fillStyle='#111'; ctx.font=`700 14px ${F}`;
  ctx.fillText(data.row,MX,valY); ctx.fillText(String(data.seat),MX+col3,valY);
  ctx.fillStyle='#000080'; ctx.fillText(`$${data.price.toFixed(2)}`,MX+col3*2,valY);

  // ── Right stub ────────────────────────────────────────────────────────────
  const SX=TEAR_X+8, SW=W-SX, SCX=SX+SW/2;
  ctx.textAlign='center';

  ctx.fillStyle='#888'; ctx.font=`400 8px ${F}`; ctx.fillText('REF',SCX,14);
  ctx.fillStyle='#111'; ctx.font=`700 8px ${F}`; ctx.fillText(data.ref,SCX,26);
  hRule(32,SX+4,SX+SW-8);

  // Barcode — leaves room for rule + ADMIT ONE
  const BC_Y=38, BC_H=H-BC_Y-38;
  ctx.fillStyle='#111';
  xpHBarcode(ctx,SX+4,BC_Y,SW-12,BC_H);

  ctx.fillStyle='#aaa'; ctx.font=`400 7px ${F}`;
  ctx.fillText(data.ref.replace('TRB-',''),SCX,BC_Y+BC_H+10);

  // Rule + ADMIT ONE with clear separation
  hRule(H-24,SX+4,SX+SW-8);
  ctx.fillStyle='#111'; ctx.font=`700 9px ${F}`;
  ctx.fillText('ADMIT ONE',SCX,H-10);

  ctx.restore();

  // Rounded border on top
  ctx.strokeStyle='#bbb'; ctx.lineWidth=1.5; ctx.setLineDash([]);
  rrPath(0,0,W,H,R); ctx.stroke();
}

function XPTicketContent({ movies, isMobile = false }: { movies: Movie[]; isMobile?: boolean }) {
  const [selectedId, setId] = useState<number | null>(movies[0]?.id ?? null);
  const [busy, setBusy]     = useState(false);
  const [data, setData]     = useState<XPTicketData | null>(null);
  const canvasRef           = useRef<HTMLCanvasElement>(null);

  const chosen = movies.find(m => m.id === selectedId) ?? null;

  const generate = useCallback(async (movie: Movie, td: XPTicketData) => {
    if (!canvasRef.current) return;
    setBusy(true);
    try { await xpDrawTicket(canvasRef.current, movie, td); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (!chosen) return;
    const td = xpMakeData(); setData(td);
    const t = setTimeout(() => generate(chosen, td), 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const regenerate = () => {
    if (!chosen) return;
    const td = xpMakeData(); setData(td); generate(chosen, td);
  };

  const download = () => {
    if (!canvasRef.current || !chosen) return;
    const src = canvasRef.current;
    // Export with transparent background outside ticket border
    const out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const oc = out.getContext('2d')!;
    oc.drawImage(src, 0, 0);
    const a = document.createElement('a');
    a.download = `xp-ticket-${chosen.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`;
    a.href = out.toDataURL('image/png'); a.click();
  };

  const xpBtn = (label: string, onClick: () => void, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 23, padding: '0 10px', fontSize: 11, fontFamily: XP_FONT, cursor: disabled ? 'default' : 'pointer',
        background: 'linear-gradient(180deg,#f4f2ef 0%,#d4d0c8 100%)',
        border: '2px outset #ffffff', color: '#000', opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );

  const movieSelectEl = (
    <div style={{ position:'relative', height:24, background:'white', boxShadow:'inset 1px 1px 0 #808080,inset -1px -1px 0 #dfdfdf,inset 2px 2px 0 #404040', flex: isMobile ? 1 : '0 0 260px', minWidth: 0 }}>
      <select value={selectedId ?? ''} onChange={e => setId(Number(e.target.value))}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', paddingLeft:4, paddingRight:20, fontSize:11, fontFamily:XP_FONT, background:'transparent', border:'none', outline:'none', color:'#000', cursor:'pointer', appearance:'none', WebkitAppearance:'none', zIndex:1 }}>
        {movies.map(m => <option key={m.id} value={m.id}>{m.title} ({m.year})</option>)}
      </select>
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:17, display:'flex', alignItems:'center', justifyContent:'center', borderLeft:'1px solid #c0bdb8', background:'linear-gradient(180deg,#f4f2ef 0%,#d4d0c8 100%)', pointerEvents:'none', zIndex:0 }}>
        <svg width="8" height="5" viewBox="0 0 8 5"><path d="M0 0L4 5L8 0Z" fill="#000"/></svg>
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', fontFamily: XP_FONT }}>
      {/* Toolbar */}
      {isMobile ? (
        <div style={{ flexShrink:0, padding:'6px 8px', background:'#f0eeeb', borderBottom:'1px solid #c0bdb8', display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color:'#000', flexShrink:0 }}>Movie:</span>
            {movieSelectEl}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {xpBtn('Generate Ticket', regenerate, busy || !chosen)}
            {xpBtn('Save PNG', download, busy || !chosen)}
          </div>
        </div>
      ) : (
        <div style={{ flexShrink:0, padding:'6px 8px', background:'#f0eeeb', borderBottom:'1px solid #c0bdb8', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#000' }}>Movie:</span>
          {movieSelectEl}
          <div style={{ display:'flex', gap:4 }}>
            {xpBtn('Generate', regenerate, busy || !chosen)}
            {xpBtn('Save PNG', download, busy || !chosen)}
          </div>
          {data && <span style={{ fontSize:10, color:'#808080', marginLeft:4 }}>Ref: {data.ref}  ·  Row {data.row} Seat {data.seat}</span>}
        </div>
      )}

      {/* Canvas area */}
      <div className="xp-scroll flex-1 overflow-auto" style={{ background:'#808080', display:'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent:'center', padding: isMobile ? '12px 8px' : 16, touchAction: isMobile ? 'auto' : 'auto' }}>
        <div style={{ position:'relative', boxShadow:'2px 2px 6px rgba(0,0,0,0.5)', width: isMobile ? '100%' : undefined }}>
          {busy && (
            <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2, fontSize:11, fontFamily:XP_FONT }}>
              Generating...
            </div>
          )}
          <canvas ref={canvasRef} style={{ display:'block', width: isMobile ? '100%' : undefined, height: isMobile ? 'auto' : undefined, maxWidth: isMobile ? undefined : '100%', imageRendering: isMobile ? 'auto' : 'pixelated' }} />
        </div>
      </div>

      {/* Ticket ready bar — below canvas for both mobile and desktop */}
      <div style={{ flexShrink:0, height:22, padding:'0 8px', display:'flex', alignItems:'center', background:'#f0eeeb', borderTop:'1px solid #c0bdb8', fontSize:11, fontFamily:XP_FONT }}>
        <span style={{ color:'#000' }}>{data ? `Ticket ready — $${data.price.toFixed(2)}  ·  ${data.time}  ·  ${data.hall}` : 'Ready'}</span>
      </div>
    </div>
  );
}

// ── CMD Search ───────────────────────────────────────────────────────────────

function CMDSearchContent({ allMovies, onOpen }: { allMovies: Movie[]; onOpen: (m: Movie) => void }) {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Movie[]>([]);
  const [history, setHistory] = useState<{ text: string; type: 'sys' | 'prompt' | 'out' | 'empty' }[]>([
    { type: 'sys',   text: 'Microsoft Windows XP [Version 5.1.2600]' },
    { type: 'sys',   text: '(C) Copyright 1985-2001 Microsoft Corp.' },
    { type: 'empty', text: '' },
    { type: 'sys',   text: 'C:\\TRASHBIN\\SEARCH> Trash Bin Cinema Search v1.0' },
    { type: 'sys',   text: 'Search your library by title, actor, or director.' },
    { type: 'sys',   text: 'Tip: type "[title] imdb link" to fetch an IMDb URL from OMDb.' },
    { type: 'empty', text: '' },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, results]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const detectImdbIntent = (q: string) => /imdb|imbd|omdb|ombd/i.test(q);
  const stripImdbWords = (q: string) => q.replace(/imdb\s*link|imbd\s*link|imdb\s*url|imbd\s*url|imdb|imbd|omdb|ombd|link|url/gi, '').replace(/\s+/g, ' ').trim();

  const handleSearch = async () => {
    const query = input.trim();
    if (!query) return;
    setInput('');

    // IMDb link intent: user wants an OMDb lookup
    if (detectImdbIntent(query)) {
      const movieTitle = stripImdbWords(query);
      const searchTitle = movieTitle || query;
      setHistory(h => [...h,
        { type: 'prompt', text: `C:\\TRASHBIN\\SEARCH> ${query}` },
        { type: 'empty',  text: '' },
        { type: 'out',    text: `Searching OMDb for "${searchTitle}"...` },
      ]);
      setResults([]);
      try {
        const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(searchTitle)}&apikey=f9062e1`);
        const data = await res.json();
        if (data.Response === 'True' && data.imdbID) {
          const link = `https://www.imdb.com/title/${data.imdbID}/`;
          setHistory(h => [...h,
            { type: 'out',   text: `  Title : ${data.Title} (${data.Year})` },
            { type: 'out',   text: `  Rating: ${data.imdbRating || 'N/A'}` },
            { type: 'out',   text: `  IMDb  : ${link}` },
            { type: 'sys',   text: `  ^ Copy this link and use "Add Movie" to add it to your library.` },
            { type: 'empty', text: '' },
          ]);
        } else {
          setHistory(h => [...h,
            { type: 'out',   text: `  No results found on OMDb for "${searchTitle}".` },
            { type: 'sys',   text: `  Try a different title spelling.` },
            { type: 'empty', text: '' },
          ]);
        }
      } catch {
        setHistory(h => [...h,
          { type: 'out',   text: `  Error reaching OMDb. Check your connection.` },
          { type: 'empty', text: '' },
        ]);
      }
      return;
    }

    // Normal local search
    const q = query.toLowerCase();
    const found = allMovies.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.director && m.director.toLowerCase().includes(q)) ||
      (m.cast && m.cast.some(a => a.toLowerCase().includes(q)))
    ).slice(0, 12);
    const newLines: { text: string; type: 'sys' | 'prompt' | 'out' | 'empty' }[] = [
      { type: 'prompt', text: `C:\\TRASHBIN\\SEARCH> ${query}` },
      { type: 'empty',  text: '' },
      { type: 'out',    text: found.length ? `Searching for "${query}"... ${found.length} result(s) found:` : `Searching for "${query}"... No results found. Try "[title] imdb link" to look it up on OMDb.` },
      { type: 'empty',  text: '' },
    ];
    setHistory(h => [...h, ...newLines]);
    setResults(found);
  };

  const colorFor = (type: string) => {
    if (type === 'sys') return '#a8a8a8';
    if (type === 'prompt') return '#ffff55';
    return '#c0c0c0';
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: '#000', fontFamily: '"Courier New", "Lucida Console", monospace', fontSize: 12 }}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex-1 overflow-y-auto xp-scroll p-3" style={{ paddingBottom: 4 }}>
        {history.map((line, i) => (
          <div key={i} className="leading-[1.5] whitespace-pre-wrap" style={{ color: colorFor(line.type) }}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {results.length > 0 && (
          <div>
            {results.map((m, i) => (
              <div
                key={m.id}
                className="leading-[1.6] px-1 cursor-pointer"
                style={{ color: '#55ffff' }}
                onMouseDown={() => { onOpen(m); setResults([]); setHistory(h => [...h, { type: 'sys', text: `Opening "${m.title}"...` }, { type: 'empty', text: '' }]); }}
                onMouseEnter={e => (e.currentTarget.style.background = '#000080')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {'  '}[{String(i + 1).padStart(2, '0')}]{'  '}{m.title} ({m.year}){'  '}{m.genre?.split(',')[0] || ''}{'  '}⭐{m.imdbRating || m.rating}
              </div>
            ))}
            <div className="leading-[1.5]" style={{ color: '#c0c0c0' }}>&nbsp;</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div
        className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderTop: '1px solid #333' }}
      >
        <span style={{ color: '#ffff55', whiteSpace: 'nowrap' }}>C:\TRASHBIN\SEARCH&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1 outline-none border-none bg-transparent"
          style={{ color: '#ffffff', fontFamily: '"Courier New", monospace', fontSize: 12, caretColor: '#fff' }}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ── ICQ-style AI Assistant ───────────────────────────────────────────────────

interface ICQMessage {
  id: string;
  text: string;
  isUser: boolean;
  movies?: Movie[];
  imdbLink?: { title: string; year: string; url: string };
}

function ICQAssistantContent({ allMovies }: { allMovies: Movie[] }) {
  const [messages, setMessages] = useState<ICQMessage[]>([{
    id: '0', isUser: false,
    text: 'Hey! CinemaBot here 🌼 What are you in the mood for?\n\n• Search by genre, actor, or director\n• Type "more" for more results\n• Type "[title] imdb link" (e.g. "Inception imdb link") to get an IMDb URL → use Add Movie to add it!',
  }]);
  const [input, setInput] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [lastResults, setLastResults] = useState<Movie[]>([]);
  const [offset, setOffset] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const analyzeQuery = (q: string): Movie[] => {
    const lq = q.toLowerCase();
    const genre   = allMovies.filter(m => m.genre?.toLowerCase().includes(lq));
    const cast    = allMovies.filter(m => m.cast?.some(a => a.toLowerCase().includes(lq)));
    const director= allMovies.filter(m => m.director?.toLowerCase().includes(lq));
    const title   = allMovies.filter(m => m.title.toLowerCase().includes(lq));
    const plot    = allMovies.filter(m => m.plot?.toLowerCase().includes(lq) || m.description?.toLowerCase().includes(lq));
    const pool    = genre.length ? genre : cast.length ? cast : director.length ? director : title.length ? title : plot.length ? plot : [];
    if (pool.length) return [...pool].sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
    // fallback: multi-word match
    const words = lq.split(' ').filter(w => w.length > 3);
    return allMovies.filter(m => {
      const blob = `${m.genre || ''} ${(m.cast || []).join(' ')} ${m.plot || ''} ${m.director || ''}`.toLowerCase();
      return words.some(w => blob.includes(w));
    }).sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
  };

  const isImdbIntent = (q: string) => /imdb|imbd|omdb|ombd/i.test(q);
  const stripImdbWords = (q: string) => q.replace(/imdb\s*link|imbd\s*link|imdb\s*url|imbd\s*url|imdb|imbd|omdb|ombd|link|url/gi, '').replace(/\s+/g, ' ').trim();

  const send = () => {
    const q = input.trim(); if (!q) return;
    setInput('');
    const userMsg: ICQMessage = { id: Date.now().toString(), text: q, isUser: true };
    setMessages(p => [...p, userMsg]);

    const doSearch = async () => {
      // IMDb link intent — search OMDb directly
      if (isImdbIntent(q)) {
        const movieTitle = stripImdbWords(q) || q;
        try {
          const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&apikey=f9062e1`);
          const data = await res.json();
          if (data.Response === 'True' && data.imdbID) {
            setMessages(p => [...p, {
              id: (Date.now() + 1).toString(),
              text: `Found it! Copy the IMDb link below and use "Add Movie" to add it to your library:`,
              isUser: false,
              imdbLink: { title: data.Title, year: data.Year, url: `https://www.imdb.com/title/${data.imdbID}/` },
            }]);
            return;
          } else {
            setMessages(p => [...p, { id: (Date.now() + 1).toString(), text: `Couldn't find "${movieTitle}" on OMDb. Try a different spelling!`, isUser: false }]);
            return;
          }
        } catch {
          setMessages(p => [...p, { id: (Date.now() + 1).toString(), text: 'OMDb search failed. Check your connection and try again.', isUser: false }]);
          return;
        }
      }

      const lq = q.toLowerCase().replace(/[?!.,;]/g, '').trim();
      const isMore = lastResults.length > 0 && /^(more|show more|next|others?)$/.test(lq);
      let results: Movie[] = [];
      let reply = '';

      if (isMore) {
        const nextOff = offset + 5;
        results = lastResults.slice(nextOff, nextOff + 5);
        if (results.length) { setOffset(nextOff); reply = `Here are ${results.length} more:`; }
        else { results = lastResults.slice(0, 5); setOffset(0); reply = "That's all I have! Starting over:"; }
      } else {
        const all = analyzeQuery(q);
        results = all.slice(0, 5);
        setLastQuery(q); setLastResults(all); setOffset(0);
        if (results.length) {
          reply = `Found ${all.length} title${all.length !== 1 ? 's' : ''} for "${q}"!${all.length > 5 ? ' Type "more" to see more.' : ''}`;
        } else {
          reply = `No results in your library for "${q}". Tip: type "[movie title] imdb link" to get an IMDb URL you can add via the Add Movie button!`;
        }
      }

      setMessages(p => [...p, { id: (Date.now() + 1).toString(), text: reply, isUser: false, movies: results.length ? results : undefined }]);
    };

    setTimeout(() => { doSearch(); }, 400);
  };

  const F = XP_FONT;
  const icqGold = '#f5c400';
  const icqDarkBlue = '#00468c';
  const icqBlue = '#0066cc';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: F, background: '#e8e4dc' }}>
      {/* ICQ-style contact header */}
      <div style={{ flexShrink: 0, background: `linear-gradient(180deg, ${icqBlue} 0%, ${icqDarkBlue} 100%)`, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '2px solid #003070' }}>
        <img src={ICON_ASSISTANT} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0, borderRadius: 4 }} />
        <div>
          <div style={{ color: icqGold, fontWeight: 'bold', fontSize: 13, fontFamily: F }}>CinemaBot</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: F }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#44dd44', marginRight: 4, verticalAlign: 'middle', border: '1px solid #22aa22' }} />
            Online · {allMovies.length} movies available
          </div>
        </div>
        <div style={{ marginLeft: 'auto', color: icqGold, fontSize: 20 }}>🌼</div>
      </div>

      {/* Messages area */}
      <div className="xp-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 6px', background: '#f5f3ef', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
            {/* Sender label */}
            <div style={{ fontSize: 10, color: '#888', fontFamily: F, paddingLeft: msg.isUser ? 0 : 2, paddingRight: msg.isUser ? 2 : 0 }}>
              {msg.isUser ? 'You' : 'CinemaBot'}
            </div>
            {/* Bubble */}
            <div style={{
              maxWidth: '80%',
              padding: '6px 10px',
              fontSize: 11, fontFamily: F,
              lineHeight: 1.45,
              background: msg.isUser ? icqBlue : 'white',
              color: msg.isUser ? 'white' : '#111',
              borderRadius: msg.isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
              border: msg.isUser ? 'none' : '1px solid #c8c4bc',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}>
              {msg.text}
            </div>
            {/* IMDb link result */}
            {msg.imdbLink && (
              <a href={msg.imdbLink.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'white', border: '2px outset #fff', boxShadow: '1px 1px 0 #000', cursor: 'pointer', textDecoration: 'none', maxWidth: '92%', alignSelf: 'flex-start' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#dbe8f7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                <span style={{ background: '#f5c518', color: '#000', fontWeight: 'bold', fontSize: 11, padding: '1px 5px', fontFamily: F, flexShrink: 0 }}>IMDb</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.imdbLink.title} ({msg.imdbLink.year})</div>
                  <div style={{ fontSize: 10, color: '#316ac5', fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.imdbLink.url}</div>
                </div>
              </a>
            )}
            {/* Movie cards */}
            {msg.movies && msg.movies.length > 0 && (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '92%', alignSelf: 'flex-start' }}>
                {msg.movies.map(m => (
                  <div key={m.id}
                    style={{ display: 'flex', gap: 8, padding: '5px 7px', background: 'white', border: '1px solid #c0bdb8', cursor: 'pointer', borderRadius: 4, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}
                    onClick={() => window.open(`/movie/${m.title.toLowerCase().replace(/\s+/g, '-')}-${m.year}`, '_blank')}
                    onMouseEnter={e => (e.currentTarget.style.background = '#dbe8f7')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                  >
                    <img src={m.image} alt={m.title} style={{ width: 32, height: 46, objectFit: 'cover', flexShrink: 0, border: '1px solid #aaa' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                      <div style={{ fontSize: 10, color: '#555', fontFamily: F }}>{m.year}{m.runtime ? ` · ${m.runtime}` : ''}</div>
                      <div style={{ fontSize: 10, color: '#888', fontFamily: F, marginTop: 1 }}>⭐ {(m.imdbRating || m.rating || 0).toFixed(1)} · {m.genre?.split(',')[0]}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{ flexShrink: 0, background: '#d4d0c8', borderTop: '2px solid #808080', padding: '6px 6px 6px', display: 'flex', gap: 5, alignItems: 'center' }}>
        <div style={{ background: icqGold, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>🌼</div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a genre, actor, or keyword..."
          style={{ flex: 1, height: 24, padding: '0 6px', fontSize: 11, fontFamily: F, background: 'white', border: '2px inset #808080', outline: 'none', color: '#000' }}
        />
        <button onClick={send} disabled={!input.trim()}
          style={{ height: 24, padding: '0 10px', fontSize: 11, fontFamily: F, background: input.trim() ? `linear-gradient(180deg, ${icqBlue} 0%, ${icqDarkBlue} 100%)` : '#aaa', color: 'white', border: '2px outset #fff', cursor: input.trim() ? 'pointer' : 'default', fontWeight: 'bold' }}>
          Send
        </button>
      </div>

      {/* ICQ status bar */}
      <div style={{ flexShrink: 0, height: 18, background: icqDarkBlue, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: F }}>ICQ-Cinema · {lastQuery ? `Last: "${lastQuery}"` : 'Ready'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: icqGold, fontFamily: F }}>Type "more" for next results</span>
      </div>
    </div>
  );
}

// ── XP Login Window ───────────────────────────────────────────────────────────

function XPLoginContent({ currentUser, setCurrentUser }: { currentUser?: any; setCurrentUser?: (u: any) => void }) {
  const navigate = useNavigate();
  const F = XP_FONT;
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [profileTab, setProfileTab] = useState<'profile' | 'comments' | 'ratings'>('profile');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg] = useState('');

  // Profile editing state
  const [newEmail, setNewEmail] = useState(currentUser?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [profilePicUrl, setProfilePicUrl] = useState(currentUser?.profilePicture || '');
  const [updateMsg, setUpdateMsg] = useState('');
  const [userComments, setUserComments] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [allMovies, setAllMovies] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const xpBtn: React.CSSProperties = { height: 24, padding: '0 12px', fontSize: 11, fontFamily: F, background: 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', border: '2px outset #fff', color: '#000', cursor: 'pointer' };
  const xpInput: React.CSSProperties = { height: 22, padding: '0 5px', fontSize: 11, fontFamily: F, background: 'white', border: 'none', outline: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #fff, inset 2px 2px 0 #404040', color: '#000', width: '100%', boxSizing: 'border-box' };
  const API = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

  useEffect(() => {
    if (currentUser && profileTab === 'comments') loadComments();
    if (currentUser && profileTab === 'ratings') loadRatings();
  }, [profileTab, currentUser]);

  const loadComments = async () => {
    setLoadingData(true);
    try {
      const [cr, mr] = await Promise.all([
        fetch(`${API}/comments`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${API}/movies`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
      ]);
      const cd = await cr.json(); const md = await mr.json();
      if (cd.success) setUserComments(cd.comments.filter((c: any) => c.username === currentUser?.username));
      if (md.success) setAllMovies(md.movies);
    } catch {} finally { setLoadingData(false); }
  };

  const loadRatings = async () => {
    setLoadingData(true);
    try {
      const [rr, mr] = await Promise.all([
        fetch(`${API}/user-ratings/${currentUser?.username}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${API}/movies`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
      ]);
      const rd = await rr.json(); const md = await mr.json();
      if (rd.success) setUserRatings(Object.entries(rd.userRatings).map(([movieId, rating]) => ({ movieId, rating: Number(rating) })));
      if (md.success) setAllMovies(md.movies);
    } catch {} finally { setLoadingData(false); }
  };

  const getMovieTitle = (movieId: string) => allMovies.find(m => m.id === parseInt(movieId))?.title || 'Unknown';
  const getMovieSlug = (movieId: string) => { const m = allMovies.find(x => x.id === parseInt(movieId)); return m ? createSlug(m.title, m.year) : null; };
  const navigateToMovie = (movieId: string) => { const s = getMovieSlug(movieId); if (s) navigate(`/movie/${s}`); };
  const deleteComment = async (movieId: string, commentId: string) => {
    try {
      const res = await fetch(`${API}/comments/${movieId}/${commentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      if (data.success) setUserComments(prev => prev.filter(c => c.id !== commentId));
    } catch {}
  };

  const handleLogin = async () => {
    if (!email || !password) { setErrMsg('Please fill in all fields.'); return; }
    setStatus('loading'); setErrMsg('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setStatus('err'); setErrMsg(authError.message);
      } else if (data.user) {
        const mapped = mapSupabaseUser(data.user);
        if (setCurrentUser) setCurrentUser(mapped);
        setStatus('ok');
        setNewEmail(mapped.email || '');
        setProfilePicUrl(mapped.profilePicture || '');
        const now = new Date().toISOString();
        if (mapped.username) {
          localStorage.setItem(`lastLogin_${mapped.username}`, now);
          // Persist lastLogin and joinDate to Supabase
          loadUserProfile(mapped.username).then(existing => {
            saveUserProfile(mapped.username, {
              ...(existing || {}),
              lastLogin: now,
              joinDate: existing?.joinDate || data.user.created_at || now,
            }).catch(() => {});
          }).catch(() => {});
        }
      }
    } catch { setStatus('err'); setErrMsg('Network error. Please try again.'); }
  };

  const handleSignup = async () => {
    if (!username || !email || !password) { setErrMsg('Please fill in all fields.'); return; }
    setStatus('loading'); setErrMsg('');
    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) { setStatus('err'); setErrMsg(authError.message); }
      else { setStatus('ok'); setErrMsg('Check your email for a confirmation link. Clicking it will log you in automatically.'); setTab('login'); }
    } catch { setStatus('err'); setErrMsg('Network error. Please try again.'); }
  };

  const handleForgot = async () => {
    if (!email) { setErrMsg('Please enter your email address.'); return; }
    setStatus('loading'); setErrMsg('');
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (authError) { setStatus('err'); setErrMsg(authError.message); }
      else { setStatus('ok'); setErrMsg('Password reset email sent!'); }
    } catch { setStatus('err'); setErrMsg('Network error. Please try again.'); }
  };

  const handleUpdateProfile = async () => {
    if (newPassword && newPassword !== confirmPwd) { setUpdateMsg('Passwords do not match.'); return; }
    try {
      // Update email if changed
      if (newEmail && newEmail !== currentUser?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) { setUpdateMsg(`Email error: ${emailError.message}`); return; }
      }
      // Update password if provided
      if (newPassword) {
        const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwdError) { setUpdateMsg(`Password error: ${pwdError.message}`); return; }
      }
      // Update metadata
      const { data, error: metaError } = await supabase.auth.updateUser({
        data: { profilePicture: profilePicUrl, username: currentUser?.username },
      });
      if (metaError) { setUpdateMsg(metaError.message); return; }
      if (data.user) {
        const mapped = mapSupabaseUser(data.user);
        if (setCurrentUser) setCurrentUser(mapped);
        setUpdateMsg('Profile updated!'); setNewPassword(''); setConfirmPwd('');
      }
    } catch { setUpdateMsg('Network error.'); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) { setUpdateMsg('Please upload a JPG, PNG, or WebP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setUpdateMsg('Image must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const b64 = reader.result as string;
      setProfilePicUrl(b64);
      try {
        const { data, error: metaError } = await supabase.auth.updateUser({
          data: { profilePicture: b64, username: currentUser?.username },
        });
        if (!metaError && data.user) {
          const mapped = mapSupabaseUser(data.user);
          if (setCurrentUser) setCurrentUser(mapped);
          setUpdateMsg('Picture updated!');
        }
      } catch {}
    };
    reader.readAsDataURL(file);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    if (setCurrentUser) setCurrentUser(null);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  if (currentUser) {
    const picSrc = profilePicUrl || currentUser.profilePicture;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#d4d0c8', fontFamily: F, overflow: 'hidden' }}>
        {/* Profile header */}
        <div style={{ background: '#316ac5', color: 'white', padding: '4px 8px', fontSize: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '2px outset #fff', background: '#000', flexShrink: 0, cursor: 'pointer' }} onClick={() => imgInputRef.current?.click()}>
            {picSrc ? <img src={picSrc} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>👤</div>}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 'bold' }}>{currentUser.username}</div>
            {currentUser.email && <div style={{ fontSize: 10, opacity: 0.8 }}>{currentUser.email}</div>}
          </div>
          <button onClick={handleSignOut} style={{ ...xpBtn, marginLeft: 'auto', fontSize: 10, height: 20 }}>Sign Out</button>
          <input ref={imgInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={handleImageUpload} />
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '2px solid #808080', background: '#d4d0c8', flexShrink: 0 }}>
          {(['profile', 'comments', 'ratings'] as const).map(t => (
            <button key={t} onClick={() => setProfileTab(t)}
              style={{ height: 24, padding: '0 10px', fontSize: 11, fontFamily: F, cursor: 'pointer', color: '#000', border: 'none', borderRight: '1px solid #808080', background: profileTab === t ? '#f0eeeb' : '#c8c4bc', fontWeight: profileTab === t ? 'bold' : 'normal', borderTop: profileTab === t ? '2px solid #fff' : 'none' }}>
              {t === 'profile' ? 'Profile' : t === 'comments' ? 'Comments' : 'Ratings'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="xp-scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', background: '#f0eeeb' }}>
          {updateMsg && (
            <div style={{ fontSize: 10, fontFamily: F, color: updateMsg.includes('!') && !updateMsg.includes('Error') && !updateMsg.includes('match') && !updateMsg.includes('error') ? '#006400' : '#cc0000', background: updateMsg.includes('!') && !updateMsg.includes('Error') && !updateMsg.includes('match') && !updateMsg.includes('error') ? '#e8ffe8' : '#ffe8e8', border: `1px solid ${updateMsg.includes('!') && !updateMsg.includes('Error') && !updateMsg.includes('match') && !updateMsg.includes('error') ? '#006400' : '#cc0000'}`, padding: '3px 6px', marginBottom: 6 }}>
              {updateMsg}
            </div>
          )}

          {profileTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', fontFamily: F, borderBottom: '1px solid #c0bdb8', paddingBottom: 2, marginBottom: 2 }}>Change Profile Picture</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="text" value={profilePicUrl} onChange={e => setProfilePicUrl(e.target.value)} placeholder="Paste image URL..." style={{ ...xpInput, flex: 1 }} />
                <button onClick={() => imgInputRef.current?.click()} style={xpBtn}>Upload</button>
                <input ref={imgInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={handleImageUpload} />
              </div>

              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', fontFamily: F, borderBottom: '1px solid #c0bdb8', paddingBottom: 2, marginTop: 4 }}>Change Email</div>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={xpInput} />

              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', fontFamily: F, borderBottom: '1px solid #c0bdb8', paddingBottom: 2, marginTop: 4 }}>Change Password</div>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (leave blank to keep)" style={xpInput} />
              {newPassword && <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Confirm new password" style={xpInput} />}

              <button onClick={handleUpdateProfile} style={{ ...xpBtn, alignSelf: 'flex-start', marginTop: 4 }}>Update Profile</button>
            </div>
          )}

          {profileTab === 'comments' && (
            <div>
              {loadingData ? (
                <div style={{ fontSize: 11, color: '#666', fontFamily: F }}>Loading comments...</div>
              ) : userComments.length === 0 ? (
                <div style={{ fontSize: 11, color: '#888', fontFamily: F }}>No comments yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {userComments.map(c => (
                    <div key={c.id} style={{ background: 'white', border: '1px inset #808080', padding: '4px 6px', cursor: 'pointer' }}
                      onClick={() => navigateToMovie(c.movieId)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 10, fontWeight: 'bold', color: '#316ac5', fontFamily: F, marginBottom: 2, textDecoration: 'underline' }}>{getMovieTitle(c.movieId)}</div>
                        <button onClick={e => { e.stopPropagation(); deleteComment(c.movieId, c.id); }}
                          style={{ width: 14, height: 14, background: '#c8352a', color: 'white', border: '1px outset #fff', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: F, flexShrink: 0 }}>
                          ×
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: '#000', fontFamily: F, lineHeight: 1.4 }}>{c.text}</div>
                      <div style={{ fontSize: 10, color: '#888', fontFamily: F, marginTop: 2 }}>{new Date(c.timestamp).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {profileTab === 'ratings' && (
            <div>
              {loadingData ? (
                <div style={{ fontSize: 11, color: '#666', fontFamily: F }}>Loading ratings...</div>
              ) : userRatings.length === 0 ? (
                <div style={{ fontSize: 11, color: '#888', fontFamily: F }}>No ratings yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {userRatings.map(r => (
                    <div key={r.movieId} style={{ background: 'white', border: '1px inset #808080', padding: '4px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => navigateToMovie(r.movieId)}>
                      <span style={{ fontSize: 11, color: '#316ac5', fontFamily: F, textDecoration: 'underline' }}>{getMovieTitle(r.movieId)}</span>
                      <span style={{ fontSize: 12, color: '#d07339', fontFamily: F }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#d4d0c8', fontFamily: F }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #808080', background: '#d4d0c8' }}>
        {(['login', 'signup', 'forgot'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setErrMsg(''); setStatus('idle'); }}
            style={{ height: 28, padding: '0 12px', fontSize: 11, fontFamily: F, cursor: 'pointer', color: '#000', border: 'none', borderRight: '1px solid #808080', background: tab === t ? '#f0eeeb' : '#c8c4bc', fontWeight: tab === t ? 'bold' : 'normal', borderTop: tab === t ? '2px solid #fff' : '1px solid #808080' }}>
            {t === 'login' ? 'Login' : t === 'signup' ? 'Create Account' : 'Forgot Pwd'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: '12px 16px', background: '#f0eeeb', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {tab === 'forgot' ? (
          <>
            <div style={{ fontSize: 11, color: '#444', fontFamily: F }}>Enter your email and we'll send you a reset link.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, fontFamily: F, color: '#000', fontWeight: 'bold' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={xpInput} autoComplete="email" onKeyDown={e => { if (e.key === 'Enter') handleForgot(); }} />
            </div>
            {errMsg && (
              <div style={{ fontSize: 11, fontFamily: F, color: status === 'ok' ? '#006400' : '#cc0000', background: status === 'ok' ? '#e8ffe8' : '#ffe8e8', border: `1px solid ${status === 'ok' ? '#006400' : '#cc0000'}`, padding: '3px 6px' }}>
                {errMsg}
              </div>
            )}
            <button onClick={handleForgot} disabled={status === 'loading'} style={{ ...xpBtn, alignSelf: 'flex-start', opacity: status === 'loading' ? 0.6 : 1 }}>
              {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
            </button>
          </>
        ) : tab === 'login' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, fontFamily: F, color: '#000', fontWeight: 'bold' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={xpInput} autoComplete="email"
                onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, fontFamily: F, color: '#000', fontWeight: 'bold' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} style={{ ...xpInput, paddingRight: 26 }} autoComplete="current-password"
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#444', padding: '0 2px', lineHeight: 1 }}>{showPwd ? '🙈' : '👁'}</button>
              </div>
            </div>
            {errMsg && (
              <div style={{ fontSize: 11, fontFamily: F, color: status === 'ok' ? '#006400' : '#cc0000', background: status === 'ok' ? '#e8ffe8' : '#ffe8e8', border: `1px solid ${status === 'ok' ? '#006400' : '#cc0000'}`, padding: '3px 6px' }}>
                {errMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={handleLogin} disabled={status === 'loading'} style={{ ...xpBtn, opacity: status === 'loading' ? 0.6 : 1 }}>
                {status === 'loading' ? 'Please wait...' : 'Login'}
              </button>
              <button onClick={handleGoogleLogin} style={{ ...xpBtn, display: 'flex', alignItems: 'center', gap: 4 }}>
                <img src="https://i.imgur.com/FmLD6jR.png" alt="Google" style={{ width: 20, height: 20, objectFit: 'contain', flexShrink: 0 }} />
                Sign in with Google
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, fontFamily: F, color: '#000', fontWeight: 'bold' }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={xpInput} autoComplete="username" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, fontFamily: F, color: '#000', fontWeight: 'bold' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={xpInput} autoComplete="email" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 11, fontFamily: F, color: '#000', fontWeight: 'bold' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} style={{ ...xpInput, paddingRight: 26 }} autoComplete="new-password"
                  onKeyDown={e => { if (e.key === 'Enter') handleSignup(); }} />
                <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#444', padding: '0 2px', lineHeight: 1 }}>{showPwd ? '🙈' : '👁'}</button>
              </div>
            </div>
            {errMsg && (
              <div style={{ fontSize: 11, fontFamily: F, color: status === 'ok' ? '#006400' : '#cc0000', background: status === 'ok' ? '#e8ffe8' : '#ffe8e8', border: `1px solid ${status === 'ok' ? '#006400' : '#cc0000'}`, padding: '3px 6px' }}>
                {errMsg}
              </div>
            )}
            <button onClick={handleSignup} disabled={status === 'loading'} style={{ ...xpBtn, alignSelf: 'flex-start', opacity: status === 'loading' ? 0.6 : 1 }}>
              {status === 'loading' ? 'Please wait...' : 'Create Account'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Mobile XP Shell ──────────────────────────────────────────────────────────

const MOB_PAGE_SIZE = 24;

function MobileXPShell({ wins, movies, toWatchMovies, openWin, closeWin, bringToFront, onExit, onAddMovie, onMarkWatched, onUpdateRating, onOpenMoviePage, comments, onAddComment, onDeleteComment, currentUser, setCurrentUser }: {
  wins: XPWin[];
  movies: Movie[];
  toWatchMovies: Movie[];
  openWin: (type: XPWin['type'], movie?: Movie) => void;
  closeWin: (id: string) => void;
  bringToFront: (id: string) => void;
  onExit: () => void;
  onAddMovie?: (movie: Movie) => void;
  onMarkWatched?: (movie: Movie) => void;
  onUpdateRating?: (movieId: number, rating: number) => void;
  onOpenMoviePage: (m: Movie) => void;
  comments?: XPComment[];
  onAddComment?: (movieId: number, text: string) => void;
  onDeleteComment?: (movieId: number, commentId: string) => void;
  currentUser?: any;
  setCurrentUser?: (u: any) => void;
}) {
  const openTabs = wins.filter(w => !w.minimized);
  const maxZ = openTabs.length > 0 ? Math.max(...openTabs.map(w => w.z)) : 0;
  const activeWin = openTabs.find(w => w.z === maxZ) ?? null;

  const [libSearch, setLibSearch]           = useState('');
  const [libPage, setLibPage]               = useState(0);
  const [libFilters, setLibFilters]         = useState<XPLibFilters>(DEFAULT_LIB_FILTERS);
  const [libShowFilters, setLibShowFilters] = useState(false);

  const [watchSearch, setWatchSearch]           = useState('');
  const [watchPage, setWatchPage]               = useState(0);
  const [watchFilters, setWatchFilters]         = useState<XPLibFilters>(DEFAULT_LIB_FILTERS);
  const [watchShowFilters, setWatchShowFilters] = useState(false);

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAddMovie, setShowAddMovie] = useState(false);
  const [imdbUrl, setImdbUrl] = useState('');
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'ok' | 'err' | 'dup'>('idle');
  const [addError, setAddError] = useState('');
  const [mobileProfileUsername, setMobileProfileUsername] = useState<string | null>(null);

  // Custom wallpaper per user (stored in KV + localStorage)
  const wallpaperKey = currentUser?.username ? `mobileWallpaper:${currentUser.username}` : null;
  const [customWallpaper, setCustomWallpaper] = useState<string>(() => {
    if (!currentUser?.username) return WALLPAPER;
    return localStorage.getItem(`mobileWallpaper_${currentUser.username}`) || WALLPAPER;
  });
  const [wallpaperUploading, setWallpaperUploading] = useState(false);
  const wallpaperFileRef = useRef<HTMLInputElement>(null);

  // Load wallpaper from KV on mount
  useEffect(() => {
    if (!wallpaperKey || !currentUser?.username) return;
    supabase.from('kv_store_ea58c774').select('value').eq('key', wallpaperKey).maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'string') {
          setCustomWallpaper(data.value);
          localStorage.setItem(`mobileWallpaper_${currentUser!.username}`, data.value);
        }
      });
  }, [wallpaperKey]);

  const saveWallpaper = async (url: string) => {
    setCustomWallpaper(url);
    if (currentUser?.username) {
      localStorage.setItem(`mobileWallpaper_${currentUser.username}`, url);
      if (wallpaperKey) {
        void (async () => { try { await supabase.from('kv_store_ea58c774').upsert({ key: wallpaperKey, value: url }, { onConflict: 'key' }); } catch {} })();
      }
    }
  };

  const handleWallpaperFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setWallpaperUploading(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      await saveWallpaper(dataUrl);
      setWallpaperUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isLib   = activeWin?.type === 'library';
  const isWatch = activeWin?.type === 'watchlist';
  const isListView = isLib || isWatch;

  const curMovies    = isLib ? movies : toWatchMovies;
  const curSearch    = isLib ? libSearch    : watchSearch;
  const curPage      = isLib ? libPage      : watchPage;
  const curFilters   = isLib ? libFilters   : watchFilters;
  const curShowF     = isLib ? libShowFilters : watchShowFilters;
  const setCurSearch = (v: string) => { isLib ? setLibSearch(v) : setWatchSearch(v); isLib ? setLibPage(0) : setWatchPage(0); };
  const setCurPage   = (fn: (p: number) => number) => isLib ? setLibPage(fn) : setWatchPage(fn);
  const setCurFilters= (f: XPLibFilters) => { isLib ? setLibFilters(f) : setWatchFilters(f); isLib ? setLibPage(0) : setWatchPage(0); };
  const toggleShowF  = () => isLib ? setLibShowFilters(v => !v) : setWatchShowFilters(v => !v);

  const applyFilters = (list: Movie[], search: string, f: XPLibFilters) => {
    let out = list.filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()));
    if (f.genres.length > 0) out = out.filter(m => f.genres.some(g => m.genre?.split(',').map(x => x.trim()).includes(g)));
    const isTv = (m: Movie) => !!m.runtime?.toLowerCase().includes('season');
    if (!f.showMovies && !f.showTv) out = [];
    else if (!f.showMovies) out = out.filter(isTv);
    else if (!f.showTv)     out = out.filter(m => !isTv(m));
    if (f.runtime !== 'all') out = out.filter(m => {
      if (isTv(m)) return true;
      const mins = parseInt(m.runtime ?? '0') || 0;
      return f.runtime === 'short' ? mins > 0 && mins <= 90 : f.runtime === 'medium' ? mins > 90 && mins <= 150 : mins > 150;
    });
    if (f.minRating > 0) out = out.filter(m => (m.imdbRating || m.rating || 0) >= f.minRating);
    return [...out].sort((a, b) => {
      switch (f.sortBy) {
        case 'oldest':    return (a.dateAdded ?? 0) - (b.dateAdded ?? 0);
        case 'titleAsc':  return a.title.localeCompare(b.title);
        case 'titleDesc': return b.title.localeCompare(a.title);
        case 'ratingHigh': return (b.imdbRating || b.rating || 0) - (a.imdbRating || a.rating || 0);
        case 'ratingLow':  return (a.imdbRating || a.rating || 0) - (b.imdbRating || b.rating || 0);
        default: return (b.dateAdded ?? 0) - (a.dateAdded ?? 0);
      }
    });
  };

  const displayed  = isListView ? applyFilters(curMovies, curSearch, curFilters) : [];
  const totalPages = Math.max(1, Math.ceil(displayed.length / MOB_PAGE_SIZE));
  const pageMovies = displayed.slice(curPage * MOB_PAGE_SIZE, (curPage + 1) * MOB_PAGE_SIZE);
  const allGenres  = isListView ? [...new Set(curMovies.flatMap(m => m.genre?.split(',').map(g => g.trim()) ?? []))].filter(Boolean).sort() : [];

  const hasTag = (m: Movie, tag: string) => m.genre?.split(',').map(g => g.trim().toLowerCase()).includes(tag.toLowerCase()) ?? false;
  const isAnimation = (m: Movie) => hasTag(m, 'Animation') || hasTag(m, 'Anime');
  const isTvSeries  = (m: Movie) => !!m.runtime?.toLowerCase().includes('season');
  // Status bar counts: use library (movies) only — same source as desktop
  const animeCount  = movies.filter(m => isAnimation(m)).length;
  const seriesCount = movies.filter(m => isTvSeries(m)).length;
  const moviesCount = movies.filter(m => !isTvSeries(m) && !isAnimation(m)).length;

  const activeFilterCount = curFilters.genres.length + (curFilters.minRating > 0 ? 1 : 0) + (curFilters.runtime !== 'all' ? 1 : 0) + (!curFilters.showMovies || !curFilters.showTv ? 1 : 0);

  const WICONS: Record<XPWin['type'], string> = { library: ICON_SSD, watchlist: ICON_EXPLORER, detail: ICON_FOLDER, tickets: ICON_TRASH, search: ICON_SEARCH, assistant: ICON_ASSISTANT, login: ICON_HUMAN, chat: ICON_ASSISTANT, profile: ICON_HUMAN, privacy: ICON_STARGATE, terms: ICON_STARGATE2 };

  const F = XP_FONT;
  const xpBtn: React.CSSProperties = { height: 30, padding: '0 12px', fontSize: 12, fontFamily: F, background: '#d4d0c8', border: '2px outset #ffffff', color: '#000', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 };
  const xpBtnPressed: React.CSSProperties = { ...xpBtn, border: '2px inset #808080' };
  const xpInset: React.CSSProperties = { background: 'white', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff, inset 2px 2px 0 #404040', border: 'none', outline: 'none' };
  const xpRow = '#d4d0c8';
  const xpBorder = '1px solid #808080';
  const ROW_H = 38;

  const handleAddSubmit = async () => {
    if (!imdbUrl.trim()) return;
    setAddStatus('saving');
    setAddError('');
    try {
      const movieData = await fetchMovieFromIMDb(imdbUrl.trim());
      if (!movieData || !movieData.title) { setAddStatus('err'); setAddError('Invalid IMDb URL or movie not found.'); return; }
      const pool = [...movies, ...toWatchMovies];
      const dup = pool.find(m => m.title.toLowerCase() === movieData.title!.toLowerCase() && m.year === movieData.year);
      if (dup) { setAddStatus('dup'); setAddError(`Already exists: "${dup.title}" (ID #${dup.id})`); return; }
      const newId = pool.length > 0 ? Math.max(...pool.map(m => m.id)) + 1 : 1;
      const newMovie: Movie = {
        id: newId,
        title: movieData.title,
        year: movieData.year || new Date().getFullYear(),
        genre: movieData.genre || 'Drama',
        rating: movieData.rating || 0,
        image: (movieData as any).poster || movieData.image || 'https://via.placeholder.com/300x450?text=No+Image',
        description: movieData.description || '',
        runtime: movieData.runtime,
        imdbId: movieData.imdbId,
        imdbRating: movieData.imdbRating,
        director: movieData.director,
        cast: movieData.cast,
        plot: movieData.plot,
        dateAdded: Date.now(),
      };
      if (onAddMovie) onAddMovie(newMovie);
      setAddStatus('ok');
      setTimeout(() => { setShowAddMovie(false); setAddStatus('idle'); setImdbUrl(''); setAddError(''); }, 1500);
    } catch {
      setAddStatus('err');
      setAddError('Failed to fetch movie data. Please try again.');
    }
  };

  // Plus button contextual options
  const plusOptions = (() => {
    const opts: { type: XPWin['type'] | 'random'; label: string }[] = [];
    if (activeWin?.type !== 'library')    opts.push({ type: 'library',   label: 'Open Library' });
    if (activeWin?.type !== 'watchlist')  opts.push({ type: 'watchlist', label: 'Open Watchlist' });
    opts.push({ type: 'random', label: 'Random Movie' });
    if (activeWin?.type !== 'search')     opts.push({ type: 'search',   label: 'Search (CMD)' });
    if (activeWin?.type !== 'tickets')    opts.push({ type: 'tickets',  label: 'My Tickets' });
    if (activeWin?.type !== 'assistant')  opts.push({ type: 'assistant', label: 'assistant.exe' });
    if (activeWin?.type !== 'login')      opts.push({ type: 'login',    label: 'Human.exe' });
    if (activeWin?.type !== 'chat')       opts.push({ type: 'chat',     label: 'Live Chat' });
    return opts;
  })();

  return (
    <div className="absolute inset-0 flex flex-col" style={{ zIndex: 400, fontFamily: F, background: xpRow }} onClick={() => showPlusMenu && setShowPlusMenu(false)}>

      {/* ── 1. Blue title ribbon ── */}
      <div style={{ height: ROW_H, flexShrink: 0, background: 'linear-gradient(90deg,#0050db 0%,#0997ff 100%)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, borderBottom: '2px solid #0831d9' }}>
        <img src={logoImage} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', fontFamily: F, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeWin?.title ?? 'Trash Bin Cinema'}
        </span>
        {activeWin && (
          <button onClick={() => closeWin(activeWin.id)} style={{ width: 26, height: 22, background: 'linear-gradient(180deg,#f97676 0%,#e02020 100%)', border: '2px outset #ff8888', color: '#fff', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
        )}
      </div>

      {/* ── 2. Tabs row ── */}
      <div style={{ height: ROW_H, flexShrink: 0, display: 'flex', alignItems: 'stretch', background: xpRow, borderBottom: '2px solid #808080' }}>
        {/* Scrollable tabs */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}>
          {[...openTabs].sort((a, b) => a.z - b.z).map(win => {
            const isActive = win.z === maxZ;
            return (
              <div key={win.id} onClick={() => bringToFront(win.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 10px', minWidth: 70, maxWidth: 140, flexShrink: 0, background: isActive ? '#f0eeeb' : '#c8c4bc', borderRight: xpBorder, borderTop: isActive ? '2px solid #fff' : '1px solid #808080', cursor: 'pointer' }}>
                <img src={WICONS[win.type]} alt="" style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: isActive ? 'bold' : 'normal', fontFamily: F }}>{win.title.length > 10 ? win.title.slice(0, 9) + '…' : win.title}</span>
                <button onClick={e => { e.stopPropagation(); closeWin(win.id); }} style={{ width: 16, height: 16, background: 'transparent', border: xpBorder, color: '#000', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, fontFamily: F }}>×</button>
              </div>
            );
          })}
        </div>
        {/* + button — outside the overflow:hidden scroll area so dropdown is not clipped */}
        <button onClick={e => { e.stopPropagation(); setShowPlusMenu(v => !v); }}
          style={{ width: 36, flexShrink: 0, background: xpRow, border: 'none', borderLeft: xpBorder, color: '#000', fontSize: 20, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      </div>
      {/* Plus dropdown — rendered at shell level to avoid clipping */}
      {showPlusMenu && (
        <div style={{ position: 'absolute', top: ROW_H * 2, right: 0, background: '#f0eeeb', border: '2px solid #808080', zIndex: 700, minWidth: 160, boxShadow: '3px 3px 6px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
          {plusOptions.map(item => (
            <div key={item.type} onClick={() => {
              if (item.type === 'random') {
                const pool = [...movies, ...toWatchMovies];
                const m = pool[Math.floor(Math.random() * pool.length)];
                if (m) openWin('detail', m);
              } else {
                openWin(item.type as XPWin['type']);
              }
              setShowPlusMenu(false);
            }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #c0bdb8', fontSize: 12, fontFamily: F, color: '#000' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#316ac5'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#000'; }}>
              <img src={item.type !== 'random' ? WICONS[item.type as XPWin['type']] : ICON_FOLDER} alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* ── 3. Library/Watchlist toolbar ── */}
      {isListView && (<>
        {/* Search LEFT, count RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: xpRow, borderBottom: xpBorder, flexShrink: 0, height: ROW_H }}>
          <input type="text" value={curSearch} onChange={e => setCurSearch(e.target.value)} placeholder="Search movies..."
            style={{ ...xpInset, flex: 1, height: 26, padding: '0 8px', fontSize: 12, fontFamily: F, color: '#000', textAlign: 'center' }} />
          <div style={{ height: 26, padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: 12, fontFamily: F, color: '#000', background: '#d4d0c8', border: '2px inset #808080', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {displayed.length} titles
          </div>
        </div>
        {/* Sort (narrow, fit content) + Filters button (wide, shows count) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: xpRow, borderBottom: '2px solid #808080', flexShrink: 0, height: ROW_H }}>
          <XPSelect value={curFilters.sortBy} width={152}
            onChange={v => setCurFilters({ ...curFilters, sortBy: v as XPLibFilters['sortBy'] })}
            options={[
              { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' },
              { value: 'titleAsc', label: 'A - Z' }, { value: 'titleDesc', label: 'Z - A' },
              { value: 'ratingHigh', label: 'IMDb Rating Desc.' }, { value: 'ratingLow', label: 'IMDb Rating Asc.' },
            ]} />
          <button onClick={toggleShowF} style={{ ...xpBtn, flex: 1, ...(curShowF || activeFilterCount > 0 ? xpBtnPressed : {}), height: 26 }}>
            {curShowF ? '▲ Hide Filters' : `▼ Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
          </button>
        </div>
        {/* Filter panel — expanded */}
        {curShowF && (
          <div style={{ flexShrink: 0, background: '#f0eeeb', borderBottom: '2px solid #808080', padding: '8px 8px', maxHeight: 200, overflowY: 'auto' }}>
            {/* Genres */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', marginBottom: 4, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>Genre</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {allGenres.slice(0, 20).map(g => (
                  <button key={g} onClick={() => setCurFilters({ ...curFilters, genres: curFilters.genres.includes(g) ? curFilters.genres.filter(x => x !== g) : [...curFilters.genres, g] })}
                    style={{ ...xpBtn, height: 24, padding: '0 6px', fontSize: 11, ...(curFilters.genres.includes(g) ? xpBtnPressed : {}) }}>{g}</button>
                ))}
              </div>
            </div>
            {/* Rating */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', marginBottom: 4, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>Min Rating</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[0, 6, 7, 8, 9].map(r => (
                  <button key={r} onClick={() => setCurFilters({ ...curFilters, minRating: r })}
                    style={{ ...xpBtn, height: 24, padding: '0 8px', fontSize: 11, ...(curFilters.minRating === r ? xpBtnPressed : {}) }}>
                    {r === 0 ? 'All' : `${r}+`}
                  </button>
                ))}
              </div>
            </div>
            {/* Runtime */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', marginBottom: 4, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>Runtime</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {([['all','All'],['short','< 90m'],['medium','90-150m'],['long','> 150m']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setCurFilters({ ...curFilters, runtime: v })}
                    style={{ ...xpBtn, height: 24, padding: '0 6px', fontSize: 11, ...(curFilters.runtime === v ? xpBtnPressed : {}) }}>{l}</button>
                ))}
              </div>
            </div>
            {/* Type */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#000', marginBottom: 4, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>Type</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { label: 'All',       show: true,  tv: true  },
                  { label: 'Movies',    show: true,  tv: false },
                  { label: 'TV Series', show: false, tv: true  },
                ] as const).map(opt => {
                  const active = curFilters.showMovies === opt.show && curFilters.showTv === opt.tv;
                  return (
                    <button key={opt.label} onClick={() => setCurFilters({ ...curFilters, showMovies: opt.show, showTv: opt.tv })}
                      style={{ ...xpBtn, height: 24, padding: '0 8px', fontSize: 11, ...(active ? xpBtnPressed : {}) }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <button onClick={() => setCurFilters(DEFAULT_LIB_FILTERS)} style={{ ...xpBtn, height: 26, marginTop: 2 }}>Reset All Filters</button>
          </div>
        )}
      </>)}

      {/* ── 4. Content area ── */}
      <div style={{ flex: 1, overflow: 'hidden', background: 'white' }}>
        {isListView ? (
          <div className="xp-scroll" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: 5 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
              {pageMovies.map(m => (
                <button key={m.id} onClick={() => openWin('detail', m)}
                  style={{ background: 'transparent', border: '1px solid transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 3, cursor: 'pointer', fontFamily: F }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dbe8f7'; (e.currentTarget as HTMLElement).style.border = '1px dotted #316ac5'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.border = '1px solid transparent'; }}>
                  <div style={{ width: '100%', aspectRatio: '2/3', border: '1px solid #aaa', overflow: 'hidden' }}>
                    <img src={m.image} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  </div>
                  <p style={{ fontSize: 11, fontFamily: F, marginTop: 3, color: '#111', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', width: '100%' }}>{m.title}</p>
                  <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Star style={{ width: 8, height: 8 }} className="fill-[#d07339] text-[#d07339] flex-shrink-0" />
                    <span style={{ fontSize: 10, color: '#555', fontFamily: F }}>{(m.imdbRating || m.rating)?.toFixed(1)}</span>
                  </div>
                </button>
              ))}
            </div>
            {displayed.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontSize: 12, color: '#666', fontFamily: F }}>No movies found</div>
            )}
          </div>
        ) : activeWin?.type === 'detail' && activeWin.movie ? (
          <DetailContent
            movie={activeWin.movie}
            isMobile
            inWatchlist={toWatchMovies.some(m => m.id === activeWin.movie?.id)}
            onOpenPage={() => onOpenMoviePage(activeWin.movie!)}
            onMarkWatched={activeWin.movie && onMarkWatched ? () => onMarkWatched(activeWin.movie!) : undefined}
            comments={comments}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onUpdateRating={onUpdateRating}
            currentUser={currentUser}
          />

        ) : activeWin?.type === 'tickets' ? (
          <XPTicketContent movies={[...movies, ...toWatchMovies]} isMobile />
        ) : activeWin?.type === 'search' ? (
          <CMDSearchContent allMovies={[...movies, ...toWatchMovies]} onOpen={m => openWin('detail', m)} />
        ) : activeWin?.type === 'assistant' ? (
          <ICQAssistantContent allMovies={[...movies, ...toWatchMovies]} />
        ) : activeWin?.type === 'login' ? (
          currentUser
            ? <XPProfileContent username={currentUser.username} currentUser={currentUser} allMovies={[...movies, ...toWatchMovies]} onOpenProfile={u => { openWin('profile'); setMobileProfileUsername(u); }} onFollow={() => {}} isMobile />
            : <XPLoginContent currentUser={currentUser} setCurrentUser={setCurrentUser} />
        ) : activeWin?.type === 'profile' ? (
          <XPProfileContent username={mobileProfileUsername || activeWin.profileUsername || currentUser?.username || ''} currentUser={currentUser} allMovies={[...movies, ...toWatchMovies]} onOpenProfile={u => setMobileProfileUsername(u)} onFollow={() => {}} isMobile />
        ) : activeWin?.type === 'chat' ? (
          <ChatPanel currentUser={currentUser} isXP={true} style={{ height: '100%' }} />
        ) : activeWin?.type === 'privacy' ? (
          <XPPrivacyContent />
        ) : activeWin?.type === 'terms' ? (
          <XPTermsContent />
        ) : null}
      </div>

      {/* ── 5. Status bar — hidden for search and ticket tabs ── */}
      {activeWin?.type !== 'search' && activeWin?.type !== 'tickets' && activeWin?.type !== 'assistant' && activeWin?.type !== 'login' && activeWin?.type !== 'profile' && activeWin?.type !== 'privacy' && activeWin?.type !== 'terms' && (
      <div style={{ height: 26, flexShrink: 0, display: 'flex', alignItems: 'stretch', background: xpRow, borderTop: '2px solid #808080', fontFamily: F }}>
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 11, color: '#000', border: '2px inset #808080', background: xpRow, marginRight: 2, whiteSpace: 'nowrap' }}>Ready</div>
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 11, color: '#000', border: '2px inset #808080', background: xpRow, marginRight: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
          {activeWin?.title ?? '—'}
        </div>
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', fontSize: 11, color: '#000', border: '2px inset #808080', background: xpRow, marginRight: 2, whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>
          {animeCount} anime · {seriesCount} series · {moviesCount} movies
        </div>
        <div style={{ padding: '0 8px', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#000', border: '2px inset #808080', background: xpRow, whiteSpace: 'nowrap' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00c800', display: 'inline-block', border: '1px solid #007000', flexShrink: 0 }} />
          Online
        </div>
      </div>
      )}

      {/* ── 6. Bottom bar ── */}
      <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px', background: xpRow, borderTop: xpBorder }}>
        {isListView ? (
          <>
            <button onClick={() => setShowAddMovie(true)} style={{ ...xpBtn, height: 28, flex: '0 0 auto', minWidth: 110, fontSize: 12 }}>+ Add Movie</button>
            <div style={{ flex: 1 }} />
            <button onClick={() => setCurPage(p => Math.max(0, p - 1))} disabled={curPage === 0}
              style={{ ...xpBtn, height: 28, padding: '0 10px', opacity: curPage === 0 ? 0.5 : 1 }}>◄</button>
            <span style={{ fontSize: 12, color: '#000', fontFamily: F, padding: '0 8px', background: '#f0eeeb', border: '2px inset #808080', height: 28, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {curPage + 1} / {totalPages}
            </span>
            <button onClick={() => setCurPage(p => Math.min(totalPages - 1, p + 1))} disabled={curPage >= totalPages - 1}
              style={{ ...xpBtn, height: 28, padding: '0 10px', opacity: curPage >= totalPages - 1 ? 0.5 : 1 }}>►</button>
          </>
        ) : (
          <>
            <button onClick={() => { if (activeWin) closeWin(activeWin.id); }}
              style={{ ...xpBtn, height: 28 }}>Back</button>
            <div style={{ flex: 1 }} />
            <button onClick={onExit} style={{ ...xpBtn, height: 28 }}>Main Site</button>
          </>
        )}
      </div>
      {/* ── Privacy / Terms footer ── */}
      <div style={{ height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#d4d0c8', borderTop: '1px solid #808080', fontFamily: F }}>
        <button onClick={() => navigate('/privacy')} style={{ fontSize: 10, color: '#316ac5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, padding: 0, textDecoration: 'underline' }}>Privacy Policy</button>
        <span style={{ fontSize: 10, color: '#808080' }}>·</span>
        <button onClick={() => navigate('/terms')} style={{ fontSize: 10, color: '#316ac5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, padding: 0, textDecoration: 'underline' }}>Terms of Service</button>
        <span style={{ fontSize: 10, color: '#808080' }}>·</span>
        <span style={{ fontSize: 10, color: '#808080', fontFamily: F }}>© {new Date().getFullYear()} Trash Bin</span>
      </div>

      {/* ── 7. Add Movie XP popup (IMDb URL) ── */}
      {showAddMovie && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#d4d0c8', border: '2px outset #ffffff', boxShadow: '4px 6px 16px rgba(0,0,0,0.5)', width: 'min(94vw, 340px)', fontFamily: F }}>
            {/* Title bar */}
            <div style={{ height: 28, background: 'linear-gradient(90deg,#0050db 0%,#0997ff 100%)', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6, borderBottom: '2px solid #0831d9' }}>
              <img src={ICON_FOLDER} alt="" style={{ width: 16, height: 16 }} />
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', flex: 1, fontFamily: F }}>Add Movie from IMDb</span>
              <button onClick={() => { setShowAddMovie(false); setAddStatus('idle'); setImdbUrl(''); setAddError(''); }}
                style={{ width: 22, height: 18, background: 'linear-gradient(180deg,#f97676 0%,#e02020 100%)', border: '2px outset #ff8888', color: '#fff', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            {/* Body */}
            <div style={{ padding: '12px 12px 8px', background: '#f0eeeb', borderBottom: '1px solid #c0bdb8' }}>
              <div style={{ fontSize: 11, fontFamily: F, color: '#000', marginBottom: 6 }}>Paste an IMDb link to add a movie to your collection.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontFamily: F, color: '#000', flexShrink: 0 }}>IMDb URL:</span>
                <input type="url" placeholder="https://www.imdb.com/title/tt1234567/"
                  value={imdbUrl}
                  onChange={e => { setImdbUrl(e.target.value); setAddError(''); setAddStatus('idle'); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !imdbUrl.trim() === false && addStatus !== 'saving') handleAddSubmit(); }}
                  style={{ ...xpInset, flex: 1, height: 24, padding: '0 6px', fontSize: 12, fontFamily: F, color: '#000' }} />
              </div>
              {addError && <div style={{ fontSize: 11, color: '#cc0000', fontFamily: F, marginBottom: 4 }}>{addError}</div>}
              {addStatus === 'ok' && <div style={{ fontSize: 11, color: '#006400', fontFamily: F, marginBottom: 4 }}>Movie added successfully!</div>}
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '8px 10px', background: xpRow }}>
              <button onClick={handleAddSubmit} disabled={addStatus === 'saving' || !imdbUrl.trim()}
                style={{ ...xpBtn, height: 26, opacity: (!imdbUrl.trim() || addStatus === 'saving') ? 0.5 : 1 }}>
                {addStatus === 'saving' ? 'Fetching…' : 'Add Movie'}
              </button>
              <button onClick={() => { setShowAddMovie(false); setAddStatus('idle'); setImdbUrl(''); setAddError(''); }} style={{ ...xpBtn, height: 26 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── XP Collections Tab ───────────────────────────────────────────────────────────

interface XPCollection { id: string; name: string; movieIds: number[]; createdAt: string; updatedAt: string; }

function XPCollectionsTab({ username, isOwn, collections, setCollections, allMovies, openColId, setOpenColId, xpPanel, xpBtn, xpInput, F }: {
  username: string; isOwn: boolean;
  collections: XPCollection[]; setCollections: React.Dispatch<React.SetStateAction<XPCollection[]>>;
  allMovies: Movie[]; openColId: string | null; setOpenColId: (id: string | null) => void;
  xpPanel: React.CSSProperties; xpBtn: React.CSSProperties; xpInput: React.CSSProperties; F: string;
}) {
  const [newColName, setNewColName] = useState('');
  const [addMovieSearch, setAddMovieSearch] = useState('');
  const [addMovieColId, setAddMovieColId] = useState<string | null>(null);

  const XPSectionHead = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', color: 'white', fontFamily: F, fontSize: 11, fontWeight: 'bold', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>{children}</div>
  );

  const save = (updated: XPCollection[]) => {
    setCollections(updated);
    localStorage.setItem(`collections_${username}`, JSON.stringify(updated));
  };

  const createCollection = () => {
    if (!newColName.trim()) return;
    const col: XPCollection = { id: Date.now().toString(), name: newColName.trim(), movieIds: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    save([...collections, col]);
    setNewColName('');
  };

  const deleteCollection = (id: string) => save(collections.filter(c => c.id !== id));

  const addMovieToCollection = (colId: string, movieId: number) => {
    save(collections.map(c => c.id === colId && !c.movieIds.includes(movieId) ? { ...c, movieIds: [...c.movieIds, movieId], updatedAt: new Date().toISOString() } : c));
    setAddMovieSearch('');
  };

  const removeMovieFromCollection = (colId: string, movieId: number) => {
    save(collections.map(c => c.id === colId ? { ...c, movieIds: c.movieIds.filter(id => id !== movieId), updatedAt: new Date().toISOString() } : c));
  };

  const searchResults = addMovieSearch.trim().length > 1
    ? allMovies.filter(m => m.title.toLowerCase().includes(addMovieSearch.toLowerCase())).slice(0, 8)
    : [];

  return (
    <div style={xpPanel}>
      <XPSectionHead>📁 Collections ({collections.length})</XPSectionHead>
      <div style={{ padding: 8 }}>
        {isOwn && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createCollection()} placeholder="New collection name..." style={{ ...xpInput, flex: 1 }} />
            <button onClick={createCollection} style={xpBtn}>+ Create</button>
          </div>
        )}
        {collections.length === 0 && <div style={{ fontSize: 11, fontFamily: F, color: '#808080' }}>No collections yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {collections.map(col => {
            const isOpen = openColId === col.id;
            const colMovies = col.movieIds.map(id => allMovies.find(m => m.id === id)).filter(Boolean) as Movie[];
            const isAddingMovie = addMovieColId === col.id;
            return (
              <div key={col.id}>
                <div onClick={() => setOpenColId(isOpen ? null : col.id)}
                  style={{ background: isOpen ? '#dce8f5' : '#f0eeeb', border: '2px outset #fff', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: F, fontSize: 11 }}>
                  <span>📁</span>
                  <span style={{ fontWeight: 'bold' }}>{col.name}</span>
                  <span style={{ color: '#808080', marginLeft: 'auto', fontSize: 10 }}>{col.movieIds.length} movies</span>
                  {isOwn && (
                    <button onClick={e => { e.stopPropagation(); deleteCollection(col.id); }}
                      style={{ background: '#c8352a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 9, padding: '1px 4px', marginLeft: 4 }}>
                      ×
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div style={{ background: 'white', border: '1px solid #808080', padding: 6, maxHeight: 260, overflowY: 'auto' }}>
                    <div style={{ fontSize: 10, fontFamily: F, color: '#808080', marginBottom: 6 }}>
                      Updated: {new Date(col.updatedAt).toLocaleDateString()}
                    </div>
                    {isOwn && (
                      <div style={{ marginBottom: 6, position: 'relative' }}>
                        {isAddingMovie ? (
                          <>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <input autoFocus value={addMovieSearch} onChange={e => setAddMovieSearch(e.target.value)} placeholder="Search movies to add..." style={{ ...xpInput, flex: 1 }} />
                              <button onClick={() => { setAddMovieColId(null); setAddMovieSearch(''); }} style={xpBtn}>Cancel</button>
                            </div>
                            {searchResults.length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #808080', zIndex: 100, maxHeight: 160, overflowY: 'auto', boxShadow: '2px 2px 4px rgba(0,0,0,0.25)' }}>
                                {searchResults.map(m => (
                                  <div key={m.id} onClick={() => addMovieToCollection(col.id, m.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', cursor: 'pointer', borderBottom: '1px solid #d4d0c8', fontFamily: F, fontSize: 11 }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#316ac5', e.currentTarget.style.color = 'white')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'white', e.currentTarget.style.color = 'black')}>
                                    <img src={m.image} alt="" style={{ width: 24, height: 34, objectFit: 'cover', border: '1px inset #808080', flexShrink: 0 }} />
                                    {m.title} ({m.year})
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <button onClick={() => setAddMovieColId(col.id)} style={xpBtn}>+ Add Movie</button>
                        )}
                      </div>
                    )}
                    {colMovies.length === 0 && <div style={{ fontSize: 11, fontFamily: F, color: '#808080', padding: '4px 0' }}>Empty collection.</div>}
                    {colMovies.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <img src={m.image} alt="" style={{ width: 28, height: 38, objectFit: 'cover', border: '1px inset #808080', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, fontFamily: F, flex: 1 }}>{m.title} ({m.year})</span>
                        {isOwn && (
                          <button onClick={() => removeMovieFromCollection(col.id, m.id)}
                            style={{ background: '#c8352a', color: 'white', border: 'none', cursor: 'pointer', fontSize: 9, padding: '1px 4px' }}>
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── XP Profile Content ────────────────────────────────────────────────────────────

function isoToFlagEmoji(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return '';
  const base = 0x1F1E6;
  return String.fromCodePoint(base + upper.charCodeAt(0) - 65) +
         String.fromCodePoint(base + upper.charCodeAt(1) - 65);
}

const COUNTRY_TABLE_XP: [string, string, ...string[]][] = [
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
  ['South Africa','ZA'],['New Zealand','NZ'],
];

function resolveCountryXP(raw: string): { flag: string; name: string } {
  if (!raw) return { flag: '', name: '' };
  const q = raw.trim().toLowerCase();
  for (const [name, iso, ...aliases] of COUNTRY_TABLE_XP) {
    if (name.toLowerCase() === q || iso.toLowerCase() === q || aliases.some(a => a.toLowerCase() === q)) {
      return { flag: isoToFlagEmoji(iso), name };
    }
  }
  if (raw.trim().length === 2 && /^[A-Za-z]{2}$/.test(raw.trim())) {
    return { flag: isoToFlagEmoji(raw.trim()), name: raw.trim().toUpperCase() };
  }
  return { flag: '', name: raw.trim() };
}

function countryToFlag(c: string): string { return resolveCountryXP(c).flag; }
function countryDisplayName(c: string): string { return resolveCountryXP(c).name || c; }

function FlagImgXP({ country }: { country: string }) {
  const entry = COUNTRY_TABLE_XP.find(([name, iso, ...aliases]) =>
    name.toLowerCase() === country.trim().toLowerCase() ||
    iso.toLowerCase() === country.trim().toLowerCase() ||
    (aliases as string[]).some((a: string) => a.toLowerCase() === country.trim().toLowerCase())
  );
  const iso = entry?.[1]?.toLowerCase() || (country.trim().length === 2 ? country.trim().toLowerCase() : '');
  if (!iso) return <></>;
  return <img src={`https://flagcdn.com/w20/${iso}.png`} alt={iso.toUpperCase()} width={16} height={12} style={{ display: 'inline', verticalAlign: 'middle' }} />;
}

function XPProfileContent({ username, currentUser, allMovies, onOpenProfile, isMobile }: {
  username: string;
  currentUser: any;
  allMovies: Movie[];
  onOpenProfile: (u: string) => void;
  onFollow: () => void;
  isMobile?: boolean;
}) {
  const F = XP_FONT;
  const isOwn = currentUser?.username === username;

  const [activeTab, setActiveTab] = useState<'profile' | 'comments' | 'ratings' | 'collections' | 'followers' | 'following' | 'messages'>('profile');

  // DM inbox state (XP profile messages tab)
  interface XpDmMsg { id: string; sender_username: string; recipient_username: string; text: string; image_url?: string; read: boolean; created_at: string; }
  interface XpDmConv { partner: string; profilePic: string; lastText: string; lastTime: string; unread: number; }
  const [xpDmConversations, setXpDmConversations] = useState<XpDmConv[]>([]);
  const [xpDmActivePartner, setXpDmActivePartner] = useState<string | null>(null);
  const [xpDmMessages, setXpDmMessages] = useState<XpDmMsg[]>([]);
  const [xpDmInput, setXpDmInput] = useState('');
  const [xpDmSending, setXpDmSending] = useState(false);
  const [xpDmLoading, setXpDmLoading] = useState(false);
  const xpDmBottomRef = useRef<HTMLDivElement>(null);
  const [xpDmImagePreview, setXpDmImagePreview] = useState<string | null>(null);
  const [xpDmGifOpen, setXpDmGifOpen] = useState(false);
  const [xpDmGifSearch, setXpDmGifSearch] = useState('');
  const [xpDmGifResults, setXpDmGifResults] = useState<{url: string; preview: string}[]>([]);
  const xpDmFileRef = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState(localStorage.getItem(`userBio_${username}`) || '');
  const [country, setCountry] = useState(localStorage.getItem(`userCountry_${username}`) || '');
  const [showCountry, setShowCountry] = useState(() => localStorage.getItem(`showCountry_${username}`) !== 'false');
  const [lastLogin, setLastLogin] = useState(localStorage.getItem(`lastLogin_${username}`) || '');
  const [pic, setPic] = useState(localStorage.getItem(`userPic_${username}`) || '');
  const [followers, setFollowers] = useState<string[]>(JSON.parse(localStorage.getItem(`followers_${username}`) || '[]'));
  const [following, setFollowing] = useState<string[]>(JSON.parse(localStorage.getItem(`following_${username}`) || '[]'));
  const [isFollowing, setIsFollowing] = useState(() => {
    if (!currentUser || isOwn) return false;
    const myF: string[] = JSON.parse(localStorage.getItem(`following_${currentUser.username}`) || '[]');
    return myF.includes(username);
  });
  const [picUrl, setPicUrl] = useState('');
  const [editBio, setEditBio] = useState(false);
  const [editBioVal, setEditBioVal] = useState(bio);
  const [userSearch, setUserSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<string[]>([]);
  const [collections, setCollections] = useState<{id:string;name:string;movieIds:number[];createdAt:string;updatedAt:string}[]>(JSON.parse(localStorage.getItem(`collections_${username}`) || '[]'));
  const [openColId, setOpenColId] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [xpBannerUrl, setXpBannerUrl] = useState(localStorage.getItem(`userBanner_${username}`) || '');
  const [xpBannerInput, setXpBannerInput] = useState(xpBannerUrl);
  const [xpUploadingBanner, setXpUploadingBanner] = useState(false);
  const xpBannerFileRef = useRef<HTMLInputElement>(null);
  const [xpSettingsOpen, setXpSettingsOpen] = useState(false);
  const [xpPreviewMode, setXpPreviewMode] = useState(false);
  const [xpReportOpen, setXpReportOpen] = useState(false);
  const [xpReportReason, setXpReportReason] = useState('');
  const [xpReportSent, setXpReportSent] = useState(false);
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsPwd, setSettingsPwd] = useState('');
  const [settingsConfirm, setSettingsConfirm] = useState('');
  const [settingsMsg, setSettingsMsg] = useState('');
  const profileCommentsKey2 = `profileComments_${username}`;
  const [profileComments2, setProfileComments2] = useState<{id:string;commenter:string;text:string;timestamp:number;imageUrl?:string}[]>(() => {
    try { return JSON.parse(localStorage.getItem(`profileComments_${username}`) || '[]'); } catch { return []; }
  });
  const [newProfComment, setNewProfComment] = useState('');
  const [profCommentImg, setProfCommentImg] = useState<string | null>(null);
  const [profGifOpen, setProfGifOpen] = useState(false);
  const [profGifQuery, setProfGifQuery] = useState('');
  const [profGifResults, setProfGifResults] = useState<any[]>([]);
  const profGifDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profImgFileRef = useRef<HTMLInputElement>(null);
  const [xpMovieList, setXpMovieList] = useState<'ratings' | 'comments' | 'watched' | null>(null);

  // Persist join date to Supabase so other users can see it
  useEffect(() => {
    if (isOwn && currentUser?.created_at && currentUser?.username) {
      const jd = currentUser.created_at;
      localStorage.setItem(`joinDate_${username}`, jd);
      loadUserProfile(currentUser.username).then(existing => {
        if (!existing?.joinDate) {
          saveUserProfile(currentUser.username, { ...(existing || {}), joinDate: jd }).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [isOwn, currentUser?.created_at, username]);

  // DM helpers
  function xpBuildConversations(rows: XpDmMsg[], me: string): XpDmConv[] {
    const map = new Map<string, XpDmConv>();
    rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const msg of rows) {
      const partner = msg.sender_username === me ? msg.recipient_username : msg.sender_username;
      const existing = map.get(partner);
      const isUnread = !msg.read && msg.recipient_username === me;
      map.set(partner, { partner, profilePic: existing?.profilePic || localStorage.getItem(`userPic_${partner}`) || '', lastText: msg.text || '', lastTime: msg.created_at, unread: (existing?.unread || 0) + (isUnread ? 1 : 0) });
    }
    return [...map.values()].sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
  }

  function xpFmtDmTime(iso: string) {
    const d = new Date(iso), diff = Date.now() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // Load DM inbox when on own profile + messages tab
  useEffect(() => {
    if (!isOwn || !currentUser?.username) return;
    const me = currentUser.username;
    const loadInbox = async () => {
      setXpDmLoading(true);
      const [{ data: sent }, { data: received }] = await Promise.all([
        supabase.from('private_messages').select('*').eq('sender_username', me).order('created_at', { ascending: false }).limit(200),
        supabase.from('private_messages').select('*').eq('recipient_username', me).order('created_at', { ascending: false }).limit(200),
      ]);
      setXpDmConversations(xpBuildConversations([...((sent || []) as XpDmMsg[]), ...((received || []) as XpDmMsg[])], me));
      setXpDmLoading(false);
    };
    loadInbox();
    const ch = supabase.channel(`xpdm:inbox:${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `recipient_username=eq.${me}` }, (payload) => {
        const msg = payload.new as XpDmMsg;
        setXpDmConversations(prev => {
          const all = prev.map(c => c.partner === msg.sender_username ? { ...c, lastText: msg.text, lastTime: msg.created_at, unread: c.unread + 1 } : c);
          if (!prev.find(c => c.partner === msg.sender_username)) all.unshift({ partner: msg.sender_username, profilePic: '', lastText: msg.text, lastTime: msg.created_at, unread: 1 });
          return all.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
        });
        setXpDmMessages(prev => xpDmActivePartner === msg.sender_username ? [...prev, msg] : prev);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isOwn, currentUser?.username]);

  // Load thread when active partner changes
  useEffect(() => {
    if (!xpDmActivePartner || !currentUser?.username) return;
    const me = currentUser.username;
    (async () => {
      const [{ data: s }, { data: r }] = await Promise.all([
        supabase.from('private_messages').select('*').eq('sender_username', me).eq('recipient_username', xpDmActivePartner).order('created_at'),
        supabase.from('private_messages').select('*').eq('sender_username', xpDmActivePartner).eq('recipient_username', me).order('created_at'),
      ]);
      const msgs = ([...((s || []) as XpDmMsg[]), ...((r || []) as XpDmMsg[])]).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setXpDmMessages(msgs);
      const unreadIds = msgs.filter(m => !m.read && m.recipient_username === me).map(m => m.id);
      if (unreadIds.length) supabase.from('private_messages').update({ read: true }).in('id', unreadIds).then(() => setXpDmConversations(prev => prev.map(c => c.partner === xpDmActivePartner ? { ...c, unread: 0 } : c)));
    })();
  }, [xpDmActivePartner, currentUser?.username]);

  useEffect(() => { xpDmBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [xpDmMessages]);

  const xpDmSearchGifs = async (q: string) => {
    if (!q.trim()) { setXpDmGifResults([]); return; }
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ea58c774/giphy/search?q=${encodeURIComponent(q)}&limit=12&offset=0`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      setXpDmGifResults((data.data || []).map((r: any) => ({
        url: r.images?.original?.url || r.images?.fixed_height?.url || '',
        preview: r.images?.fixed_height?.url || r.images?.fixed_width_small?.url || '',
      })).filter((r: any) => r.url));
    } catch { setXpDmGifResults([]); }
  };

  const xpDmSend = async (gifUrl?: string) => {
    const text = xpDmInput.trim();
    const imageToSend = gifUrl || xpDmImagePreview || null;
    if (!text && !imageToSend) return;
    if (!xpDmActivePartner || !currentUser?.username || xpDmSending) return;
    const me = currentUser.username;
    const tempMsg: XpDmMsg = { id: `tmp-${Date.now()}`, sender_username: me, recipient_username: xpDmActivePartner, text: text || '', read: false, created_at: new Date().toISOString() };
    setXpDmMessages(prev => [...prev, tempMsg]);
    setXpDmInput('');
    setXpDmImagePreview(null);
    setXpDmGifOpen(false);
    setXpDmGifSearch('');
    setXpDmGifResults([]);
    setXpDmSending(true);
    const { error } = await supabase.from('private_messages').insert({ sender_username: me, recipient_username: xpDmActivePartner, text: text || null, image_url: imageToSend, read: false });
    if (error) {
      setXpDmMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } else {
      const displayText = text || (imageToSend ? '[image]' : '');
      setXpDmConversations(prev => {
        const exists = prev.find(c => c.partner === xpDmActivePartner);
        if (exists) return [{ ...exists, lastText: displayText, lastTime: new Date().toISOString() }, ...prev.filter(c => c.partner !== xpDmActivePartner)];
        return [{ partner: xpDmActivePartner, profilePic: '', lastText: displayText, lastTime: new Date().toISOString(), unread: 0 }, ...prev];
      });
    }
    setXpDmSending(false);
  };

  const effectiveIsOwn = isOwn && !xpPreviewMode;

  const xpGrey = '#d4d0c8';
  const xpBorder = '1px solid #808080';
  const xpBlueHead: React.CSSProperties = { background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', color: 'white', fontFamily: F, fontSize: 11, fontWeight: 'bold', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 4 };
  const xpPanel: React.CSSProperties = { background: 'white', border: xpBorder, boxShadow: 'inset 1px 1px 0 #808080', overflow: 'hidden', marginBottom: 10 };
  const xpBtn: React.CSSProperties = { height: 23, padding: '0 10px', fontSize: 11, fontFamily: F, background: 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', border: '2px outset #fff', color: '#000', cursor: 'pointer', whiteSpace: 'nowrap' };
  const xpInput: React.CSSProperties = { height: 20, padding: '0 4px', fontSize: 11, fontFamily: F, background: 'white', border: 'none', outline: 'none', boxShadow: 'inset 1px 1px 0 #808080, inset -1px -1px 0 #fff, inset 2px 2px 0 #404040', color: '#000', width: '100%', boxSizing: 'border-box' };
  const xpTextArea: React.CSSProperties = { ...xpInput, height: 'auto', padding: '4px', resize: 'vertical' as const, minHeight: 50 };
  const badge: React.CSSProperties = { display: 'inline-block', padding: '1px 6px', fontSize: 9, fontFamily: F, fontWeight: 'bold', border: '1px outset #aaa', borderRadius: 2, margin: '1px 2px', cursor: 'default' };

  // Collect all comments from movies
  const allComments: {movieId:number;username:string;text:string;timestamp:number}[] = [];
  allMovies.forEach((m:any) => (m.comments||[]).forEach((c:any) => allComments.push({...c, movieId: m.id})));
  const userComments = allComments.filter(c => c.username === username);
  const ratedMovies = allMovies.filter(m => (m as any).userRating && (m as any).userRating > 0);
  const topMovies = ratedMovies.sort((a:any,b:any) => (b.userRating||0)-(a.userRating||0)).slice(0,4);

  const favGenreStr = (() => {
    const freq: Record<string,number> = {};
    ratedMovies.forEach((m:any) => (m.genre||'').split(',').map((g:string)=>g.trim()).filter(Boolean).forEach((g:string)=>{ freq[g]=(freq[g]||0)+1; }));
    const t = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
    return t.length ? t[0][0] : 'N/A';
  })();

  // Compute badges
  const userBadges: {label:string;color:string;bg:string}[] = [];
  if (ratedMovies.length >= 100) userBadges.push({ label: '🏆 100 Ratings', color: '#fff', bg: '#b8860b' });
  if (userComments.length >= 500) userBadges.push({ label: '💬 500 Comments', color: '#fff', bg: '#1e4d8c' });
  if (collections.length >= 3) userBadges.push({ label: '🎬 Movie Collector', color: '#fff', bg: '#8b4513' });
  if (userComments.length >= 50) userBadges.push({ label: '⭐ Top Critic', color: '#000', bg: '#ffd700' });
  const joinDate = localStorage.getItem(`joinDate_${username}`);
  if (joinDate && new Date(joinDate) < new Date('2025-01-01')) userBadges.push({ label: '📼 Early Member', color: '#fff', bg: '#4a7c4e' });
  if (currentUser?.role === 'admin' || currentUser?.role === 'moderator') userBadges.push({ label: '👑 Administrator', color: '#fff', bg: '#6a0dad' });

  const handleFollow = () => {
    if (!currentUser || isOwn) return;
    const myF: string[] = JSON.parse(localStorage.getItem(`following_${currentUser.username}`) || '[]');
    const theirF: string[] = JSON.parse(localStorage.getItem(`followers_${username}`) || '[]');
    if (isFollowing) {
      const nf = myF.filter(u => u !== username);
      const nt = theirF.filter(u => u !== currentUser.username);
      localStorage.setItem(`following_${currentUser.username}`, JSON.stringify(nf));
      localStorage.setItem(`followers_${username}`, JSON.stringify(nt));
      setFollowers(nt); setIsFollowing(false);
    } else {
      const nf = [...myF, username];
      const nt = [...theirF, currentUser.username];
      localStorage.setItem(`following_${currentUser.username}`, JSON.stringify(nf));
      localStorage.setItem(`followers_${username}`, JSON.stringify(nt));
      setFollowers(nt); setIsFollowing(true);
    }
  };

  const handleXpReport = async () => {
    if (!xpReportReason.trim() || !currentUser?.username || !username) return;
    const reason = xpReportReason.trim();
    const text = `⚑ Report: ${currentUser.username} reported ${username} — "${reason}"`;
    const link = `/user/${username}`;
    const { data: mods } = await supabase.from('profiles').select('username').in('role', ['admin', 'moderator']);
    const targets = (mods || []).map((r: any) => r.username).filter(Boolean);
    for (const mod of targets) {
      await addNotification(mod, { type: 'mention', senderUsername: currentUser.username, text, link });
    }
    if (targets.length === 0) {
      const key = 'reports:pending';
      const { data: existing } = await supabase.from('kv_store_ea58c774').select('value').eq('key', key).maybeSingle();
      const list = Array.isArray(existing?.value) ? existing.value : [];
      await supabase.from('kv_store_ea58c774').upsert({ key, value: [{ reporter: currentUser.username, reported: username, reason, at: new Date().toISOString() }, ...list].slice(0, 200) }, { onConflict: 'key' });
    }
    setXpReportSent(true);
    setTimeout(() => { setXpReportOpen(false); setXpReportReason(''); setXpReportSent(false); }, 1800);
  };

  const handlePicUrl = () => {
    if (!picUrl.trim()) return;
    setPic(picUrl.trim());
    localStorage.setItem(`userPic_${username}`, picUrl.trim());
    setPicUrl('');
  };
  const handlePicFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `profile-pics/${username}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('user-uploads').upload(path, file, { upsert: true, contentType: file.type });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
        const url = urlData.publicUrl;
        setPic(url); localStorage.setItem(`userPic_${username}`, url); e.target.value = ''; return;
      }
    } catch {}
    // fallback: base64
    const reader = new FileReader();
    reader.onload = ev => { const url = ev.target?.result as string; setPic(url); localStorage.setItem(`userPic_${username}`, url); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const handleSaveBio = () => {
    setBio(editBioVal);
    localStorage.setItem(`userBio_${username}`, editBioVal);
    setEditBio(false);
  };

  const handleSettingsEmail = async () => {
    if (!settingsEmail.trim()) return;
    try {
      await supabase.auth.updateUser({ email: settingsEmail });
      setSettingsMsg('Confirmation email sent to ' + settingsEmail);
      setSettingsEmail('');
    } catch { setSettingsMsg('Failed to update email'); }
  };
  const handleSettingsPwd = async () => {
    if (settingsPwd !== settingsConfirm) { setSettingsMsg('Passwords do not match'); return; }
    if (settingsPwd.length < 6) { setSettingsMsg('Min 6 characters'); return; }
    try {
      await supabase.auth.updateUser({ password: settingsPwd });
      setSettingsMsg('Password updated!');
      setSettingsPwd(''); setSettingsConfirm('');
    } catch { setSettingsMsg('Failed'); }
  };
  const handleGoogleLink = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
      setSettingsMsg('Google account linked!');
    } catch { setSettingsMsg('Could not link Google account'); }
  };
  useEffect(() => {
    loadProfileComments(username).then(loaded => {
      if (loaded.length > 0) {
        setProfileComments2(loaded);
        localStorage.setItem(profileCommentsKey2, JSON.stringify(loaded));
      }
    }).catch(() => {});
  }, [username]);

  const handleAddProfComment = () => {
    if (!currentUser || (!newProfComment.trim() && !profCommentImg)) return;
    const c = { id: Date.now().toString(), commenter: currentUser.username, text: newProfComment.trim(), timestamp: Date.now(), imageUrl: profCommentImg || undefined };
    const updated = [c, ...profileComments2];
    setProfileComments2(updated);
    localStorage.setItem(profileCommentsKey2, JSON.stringify(updated));
    saveProfileComments(username, updated).catch(() => {});
    setNewProfComment('');
    setProfCommentImg(null);
    setProfGifOpen(false);
  };

  const handleDeleteProfComment = (commentId: string) => {
    const updated = profileComments2.filter(x => x.id !== commentId);
    setProfileComments2(updated);
    localStorage.setItem(profileCommentsKey2, JSON.stringify(updated));
    saveProfileComments(username, updated).catch(() => {});
  };

  useEffect(() => {
    if (!userSearch.trim()) { setUserSearchResults([]); return; }
    const q = userSearch.toLowerCase();
    const users = new Set<string>();
    // From comment authors (fast local)
    allComments.forEach(c => { if (c.username.toLowerCase().includes(q)) users.add(c.username); });
    setUserSearchResults(Array.from(users).slice(0, 8));
    // Also query profiles table for registered users
    supabase.from('profiles').select('username').ilike('username', `%${q}%`).limit(20)
      .then(({ data }) => {
        (data || []).forEach(r => { if (r.username) users.add(r.username); });
        setUserSearchResults(Array.from(users).slice(0, 8));
      }).catch(() => {});
    // KV profile fallback
    supabase.from('kv_store_ea58c774').select('key').like('key', 'profile:%')
      .then(({ data }) => {
        (data || []).forEach(row => {
          const uname = String(row.key).replace('profile:', '');
          if (uname.toLowerCase().includes(q)) users.add(uname);
        });
        setUserSearchResults(Array.from(users).slice(0, 8));
      }).catch(() => {});
  }, [userSearch]);

  const XPSectionHead = ({ children }: { children: React.ReactNode }) => (
    <div style={xpBlueHead}>{children}</div>
  );

  const renderBadges = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 4 }}>
      {userBadges.map((b, i) => (
        <span key={i} style={{ ...badge, background: b.bg, color: b.color, borderColor: b.bg }}>{b.label}</span>
      ))}
      {userBadges.length === 0 && <span style={{ fontSize: 10, color: '#808080', fontFamily: F }}>No badges yet</span>}
    </div>
  );

  const renderMain = () => {
    switch (activeTab) {
      case 'profile': return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* 1. Profile Badges */}
          <div style={xpPanel}>
            <XPSectionHead>🏅 Profile Badges</XPSectionHead>
            <div style={{ padding: '6px 8px' }}>{renderBadges()}</div>
          </div>

          {/* 2. About Me */}
          <div style={xpPanel}>
            <XPSectionHead>📝 About Me</XPSectionHead>
            <div style={{ padding: 8, fontSize: 11, fontFamily: F }}>
              <div style={{ marginBottom: 4 }}><strong>Username:</strong> {username}</div>
              {(effectiveIsOwn || (showCountry && country)) && (
                <div style={{ marginBottom: 4 }}>
                  <strong>Country:</strong>{' '}
                  {effectiveIsOwn ? (
                    <input value={country} onChange={e => { setCountry(e.target.value); localStorage.setItem(`userCountry_${username}`, e.target.value); }} style={{ ...xpInput, width: 130, display: 'inline-block' }} />
                  ) : <><FlagImgXP country={country} /> {countryDisplayName(country)}</>}
                </div>
              )}
              {effectiveIsOwn && (
                <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={showCountry} id="xp-show-country" onChange={e => { setShowCountry(e.target.checked); localStorage.setItem(`showCountry_${username}`, String(e.target.checked)); }} />
                  <label htmlFor="xp-show-country" style={{ fontSize: 10, fontFamily: F }}>Show country publicly</label>
                </div>
              )}
              <div style={{ marginBottom: 4 }}>
                <strong>Joined:</strong>{' '}
                {(() => {
                  const raw = (isOwn ? currentUser?.created_at : null) || localStorage.getItem(`joinDate_${username}`);
                  return raw ? new Date(raw).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown';
                })()}
              </div>
              <div style={{ marginBottom: 4 }}><strong>Bio:</strong></div>
              {effectiveIsOwn && editBio ? (
                <div>
                  <textarea value={editBioVal} onChange={e => setEditBioVal(e.target.value)} rows={4} style={{ ...xpTextArea, width: '100%' }} />
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button onClick={handleSaveBio} style={xpBtn}>Save</button>
                    <button onClick={() => setEditBio(false)} style={xpBtn}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ background: '#f8f8f8', border: xpBorder, padding: '4px 6px', minHeight: 36, fontSize: 11, fontFamily: F, color: bio ? '#000' : '#808080' }}>{bio || 'No bio yet.'}</div>
                  {effectiveIsOwn && <button onClick={() => { setEditBioVal(bio); setEditBio(true); }} style={{ ...xpBtn, marginTop: 4 }}>Edit Bio</button>}
                </div>
              )}
            </div>
          </div>

          {/* 3. Movie Space */}
          <div style={xpPanel}>
            <XPSectionHead>🎬 Movie Space</XPSectionHead>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: F }}>
              <tbody>
                {[
                  { k: 'Ratings', v: ratedMovies.length, key: 'ratings' as const },
                  { k: 'Comments', v: userComments.length, key: 'comments' as const },
                  { k: 'Watched', v: ratedMovies.length, key: 'watched' as const },
                  { k: 'Favourite Genre', v: favGenreStr, key: null },
                ].map(({ k, v, key }, i) => (
                  <tr
                    key={i}
                    style={{ background: xpMovieList === key && key ? '#dce8f8' : i % 2 === 0 ? '#f0eeeb' : 'white', cursor: key ? 'pointer' : 'default' }}
                    onClick={key ? () => setXpMovieList(xpMovieList === key ? null : key) : undefined}
                  >
                    <td style={{ padding: '3px 8px', borderBottom: '1px solid #d4d0c8', fontWeight: 'bold', width: '50%', color: key ? '#0a246a' : undefined }}>{k}</td>
                    <td style={{ padding: '3px 8px', borderBottom: '1px solid #d4d0c8', color: key ? '#0a246a' : undefined }}>{v}{key ? ' ▼' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {xpMovieList && (() => {
              const items: { movie: any; extra?: string }[] = xpMovieList === 'ratings'
                ? ratedMovies.map((m: any) => ({ movie: m }))
                : xpMovieList === 'comments'
                  ? (userComments.map((c: any) => { const m = allMovies.find((mv: any) => Number(mv.id) === Number(c.movieId)); return m ? { movie: m, extra: c.text } : null; }).filter(Boolean) as any[])
                  : ratedMovies.map((m: any) => ({ movie: m }));
              const title = xpMovieList === 'ratings' ? 'Rated Movies' : xpMovieList === 'comments' ? 'Commented Movies' : 'Watched Movies';
              return (
                <div style={{ borderTop: '2px inset #d4d0c8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#c8ddf0', borderBottom: '1px solid #a8c8e8' }}>
                    <span style={{ fontSize: 11, fontFamily: F, fontWeight: 'bold', color: '#0a246a' }}>{title} ({items.length})</span>
                    <button onClick={() => setXpMovieList(null)} style={{ fontSize: 11, fontFamily: F, background: '#d4d0c8', border: '1px outset #fff', padding: '1px 6px', cursor: 'pointer' }}>✕</button>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {items.length === 0 && <div style={{ padding: 10, fontSize: 11, fontFamily: F, color: '#808080' }}>No items yet.</div>}
                    {items.map(({ movie: m, extra }: any, idx: number) => (
                      <div
                        key={idx}
                        style={{ display: 'flex', gap: 6, padding: '4px 8px', borderBottom: '1px solid #d4d0c8', background: idx % 2 === 0 ? '#f8f8f8' : 'white', cursor: 'pointer' }}
                        onClick={() => window.open(`/movie/${(m.title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${m.year}`, '_blank')}
                      >
                        {m.image && <img src={m.image} alt="" style={{ width: 28, height: 40, objectFit: 'cover', border: '1px inset #808080', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontFamily: F, fontWeight: 'bold', color: '#0a246a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                          <div style={{ fontSize: 9, fontFamily: F, color: '#808080' }}>{m.year}{m.genre ? ` · ${m.genre.split(',')[0]}` : ''}</div>
                          {xpMovieList === 'ratings' && m.userRating && (
                            <div style={{ fontSize: 10, fontFamily: F, color: '#b8860b' }}>{'★'.repeat(m.userRating||0)}{'☆'.repeat(5-(m.userRating||0))}</div>
                          )}
                          {xpMovieList === 'comments' && extra && (
                            <div style={{ fontSize: 10, fontFamily: F, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{String(extra).slice(0,55)}"</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 4. Top Movies */}
          <div style={xpPanel}>
            <XPSectionHead>⭐ Top Movies</XPSectionHead>
            <div style={{ padding: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {topMovies.length === 0 && <span style={{ fontSize: 11, fontFamily: F, color: '#808080' }}>No rated movies yet.</span>}
              {topMovies.map((m:any) => (
                <div key={m.id} style={{ textAlign: 'center', cursor: 'pointer', width: 100 }} onClick={() => window.open(`/movie/${m.title?.toLowerCase().replace(/\s+/g,'-')}-${m.year}`, '_blank')}>
                  <div style={{ border: '2px inset #808080', width: 90, height: 130, overflow: 'hidden', margin: '0 auto 4px' }}>
                    <img src={m.image} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ fontSize: 10, fontFamily: F, lineHeight: 1.2 }}>{m.title}</div>
                  <div style={{ fontSize: 9, color: '#808080', fontFamily: F }}>★ {(m as any).userRating}/5</div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Collections */}
          <div style={xpPanel}>
            <XPSectionHead>📁 Collections ({collections.length})</XPSectionHead>
            <div style={{ padding: 6 }}>
              {collections.length === 0 && <div style={{ fontSize: 11, fontFamily: F, color: '#808080', padding: '4px 2px' }}>No collections yet.</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {collections.map(col => (
                  <div key={col.id} onClick={() => setOpenColId(col.id)} style={{ background: '#f0eeeb', border: '1px outset #d4d0c8', padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontFamily: F }}>
                    📁 {col.name} ({col.movieIds.length})
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Recent Activity */}
          <div style={xpPanel}>
            <XPSectionHead>🕐 Recent Activity</XPSectionHead>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {(() => {
                const activity: {type:string;timestamp:number;label:string;sub:string}[] = [];
                userComments.forEach(c => {
                  const m = allMovies.find(mv => Number(mv.id) === Number(c.movieId));
                  activity.push({ type: 'comment', timestamp: c.timestamp, label: m ? `Commented on "${m.title}"` : 'Left a comment', sub: `"${c.text.slice(0,60)}${c.text.length>60?'…':''}"` });
                });
                ratedMovies.forEach((m:any) => {
                  if (m.ratedAt) activity.push({ type: 'rating', timestamp: m.ratedAt, label: `Rated "${m.title}"`, sub: `${'★'.repeat(m.userRating||0)}${'☆'.repeat(5-(m.userRating||0))} ${m.userRating}/5` });
                });
                activity.sort((a,b) => b.timestamp - a.timestamp);
                if (activity.length === 0) return <div style={{ padding: 10, fontSize: 11, fontFamily: F, color: '#808080' }}>No recent activity.</div>;
                return activity.slice(0, 10).map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 8px', borderBottom: '1px solid #d4d0c8', background: i % 2 === 0 ? '#f8f8f8' : 'white', fontSize: 11, fontFamily: F }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{a.type === 'comment' ? '💬' : '⭐'}</span>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#0a246a' }}>{a.label}</div>
                      <div style={{ color: '#444', fontSize: 10 }}>{a.sub}</div>
                      <div style={{ color: '#808080', fontSize: 9 }}>{new Date(a.timestamp).toLocaleDateString()}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Profile wall — inline on Profile tab */}
          <div style={xpPanel}>
            <XPSectionHead>📝 Profile Comments ({profileComments2.length})</XPSectionHead>
            {currentUser && (
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #d4d0c8', background: '#f0eeeb' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: profCommentImg ? 4 : 0 }}>
                  <input
                    value={newProfComment}
                    onChange={e => setNewProfComment(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddProfComment()}
                    placeholder={isOwn ? 'Write on your profile...' : `Leave a comment on ${username}'s profile...`}
                    style={{ ...xpInput, flex: 1 }}
                  />
                  <button onClick={() => profImgFileRef.current?.click()} style={{ ...xpBtn, padding: '0 6px' }} title="Attach image">📎</button>
                  <button onClick={() => { setProfGifOpen(v => !v); setProfGifQuery(''); setProfGifResults([]); }}
                    style={{ ...xpBtn, background: profGifOpen ? '#d07339' : 'linear-gradient(180deg,#f0eeeb 0%,#d4d0c8 100%)', color: profGifOpen ? 'white' : '#000', fontWeight: 'bold', padding: '0 6px' }}>GIF</button>
                  <button onClick={handleAddProfComment} style={xpBtn}>Post</button>
                </div>
                {profCommentImg && (
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: 4 }}>
                    <img src={profCommentImg} alt="preview" style={{ maxHeight: 50, maxWidth: 80, border: '1px solid #808080', display: 'block' }} />
                    <button onClick={() => setProfCommentImg(null)} style={{ position: 'absolute', top: -5, right: -5, width: 12, height: 12, background: '#e02020', color: 'white', border: 'none', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontFamily: F }}>×</button>
                  </div>
                )}
                {profGifOpen && (
                  <div style={{ background: '#e8e4dc', border: '1px inset #808080', padding: 4, marginTop: 4 }}>
                    <input value={profGifQuery} onChange={e => {
                      setProfGifQuery(e.target.value);
                      if (profGifDebounce.current) clearTimeout(profGifDebounce.current);
                      profGifDebounce.current = setTimeout(async () => {
                        if (!e.target.value.trim()) { setProfGifResults([]); return; }
                        try {
                          const r = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-ea58c774/giphy/search?q=${encodeURIComponent(e.target.value)}&limit=12&offset=0`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
                          const d = await r.json();
                          setProfGifResults(d.data || []);
                        } catch { setProfGifResults([]); }
                      }, 400);
                    }}
                      placeholder="Search GIFs…" style={{ width: '100%', boxSizing: 'border-box', fontSize: 10, fontFamily: F, padding: '2px 4px', border: '2px inset #808080', background: 'white', color: '#000', marginBottom: 3, display: 'block', outline: 'none' }} />
                    {profGifResults.length === 0 && <div style={{ fontSize: 9, color: '#808080', fontFamily: F, textAlign: 'center', padding: 3 }}>{profGifQuery ? 'No GIFs found' : 'Type to search…'}</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, maxHeight: 90, overflowY: 'auto' }}>
                      {profGifResults.map((g: any, i: number) => (
                        <img key={i} src={g.images?.fixed_height_small?.url || g.images?.fixed_height?.url} alt="gif"
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', cursor: 'pointer', border: '1px solid #c0bdb8' }}
                          onClick={() => { setProfCommentImg(g.images?.original?.url || g.images?.fixed_height?.url); setProfGifOpen(false); setProfGifQuery(''); setProfGifResults([]); }} />
                      ))}
                    </div>
                  </div>
                )}
                <input ref={profImgFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  try {
                    const ext = file.name.split('.').pop() || 'jpg';
                    const path = `comment-imgs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const { data: up } = await supabase.storage.from('chat-images').upload(path, file, { contentType: file.type, upsert: false });
                    if (up?.path) {
                      const { data: pub } = supabase.storage.from('chat-images').getPublicUrl(up.path);
                      if (pub?.publicUrl) { setProfCommentImg(pub.publicUrl); e.target.value = ''; return; }
                    }
                  } catch {}
                  const reader = new FileReader();
                  reader.onload = ev => { if (ev.target?.result) setProfCommentImg(ev.target.result as string); };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
              </div>
            )}
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {profileComments2.length === 0 && <div style={{ padding: 12, fontSize: 11, fontFamily: F, color: '#808080' }}>No comments yet. Be the first!</div>}
              {profileComments2.map((c, i) => {
                const cPic = localStorage.getItem(`userPic_${c.commenter}`) || '';
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderBottom: '1px solid #d4d0c8', background: i % 2 === 0 ? '#f8f8f8' : 'white' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1px inset #808080', flexShrink: 0, background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                      {cPic ? <img src={cPic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '👤'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button onClick={() => onOpenProfile(c.commenter)} style={{ fontSize: 11, fontFamily: F, fontWeight: 'bold', color: '#0a246a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{c.commenter}</button>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, fontFamily: F, color: '#808080' }}>{new Date(c.timestamp).toLocaleDateString()}</span>
                          {(isOwn || currentUser?.username === c.commenter) && (
                            <button onClick={() => handleDeleteProfComment(c.id)} style={{ fontSize: 13, lineHeight: 1, color: '#c8352a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
                          )}
                        </div>
                      </div>
                      {c.text && <div style={{ fontSize: 11, fontFamily: F, color: '#000', marginTop: 2 }}>{c.text}</div>}
                      {c.imageUrl && <img src={c.imageUrl} alt="attachment" style={{ maxHeight: 80, maxWidth: 140, display: 'block', marginTop: 3, border: '1px solid #808080' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

      case 'comments': return (
        <div style={xpPanel}>
          <XPSectionHead>💬 User Comments ({userComments.length})</XPSectionHead>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {userComments.length === 0 && <div style={{ padding: 12, fontSize: 11, fontFamily: F, color: '#808080' }}>No comments yet.</div>}
            {userComments.map((c, i) => {
              const m = allMovies.find(m => Number(m.id) === Number(c.movieId));
              return (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 8px', borderBottom: '1px solid #d4d0c8', background: i % 2 === 0 ? '#f8f8f8' : 'white' }}>
                  {m && <img src={m.image} alt="" style={{ width: 36, height: 50, objectFit: 'cover', border: '1px inset #808080', flexShrink: 0 }} />}
                  <div style={{ flex: 1 }}>
                    {m && <div style={{ fontSize: 11, fontFamily: F, fontWeight: 'bold', color: '#0a246a' }}>{m.title} ({m.year})</div>}
                    <div style={{ fontSize: 11, fontFamily: F, color: '#000', marginTop: 2 }}>"{c.text}"</div>
                    <div style={{ fontSize: 9, fontFamily: F, color: '#808080', marginTop: 2 }}>{new Date(c.timestamp).toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

      case 'ratings': return (
        <div style={xpPanel}>
          <XPSectionHead>⭐ Ratings ({ratedMovies.length})</XPSectionHead>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {ratedMovies.length === 0 && <div style={{ padding: 12, fontSize: 11, fontFamily: F, color: '#808080' }}>No ratings yet.</div>}
            {ratedMovies.map((m:any, i:number) => (
              <div key={m.id} style={{ display: 'flex', gap: 8, padding: '5px 8px', borderBottom: '1px solid #d4d0c8', background: i % 2 === 0 ? '#f8f8f8' : 'white' }}>
                <img src={m.image} alt="" style={{ width: 36, height: 50, objectFit: 'cover', border: '1px inset #808080', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontFamily: F, fontWeight: 'bold' }}>{m.title}</div>
                  <div style={{ fontSize: 10, fontFamily: F, color: '#808080' }}>{m.year} · {m.genre?.split(',')[0]}</div>
                  <div style={{ fontSize: 11, fontFamily: F, color: '#b8860b' }}>{'★'.repeat(m.userRating || 0)}{'☆'.repeat(5-(m.userRating||0))} {m.userRating}/5</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

      case 'followers': return (
        <div style={xpPanel}>
          <XPSectionHead>👥 Followers ({followers.length})</XPSectionHead>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {followers.length === 0 && <div style={{ padding: 12, fontSize: 11, fontFamily: F, color: '#808080' }}>No followers yet.</div>}
            {followers.map((u, i) => {
              const uPic = localStorage.getItem(`userPic_${u}`) || '';
              return (
                <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderBottom: '1px solid #d4d0c8', background: i % 2 === 0 ? '#f8f8f8' : 'white' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1px inset #808080', flexShrink: 0, background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {uPic ? <img src={uPic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '👤'}
                  </div>
                  <button onClick={() => onOpenProfile(u)} style={{ ...xpBtn, background: 'none', border: 'none', padding: 0, fontWeight: 'bold', color: '#0a246a', textDecoration: 'underline', cursor: 'pointer', boxShadow: 'none' }}>{u}</button>
                </div>
              );
            })}
          </div>
        </div>
      );

      case 'following': return (
        <div style={xpPanel}>
          <XPSectionHead>❤️ Following ({following.length})</XPSectionHead>
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {following.length === 0 && <div style={{ padding: 12, fontSize: 11, fontFamily: F, color: '#808080' }}>Not following anyone yet.</div>}
            {following.map((u, i) => {
              const uPic = localStorage.getItem(`userPic_${u}`) || '';
              return (
                <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderBottom: '1px solid #d4d0c8', background: i % 2 === 0 ? '#f8f8f8' : 'white' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1px inset #808080', flexShrink: 0, background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {uPic ? <img src={uPic} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : '👤'}
                  </div>
                  <button onClick={() => onOpenProfile(u)} style={{ ...xpBtn, background: 'none', border: 'none', padding: 0, fontWeight: 'bold', color: '#0a246a', textDecoration: 'underline', cursor: 'pointer', boxShadow: 'none' }}>{u}</button>
                </div>
              );
            })}
          </div>
        </div>
      );

      case 'collections': return (
        <XPCollectionsTab
          username={username}
          isOwn={isOwn}
          collections={collections}
          setCollections={setCollections}
          allMovies={allMovies}
          openColId={openColId}
          setOpenColId={setOpenColId}
          xpPanel={xpPanel}
          xpBtn={xpBtn}
          xpInput={xpInput}
          F={F}
        />
      );

      case 'messages': {
        if (!isOwn) return (
          <div style={{ ...xpPanel, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✉</div>
            <div style={{ fontSize: 11, fontFamily: F, color: '#808080' }}>Messages are private.</div>
          </div>
        );
        return (
          <div style={{ display: 'flex', flex: 1, border: '1px inset #808080', background: 'white', overflow: 'hidden', minHeight: 0 }}>
            {/* Conversation list */}
            <div style={{ width: xpDmActivePartner ? 180 : '100%', display: xpDmActivePartner && isMobile ? 'none' : 'flex', flexDirection: 'column', borderRight: '1px solid #808080', flexShrink: 0, minWidth: xpDmActivePartner ? 140 : undefined, maxWidth: xpDmActivePartner ? 180 : undefined, background: '#f0eeea' }}>
              <div style={{ padding: '4px 8px', background: '#316ac5', color: 'white', fontSize: 10, fontFamily: F, fontWeight: 'bold', flexShrink: 0 }}>
                Inbox {xpDmLoading && '(Loading…)'}
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {!xpDmLoading && xpDmConversations.length === 0 && (
                  <div style={{ padding: 12, fontSize: 10, fontFamily: F, color: '#808080', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>✉</div>
                    No conversations yet.
                  </div>
                )}
                {xpDmConversations.map(conv => (
                  <button key={conv.partner} onClick={() => setXpDmActivePartner(conv.partner)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 8px', border: 'none', borderBottom: '1px solid #d4d0c8', cursor: 'pointer', textAlign: 'left', background: xpDmActivePartner === conv.partner ? '#316ac5' : 'transparent', color: xpDmActivePartner === conv.partner ? 'white' : 'black', fontFamily: F }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, border: '1px inset #808080' }}>
                      {conv.profilePic ? <img src={conv.profilePic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontFamily: F, fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.partner}</span>
                        <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0, marginLeft: 4 }}>{xpFmtDmTime(conv.lastTime)}</span>
                      </div>
                      <div style={{ fontSize: 9, fontFamily: F, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.lastText}</div>
                    </div>
                    {conv.unread > 0 && <span style={{ background: '#d07339', color: 'white', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{conv.unread > 9 ? '9+' : conv.unread}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Thread panel */}
            {xpDmActivePartner ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                <div style={{ padding: '3px 8px', background: '#316ac5', color: 'white', fontSize: 10, fontFamily: F, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {isMobile && <button onClick={() => setXpDmActivePartner(null)} style={{ ...xpBtn, background: 'none', border: 'none', color: 'white', padding: 0, boxShadow: 'none', fontSize: 11, marginRight: 4, cursor: 'pointer' }}>←</button>}
                  ✉ {xpDmActivePartner}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {xpDmMessages.map(msg => {
                    const isMe = msg.sender_username === currentUser?.username;
                    if (msg.sender_username === 'system') return <div key={msg.id} style={{ textAlign: 'center', fontSize: 9, fontFamily: F, color: '#808080', fontStyle: 'italic' }}>{msg.text}</div>;
                    return (
                      <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '72%', padding: '4px 8px', fontSize: 10, fontFamily: F, border: '1px solid #808080', background: isMe ? '#d07339' : '#f0eeea', color: isMe ? 'white' : 'black', boxShadow: '1px 1px 0 #808080' }}>
                          {msg.image_url && <img src={msg.image_url} alt="media" style={{ maxWidth: 160, maxHeight: 120, display: 'block', marginBottom: msg.text ? 4 : 0, border: '1px inset #808080' }} />}
                          {msg.text && msg.text}
                          <div style={{ fontSize: 8, opacity: 0.65, marginTop: 2, textAlign: 'right' }}>{xpFmtDmTime(msg.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={xpDmBottomRef} />
                </div>
                {/* GIF picker */}
                {xpDmGifOpen && (
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #808080', background: '#f0eeea', maxHeight: 140, overflowY: 'auto', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      <input value={xpDmGifSearch} onChange={e => { setXpDmGifSearch(e.target.value); xpDmSearchGifs(e.target.value); }}
                        placeholder="Search GIFs…" style={{ ...xpInput, flex: 1, height: 18, fontSize: 9 }} />
                      <button onClick={() => { setXpDmGifOpen(false); setXpDmGifSearch(''); setXpDmGifResults([]); }} style={{ height: 18, padding: '0 6px', fontSize: 9, background: '#d4d0c8', border: '1px outset #fff', cursor: 'pointer' }}>×</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                      {xpDmGifResults.map((g, i) => (
                        <img key={i} src={g.preview} alt="gif" style={{ width: '100%', height: 50, objectFit: 'cover', cursor: 'pointer', border: '1px solid #d4d0c8' }}
                          onClick={() => xpDmSend(g.url)} />
                      ))}
                      {xpDmGifSearch && xpDmGifResults.length === 0 && <div style={{ gridColumn: '1/-1', fontSize: 9, fontFamily: F, color: '#808080', textAlign: 'center', padding: 4 }}>No GIFs found</div>}
                      {!xpDmGifSearch && <div style={{ gridColumn: '1/-1', fontSize: 9, fontFamily: F, color: '#808080', textAlign: 'center', padding: 4 }}>Type to search GIFs…</div>}
                    </div>
                  </div>
                )}
                {xpDmImagePreview && (
                  <div style={{ padding: '4px 8px', borderTop: '1px solid #808080', background: '#f0eeea', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <img src={xpDmImagePreview} alt="preview" style={{ width: 40, height: 40, objectFit: 'cover', border: '1px inset #808080' }} />
                    <span style={{ fontSize: 9, fontFamily: F, flex: 1 }}>Image ready</span>
                    <button onClick={() => setXpDmImagePreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00', fontSize: 12, lineHeight: 1 }}>×</button>
                  </div>
                )}
                <input ref={xpDmFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  if (file.size > 4 * 1024 * 1024) { alert('Image must be under 4MB'); return; }
                  const reader = new FileReader();
                  reader.onload = ev => { if (ev.target?.result) setXpDmImagePreview(ev.target.result as string); };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }} />
                <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid #808080', flexShrink: 0, background: '#d4d0c8', alignItems: 'center' }}>
                  <button onClick={() => xpDmFileRef.current?.click()} title="Attach image" style={{ height: 22, width: 22, padding: 0, fontSize: 11, background: '#d4d0c8', border: '2px outset #fff', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖼</button>
                  <button onClick={() => { setXpDmGifOpen(v => !v); setXpDmGifSearch(''); setXpDmGifResults([]); }} style={{ height: 22, padding: '0 6px', fontSize: 9, fontWeight: 'bold', background: xpDmGifOpen ? '#d07339' : '#d4d0c8', color: xpDmGifOpen ? 'white' : 'black', border: '2px outset #fff', cursor: 'pointer', flexShrink: 0 }}>GIF</button>
                  <input value={xpDmInput} onChange={e => setXpDmInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); xpDmSend(); } }}
                    placeholder={`Message ${xpDmActivePartner}…`} disabled={xpDmSending}
                    style={{ ...xpInput, flex: 1, height: 22, fontSize: 10 }} />
                  <button onClick={() => xpDmSend()} disabled={(!xpDmInput.trim() && !xpDmImagePreview) || xpDmSending} style={{ ...xpBtn, height: 22, fontSize: 10, minWidth: 48, opacity: (!xpDmInput.trim() && !xpDmImagePreview) || xpDmSending ? 0.5 : 1 }}>Send</button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f6f0' }}>
                <div style={{ textAlign: 'center', fontSize: 11, fontFamily: F, color: '#808080' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>✉</div>
                  Select a conversation
                </div>
              </div>
            )}
          </div>
        );
      }

      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: xpGrey, fontFamily: F, overflow: 'hidden' }}>

      {/* Profile header */}
      <div style={{ position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
        {/* Banner background */}
        {xpBannerUrl && (
          <img src={xpBannerUrl} alt="banner" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />
        )}
        <div style={{ position: 'relative', zIndex: 1, background: xpBannerUrl ? 'rgba(10,30,90,0.72)' : 'linear-gradient(180deg,#2563b0 0%,#1e4a8e 100%)', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {/* Left: Avatar + URL input */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 88, height: 88, border: '3px inset #808080', overflow: 'hidden', background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
                {pic ? <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              {effectiveIsOwn && (
                <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, background: '#d07339', border: '1px outset #fff', color: 'white', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📷</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={handlePicFile} />
            <input value={picUrl} onChange={e => setPicUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePicUrl()} placeholder="Avatar URL..." style={{ ...xpInput, width: 92, fontSize: 9, height: 17 }} />
            {/* Banner file upload for own profile */}
            {effectiveIsOwn && (
              <>
                <input ref={xpBannerFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
                  setXpUploadingBanner(true);
                  try {
                    const ext = file.name.split('.').pop() || 'jpg';
                    const path = `banners/${username}-${Date.now()}.${ext}`;
                    const { data, error } = await supabase.storage.from('user-uploads').upload(path, file, { upsert: true });
                    if (!error && data) {
                      const { data: urlData } = supabase.storage.from('user-uploads').getPublicUrl(path);
                      setXpBannerUrl(urlData.publicUrl); localStorage.setItem(`userBanner_${username}`, urlData.publicUrl);
                      try { await supabase.auth.updateUser({ data: { ...(currentUser?.user_metadata || {}), bannerUrl: urlData.publicUrl } }); } catch {}
                      setXpUploadingBanner(false); return;
                    }
                  } catch {}
                  if (file.size <= 2 * 1024 * 1024) {
                    const reader = new FileReader();
                    reader.onload = ev => { const url = ev.target?.result as string; setXpBannerUrl(url); localStorage.setItem(`userBanner_${username}`, url); };
                    reader.readAsDataURL(file);
                  }
                  setXpUploadingBanner(false);
                }} />
                <button onClick={() => xpBannerFileRef.current?.click()} disabled={xpUploadingBanner}
                  style={{ height: 17, padding: '0 6px', fontSize: 9, fontFamily: XP_FONT, background: '#d4d0c8', border: '1px outset #fff', cursor: 'pointer', width: 92, opacity: xpUploadingBanner ? 0.5 : 1 }}>
                  {xpUploadingBanner ? 'Uploading…' : xpBannerUrl ? '📷 Change banner' : '📷 Add banner'}
                </button>
                {xpBannerUrl && (
                  <button onClick={() => { setXpBannerUrl(''); localStorage.setItem(`userBanner_${username}`, ''); }}
                    style={{ height: 17, padding: '0 6px', fontSize: 9, fontFamily: XP_FONT, background: '#d4d0c8', border: '1px outset #fff', cursor: 'pointer', width: 92 }}>
                    × Remove banner
                  </button>
                )}
              </>
            )}
          </div>

          {/* Right: Info */}
          <div style={{ flex: 1, color: 'white', minWidth: 0 }}>
            {/* Username + Role + Online status in one row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 'bold', fontFamily: F, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>{username}</span>
              {currentUser?.role && currentUser.role !== 'user' && (
                <span style={{ fontSize: 9, fontFamily: F, fontWeight: 'bold', padding: '1px 5px', background: currentUser.role === 'admin' ? '#6a0dad' : '#1a6bbd', color: 'white', border: '1px outset #aaa', borderRadius: 2 }}>
                  {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'moderator' ? 'Mod' : currentUser.role}
                </span>
              )}
              <span style={{ fontSize: 10, fontFamily: F, color: '#7aff7a', fontWeight: 'bold' }}>● Online</span>
            </div>
            {/* Country */}
            {country && (isOwn || showCountry) && (
              <div style={{ fontSize: 10, fontFamily: F, opacity: 0.9, marginBottom: 2 }}><><FlagImgXP country={country} /> {countryDisplayName(country)}</></div>
            )}
            {/* Followers/following */}
            <div style={{ fontSize: 10, fontFamily: F, opacity: 0.8, marginBottom: 4 }}>
              <button onClick={() => setActiveTab('followers')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: F, textDecoration: 'underline', padding: 0, color: 'inherit' }}>{followers.length} followers</button>
              {' · '}
              <button onClick={() => setActiveTab('following')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, fontFamily: F, textDecoration: 'underline', padding: 0, color: 'inherit' }}>{following.length} following</button>
            </div>
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {!isOwn && currentUser && (
                <button onClick={handleFollow} style={{ ...xpBtn, height: 20, fontSize: 10 }}>{isFollowing ? '✓ Following' : '+ Follow'}</button>
              )}
              {!isOwn && <button onClick={() => navigate(`/chat?dm=${username}`)} style={{ ...xpBtn, height: 20, fontSize: 10 }}>✉ Message</button>}
              {!isOwn && currentUser && <button onClick={() => setXpReportOpen(true)} style={{ ...xpBtn, height: 20, fontSize: 10, color: '#8b0000' }}>⚑ Report</button>}
              {isOwn && (
                <button onClick={() => setXpSettingsOpen(true)} style={{ ...xpBtn, height: 20, fontSize: 10 }}>⚙ Settings</button>
              )}
              {isOwn && (
                <button onClick={() => setXpPreviewMode(v => !v)} style={{ ...xpBtn, height: 20, fontSize: 10, background: xpPreviewMode ? '#316ac5' : undefined, color: xpPreviewMode ? 'white' : undefined }}>
                  {xpPreviewMode ? '← Edit' : '👁 Preview'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {xpPreviewMode && (
        <div style={{ background: '#fffbe6', borderBottom: '1px solid #b8860b', padding: '3px 8px', fontSize: 10, fontFamily: F, color: '#7a5c00', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span>👁 Preview mode — viewing as a visitor sees you</span>
          <button onClick={() => setXpPreviewMode(false)} style={{ ...xpBtn, height: 16, fontSize: 9, padding: '0 6px' }}>Exit Preview</button>
        </div>
      )}

      {/* User search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#c0bdb8', borderBottom: '1px solid #808080', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontFamily: F }}>🔍 Find User:</span>
        <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search users..." style={{ ...xpInput, width: 160 }} />
        {userSearchResults.length > 0 && userSearch && (
          <div style={{ position: 'absolute', marginTop: 24, zIndex: 999, background: 'white', border: '1px solid #808080', boxShadow: '2px 2px 4px rgba(0,0,0,0.3)', minWidth: 160, maxHeight: 120, overflowY: 'auto' }}>
            {userSearchResults.map(u => (
              <div key={u} onClick={() => { onOpenProfile(u); setUserSearch(''); setUserSearchResults([]); }}
                style={{ padding: '3px 8px', fontSize: 11, fontFamily: F, cursor: 'pointer', borderBottom: '1px solid #d4d0c8' }}
                onMouseEnter={e => (e.currentTarget.style.background='#316ac5', (e.currentTarget.style.color='white'))}
                onMouseLeave={e => (e.currentTarget.style.background='white', (e.currentTarget.style.color='black'))}
              >{u}</div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile: horizontal tab bar; Desktop: vertical left nav */}
      {isMobile && (
        <div style={{ display: 'flex', overflowX: 'auto', background: '#c0bdb8', borderBottom: '2px solid #808080', flexShrink: 0 }}>
          {(([
            ['profile', '🏠', 'Profile'],
            ['comments', '💬', 'Comments'],
            ['ratings', '⭐', 'Ratings'],
            ['collections', '📁', 'Collections'],
            ['followers', '👥', `Flwrs (${followers.length})`],
            ['following', '❤️', `Flwng (${following.length})`],
            ...(isOwn ? [['messages', '✉', 'Messages']] : []),
          ]) as [string, string, string][]).map(([t, icon, label]) => (
            <button key={t} onClick={() => setActiveTab(t as any)}
              style={{
                flexShrink: 0, padding: '5px 8px', fontSize: 10, fontFamily: F,
                cursor: 'pointer', border: 'none', borderRight: '1px solid #9e9b96', lineHeight: 1.3,
                background: activeTab === t ? 'linear-gradient(180deg,#4a7fc1 0%,#316ac5 100%)' : 'transparent',
                color: activeTab === t ? '#fff' : '#000',
                fontWeight: activeTab === t ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
              }}>
              <span style={{ marginRight: 3 }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      )}

      {/* Left nav + right content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Vertical left nav — desktop only */}
        {!isMobile && (
          <div style={{ width: 108, background: '#c0bdb8', borderRight: '2px solid #808080', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
            {(([
              ['profile', '🏠', 'Profile'],
              ['comments', '💬', 'Comments'],
              ['ratings', '⭐', 'Ratings'],
              ['collections', '📁', 'Collections'],
              ['followers', '👥', `Followers (${followers.length})`],
              ['following', '❤️', `Following (${following.length})`],
              ...(isOwn ? [['messages', '✉', 'Messages']] : []),
            ]) as [string, string, string][]).map(([t, icon, label]) => (
              <button key={t} onClick={() => setActiveTab(t as any)}
                style={{
                  display: 'block', width: '100%', padding: '7px 6px', fontSize: 10, fontFamily: F,
                  cursor: 'pointer', textAlign: 'left', border: 'none', lineHeight: 1.3,
                  borderBottom: '1px solid #9e9b96',
                  background: activeTab === t ? 'linear-gradient(180deg,#4a7fc1 0%,#316ac5 100%)' : 'transparent',
                  color: activeTab === t ? '#fff' : '#000',
                  fontWeight: activeTab === t ? 'bold' : 'normal',
                  boxShadow: activeTab === t ? 'inset 1px 1px 0 rgba(255,255,255,0.3)' : 'none',
                }}>
                <span style={{ display: 'block', fontSize: 13, marginBottom: 2 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Right content */}
        <div style={{ flex: 1, overflow: activeTab === 'messages' ? 'hidden' : 'auto', padding: activeTab === 'messages' ? 0 : 10, display: 'flex', flexDirection: 'column' }}>
          {renderMain()}
        </div>
      </div>

      {/* Settings modal */}
      {xpReportOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#d4d0c8', border: '2px outset #fff', width: 320, fontFamily: F, boxShadow: '4px 6px 16px rgba(0,0,0,0.5)' }}>
            <div style={{ background: 'linear-gradient(180deg,#6a0000 0%,#c02020 100%)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold', fontFamily: F }}>⚑ Report User</span>
              <button onClick={() => { setXpReportOpen(false); setXpReportReason(''); }} style={{ width: 16, height: 14, background: 'linear-gradient(180deg,#f97676 0%,#e02020 100%)', border: '1px outset #ff8888', color: 'white', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 12 }}>
              {xpReportSent ? (
                <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, fontFamily: F, color: '#006400' }}>✓ Report submitted. Moderators notified.</div>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontFamily: F, marginBottom: 6, color: '#333' }}>Reporting: <strong>{username}</strong></div>
                  <div style={{ fontSize: 10, fontFamily: F, marginBottom: 4 }}>Reason for report:</div>
                  <textarea
                    value={xpReportReason}
                    onChange={e => setXpReportReason(e.target.value)}
                    placeholder="Describe the issue..."
                    style={{ ...xpTextArea, marginBottom: 8, height: 60 }}
                  />
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setXpReportOpen(false); setXpReportReason(''); }} style={{ ...xpBtn }}>Cancel</button>
                    <button onClick={handleXpReport} disabled={!xpReportReason.trim()} style={{ ...xpBtn, background: '#8b0000', color: 'white', opacity: xpReportReason.trim() ? 1 : 0.5 }}>Submit Report</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {xpSettingsOpen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#d4d0c8', border: '2px outset #fff', width: 340, fontFamily: F, boxShadow: '4px 6px 16px rgba(0,0,0,0.5)' }}>
            {/* Title bar */}
            <div style={{ background: 'linear-gradient(180deg,#0a246a 0%,#3c6eb4 100%)', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'white', fontSize: 12, fontWeight: 'bold', fontFamily: F }}>⚙ Account Settings</span>
              <button onClick={() => { setXpSettingsOpen(false); setSettingsMsg(''); }} style={{ width: 16, height: 14, background: 'linear-gradient(180deg,#f97676 0%,#e02020 100%)', border: '1px outset #ff8888', color: 'white', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Change Email */}
              <div>
                <div style={{ fontSize: 10, fontFamily: F, fontWeight: 'bold', color: '#0a246a', marginBottom: 3, borderBottom: '1px solid #808080', paddingBottom: 2 }}>Change Email</div>
                <input value={settingsEmail} onChange={e => setSettingsEmail(e.target.value)} placeholder="New email address" style={{ ...xpInput, marginBottom: 4 }} />
                <button onClick={handleSettingsEmail} style={{ ...xpBtn, width: '100%' }}>Update Email</button>
              </div>
              {/* Change Password */}
              <div>
                <div style={{ fontSize: 10, fontFamily: F, fontWeight: 'bold', color: '#0a246a', marginBottom: 3, borderBottom: '1px solid #808080', paddingBottom: 2 }}>Change Password</div>
                <input type="password" value={settingsPwd} onChange={e => setSettingsPwd(e.target.value)} placeholder="New password (min 6)" style={{ ...xpInput, marginBottom: 4 }} />
                <input type="password" value={settingsConfirm} onChange={e => setSettingsConfirm(e.target.value)} placeholder="Confirm password" style={{ ...xpInput, marginBottom: 4 }} />
                <button onClick={handleSettingsPwd} style={{ ...xpBtn, width: '100%' }}>Update Password</button>
              </div>
              {/* Link Google */}
              <div>
                <div style={{ fontSize: 10, fontFamily: F, fontWeight: 'bold', color: '#0a246a', marginBottom: 3, borderBottom: '1px solid #808080', paddingBottom: 2 }}>Google Account</div>
                <button onClick={handleGoogleLink} style={{ ...xpBtn, width: '100%' }}>🔗 Link Google Account</button>
              </div>
              {settingsMsg && <div style={{ fontSize: 10, fontFamily: F, color: settingsMsg.includes('!') || settingsMsg.includes('sent') ? '#006400' : '#c8352a', background: settingsMsg.includes('!') || settingsMsg.includes('sent') ? '#e8f5e9' : '#fde8e8', border: '1px solid', padding: '3px 6px' }}>{settingsMsg}</div>}
              <button onClick={() => { setXpSettingsOpen(false); setSettingsMsg(''); }} style={{ ...xpBtn, alignSelf: 'flex-end' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const XP_FONT_STR = '"Tahoma", "MS Sans Serif", Arial, sans-serif';

function XPDocContent({ title, icon, sections }: { title: string; icon: string; sections: { heading: string; body: string }[] }) {
  const F = XP_FONT_STR;
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#d4d0c8', fontFamily: F }}>
      {/* Page title bar */}
      <div style={{ background: 'linear-gradient(180deg,#316ac5 0%,#1a4faa 100%)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid #0831d9' }}>
        <img src={icon} alt="" style={{ width: 28, height: 28, objectFit: 'contain', flexShrink: 0 }} />
        <span style={{ color: 'white', fontSize: 18, fontWeight: 'bold', fontFamily: F, textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>{title}</span>
      </div>
      {/* Sections */}
      <div style={{ padding: '10px 10px 20px' }}>
        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            {/* Section heading — XP blue label bar */}
            <div style={{ background: '#316ac5', color: 'white', fontSize: 13, fontWeight: 'bold', padding: '4px 10px', fontFamily: F, borderBottom: '1px solid #0831d9' }}>
              {s.heading}
            </div>
            {/* Section body — white inset box */}
            <div style={{ background: 'white', border: '2px inset #808080', padding: '10px 12px' }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: '#111', fontFamily: F }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function XPPrivacyContent() {
  return (
    <XPDocContent
      title="Privacy Policy"
      icon={ICON_STARGATE}
      sections={[
        { heading: 'Overview', body: 'This privacy policy explains how Trash Bin collects, uses, and protects your personal information.' },
        { heading: 'Information We Collect', body: 'We collect information you provide directly, such as your username, email address, and profile information when you create an account.' },
        { heading: 'How We Use Your Information', body: 'We use collected information to provide and improve our services, personalize your experience, and communicate with you about updates.' },
        { heading: 'Data Storage', body: 'Your data is stored securely using Supabase infrastructure. We implement appropriate security measures to protect your information.' },
        { heading: 'Cookies', body: 'We use cookies and localStorage to maintain your session and remember your preferences.' },
        { heading: 'Contact', body: 'For privacy-related questions, contact us at wannabenargail@gmail.com' },
      ]}
    />
  );
}

function XPTermsContent() {
  return (
    <XPDocContent
      title="Terms of Service"
      icon={ICON_STARGATE2}
      sections={[
        { heading: 'Agreement', body: 'By using Trash Bin, you agree to these terms. Please read them carefully before using the service.' },
        { heading: 'Acceptable Use', body: 'You agree to use this service lawfully and not to post harmful, offensive, or illegal content. Spam, harassment, and impersonation are prohibited.' },
        { heading: 'User Accounts', body: 'You are responsible for maintaining the security of your account and all activity under your credentials.' },
        { heading: 'Content', body: 'Movie data is sourced from public APIs. User-submitted content remains your responsibility. We reserve the right to remove content that violates these terms.' },
        { heading: 'Modifications', body: 'We may update these terms at any time. Continued use of the service constitutes acceptance of updated terms.' },
        { heading: 'Copyright Disclaimer', body: 'All movie posters, TV show artwork, logos, trademarks, and other copyrighted materials featured on this website are the property of their respective copyright owners. This website does not claim ownership of any such materials. Images and related content are used solely for identification, informational, editorial, and reference purposes. If you are a copyright owner and believe that any content infringes your rights, please contact us and the material will be promptly reviewed and removed if necessary.' },
        { heading: 'Contact', body: 'For terms-related questions, contact us at wannabenargail@gmail.com' },
      ]}
    />
  );
}
