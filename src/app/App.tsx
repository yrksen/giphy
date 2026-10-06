import { AllCommentsModal } from "./components/AllCommentsModal";
import { FilterSidebar } from "./components/FilterSidebar";
import { DarkModeToggle } from "./components/DarkModeToggle";
import { LoginModal } from "./components/LoginModal";
import { TiredOfScrollingModal } from "./components/TiredOfScrollingModal";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { MovieDetailPage } from "./pages/MovieDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ChatPage } from "./pages/ChatPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import { useState, useEffect, useMemo, Component, type ReactNode } from "react";

class AppErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean; msg: string }> {
  state = { crashed: false, msg: '' };
  static getDerivedStateFromError(err: Error) { return { crashed: true, msg: err.message }; }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#888', gap: 8 }}>
          <span style={{ fontSize: 32 }}>🎬</span>
          <span style={{ fontSize: 14 }}>Trash Bin Cinema failed to load.</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{this.state.msg}</span>
          <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '6px 16px', fontSize: 12, cursor: 'pointer', borderRadius: 6, border: '1px solid #ccc' }}>Reload</button>
        </div>
      );
    }
    return this.state.crashed ? null : this.props.children;
  }
}
import {
  Search,
  Plus,
  X,
  Filter,
  Star,
  RefreshCw,
  LayoutGrid,
  List,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { MovieCard, type Movie } from "./components/MovieCard";
import { RecentMoviesCarousel } from "./components/RecentMoviesCarousel";
import { SortDropdown } from "./components/SortDropdown";
import { AddMovieDialog } from "./components/AddMovieDialog";
import { PaginationControls } from "./components/PaginationControls";
import { FaviconSetter } from "./components/FaviconSetter";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";
import { ChatAssistant } from "./components/ChatAssistant";
import { XPDesktop } from "./components/XPDesktop";
import { FloatingChat } from "./components/LiveChat";
import { recordActivity, registerInDirectory } from "./utils/socialDB";
import { TicketGenerator } from "./components/TicketGenerator";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { supabase, mapSupabaseUser, fetchUserRole } from "./utils/supabaseClient";
import { createSlug } from "./utils/slugify";
import { SiteHeader } from "./components/SiteLayout";

const logoImage = "https://i.imgur.com/vUiVqow.png?direct";

type SortOption =
  | "dateAdded"
  | "dateAddedLatest"
  | "title"
  | "titleDesc"
  | "year"
  | "imdbRating"
  | "userRating"
  | "communityRating";

interface Comment {
  id: string;
  movieId: number;
  username: string;
  text: string;
  timestamp: number;
  imageUrl?: string;
  parentId?: string;
}

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

// Generate or retrieve anonymous user ID for non-logged-in users
const getAnonymousUserId = () => {
  let anonymousId = localStorage.getItem("anonymousUserId");
  if (!anonymousId) {
    // Generate a unique ID using timestamp + random string
    anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("anonymousUserId", anonymousId);
  }
  return anonymousId;
};

// ── Google OAuth username setup modal ────────────────────────────────────────

function UsernameSetupModal({ onComplete }: { onComplete: (username: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const t = value.trim();
    if (!t || t.length < 2) { setError('At least 2 characters required.'); return; }
    if (t.length > 20) { setError('Max 20 characters.'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(t)) { setError('Letters, numbers and underscores only.'); return; }
    setSaving(true);
    try {
      const { data } = await supabase.from('profiles').select('username').ilike('username', t).limit(1);
      if (data && data.length > 0) { setError('That username is already taken.'); setSaving(false); return; }
      const { error: upErr } = await supabase.auth.updateUser({ data: { username: t } });
      if (upErr) { setError('Failed to save. Please try again.'); setSaving(false); return; }
      onComplete(t);
    } catch { setError('Something went wrong. Please try again.'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.3)] dark:border-[rgba(126,62,21,0.3)] rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[rgba(208,115,57,0.12)] flex items-center justify-center mx-auto mb-3 text-3xl">👤</div>
          <h2 className="text-lg font-bold text-[#100b09] dark:text-[#f7f1ed]">Choose your username</h2>
          <p className="text-sm text-[rgba(16,11,9,0.55)] dark:text-[rgba(247,241,237,0.55)] mt-1 leading-relaxed">
            Your Google account doesn't have a username yet. Pick one so others can find and mention you.
          </p>
        </div>
        <input
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="YourUsername"
          className="w-full text-sm border border-[rgba(208,115,57,0.3)] dark:border-[rgba(126,62,21,0.4)] rounded-lg px-3 py-2.5 bg-[rgba(208,115,57,0.05)] dark:bg-[rgba(126,62,21,0.1)] outline-none focus:border-[#d07339] text-[#100b09] dark:text-[#f7f1ed] placeholder-[rgba(16,11,9,0.3)] dark:placeholder-[rgba(247,241,237,0.3)]"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-[#d07339] hover:bg-[#c36a32] disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Set username & continue'}
        </button>
        <p className="text-[10px] text-center text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)]">
          Letters, numbers and _ only · 2–20 characters
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUsernameSetup, setShowUsernameSetup] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  // Returns true if this is a Google/OAuth user with no explicit username set
  const needsUsername = (user: any) => !!user && !user.user_metadata?.username;

  // Apply dark mode class globally — runs on all pages (not just library)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Subscribe to Supabase Auth session — session persists via localStorage until explicit sign-out
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const mapped = session ? mapSupabaseUser(session.user) : null;
      setCurrentUser(mapped);
      if (session?.user && needsUsername(session.user)) setShowUsernameSetup(true);
      setAuthLoading(false);
      // Fetch authoritative role from profiles table (never trust user_metadata for role)
      if (mapped && session?.user?.id) {
        fetchUserRole(session.user.id).then(role => {
          setCurrentUser(u => u ? { ...u, role } : u);
        }).catch(() => {});
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const mapped = session ? mapSupabaseUser(session.user) : null;
      setCurrentUser(mapped);
      if (session?.user && needsUsername(session.user)) setShowUsernameSetup(true);
      setAuthLoading(false);
      if (mapped && session?.user?.id) {
        // Always resolve role from DB — user_metadata.role is untrusted
        fetchUserRole(session.user.id).then(role => {
          setCurrentUser(u => u ? { ...u, role } : u);
        }).catch(() => {});
      }
      if (mapped?.username && _event === 'SIGNED_IN') {
        localStorage.setItem(`lastLogin_${mapped.username}`, new Date().toISOString());
        registerInDirectory(mapped.username, mapped.profilePicture || '').catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Heartbeat: write lastSeen every 3 minutes while logged in so profiles show accurate status
  useEffect(() => {
    if (!currentUser?.username) return;
    const writeHeartbeat = async () => {
      const now = new Date().toISOString();
      localStorage.setItem(`lastSeen_${currentUser.username}`, now);
      try {
        await supabase.from('kv_store_ea58c774')
          .upsert({ key: `lastSeen:${currentUser.username}`, value: now }, { onConflict: 'key' });
      } catch {}
    };
    writeHeartbeat(); // Write immediately on login
    const interval = setInterval(writeHeartbeat, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser?.username]);

  return (
    <AppErrorBoundary>
    <Router>
      <FaviconSetter />
      {showUsernameSetup && (
        <UsernameSetupModal
          onComplete={username => {
            setShowUsernameSetup(false);
            setCurrentUser((prev: any) => prev ? { ...prev, username } : prev);
          }}
        />
      )}
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
            />
          }
        />
        <Route
          path="/movie/:title"
          element={
            <MovieDetailPage
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
            />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
            />
          }
        />
        <Route
          path="/reset-password"
          element={
            <ResetPasswordPage isDarkMode={isDarkMode} />
          }
        />
        <Route
          path="/auth/callback"
          element={
            <AuthCallbackPage isDarkMode={isDarkMode} />
          }
        />
        <Route path="/privacy" element={<PrivacyPolicyPage currentUser={currentUser} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} setCurrentUser={setCurrentUser} />} />
        <Route path="/terms" element={<TermsOfServicePage currentUser={currentUser} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} setCurrentUser={setCurrentUser} />} />
        <Route
          path="/users/:username"
          element={
            <UserProfilePage
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              setCurrentUser={setCurrentUser}
            />
          }
        />
        <Route
          path="/chat"
          element={
            <ChatPage
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              setCurrentUser={setCurrentUser}
            />
          }
        />
        <Route
          path="*"
          element={<NotFoundPage currentUser={currentUser} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />}
        />
      </Routes>
    </Router>
    </AppErrorBoundary>
  );
}

function MovieListRow({ movie, isDarkMode, onClick }: { movie: Movie; isDarkMode: boolean; onClick: () => void }) {
  const genres = movie.genre?.split(',').map(g => g.trim()).filter(Boolean) ?? [];
  const imdbRating = movie.imdbRating || movie.rating;
  const genreColors = ['bg-[#eea77a]/20 text-[#d07339] border-[#eea77a]/40', 'bg-blue-100/60 text-blue-700 border-blue-200/60', 'bg-purple-100/60 text-purple-700 border-purple-200/60', 'bg-green-100/60 text-green-700 border-green-200/60', 'bg-rose-100/60 text-rose-700 border-rose-200/60'];
  const genreColorsDark = ['bg-[#7e3e15]/30 text-[#c36a32] border-[#7e3e15]/40', 'bg-blue-900/30 text-blue-400 border-blue-800/40', 'bg-purple-900/30 text-purple-400 border-purple-800/40', 'bg-green-900/30 text-green-400 border-green-800/40', 'bg-rose-900/30 text-rose-400 border-rose-800/40'];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border transition-all hover:scale-[1.005] active:scale-[0.999] ${isDarkMode ? 'border-[#3d2010] bg-[#18110c] hover:border-[#7e3e15] hover:bg-[#1f1409]' : 'border-[#f0dcc8] bg-white hover:border-[#eea77a] hover:bg-[#fefaf7]'}`}
      style={{ boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(208,115,57,0.06)' }}
    >
      <div className="flex gap-0 items-stretch">
        {/* Poster */}
        <div className="flex-shrink-0 w-16 md:w-24 rounded-l-xl overflow-hidden">
          <img src={movie.image} alt={movie.title} className="w-full h-full object-cover" style={{ minHeight: 96, maxHeight: 160 }} loading="lazy" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-3 md:p-4 flex flex-col gap-1.5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-bold leading-tight text-sm md:text-base ${isDarkMode ? 'text-[#f7f1ed]' : 'text-[#100b09]'}`}>
              {movie.title}
            </h3>
            <span className={`text-xs flex-shrink-0 mt-0.5 font-medium ${isDarkMode ? 'text-[rgba(247,241,237,0.45)]' : 'text-[#100b09]/40'}`}>
              {movie.year}{movie.runtime ? ` · ${movie.runtime}` : ''}
            </span>
          </div>

          {/* Ratings */}
          <div className="flex items-center gap-3 flex-wrap">
            {imdbRating != null && imdbRating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="size-3 fill-[#d07339] text-[#d07339] flex-shrink-0" />
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-[#c36a32]' : 'text-[#d07339]'}`}>{imdbRating.toFixed(1)}</span>
                <span className={`text-xs ${isDarkMode ? 'text-[rgba(247,241,237,0.35)]' : 'text-[#100b09]/30'}`}>IMDb</span>
              </span>
            )}
            {movie.userRating != null && movie.userRating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="size-3 fill-[#234da0] text-[#234da0] flex-shrink-0" />
                <span className={`text-xs font-semibold text-[#234da0]`}>{movie.userRating.toFixed(1)}</span>
                <span className={`text-xs ${isDarkMode ? 'text-[rgba(247,241,237,0.35)]' : 'text-[#100b09]/30'}`}>You</span>
              </span>
            )}
          </div>

          {/* Genre pills */}
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {genres.map((g, i) => (
                <span key={g} className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full border font-medium ${isDarkMode ? genreColorsDark[i % genreColorsDark.length] : genreColors[i % genreColors.length]}`}>
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Tags */}
          {movie.tags && movie.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {movie.tags.map(tag => (
                <span key={tag} className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full border font-medium ${isDarkMode ? 'bg-purple-900/30 text-purple-400 border-purple-800/40' : 'bg-purple-100/60 text-purple-700 border-purple-200/60'}`}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Description — hidden on very small screens, 2 lines on mobile, 3 on desktop */}
          {(movie.plot || movie.description) && (
            <p className={`text-xs md:text-sm leading-relaxed hidden xs:block ${isDarkMode ? 'text-[rgba(247,241,237,0.55)]' : 'text-[#100b09]/60'}`}
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {movie.plot || movie.description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function HomePage({
  currentUser,
  setCurrentUser,
  isDarkMode,
  setIsDarkMode,
}: {
  currentUser: any;
  setCurrentUser: any;
  isDarkMode: boolean;
  setIsDarkMode: any;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedGenres, setSelectedGenres] = useState<
    string[]
  >([]);
  const [selectedYears, setSelectedYears] = useState<number[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] =
    useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentView, setCurrentView] = useState<
    "main" | "towatch"
  >("main");
  const [toWatchMovies, setToWatchMovies] = useState<Movie[]>(
    [],
  );
  const [comments, setComments] = useState<Comment[]>([]);

  // New states for enhanced features
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem("sortPreference");
    return (saved as SortOption) || "title";
  });
  const [imdbRatingRange, setImdbRatingRange] = useState<
    [number, number]
  >([0, 10]);
  const [runtimeFilter, setRuntimeFilter] =
    useState<string>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    [],
  );
  const [isLoginModalOpen, setIsLoginModalOpen] =
    useState(false);
  const [isTiredModalOpen, setIsTiredModalOpen] =
    useState(false);
  const [hasShownTiredModal, setHasShownTiredModal] =
    useState(false);
  const [isLoadingTrailers, setIsLoadingTrailers] =
    useState(false);
  const [trailerLoadProgress, setTrailerLoadProgress] =
    useState<string>("");
  const [showSearchDropdown, setShowSearchDropdown] =
    useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('movieViewMode') as 'grid' | 'list') || 'grid';
  });

  const toggleViewMode = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    localStorage.setItem('movieViewMode', next);
  };

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(
    () => {
      const saved = localStorage.getItem("sidebarExpanded");
      return saved ? JSON.parse(saved) : true;
    },
  );
  const [showAllComments, setShowAllComments] = useState(false);
  const [isXPMode, setIsXPMode] = useState(false);

  const canModerate = currentUser?.role === 'admin' || currentUser?.role === 'moderator';

  const MOVIES_PER_PAGE_MOBILE = 24;
  // 5 rows × columns-per-row (6 at md, 8 at 2xl)
  const [desktopCols, setDesktopCols] = useState(() => window.innerWidth >= 1536 ? 8 : 6);
  useEffect(() => {
    const update = () => setDesktopCols(window.innerWidth >= 1536 ? 8 : 6);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  const MOVIES_PER_PAGE_DESKTOP = desktopCols * 5;

  useEffect(() => {
    document.title = "Trash bin";
    const loadData = async () => {
      // Load all data in parallel for faster initial load
      await Promise.all([
        loadMovies(),
        loadToWatchMovies(),
        loadComments(),
        loadRatings(),
      ]);
    };
    loadData();
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem(
      "darkMode",
      JSON.stringify(isDarkMode),
    );
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Save sort preference
  useEffect(() => {
    localStorage.setItem("sortPreference", sortBy);
  }, [sortBy]);

  // Save sidebar expanded preference
  useEffect(() => {
    localStorage.setItem(
      "sidebarExpanded",
      JSON.stringify(isSidebarExpanded),
    );
  }, [isSidebarExpanded]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Show "Tired of scrolling?" modal on page 10 (only on mobile)
    if (
      currentPage === 10 &&
      !hasShownTiredModal &&
      window.innerWidth < 768
    ) {
      setIsTiredModalOpen(true);
      setHasShownTiredModal(true);
    }
  }, [currentPage, currentView, hasShownTiredModal]);

  // Check for view/xp/random/q query parameters
  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "towatch") {
      setCurrentView("towatch");
    } else {
      setCurrentView("main");
    }
    if (searchParams.get("xp") === "1") {
      setIsXPMode(true);
    }
    const q = searchParams.get("q");
    if (q) {
      setSearchQuery(q);
      setCurrentPage(1);
    }
  }, [searchParams]);

  const loadToWatchMovies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/towatch`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setToWatchMovies(data.movies);
        localStorage.setItem(
          "toWatchMovies",
          JSON.stringify(data.movies),
        );
      } else {
        console.error(
          "Error loading to watch movies:",
          data.error,
        );
        loadToWatchFromLocalStorage();
      }
    } catch (error) {
      console.error(
        "Error fetching to watch movies from backend, using localStorage:",
        error,
      );
      loadToWatchFromLocalStorage();
    }
  };

  const loadToWatchFromLocalStorage = () => {
    const stored = localStorage.getItem("toWatchMovies");
    if (stored) {
      try {
        const parsedMovies = JSON.parse(stored);
        setToWatchMovies(parsedMovies);
      } catch (error) {
        console.error("Error parsing toWatchMovies:", error);
        setToWatchMovies([]);
      }
    } else {
      setToWatchMovies([]);
    }
  };

  const loadMovies = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/movies`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setMovies(data.movies);
        localStorage.setItem(
          "movies",
          JSON.stringify(data.movies),
        );
      } else {
        console.error("Error loading movies:", data.error);
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error(
        "Error fetching movies from backend, using localStorage:",
        error,
      );
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem("movies");
    if (stored) {
      try {
        const parsedMovies = JSON.parse(stored);
        setMovies(parsedMovies);
      } catch (error) {
        console.error("Error parsing localStorage:", error);
        setMovies([]);
      }
    } else {
      setMovies([]);
    }
  };

  const loadComments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
        localStorage.setItem(
          "comments",
          JSON.stringify(data.comments),
        );
      } else {
        console.error("Error loading comments:", data.error);
        loadCommentsFromLocalStorage();
      }
    } catch (error) {
      console.error(
        "Error fetching comments from backend, using localStorage:",
        error,
      );
      loadCommentsFromLocalStorage();
    }
  };

  const loadCommentsFromLocalStorage = () => {
    const stored = localStorage.getItem("comments");
    if (stored) {
      try {
        const parsedComments = JSON.parse(stored);
        setComments(parsedComments);
      } catch (error) {
        console.error("Error parsing comments:", error);
        setComments([]);
      }
    } else {
      setComments([]);
    }
  };

  const loadRatings = async () => {
    try {
      // Load community ratings
      const response = await fetch(`${API_BASE_URL}/ratings`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();

      // Load user's personal ratings
      let userIdentifier = "";
      if (currentUser) {
        userIdentifier = currentUser.username;
      } else {
        userIdentifier = getAnonymousUserId();
      }

      const userResponse = await fetch(
        `${API_BASE_URL}/user-ratings/${userIdentifier}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      let userRatings: { [key: string]: number } = {};
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success) {
          userRatings = userData.userRatings;
        }
      }

      if (data.success && data.averages) {
        // Merge rating data into movies
        setMovies((prevMovies) =>
          prevMovies.map((m) => ({
            ...m,
            communityRating:
              data.averages[m.id]?.average || undefined,
            ratingCount:
              data.averages[m.id]?.count || undefined,
            userRating: userRatings[m.id] || m.userRating,
          })),
        );

        // Also update toWatch movies
        setToWatchMovies((prevMovies) =>
          prevMovies.map((m) => ({
            ...m,
            communityRating:
              data.averages[m.id]?.average || undefined,
            ratingCount:
              data.averages[m.id]?.count || undefined,
            userRating: userRatings[m.id] || m.userRating,
          })),
        );
      } else {
        console.error("Error loading ratings:", data.error);
      }
    } catch (error) {
      console.error(
        "Error fetching ratings from backend:",
        error,
      );
    }
  };

  const handleGenreChange = (
    genre: string,
    checked: boolean,
  ) => {
    if (checked) {
      setSelectedGenres([...selectedGenres, genre]);
    } else {
      setSelectedGenres(
        selectedGenres.filter((g) => g !== genre),
      );
    }
    setCurrentPage(1);
  };

  const handleClearGenres = () => {
    setSelectedGenres([]);
    setCurrentPage(1);
  };

  const handleClearYears = () => {
    setSelectedYears([]);
    setCurrentPage(1);
  };

  const handleYearChange = (year: number, checked: boolean) => {
    if (checked) {
      setSelectedYears([...selectedYears, year]);
    } else {
      setSelectedYears(selectedYears.filter((y) => y !== year));
    }
    setCurrentPage(1);
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    if (checked) {
      setSelectedTags([...selectedTags, tag]);
    } else {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    }
    setCurrentPage(1);
  };

  const handleFixRuntimes = async () => {
    const apiKey = "f9062e1";
    const targetList =
      currentView === "towatch" ? toWatchMovies : movies;

    // Filter to only movies without runtime
    const moviesWithoutRuntime = targetList.filter(
      (movie) => !movie.runtime || movie.runtime.trim() === "",
    );

    if (moviesWithoutRuntime.length === 0) {
      alert("All movies already have runtime information!");
      return;
    }

    if (
      !confirm(
        `This will fetch runtime information from IMDb for ${moviesWithoutRuntime.length} movies that are missing runtime data. Continue?`,
      )
    ) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    console.log(
      `🎬 Starting runtime fix for ${moviesWithoutRuntime.length} movies (out of ${targetList.length} total) in ${currentView} list`,
    );

    for (const movie of moviesWithoutRuntime) {
      console.log(
        `\n📽️ Processing: "${movie.title}" (ID: ${movie.id})`,
      );
      console.log(
        `   Current runtime: ${movie.runtime || "NONE"}`,
      );
      console.log(`   IMDb ID: ${movie.imdbId || "NONE"}`);

      try {
        // Try to extract IMDb ID from the movie data
        let imdbId = movie.imdbId;

        // If no IMDb ID, try to search by title
        if (!imdbId) {
          console.log(
            `   🔍 Searching IMDb for: "${movie.title}" (${movie.year})`,
          );
          const searchRes = await fetch(
            `https://www.omdbapi.com/?t=${encodeURIComponent(movie.title)}&y=${movie.year}&apikey=${apiKey}`,
          );
          const searchData = await searchRes.json();
          console.log(`   Search result:`, searchData);
          if (searchData.Response === "True") {
            imdbId = searchData.imdbID;
            console.log(`   ✓ Found IMDb ID: ${imdbId}`);
          } else {
            console.log(`   ✗ Not found on IMDb`);
            skippedCount++;
            continue;
          }
        }

        if (imdbId) {
          console.log(`   📡 Fetching details from IMDb...`);
          const res = await fetch(
            `https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`,
          );
          const data = await res.json();
          console.log(`   IMDb data:`, data);

          // Check if it's a series or movie
          if (data.Response === "True") {
            let runtimeValue = null;

            if (data.Type === "series") {
              // For series, store season and episode count
              if (
                data.totalSeasons &&
                data.totalSeasons !== "N/A"
              ) {
                runtimeValue = `${data.totalSeasons} Season${data.totalSeasons !== "1" ? "s" : ""}`;
                console.log(
                  `   📺 Series found: ${runtimeValue}`,
                );
              }
            } else {
              // For movies, store runtime
              if (data.Runtime && data.Runtime !== "N/A") {
                runtimeValue = data.Runtime;
                console.log(
                  `   ⏱️ Runtime found: ${runtimeValue}`,
                );
              }
            }

            if (runtimeValue) {
              // Update backend for each movie individually
              try {
                const endpoint =
                  currentView === "towatch"
                    ? "towatch"
                    : "movies";
                const updateRes = await fetch(
                  `${API_BASE_URL}/${endpoint}/${movie.id}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${publicAnonKey}`,
                    },
                    body: JSON.stringify({
                      runtime: runtimeValue,
                      imdbId: imdbId,
                    }),
                  },
                );

                const responseText = await updateRes.text();
                console.log(
                  `   Backend response:`,
                  responseText,
                );

                if (updateRes.ok) {
                  console.log(
                    `   ✅ Updated runtime for "${movie.title}": ${runtimeValue}`,
                  );
                  successCount++;
                } else {
                  console.error(
                    `   ❌ Failed to update "${movie.title}":`,
                    responseText,
                  );
                  errorCount++;
                }
              } catch (error) {
                console.error(
                  `   ❌ Error updating movie ${movie.id} in backend:`,
                  error,
                );
                errorCount++;
              }
            } else {
              console.log(
                `   ⚠️ No runtime/season information available from IMDb`,
              );
              skippedCount++;
            }
          } else {
            console.log(`   ⚠️ No data available from IMDb`);
            skippedCount++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) =>
          setTimeout(resolve, 200),
        );
      } catch (error) {
        console.error(
          `   ❌ Error fetching runtime for ${movie.title}:`,
          error,
        );
        errorCount++;
      }
    }

    console.log(`\n📊 Final Results:`);
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);

    // Reload data from backend to ensure we have the latest
    await loadMovies();
    await loadToWatchMovies();

    alert(
      `Runtimes updated!\nSuccess: ${successCount}\nErrors: ${errorCount}\nSkipped: ${skippedCount}`,
    );
  };

  const handleMigrateDateAdded = async () => {
    console.log(
      "🔄 Starting migration: Adding dateAdded timestamps to all movies...",
    );

    const targetList =
      currentView === "towatch" ? toWatchMovies : movies;
    let updatedCount = 0;

    for (const movie of targetList) {
      // Skip movies that already have dateAdded
      if (movie.dateAdded) {
        continue;
      }

      console.log(
        `✅ Adding dateAdded to movie #${movie.id}: ${movie.title}`,
      );

      // Add dateAdded timestamp (use current time)
      const updatedMovie = {
        ...movie,
        dateAdded: Date.now(),
      };

      try {
        // Update in database
        const endpoint =
          currentView === "towatch" ? "towatch" : "movies";
        const response = await fetch(
          `${API_BASE_URL}/${endpoint}/${movie.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify(updatedMovie),
          },
        );

        if (response.ok) {
          updatedCount++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise((resolve) =>
          setTimeout(resolve, 100),
        );
      } catch (error) {
        console.error(
          `Error updating movie ${movie.id}:`,
          error,
        );
      }
    }

    console.log(
      `✅ Migration complete! Updated ${updatedCount} movies.`,
    );
    console.log("🔄 Reloading movies from database...");

    // Reload data from backend
    await loadMovies();
    await loadToWatchMovies();

    alert(
      `Migration complete!\nUpdated ${updatedCount} movies with dateAdded timestamps.`,
    );
    console.log(
      '✨ Done! The "Recently Added" carousel should now work correctly.',
    );
  };

  const handleLoadAllTrailers = async () => {
    if (
      !confirm(
        "This will automatically search and add trailers from YouTube for all movies that don't have trailers. No API limits! This may take a few minutes. Continue?",
      )
    ) {
      return;
    }

    setIsLoadingTrailers(true);
    setTrailerLoadProgress("Starting trailer fetch...");

    try {
      // Calculate how many movies need trailers
      const moviesWithoutTrailers = movies.filter(
        (m) => !m.trailer || m.trailer.trim() === "",
      );
      const totalToProcess = moviesWithoutTrailers.length;

      console.log("🎬 Trailer Loading Debug:");
      console.log("Total movies:", movies.length);
      console.log("Movies without trailers:", totalToProcess);
      console.log(
        "Sample movies:",
        movies.slice(0, 3).map((m) => ({
          title: m.title,
          hasTrailer: !!m.trailer,
          trailerValue: m.trailer,
        })),
      );

      if (totalToProcess === 0) {
        alert("All movies already have trailers!");
        setIsLoadingTrailers(false);
        setTrailerLoadProgress("");
        return;
      }

      let processedSoFar = 0;
      let updatedTotal = 0;

      // Process in batches of 10 to avoid timeout
      while (processedSoFar < totalToProcess) {
        const remaining = totalToProcess - processedSoFar;
        const batchSize = Math.min(10, remaining);

        setTrailerLoadProgress(
          `Processing ${processedSoFar + 1}-${processedSoFar + batchSize} of ${totalToProcess} movies...`,
        );

        const response = await fetch(
          `${API_BASE_URL}/movies/fetch-all-trailers?limit=${batchSize}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}`,
          );
        }

        const data = await response.json();

        if (data.success) {
          console.log("Batch completed:", data.summary);
          console.log(
            "Results sample:",
            data.results?.slice(0, 3),
          );
          updatedTotal += data.summary.updated;
          processedSoFar += data.summary.processed;

          // If there are no more movies to process, break
          if (data.summary.remaining === 0) {
            break;
          }
        } else {
          console.error("Error fetching trailers:", data.error);
          alert(`Error: ${data.error}`);
          break;
        }

        // Small delay between batches
        await new Promise((resolve) =>
          setTimeout(resolve, 500),
        );
      }

      setTrailerLoadProgress("Reloading movies...");
      await loadMovies();

      setTrailerLoadProgress("");
      alert(
        `Trailer loading complete!\\n\\nSuccessfully added trailers to ${updatedTotal} movies.`,
      );
    } catch (error) {
      console.error("Error loading trailers:", error);
      alert(`Error loading trailers: ${error}`);
      setTrailerLoadProgress("");
    } finally {
      setIsLoadingTrailers(false);
    }
  };

  const handleForceReloadAllTrailers = async () => {
    if (
      !confirm(
        "⚠️ WARNING: This will RE-FETCH trailers for ALL " +
          movies.length +
          " movies, even those that already have trailers. This may take several minutes. Continue?",
      )
    ) {
      return;
    }

    setIsLoadingTrailers(true);
    setTrailerLoadProgress("Force reloading ALL trailers...");

    try {
      let processedSoFar = 0;
      let updatedTotal = 0;
      const totalToProcess = movies.length;

      // Process in batches of 10
      while (processedSoFar < totalToProcess) {
        const remaining = totalToProcess - processedSoFar;
        const batchSize = Math.min(10, remaining);

        setTrailerLoadProgress(
          `Force reloading ${processedSoFar + 1}-${processedSoFar + batchSize} of ${totalToProcess} movies...`,
        );

        const response = await fetch(
          `${API_BASE_URL}/movies/fetch-all-trailers?limit=${batchSize}&force=true`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}`,
          );
        }

        const data = await response.json();

        if (data.success) {
          console.log("Batch completed:", data.summary);
          console.log(
            "Results sample:",
            data.results?.slice(0, 3),
          );
          updatedTotal += data.summary.updated;
          processedSoFar += data.summary.processed;

          // If there are no more movies to process, break
          if (data.summary.remaining === 0) {
            break;
          }
        } else {
          console.error("Error fetching trailers:", data.error);
          alert(`Error: ${data.error}`);
          break;
        }

        // Small delay between batches
        await new Promise((resolve) =>
          setTimeout(resolve, 500),
        );
      }

      setTrailerLoadProgress("Reloading movies...");
      await loadMovies();

      setTrailerLoadProgress("");
      alert(
        `Force reload complete!\\n\\nSuccessfully reloaded trailers for ${updatedTotal} movies.`,
      );
    } catch (error) {
      console.error("Error force reloading trailers:", error);
      alert(`Error force reloading trailers: ${error}`);
      setTrailerLoadProgress("");
    } finally {
      setIsLoadingTrailers(false);
    }
  };

  const handleAddMovie = async (newMovie: Movie) => {
    const targetList =
      currentView === "towatch" ? toWatchMovies : movies;
    const updatedMovies = [newMovie, ...targetList];

    if (currentView === "towatch") {
      try {
        const response = await fetch(
          `${API_BASE_URL}/towatch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify(newMovie),
          },
        );

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}`,
          );
        }

        const data = await response.json();
        if (data.success) {
          setToWatchMovies(updatedMovies);
          localStorage.setItem(
            "toWatchMovies",
            JSON.stringify(updatedMovies),
          );
        } else {
          console.error(
            "Error adding to watch movie to backend:",
            data.error,
          );
          setToWatchMovies(updatedMovies);
          localStorage.setItem(
            "toWatchMovies",
            JSON.stringify(updatedMovies),
          );
        }
      } catch (error) {
        console.error(
          "Error saving to watch movie to backend, saving to localStorage only:",
          error,
        );
        setToWatchMovies(updatedMovies);
        localStorage.setItem(
          "toWatchMovies",
          JSON.stringify(updatedMovies),
        );
      }
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/movies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(newMovie),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setMovies(updatedMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMovies),
        );
      } else {
        console.error(
          "Error adding movie to backend:",
          data.error,
        );
        setMovies(updatedMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMovies),
        );
      }
    } catch (error) {
      console.error(
        "Error saving movie to backend, saving to localStorage only:",
        error,
      );
      setMovies(updatedMovies);
      localStorage.setItem(
        "movies",
        JSON.stringify(updatedMovies),
      );
    }
  };

  const handleMovieClick = (movie: Movie) => {
    navigate(`/movie/${createSlug(movie.title, movie.year)}`);
  };

  const handleDeleteMovie = async (movieId: number) => {
    if (currentView === "towatch") {
      const updatedMovies = toWatchMovies.filter(
        (m) => m.id !== movieId,
      );

      try {
        const response = await fetch(
          `${API_BASE_URL}/towatch/${movieId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${publicAnonKey}`,
            },
          },
        );

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status}`,
          );
        }

        const data = await response.json();
        if (data.success) {
          setToWatchMovies(updatedMovies);
          localStorage.setItem(
            "toWatchMovies",
            JSON.stringify(updatedMovies),
          );
        } else {
          console.error(
            "Error deleting to watch movie from backend:",
            data.error,
          );
          setToWatchMovies(updatedMovies);
          localStorage.setItem(
            "toWatchMovies",
            JSON.stringify(updatedMovies),
          );
        }
      } catch (error) {
        console.error(
          "Error deleting to watch movie from backend, deleting from localStorage only:",
          error,
        );
        setToWatchMovies(updatedMovies);
        localStorage.setItem(
          "toWatchMovies",
          JSON.stringify(updatedMovies),
        );
      }
      return;
    }

    const updatedMovies = movies.filter(
      (m) => m.id !== movieId,
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/movies/${movieId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setMovies(updatedMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMovies),
        );
      } else {
        console.error(
          "Error deleting movie from backend:",
          data.error,
        );
        setMovies(updatedMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMovies),
        );
      }
    } catch (error) {
      console.error(
        "Error deleting movie from backend, deleting from localStorage only:",
        error,
      );
      setMovies(updatedMovies);
      localStorage.setItem(
        "movies",
        JSON.stringify(updatedMovies),
      );
    }
  };

  const handleUpdatePoster = async (
    movieId: number,
    newImageUrl: string,
  ) => {
    const updatedMovies = movies.map((m) =>
      m.id === movieId ? { ...m, image: newImageUrl } : m,
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/movies/${movieId}/poster`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ image: newImageUrl }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setMovies(updatedMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMovies),
        );
      } else {
        console.error(
          "Error updating poster in backend:",
          data.error,
        );
        setMovies(updatedMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMovies),
        );
      }
    } catch (error) {
      console.error(
        "Error updating poster in backend, updating localStorage only:",
        error,
      );
      setMovies(updatedMovies);
      localStorage.setItem(
        "movies",
        JSON.stringify(updatedMovies),
      );
    }
  };

  const handleUpdateRating = async (
    movieId: number,
    rating: number,
  ) => {
    const targetList =
      currentView === "towatch" ? toWatchMovies : movies;
    const setTargetList =
      currentView === "towatch" ? setToWatchMovies : setMovies;
    const storageKey =
      currentView === "towatch" ? "toWatchMovies" : "movies";

    const updatedMovies = targetList.map((m) =>
      m.id === movieId ? { ...m, userRating: rating } : m,
    );

    setTargetList(updatedMovies);
    localStorage.setItem(
      storageKey,
      JSON.stringify(updatedMovies),
    );

    // Submit rating to backend
    try {
      let userIdentifier = "";
      if (currentUser) {
        userIdentifier = currentUser.id;
      } else {
        userIdentifier = getAnonymousUserId();
      }

      const response = await fetch(`${API_BASE_URL}/ratings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          movieId,
          rating,
          userIdentifier,
        }),
      });

      if (response.ok) {
        console.log("Rating submitted successfully");
      }
    } catch (error) {
      console.error(
        "Error submitting rating to backend:",
        error,
      );
    }
    // Record in activity feed so it appears on the user's profile
    if (currentUser?.username) {
      const ratedMovie = targetList.find(m => m.id === movieId);
      recordActivity(currentUser.username, {
        type: 'rating',
        movieId,
        movieTitle: ratedMovie?.title,
        movieImage: (ratedMovie as any)?.image,
        rating,
      }).catch(() => {});
    }
  };

  const handleUpdateTags = async (
    movieId: number,
    tags: string[],
  ) => {
    const targetList =
      currentView === "towatch" ? toWatchMovies : movies;
    const setTargetList =
      currentView === "towatch" ? setToWatchMovies : setMovies;
    const storageKey =
      currentView === "towatch" ? "toWatchMovies" : "movies";

    const updatedMovies = targetList.map((m) =>
      m.id === movieId ? { ...m, tags } : m,
    );

    setTargetList(updatedMovies);
    localStorage.setItem(
      storageKey,
      JSON.stringify(updatedMovies),
    );
  };

  const handleUpdateRuntime = async (
    movieId: number,
    runtime: string,
  ) => {
    const targetList =
      currentView === "towatch" ? toWatchMovies : movies;
    const setTargetList =
      currentView === "towatch" ? setToWatchMovies : setMovies;
    const storageKey =
      currentView === "towatch" ? "toWatchMovies" : "movies";

    const updatedMovies = targetList.map((m) =>
      m.id === movieId ? { ...m, runtime } : m,
    );

    setTargetList(updatedMovies);
    localStorage.setItem(
      storageKey,
      JSON.stringify(updatedMovies),
    );

    // Update backend
    try {
      const endpoint =
        currentView === "towatch" ? "towatch" : "movies";
      const response = await fetch(
        `${API_BASE_URL}/${endpoint}/${movieId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ runtime }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (!data.success) {
        console.error(
          "Error updating runtime in backend:",
          data.error,
        );
      }
    } catch (error) {
      console.error(
        "Error updating runtime in backend:",
        error,
      );
    }
  };

  const handleMarkAsWatched = async (movie: Movie) => {
    const maxId =
      movies.length > 0
        ? Math.max(...movies.map((m) => m.id))
        : 0;
    const movieWithNewId = {
      ...movie,
      id: maxId + 1,
      dateAdded: Date.now(),
    };

    const updatedMainMovies = [movieWithNewId, ...movies];
    const updatedToWatchMovies = toWatchMovies.filter(
      (m) => m.id !== movie.id,
    );

    try {
      const addResponse = await fetch(
        `${API_BASE_URL}/movies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(movieWithNewId),
        },
      );

      if (!addResponse.ok) {
        throw new Error(
          `HTTP error adding to main list! status: ${addResponse.status}`,
        );
      }

      const deleteResponse = await fetch(
        `${API_BASE_URL}/towatch/${movie.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!deleteResponse.ok) {
        throw new Error(
          `HTTP error removing from to watch! status: ${deleteResponse.status}`,
        );
      }

      const addData = await addResponse.json();
      const deleteData = await deleteResponse.json();

      if (addData.success && deleteData.success) {
        setMovies(updatedMainMovies);
        setToWatchMovies(updatedToWatchMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMainMovies),
        );
        localStorage.setItem(
          "toWatchMovies",
          JSON.stringify(updatedToWatchMovies),
        );
        // Navigate back to home after marking as watched
        navigate("/");
      } else {
        console.error(
          "Error marking movie as watched:",
          addData.error || deleteData.error,
        );
        setMovies(updatedMainMovies);
        setToWatchMovies(updatedToWatchMovies);
        localStorage.setItem(
          "movies",
          JSON.stringify(updatedMainMovies),
        );
        localStorage.setItem(
          "toWatchMovies",
          JSON.stringify(updatedToWatchMovies),
        );
        navigate("/");
      }
    } catch (error) {
      console.error(
        "Error marking movie as watched in backend, updating localStorage only:",
        error,
      );
      setMovies(updatedMainMovies);
      setToWatchMovies(updatedToWatchMovies);
      localStorage.setItem(
        "movies",
        JSON.stringify(updatedMainMovies),
      );
      localStorage.setItem(
        "toWatchMovies",
        JSON.stringify(updatedToWatchMovies),
      );
      navigate("/");
    }
  };

  const handleTryMyLuck = () => {
    const currentMovieList =
      currentView === "towatch" ? toWatchMovies : movies;

    if (currentMovieList.length === 0) {
      return;
    }

    const randomIndex = Math.floor(
      Math.random() * currentMovieList.length,
    );
    const randomMovie = currentMovieList[randomIndex];

    navigate(
      `/movie/${createSlug(randomMovie.title, randomMovie.year)}`,
    );
  };

  const handleAddComment = async (
    movieId: number,
    text: string,
  ) => {
    const { text: commentText, username, parentId, imageUrl } = JSON.parse(text);

    const newComment: Comment = {
      id: Date.now().toString(),
      movieId,
      text: commentText,
      username,
      timestamp: Date.now(),
      userId: currentUser ? `user_${currentUser.username}` : `anon_${Date.now()}`,
      profilePicture: currentUser?.profilePicture || '',
      ...(parentId ? { parentId } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    };

    const updatedComments = [...comments, newComment];

    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(newComment),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setComments(updatedComments);
        localStorage.setItem(
          "comments",
          JSON.stringify(updatedComments),
        );
      } else {
        console.error(
          "Error adding comment to backend:",
          data.error,
        );
        setComments(updatedComments);
        localStorage.setItem(
          "comments",
          JSON.stringify(updatedComments),
        );
      }
    } catch (error) {
      console.error(
        "Error saving comment to backend, saving to localStorage only:",
        error,
      );
      setComments(updatedComments);
      localStorage.setItem(
        "comments",
        JSON.stringify(updatedComments),
      );
    }
    // Record in activity feed so it appears on the user's profile
    if (username) {
      const commentedMovie = movies.find(m => m.id === movieId) || toWatchMovies.find(m => m.id === movieId);
      recordActivity(username, {
        type: 'comment',
        movieId,
        movieTitle: (commentedMovie as any)?.title,
        movieImage: (commentedMovie as any)?.image,
        comment: commentText.slice(0, 200),
      }).catch(() => {});
    }
  };

  const handleDeleteComment = async (
    movieId: number,
    commentId: string,
  ) => {
    const updatedComments = comments.filter(
      (c) => String(c.id) !== String(commentId),
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/comments/${movieId}/${commentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `HTTP error! status: ${response.status}`,
        );
      }

      const data = await response.json();
      if (data.success) {
        setComments(updatedComments);
        localStorage.setItem(
          "comments",
          JSON.stringify(updatedComments),
        );
      } else {
        console.error(
          "Error deleting comment from backend:",
          data.error,
        );
        setComments(updatedComments);
        localStorage.setItem(
          "comments",
          JSON.stringify(updatedComments),
        );
      }
    } catch (error) {
      console.error(
        "Error deleting comment from backend, deleting from localStorage only:",
        error,
      );
      setComments(updatedComments);
      localStorage.setItem(
        "comments",
        JSON.stringify(updatedComments),
      );
    }
  };

  // Get all unique tags from movies (memoized)
  const allTags = useMemo(
    () =>
      Array.from(
        new Set(
          (currentView === "towatch"
            ? toWatchMovies
            : movies
          ).flatMap((m) => m.tags || []),
        ),
      ),
    [currentView, toWatchMovies, movies],
  );

  // Get all unique years from movies (memoized)
  const availableYears = useMemo(() => {
    const years = new Set(
      (currentView === "towatch" ? toWatchMovies : movies).map(
        (m) => m.year,
      ),
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [currentView, toWatchMovies, movies]);

  // Helper function to parse runtime string to minutes
  const parseRuntime = (runtime?: string): number => {
    if (!runtime) return 0;
    const match = runtime.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  // Advanced filtering (memoized)
  const filteredMovies = useMemo(
    () =>
      (currentView === "towatch"
        ? toWatchMovies
        : movies
      ).filter((movie) => {
        // Split movie genres by comma and trim whitespace
        const movieGenres = movie.genre
          ? movie.genre.split(",").map((g) => g.trim())
          : [];
        const genreMatch =
          selectedGenres.length === 0 ||
          selectedGenres.some((genre) =>
            movieGenres.includes(genre),
          );

        const yearMatch =
          selectedYears.length === 0 ||
          selectedYears.includes(movie.year);
        const searchMatch =
          searchQuery === "" ||
          movie.title
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          movie.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

        // IMDb rating filter
        const movieRating = movie.imdbRating || movie.rating;
        const ratingMatch =
          movieRating >= imdbRatingRange[0] &&
          movieRating <= imdbRatingRange[1];

        // Runtime filter
        let runtimeMatch = true;
        if (runtimeFilter !== "all") {
          const runtimeMinutes = parseRuntime(movie.runtime);
          const isSeason =
            movie.runtime &&
            movie.runtime.toLowerCase().includes("season");

          if (runtimeFilter === "short") {
            runtimeMatch =
              !isSeason &&
              runtimeMinutes > 0 &&
              runtimeMinutes <= 90;
          } else if (runtimeFilter === "medium") {
            runtimeMatch =
              !isSeason &&
              runtimeMinutes > 90 &&
              runtimeMinutes <= 150;
          } else if (runtimeFilter === "long") {
            runtimeMatch = !isSeason && runtimeMinutes > 150;
          } else if (runtimeFilter === "oneSeason") {
            runtimeMatch =
              isSeason &&
              (movie.runtime.includes("1 Season") ||
                movie.runtime === "1 Seasons");
          } else if (runtimeFilter === "multiSeason") {
            const seasonMatch =
              movie.runtime?.match(/(\d+)\s+Season/);
            runtimeMatch =
              isSeason &&
              seasonMatch &&
              parseInt(seasonMatch[1]) > 1;
          }
        }

        // Tag filter
        const tagMatch =
          selectedTags.length === 0 ||
          (movie.tags &&
            selectedTags.some((tag) =>
              movie.tags?.includes(tag),
            ));

        return (
          genreMatch &&
          yearMatch &&
          searchMatch &&
          ratingMatch &&
          runtimeMatch &&
          tagMatch
        );
      }),
    [
      currentView,
      toWatchMovies,
      movies,
      selectedGenres,
      selectedYears,
      searchQuery,
      imdbRatingRange,
      runtimeFilter,
      selectedTags,
    ],
  );

  // Sorting logic (memoized)
  const sortedMovies = useMemo(
    () =>
      [...filteredMovies].sort((a, b) => {
        switch (sortBy) {
          case "dateAdded":
            return b.id - a.id; // Newest first
          case "dateAddedLatest":
            return a.id - b.id; // Latest (oldest) first
          case "title":
            return a.title.localeCompare(b.title);
          case "titleDesc":
            return b.title.localeCompare(a.title);
          case "year":
            return b.year - a.year;
          case "imdbRating":
            return (
              (b.imdbRating || b.rating) -
              (a.imdbRating || a.rating)
            );
          case "userRating":
            return (b.userRating || 0) - (a.userRating || 0);
          case "communityRating":
            return (
              (b.communityRating || 0) -
              (a.communityRating || 0)
            );
          default:
            return 0;
        }
      }),
    [filteredMovies, sortBy],
  );

  const displayMovies = sortedMovies;

  // Pagination calculations
  const totalPagesMobile = Math.ceil(
    displayMovies.length / MOVIES_PER_PAGE_MOBILE,
  );
  const totalPagesDesktop = Math.ceil(
    displayMovies.length / MOVIES_PER_PAGE_DESKTOP,
  );
  const startIndexMobile =
    (currentPage - 1) * MOVIES_PER_PAGE_MOBILE;
  const endIndexMobile =
    startIndexMobile + MOVIES_PER_PAGE_MOBILE;
  const paginatedMoviesForMobile = displayMovies.slice(
    startIndexMobile,
    endIndexMobile,
  );
  const startIndexDesktop =
    (currentPage - 1) * MOVIES_PER_PAGE_DESKTOP;
  const endIndexDesktop =
    startIndexDesktop + MOVIES_PER_PAGE_DESKTOP;
  const paginatedMoviesForDesktop = displayMovies.slice(
    startIndexDesktop,
    endIndexDesktop,
  );

  // Get the 12 most recently added movies (by dateAdded timestamp) (memoized)
  const recentMovies = useMemo(
    () => [...movies].sort((a, b) => b.id - a.id).slice(0, 12),
    [movies],
  );

  return (
    <div
      className={`min-h-screen flex flex-col bg-[#fdfaf8] dark:bg-[#0b0704] ${isDarkMode ? "dark" : ""}`}
    >
      {/* Show loading screen while initial data is loading */}
      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-[#0b0704]">
          <div className="flex flex-col items-center gap-4">
            {/* Spinning Logo */}
            <div className="w-16 h-16 animate-spin">
              <img
                src={logoImage}
                alt="Trash Bin Logo"
                className="w-full h-full"
              />
            </div>
            {/* Loading Text */}
            <div className="text-lg font-medium text-black dark:text-[#f7f1ed]">
              Bear with us...
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* XP Desktop overlay */}
          {isXPMode && (
            <XPDesktop
              movies={movies}
              toWatchMovies={toWatchMovies}
              onExit={() => setIsXPMode(false)}
              onAddMovie={handleAddMovie}
              onMarkWatched={handleMarkAsWatched}
              onUpdateRating={handleUpdateRating}
              comments={comments}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
            />
          )}

          {/* Floating Live Chat - shown when not in XP mode */}
          {!isXPMode && <FloatingChat currentUser={currentUser} isDarkMode={isDarkMode} />}

          {/* Login Modal */}
          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            isDarkMode={isDarkMode}
            setCurrentUser={setCurrentUser}
          />


          {/* Tired of Scrolling Modal */}
          <TiredOfScrollingModal
            isOpen={isTiredModalOpen}
            onClose={() => setIsTiredModalOpen(false)}
            onRandomMovie={handleTryMyLuck}
            isDarkMode={isDarkMode}
          />

          {/* All Comments Modal */}
          {showAllComments && (
            <AllCommentsModal
              comments={comments}
              movies={[...movies, ...toWatchMovies]}
              onCommentClick={handleMovieClick}
              onClose={() => setShowAllComments(false)}
              isDarkMode={isDarkMode}
            />
          )}

          <SiteHeader
            currentUser={currentUser}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            movies={[...movies, ...toWatchMovies]}
            onLogoClick={() => { setCurrentView("main"); setCurrentPage(1); setSearchQuery(""); }}
            onLoginRequest={() => setIsLoginModalOpen(true)}
            onXPMode={() => setIsXPMode(true)}
          />

          {/* Main Content Area - Desktop: Filters + Carousel + Grid */}
          <div className="flex flex-col md:flex-row flex-1 p-0 md:px-6 md:pt-6 md:pb-6 gap-0 md:gap-6 md:items-stretch">
            {/* Desktop Filters - Full Height */}
            <div
              className={`hidden md:block flex-shrink-0 self-stretch transition-all duration-300 ${isSidebarExpanded ? "w-[211px]" : "w-12"}`}
            >
              <FilterSidebar
                selectedGenres={selectedGenres}
                selectedYears={selectedYears}
                onGenreChange={handleGenreChange}
                onClearGenres={handleClearGenres}
                onYearChange={handleYearChange}
                onClearYears={handleClearYears}
                onTryMyLuck={handleTryMyLuck}
                comments={comments}
                movies={
                  currentView === "towatch"
                    ? toWatchMovies
                    : movies
                }
                allMovies={[...movies, ...toWatchMovies]}
                onCommentClick={handleMovieClick}
                onViewAllComments={() =>
                  setShowAllComments(true)
                }
                imdbRatingRange={imdbRatingRange}
                onImdbRatingChange={setImdbRatingRange}
                runtimeFilter={runtimeFilter}
                onRuntimeChange={setRuntimeFilter}
                selectedTags={selectedTags}
                onTagChange={handleTagChange}
                allTags={allTags}
                availableYears={availableYears}
                isExpanded={isSidebarExpanded}
                onToggle={() =>
                  setIsSidebarExpanded(!isSidebarExpanded)
                }
              />
            </div>

            {/* Right Side: Carousel + Movie Grid */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
              {/* Carousel Section - Desktop Only */}
              <div className="hidden md:block bg-white dark:bg-[#18110c] rounded-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] p-4">
                <RecentMoviesCarousel
                  movies={recentMovies}
                  onMovieClick={handleMovieClick}
                  isDarkMode={isDarkMode}
                />
              </div>

              {/* Movie Grid */}
              <div className="flex-1">
                {/* Mobile Filter Overlay */}
                {isMobileFilterOpen && (
                  <div className="fixed inset-0 z-50 md:hidden">
                    {/* Backdrop */}
                    <div
                      className="absolute inset-0 bg-black/50"
                      onClick={() =>
                        setIsMobileFilterOpen(false)
                      }
                    />
                    {/* Sidebar */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] shadow-xl overflow-y-auto ${isDarkMode ? "bg-gray-800" : "bg-background"}`}
                    >
                      <div
                        className={`p-4 border-b flex items-center justify-between ${isDarkMode ? "border-gray-700" : ""}`}
                      >
                        <h2
                          className={`text-sm font-bold tracking-tight ${isDarkMode ? "text-white" : ""}`}
                        >
                          Filters
                        </h2>
                        <button
                          onClick={() =>
                            setIsMobileFilterOpen(false)
                          }
                          className={`hover:opacity-70 transition-opacity ${isDarkMode ? "text-white" : ""}`}
                          aria-label="Close filters"
                        >
                          <X className="size-5" />
                        </button>
                      </div>
                      <div className="p-4">
                        <FilterSidebar
                          selectedGenres={selectedGenres}
                          selectedYears={selectedYears}
                          onGenreChange={handleGenreChange}
                          onClearGenres={handleClearGenres}
                          onYearChange={handleYearChange}
                          onTryMyLuck={handleTryMyLuck}
                          comments={comments}
                          movies={
                            currentView === "towatch"
                              ? toWatchMovies
                              : movies
                          }
                          allMovies={[...movies, ...toWatchMovies]}
                          onCommentClick={handleMovieClick}
                          onViewAllComments={() =>
                            setShowAllComments(true)
                          }
                          imdbRatingRange={imdbRatingRange}
                          onImdbRatingChange={
                            setImdbRatingRange
                          }
                          runtimeFilter={runtimeFilter}
                          onRuntimeChange={setRuntimeFilter}
                          selectedTags={selectedTags}
                          onTagChange={handleTagChange}
                          allTags={allTags}
                          availableYears={availableYears}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Carousel - separate card, no gap to main */}
                <div className="md:hidden bg-white dark:bg-[#120d09] rounded-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] p-3 mb-0">
                  <RecentMoviesCarousel
                    movies={recentMovies}
                    onMovieClick={handleMovieClick}
                    isDarkMode={isDarkMode}
                  />
                </div>

                {/* Main Content */}
                <main
                  className={`p-4 md:p-5 pb-4 md:pb-5 bg-white dark:bg-[#120d09] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] ${isDarkMode ? "text-white" : ""}`}
                >
                  {/* Sort Dropdown for Mobile */}
                  <div className="mb-4 md:hidden flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]" />
                      <Input
                        type="text"
                        placeholder="Search movies..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="h-10 pl-10 pr-10 rounded-lg text-sm border bg-[#fdfaf8] text-black placeholder-[rgba(16,11,9,0.6)] border-[#eea77a] dark:bg-[#18110c] dark:text-[rgba(247,241,237,0.6)] dark:border-[#7e3e15] dark:placeholder-[rgba(247,241,237,0.6)]"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setCurrentPage(1);
                          }}
                          className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${isDarkMode ? "text-gray-400 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
                          aria-label="Clear search"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    <SortDropdown
                      value={sortBy}
                      onChange={setSortBy}
                    />
                  </div>

                  {/* Sort Dropdown for Desktop */}
                  <div className="hidden md:flex mb-6 items-center justify-between">
                    <div className="flex items-center gap-3">
                      <SortDropdown
                        value={sortBy}
                        onChange={setSortBy}
                      />
                      <p className="text-sm leading-normal dark:text-[#c36a32] font-bold text-[#db8652]">
                        Showing {displayMovies.length}{" "}
                        {displayMovies.length === 1
                          ? "movie"
                          : "movies"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleViewMode}
                        title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                        className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-colors ${isDarkMode ? 'border-[#7e3e15] text-[#c36a32] hover:bg-[rgba(126,62,21,0.2)]' : 'border-[#eea77a] text-[#d07339] hover:bg-[rgba(238,167,122,0.1)]'} bg-transparent`}
                      >
                        {viewMode === 'grid' ? <List className="size-5" /> : <LayoutGrid className="size-5" />}
                      </button>
                      <AddMovieDialog
                        onAddMovie={handleAddMovie}
                        existingMovies={[
                          ...movies,
                          ...toWatchMovies,
                        ]}
                        currentViewMovies={
                          currentView === "towatch"
                            ? toWatchMovies
                            : movies
                        }
                      />
                    </div>
                  </div>

                  {/* Active Filters Display - Desktop */}
                  {(selectedGenres.length > 0 ||
                    selectedYears.length > 0 ||
                    searchQuery !== "" ||
                    selectedTags.length > 0 ||
                    imdbRatingRange[0] !== 0 ||
                    runtimeFilter !== "all") && (
                    <div className="hidden md:block mb-6">
                      <div className="flex flex-wrap gap-2">
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
                          >
                            Search: {searchQuery}
                            <X className="size-3.5" />
                          </button>
                        )}
                        {selectedGenres.map((genre) => (
                          <button
                            key={genre}
                            onClick={() =>
                              handleGenreChange(genre, false)
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-100 text-blue-800 hover:bg-blue-200"}`}
                          >
                            {genre}
                            <X className="size-3.5" />
                          </button>
                        ))}
                        {selectedYears.map((year) => (
                          <button
                            key={year}
                            onClick={() =>
                              handleYearChange(year, false)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border bg-[#eea77a] text-[#100b09] hover:bg-[rgba(238,167,122,0.3)] border-[#eea77a] dark:bg-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.5)] dark:border-[#7e3e15]"
                          >
                            {year}
                            <X className="size-3.5" />
                          </button>
                        ))}
                        {selectedTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() =>
                              handleTagChange(tag, false)
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-purple-100 text-purple-800 hover:bg-purple-200"}`}
                          >
                            {tag}
                            <X className="size-3.5" />
                          </button>
                        ))}
                        {imdbRatingRange[0] !== 0 && (
                          <button
                            onClick={() =>
                              setImdbRatingRange([0, 10])
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-yellow-600 text-white hover:bg-yellow-700" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"}`}
                          >
                            IMDb:{" "}
                            {imdbRatingRange[0].toFixed(1)} -{" "}
                            {imdbRatingRange[1].toFixed(1)}
                            <X className="size-3.5" />
                          </button>
                        )}
                        {runtimeFilter !== "all" && (
                          <button
                            onClick={() =>
                              setRuntimeFilter("all")
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-orange-100 text-orange-800 hover:bg-orange-200"}`}
                          >
                            Runtime:{" "}
                            {runtimeFilter === "short"
                              ? "≤90 min"
                              : runtimeFilter === "medium"
                                ? "90-150 min"
                                : runtimeFilter === "long"
                                  ? "≥150 min"
                                  : runtimeFilter ===
                                      "oneSeason"
                                    ? "1 Season"
                                    : "Multi-Season"}
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mobile Filter Button */}
                  <div className="mb-4 md:hidden">
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          setIsMobileFilterOpen(true)
                        }
                        size="lg"
                        className="flex-1 justify-center gap-2 text-sm border border-[#eea77a] dark:border-[#7e3e15] bg-transparent hover:bg-[rgba(238,167,122,0.1)] dark:hover:bg-[rgba(126,62,21,0.2)] text-[#d07339] dark:text-[#c36a32] transition-colors"
                      >
                        <Filter className="size-4" />
                        Filters
                        {(selectedGenres.length > 0 ||
                          selectedYears.length > 0) && (
                          <span className="ml-1 px-2 py-0.5 bg-[#d07339] dark:bg-[#c36a32] text-white text-xs rounded-full">
                            {selectedGenres.length +
                              selectedYears.length}
                          </span>
                        )}
                      </Button>

                      {/* View Toggle for Mobile */}
                      <button
                        onClick={toggleViewMode}
                        className={`flex items-center justify-center h-10 w-10 rounded-lg border-2 transition-colors ${isDarkMode ? 'border-[#7e3e15] text-[#c36a32] hover:bg-[rgba(126,62,21,0.2)]' : 'border-[#eea77a] text-[#d07339] hover:bg-[rgba(238,167,122,0.1)]'} bg-transparent flex-shrink-0`}
                      >
                        {viewMode === 'grid' ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
                      </button>

                      {/* Add Movie Button for Mobile */}
                      <AddMovieDialog
                        onAddMovie={handleAddMovie}
                        existingMovies={[
                          ...movies,
                          ...toWatchMovies,
                        ]}
                        currentViewMovies={
                          currentView === "towatch"
                            ? toWatchMovies
                            : movies
                        }
                      />

                      {/* Reset Filters Button */}
                      {(selectedGenres.length > 0 ||
                        selectedYears.length > 0 ||
                        searchQuery !== "" ||
                        selectedTags.length > 0 ||
                        imdbRatingRange[0] !== 0 ||
                        imdbRatingRange[1] !== 10 ||
                        runtimeFilter !== "all") && (
                        <Button
                          onClick={() => {
                            setSelectedGenres([]);
                            setSelectedYears([]);
                            setSearchQuery("");
                            setSelectedTags([]);
                            setImdbRatingRange([0, 10]);
                            setRuntimeFilter("all");
                            setCurrentPage(1);
                          }}
                          size="lg"
                          className={`px-4 border-2 ${isDarkMode ? "bg-black text-white border-gray-700 hover:bg-gray-900" : "bg-white text-black border-gray-300 hover:bg-gray-50"}`}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Active Filters Display - Mobile */}
                  {(selectedGenres.length > 0 ||
                    selectedYears.length > 0 ||
                    searchQuery !== "" ||
                    selectedTags.length > 0 ||
                    imdbRatingRange[0] !== 0 ||
                    runtimeFilter !== "all") && (
                    <div className="md:hidden mb-4">
                      <div className="flex flex-wrap gap-2">
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
                          >
                            Search: {searchQuery}
                            <X className="size-3" />
                          </button>
                        )}
                        {selectedGenres.map((genre) => (
                          <button
                            key={genre}
                            onClick={() =>
                              handleGenreChange(genre, false)
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-100 text-blue-800 hover:bg-blue-200"}`}
                          >
                            {genre}
                            <X className="size-3" />
                          </button>
                        ))}
                        {selectedYears.map((year) => (
                          <button
                            key={year}
                            onClick={() =>
                              handleYearChange(year, false)
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border bg-[#eea77a] text-[#100b09] hover:bg-[rgba(238,167,122,0.3)] border-[#eea77a] dark:bg-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.5)] dark:border-[#7e3e15]"
                          >
                            {year}
                            <X className="size-3" />
                          </button>
                        ))}
                        {selectedTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() =>
                              handleTagChange(tag, false)
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-purple-600 text-white hover:bg-purple-700" : "bg-purple-100 text-purple-800 hover:bg-purple-200"}`}
                          >
                            {tag}
                            <X className="size-3" />
                          </button>
                        ))}
                        {imdbRatingRange[0] !== 0 && (
                          <button
                            onClick={() =>
                              setImdbRatingRange([0, 10])
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-yellow-600 text-white hover:bg-yellow-700" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"}`}
                          >
                            IMDb:{" "}
                            {imdbRatingRange[0].toFixed(1)} -{" "}
                            {imdbRatingRange[1].toFixed(1)}
                            <X className="size-3" />
                          </button>
                        )}
                        {runtimeFilter !== "all" && (
                          <button
                            onClick={() =>
                              setRuntimeFilter("all")
                            }
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${isDarkMode ? "bg-orange-600 text-white hover:bg-orange-700" : "bg-orange-100 text-orange-800 hover:bg-orange-200"}`}
                          >
                            Runtime:{" "}
                            {runtimeFilter === "short"
                              ? "≤90 min"
                              : runtimeFilter === "medium"
                                ? "90-150 min"
                                : runtimeFilter === "long"
                                  ? "≥150 min"
                                  : runtimeFilter ===
                                      "oneSeason"
                                    ? "1 Season"
                                    : "Multi-Season"}
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {displayMovies.length > 0 ? (
                    <>
                      {/* Showing movies count for Mobile */}
                      <div className="md:hidden mb-4">
                        <p className="text-sm leading-normal font-bold text-[#DB8652] dark:text-[#c36a32]">
                          Showing {displayMovies.length}{" "}
                          {displayMovies.length === 1
                            ? "movie"
                            : "movies"}
                        </p>
                      </div>

                      {/* Movie Grid or List */}
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-3 md:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-4 max-w-[2400px]">
                          <div className="contents md:hidden">
                            {paginatedMoviesForMobile.map((movie) => (
                              <MovieCard key={movie.id} movie={movie} onClick={() => handleMovieClick(movie)} onDelete={canModerate ? handleDeleteMovie : undefined} />
                            ))}
                          </div>
                          <div className="contents hidden md:contents">
                            {paginatedMoviesForDesktop.map((movie) => (
                              <MovieCard key={movie.id} movie={movie} onClick={() => handleMovieClick(movie)} onDelete={canModerate ? handleDeleteMovie : undefined} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 max-w-[2400px]">
                          {/* Mobile list */}
                          <div className="md:hidden flex flex-col gap-3">
                            {paginatedMoviesForMobile.map((movie) => (
                              <MovieListRow key={movie.id} movie={movie} isDarkMode={isDarkMode} onClick={() => navigate(`/movie/${createSlug(movie.title, movie.year)}`)} />
                            ))}
                          </div>
                          {/* Desktop list */}
                          <div className="hidden md:flex flex-col gap-3">
                            {paginatedMoviesForDesktop.map((movie) => (
                              <MovieListRow key={movie.id} movie={movie} isDarkMode={isDarkMode} onClick={() => navigate(`/movie/${createSlug(movie.title, movie.year)}`)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mobile Pagination Controls */}
                      {totalPagesMobile > 1 && (
                        <div className="md:hidden mt-6 mb-0">
                          <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPagesMobile}
                            onPageChange={setCurrentPage}
                            variant="mobile"
                          />
                        </div>
                      )}

                      {/* Desktop Pagination Controls */}
                      {totalPagesDesktop > 1 && (
                        <div className="hidden md:block mt-8 mb-0">
                          <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPagesDesktop}
                            onPageChange={setCurrentPage}
                            variant="desktop"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <Search
                        className={`size-16 mx-auto mb-4 ${isDarkMode ? "text-gray-600" : "text-gray-300"}`}
                      />
                      <h3
                        className={`text-lg font-medium mb-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}
                      >
                        No movies found
                      </h3>
                      <p
                        className={
                          isDarkMode
                            ? "text-gray-400"
                            : "text-gray-600"
                        }
                      >
                        Try adjusting your filters to see more
                        results
                      </p>
                    </div>
                  )}
                </main>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer
            className="border-t bg-white dark:bg-[#120d09] rounded-t-[10px]"
            style={{
              borderTopWidth: "1px",
              borderTopColor: isDarkMode
                ? "rgba(126,62,21,0.4)"
                : "rgba(208,115,57,0.25)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 md:px-8 h-16"
            >
              {/* Logo — hidden on mobile */}
              <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                <img src={logoImage} alt="Trash Bin Logo" className="size-6" />
                <h1 className="text-sm font-bold tracking-tight text-black dark:text-[#f7f1ed]">Trash Bin</h1>
              </div>

              {/* Links — spread evenly across full footer */}
              <div className="flex flex-1 items-center justify-evenly">
                <button
                  onClick={() => { window.location.href = `mailto:wannabenargail@gmail.com?subject=${encodeURIComponent("Contact Trash Bin")}&body=${encodeURIComponent("Enter your message here...")}`; }}
                  className="text-sm font-medium cursor-pointer transition-colors text-[rgba(16,11,9,0.6)] hover:text-[#d07339] dark:text-[rgba(247,241,237,0.6)] dark:hover:text-[#c36a32]"
                >
                  Contact
                </button>
                <Link to="/privacy" className="text-sm font-medium cursor-pointer transition-colors text-[rgba(16,11,9,0.6)] hover:text-[#d07339] dark:text-[rgba(247,241,237,0.6)] dark:hover:text-[#c36a32]">
                  Privacy
                </Link>
                <Link to="/terms" className="text-sm font-medium cursor-pointer transition-colors text-[rgba(16,11,9,0.6)] hover:text-[#d07339] dark:text-[rgba(247,241,237,0.6)] dark:hover:text-[#c36a32]">
                  Terms
                </Link>
              </div>

              {/* Copyright */}
              <span className="text-sm font-medium text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] flex-shrink-0">
                © {new Date().getFullYear()} All rights reserved
              </span>
            </div>
          </footer>

          {/* Chat Assistant */}
          <ChatAssistant
            movies={
              currentView === "towatch" ? toWatchMovies : movies
            }
            isDarkMode={isDarkMode}
          />
        </>
      )}
    </div>
  );
}