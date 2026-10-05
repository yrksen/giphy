import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Star } from 'lucide-react';
import { DarkModeToggle } from './DarkModeToggle';
import { TicketGenerator } from './TicketGenerator';
import { Input } from './ui/input';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { NotificationBell } from './Notifications';

const logoImage = 'https://i.imgur.com/vUiVqow.png?direct';

const muted = 'text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]';
const hov = 'hover:text-[#d07339] dark:hover:text-[#c36a32]';
const navBtn = `text-sm font-medium cursor-pointer transition-colors tracking-tight whitespace-nowrap ${muted} ${hov}`;

interface Movie {
  id: number; title: string; year: number; genre?: string;
  imdbRating?: number; rating?: number; image?: string; runtime?: string;
}

interface SiteHeaderProps {
  currentUser: any;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  onLogoClick?: () => void;
  onLoginRequest?: () => void;
  onXPMode?: () => void;
  movies?: Movie[];
}

export function SiteHeader({ currentUser, isDarkMode, setIsDarkMode, onLogoClick, onLoginRequest, onXPMode, movies = [] }: SiteHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const onProfilePage = location.pathname.startsWith('/users/');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchResults = searchQuery.trim().length > 0
    ? movies.filter(m =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(m.year).includes(searchQuery)
      ).slice(0, 8)
    : [];

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 bg-white dark:bg-[#120d09] border-b rounded-b-[10px] backdrop-blur-sm"
      style={{
        height: 64,
        borderBottomColor: isDarkMode ? 'rgba(126,62,21,0.4)' : 'rgba(208,115,57,0.25)',
        borderBottomWidth: 1,
      }}
    >
      <div className="flex items-center justify-between gap-4 px-6 h-full">
        {/* Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity flex-shrink-0"
          onClick={onLogoClick ?? (() => navigate('/'))}
        >
          <img src={logoImage} alt="Trash Bin" className="size-6" />
          <span className="hidden sm:block text-sm font-bold tracking-tight text-black dark:text-[#f7f1ed]">
            Trash Bin
          </span>
        </div>

        {/* Center - Search */}
        <div
          className="absolute hidden md:flex items-center gap-4"
          style={{ left: 'calc(100vw / 8)', width: 'auto' }}
        >
          <div ref={searchRef} className="relative" style={{ width: '520px', maxWidth: 'calc(100vw / 8 * 3)' }}>
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 size-4 ${muted}`} />
            <Input
              type="text"
              placeholder="Search movies..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(e.target.value.length > 0);
              }}
              onFocus={() => setShowDropdown(searchQuery.length > 0)}
              onKeyDown={handleSearchKeyDown}
              className={`h-10 pl-10 pr-10 border rounded-lg bg-[#fdfaf8] text-[#100b09] placeholder-[rgba(16,11,9,0.6)] border-[#eea77a] focus:border-[#d07339] dark:bg-[#18110c] dark:text-[rgba(247,241,237,0.6)] dark:border-[#7e3e15] dark:focus:border-[#c36a32] dark:placeholder-[rgba(247,241,237,0.6)]`}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setShowDropdown(false); }}
                className={`absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70 transition-opacity ${muted}`}
              >
                <X className="size-4" />
              </button>
            )}
            {/* Dropdown: live results if movies provided, else prompt to search */}
            {showDropdown && searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-2 border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50 bg-[#fdfaf8] border-[rgba(208,115,57,0.25)] dark:bg-[#120d09] dark:border-[rgba(126,62,21,0.4)]">
                {searchResults.length > 0 ? searchResults.map(movie => (
                  <div
                    key={movie.id}
                    onClick={() => {
                      navigate(`/movie/${movie.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${movie.year}`);
                      setShowDropdown(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-[rgba(238,167,122,0.15)] dark:hover:bg-[rgba(126,62,21,0.2)] border-b last:border-b-0 border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.3)]"
                  >
                    <ImageWithFallback src={movie.image} alt={movie.title} className="w-10 h-14 object-cover rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-[#100b09] dark:text-[#f7f1ed] text-sm">{movie.title}</div>
                      <div className={`text-xs flex items-center gap-1.5 mt-0.5 ${muted}`}>
                        {(movie.imdbRating || movie.rating) ? (
                          <span className="flex items-center gap-0.5">
                            <Star className="size-3 fill-[#f99251] text-[#f99251]" />
                            {(movie.imdbRating || movie.rating)!.toFixed(1)}
                          </span>
                        ) : null}
                        <span>{movie.year}</span>
                        {movie.genre && <span className="truncate">{movie.genre.split(',')[0]}</span>}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div
                    className={`p-3 text-sm text-center cursor-pointer ${muted} hover:bg-[rgba(238,167,122,0.08)]`}
                    onClick={() => { navigate(`/?q=${encodeURIComponent(searchQuery)}`); setShowDropdown(false); }}
                  >
                    Search for "{searchQuery}" in library →
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Random */}
          <button onClick={() => navigate('/?random=1')} className={navBtn}>
            🎲 Random
          </button>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4 md:gap-5">
          {/* Desktop: Watchlist */}
          <span className={`hidden md:block ${navBtn}`} onClick={() => navigate('/?view=towatch')}>
            Watchlist
          </span>

          {/* Mobile: Random + Watchlist */}
          <button onClick={() => navigate('/?random=1')} className={`md:hidden ${navBtn}`}>🎲</button>
          <span className={`md:hidden ${navBtn}`} onClick={() => navigate('/?view=towatch')}>Watchlist</span>

          <TicketGenerator movies={movies as any} isDark={isDarkMode} />

          <button
            onClick={() => { if (onXPMode) { onXPMode(); } else { navigate('/?xp=1'); } }}
            title="Windows XP mode"
            className={navBtn}
          >
            🖥️ XP
          </button>

          <DarkModeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />

          {currentUser && <NotificationBell currentUser={currentUser} isDarkMode={isDarkMode} />}

          {currentUser ? (
            !onProfilePage && (
              <button onClick={() => navigate(`/users/${currentUser.username}`)} className={navBtn}>
                Profile
              </button>
            )
          ) : (
            <button
              onClick={onLoginRequest ?? (() => navigate('/'))}
              className={navBtn}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

interface SiteFooterProps {
  isDarkMode: boolean;
}

export function SiteFooter({ isDarkMode }: SiteFooterProps) {
  return (
    <footer
      className="border-t bg-white dark:bg-[#120d09]"
      style={{ borderTopColor: isDarkMode ? 'rgba(126,62,21,0.4)' : 'rgba(208,115,57,0.25)' }}
    >
      <div
        className="flex items-center justify-between px-4 md:px-8 h-16"
      >
        {/* Logo — desktop only */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <img src={logoImage} alt="Trash Bin" className="size-6" />
          <span className="text-sm font-bold tracking-tight text-black dark:text-[#f7f1ed]">Trash Bin</span>
        </div>

        {/* Links — spread evenly */}
        <div className="flex flex-1 items-center justify-evenly">
          <button
            onClick={() => { window.location.href = `mailto:wannabenargail@gmail.com?subject=${encodeURIComponent('Contact Trash Bin')}&body=${encodeURIComponent('Enter your message here...')}`; }}
            className={`text-sm font-medium cursor-pointer transition-colors ${muted} ${hov}`}
          >
            Contact
          </button>
          <Link to="/privacy" className={`text-sm font-medium cursor-pointer transition-colors ${muted} ${hov}`}>Privacy</Link>
          <Link to="/terms" className={`text-sm font-medium cursor-pointer transition-colors ${muted} ${hov}`}>Terms</Link>
        </div>

        {/* Copyright */}
        <span className={`text-sm font-medium flex-shrink-0 ${muted}`}>
          © {new Date().getFullYear()} All rights reserved
        </span>
      </div>
    </footer>
  );
}
