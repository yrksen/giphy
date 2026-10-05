import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Search, X, RefreshCw, Star, Folder, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase, mapSupabaseUser } from '../utils/supabaseClient';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { RecentMoviesCarousel } from '../components/RecentMoviesCarousel';
import { Input } from '../components/ui/input';
import { createSlug } from '../utils/slugify';
import { SiteHeader, SiteFooter } from '../components/SiteLayout';
const logoImage = 'https://i.imgur.com/vUiVqow.png?direct';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

interface ProfilePageProps {
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  currentUser: any;
  setCurrentUser: (user: any) => void;
}

type ProfileSection = 'profile' | 'comments' | 'ratings' | 'logout';

export function ProfilePage({ isDarkMode, setIsDarkMode, currentUser, setCurrentUser }: ProfilePageProps) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<ProfileSection>('profile');
  const [userComments, setUserComments] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [allMovies, setAllMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [newEmail, setNewEmail] = useState(currentUser?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePicture, setProfilePicture] = useState(currentUser?.profilePicture || '');
  const [updateMessage, setUpdateMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentMovies, setRecentMovies] = useState<any[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);

  const [isUpdatingCastDirector, setIsUpdatingCastDirector] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<string>('');

  // Collections state
  const [collections, setCollections] = useState<{ id: string; name: string; movieIds: number[]; createdAt: string }[]>([]);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [addMovieDropdown, setAddMovieDropdown] = useState<{ movieId: number } | null>(null);

  useEffect(() => {
    if (!currentUser?.username) return;
    const raw = localStorage.getItem(`collections_${currentUser.username}`);
    if (raw) { try { setCollections(JSON.parse(raw)); } catch {} }
  }, [currentUser?.username]);

  const saveCollections = (updated: typeof collections) => {
    setCollections(updated);
    localStorage.setItem(`collections_${currentUser.username}`, JSON.stringify(updated));
  };

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    const col = { id: Date.now().toString(), name: newCollectionName.trim(), movieIds: [], createdAt: new Date().toISOString() };
    saveCollections([...collections, col]);
    setNewCollectionName('');
    setShowNewCollectionForm(false);
  };

  const handleAddMovieToCollection = (colId: string, movieId: number) => {
    const updated = collections.map(c => c.id === colId
      ? { ...c, movieIds: c.movieIds.includes(movieId) ? c.movieIds : [...c.movieIds, movieId] }
      : c);
    saveCollections(updated);
    setAddMovieDropdown(null);
  };

  useEffect(() => {
    if (!currentUser) navigate('/');
  }, [currentUser, navigate]);

  useEffect(() => {
    loadRecentMovies();
  }, []);

  const loadRecentMovies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/movies`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      if (data.success) {
        setAllMovies(data.movies);
        const recent = [...data.movies].sort((a, b) => b.id - a.id).slice(0, 12);
        setRecentMovies(recent);
      }
    } catch (error) {
      console.error('Error loading recent movies:', error);
    }
  };

  const handleMovieClickFromCarousel = (movie: any) => {
    navigate(`/movie/${createSlug(movie.title, movie.year)}`);
  };

  const handleTryMyLuck = () => {
    if (movies.length > 0) {
      const randomMovie = movies[Math.floor(Math.random() * movies.length)];
      navigate(`/movie/${createSlug(randomMovie.title, randomMovie.year)}`);
    }
  };

  useEffect(() => {
    if (activeSection === 'comments' && currentUser) fetchUserComments();
  }, [activeSection, currentUser]);

  useEffect(() => {
    if (activeSection === 'ratings' && currentUser) fetchUserRatings();
  }, [activeSection, currentUser]);

  const fetchUserComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      if (data.success) {
        const filtered = data.comments.filter((c: any) => c.username === currentUser.username);
        setUserComments(filtered);

        const moviesResponse = await fetch(`${API_BASE_URL}/movies`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const moviesData = await moviesResponse.json();
        if (moviesData.success) setMovies(moviesData.movies);
      }
    } catch (error) {
      console.error('Error fetching user comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRatings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/user-ratings/${currentUser.username}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();

      if (data.success) {
        const ratingsArray = Object.entries(data.userRatings).map(([movieId, rating]) => ({
          movieId,
          rating: Number(rating),
        }));
        setUserRatings(ratingsArray);

        const [moviesResponse, toWatchResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/movies`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
          fetch(`${API_BASE_URL}/towatch`, { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
        ]);

        const moviesData = await moviesResponse.json();
        const toWatchData = await toWatchResponse.json();

        setMovies([
          ...(moviesData.success ? moviesData.movies : []),
          ...(toWatchData.success ? toWatchData.movies : []),
        ]);
      }
    } catch (error) {
      console.error('Error fetching user ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMessage('');
    if (newPassword && newPassword !== confirmPassword) {
      setUpdateMessage('Passwords do not match');
      return;
    }
    updateProfileInBackend();
  };

  const updateProfileInBackend = async () => {
    try {
      // Update email if changed
      if (newEmail && newEmail !== currentUser.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) {
          setUpdateMessage(`Error updating email: ${emailError.message}`);
          return;
        }
      }

      // Update password if provided
      if (newPassword && newPassword.trim() !== '') {
        const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
        if (pwdError) {
          setUpdateMessage(`Error updating password: ${pwdError.message}`);
          return;
        }
      }

      // Update profile picture and username in user_metadata
      const { data, error: metaError } = await supabase.auth.updateUser({
        data: {
          profilePicture: profilePicture,
          username: currentUser.username,
        },
      });

      if (metaError) {
        setUpdateMessage(`Error: ${metaError.message}`);
        return;
      }

      if (data.user) {
        const updatedUser = mapSupabaseUser(data.user);
        setCurrentUser(updatedUser);
        setUpdateMessage('Profile updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setUpdateMessage('Failed to update profile. Please try again.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
      setUpdateMessage('Please upload a JPG or PNG image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUpdateMessage('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setProfilePicture(base64String);

      try {
        const { data, error: metaError } = await supabase.auth.updateUser({
          data: {
            profilePicture: base64String,
            username: currentUser.username,
          },
        });

        if (metaError) {
          setUpdateMessage(`Error: ${metaError.message}`);
          return;
        }

        if (data.user) {
          const updatedUser = mapSupabaseUser(data.user);
          setCurrentUser(updatedUser);
          setShowImageUpload(false);
          setUpdateMessage('Profile picture updated successfully!');
        }
      } catch (error) {
        console.error('Error updating profile picture:', error);
        setUpdateMessage('Failed to update profile picture. Please try again.');
      }
    };
    reader.readAsDataURL(file);
  };

  const getMovieTitle = (movieId: string) => {
    const movie = movies.find(m => m.id === parseInt(movieId));
    return movie?.title || 'Unknown Movie';
  };

  const getMovieSlug = (movieId: string) => {
    const movie = movies.find(m => m.id === parseInt(movieId));
    return movie ? createSlug(movie.title, movie.year) : null;
  };

  const handleUpdateCastDirector = async () => {
    setIsUpdatingCastDirector(true);
    setUpdateProgress('Starting update...');

    try {
      let hasMore = true;
      let totalUpdated = 0;

      while (hasMore) {
        setUpdateProgress(`Updating... (${totalUpdated} movies updated so far)`);

        const response = await fetch(`${API_BASE_URL}/movies/update-cast-director?limit=10`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (data.success) {
          totalUpdated += data.updated;
          hasMore = data.hasMore;

          if (!hasMore) {
            setUpdateProgress(`✅ Complete! Updated ${totalUpdated} movies.`);
            setTimeout(() => {
              loadRecentMovies();
              setUpdateProgress('');
              setIsUpdatingCastDirector(false);
            }, 3000);
          }
        } else {
          setUpdateProgress(`❌ Error: ${data.error}`);
          setIsUpdatingCastDirector(false);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error updating cast/director:', error);
      setUpdateProgress(`❌ Failed to update: ${error}`);
      setIsUpdatingCastDirector(false);
    }
  };

  if (!currentUser) return null;

  const inputClass = `w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d07339] bg-[#fdfaf8] border-[#eea77a] text-[#100b09] placeholder-[rgba(16,11,9,0.5)] dark:bg-[#18110c] dark:border-[#7e3e15] dark:text-[rgba(247,241,237,0.9)] dark:placeholder-[rgba(247,241,237,0.4)]`;
  const labelClass = `block mb-2 text-[11px] font-semibold uppercase tracking-wide text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]`;

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfaf8] dark:bg-[#0b0704]">
      <SiteHeader
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      {/* Main Content */}
      <div className="flex-1 px-3 md:px-6 py-4 md:py-8">
        {/* Carousel — desktop */}
        <div className="hidden md:block bg-white dark:bg-[#18110c] rounded-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] p-4 mb-6">
          <RecentMoviesCarousel movies={recentMovies} onMovieClick={handleMovieClickFromCarousel} isDarkMode={isDarkMode} />
        </div>
        {/* Carousel — mobile */}
        <div className="md:hidden bg-white dark:bg-[#120d09] rounded-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] p-3 mb-4">
          <RecentMoviesCarousel movies={recentMovies} onMovieClick={handleMovieClickFromCarousel} isDarkMode={isDarkMode} />
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <div className="rounded-[10px] p-3 md:p-4 bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)]">
              <div className="mb-4 md:mb-6 text-center">
                <button
                  onClick={() => setShowImageUpload(true)}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full mx-auto mb-2 md:mb-3 flex items-center justify-center overflow-hidden cursor-pointer transition-opacity hover:opacity-70 bg-[rgba(238,167,122,0.2)] dark:bg-[rgba(126,62,21,0.25)]"
                >
                  {profilePicture ? (
                    <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="size-8 md:size-10 text-[#d07339] dark:text-[#c36a32]" />
                  )}
                </button>
                <h2 className="text-base md:text-lg font-bold text-[#100b09] dark:text-[#f7f1ed]">
                  {currentUser.username}
                </h2>
                <p className="text-[11px] md:text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                  {currentUser.email}
                </p>
              </div>

              <nav className="grid grid-cols-2 md:grid-cols-1 gap-1">
                {(['profile', 'comments', 'ratings'] as ProfileSection[]).map((section) => (
                  <button
                    key={section}
                    onClick={() => setActiveSection(section)}
                    className={`w-full text-left px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-[11px] md:text-[13px] font-medium transition-colors ${
                      activeSection === section
                        ? 'bg-[#d07339] dark:bg-[#c36a32] text-white'
                        : 'text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)] hover:bg-[rgba(238,167,122,0.15)] dark:hover:bg-[rgba(126,62,21,0.2)]'
                    }`}
                  >
                    {section === 'profile' ? 'My Profile' : section === 'comments' ? 'My Comments' : 'My Ratings'}
                  </button>
                ))}

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-[11px] md:text-[13px] font-medium transition-colors text-red-600 dark:text-red-400 hover:bg-[rgba(238,167,122,0.15)] dark:hover:bg-[rgba(126,62,21,0.2)]"
                >
                  Log Out
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1">
            <div className="rounded-[10px] p-4 md:p-6 bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)]">
              {/* My Profile Section */}
              {activeSection === 'profile' && (
                <div>
                  <h2 className="text-[16px] font-bold mb-6 text-[#100b09] dark:text-[#f7f1ed]">Edit Profile</h2>

                  {updateMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-[13px] ${
                      updateMessage.includes('success')
                        ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {updateMessage}
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                    <div>
                      <label className={labelClass}>Profile Picture URL</label>
                      <input
                        type="url"
                        value={profilePicture}
                        onChange={(e) => setProfilePicture(e.target.value)}
                        placeholder="Enter image URL"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>New Password (optional)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className={inputClass}
                      />
                    </div>

                    {newPassword && (
                      <div>
                        <label className={labelClass}>Confirm New Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          required
                          className={inputClass}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      className="px-6 py-2.5 text-[13px] font-medium rounded-lg transition-colors bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white"
                    >
                      Update Profile
                    </button>
                  </form>

                  {updateProgress && (
                    <div className={`mt-6 p-3 rounded-lg text-[12px] max-w-md ${
                      updateProgress.includes('✅')
                        ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : updateProgress.includes('❌')
                        ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-[rgba(238,167,122,0.15)] text-[#100b09] dark:bg-[rgba(126,62,21,0.2)] dark:text-[rgba(247,241,237,0.8)]'
                    }`}>
                      {updateProgress}
                    </div>
                  )}
                </div>
              )}

              {/* My Collections Section (shown within profile tab) */}
              {activeSection === 'profile' && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-[16px] font-bold text-[#100b09] dark:text-[#f7f1ed]">My Collections</h2>
                    <button
                      onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white transition-colors"
                    >
                      <Plus className="size-3.5" />
                      New Collection
                    </button>
                  </div>

                  {showNewCollectionForm && (
                    <div className="mb-4 p-4 rounded-lg border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] bg-[rgba(238,167,122,0.05)] dark:bg-[rgba(126,62,21,0.08)] flex items-center gap-3">
                      <input
                        type="text"
                        value={newCollectionName}
                        onChange={e => setNewCollectionName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateCollection()}
                        placeholder="Collection name..."
                        className={inputClass + ' max-w-xs'}
                        autoFocus
                      />
                      <button onClick={handleCreateCollection} className="px-3 py-2 text-[12px] font-medium rounded-lg bg-[#d07339] text-white hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] transition-colors whitespace-nowrap">Save</button>
                      <button onClick={() => { setShowNewCollectionForm(false); setNewCollectionName(''); }} className="px-3 py-2 text-[12px] font-medium rounded-lg border border-[rgba(208,115,57,0.3)] text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)] hover:bg-[rgba(238,167,122,0.1)] transition-colors">Cancel</button>
                    </div>
                  )}

                  {collections.length === 0 ? (
                    <p className="text-[13px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">No collections yet. Create one to organize your movies!</p>
                  ) : (
                    <div className="space-y-3">
                      {collections.map(col => {
                        const isExpanded = expandedCollection === col.id;
                        const colMovies = col.movieIds.map(id => allMovies.find(m => m.id === id)).filter(Boolean) as any[];
                        return (
                          <div key={col.id} className="rounded-lg border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] overflow-hidden">
                            <button
                              onClick={() => setExpandedCollection(isExpanded ? null : col.id)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-[rgba(238,167,122,0.07)] dark:hover:bg-[rgba(126,62,21,0.1)] transition-colors text-left"
                            >
                              <span className="text-lg">📁</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-[13px] text-[#100b09] dark:text-[#f7f1ed]">{col.name}</div>
                                <div className="text-[11px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">{col.movieIds.length} movies · {new Date(col.createdAt).toLocaleDateString()}</div>
                              </div>
                              {isExpanded ? <ChevronUp className="size-4 text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]" /> : <ChevronDown className="size-4 text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]" />}
                            </button>
                            {isExpanded && (
                              <div className="border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.2)]">
                                {colMovies.length === 0 ? (
                                  <p className="p-3 text-[12px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">No movies in this collection yet.</p>
                                ) : (
                                  <div className="divide-y divide-[rgba(208,115,57,0.07)] dark:divide-[rgba(126,62,21,0.1)]">
                                    {colMovies.map((m: any) => (
                                      <button
                                        key={m.id}
                                        onClick={() => navigate(`/movie/${createSlug(m.title, m.year)}`)}
                                        className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-[rgba(238,167,122,0.07)] dark:hover:bg-[rgba(126,62,21,0.1)] transition-colors"
                                      >
                                        {m.image && <img src={m.image} alt={m.title} className="w-8 h-12 object-cover rounded flex-shrink-0" />}
                                        <div>
                                          <div className="text-[13px] font-medium text-[#100b09] dark:text-[#f7f1ed]">{m.title}</div>
                                          <div className="text-[11px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">{m.year}</div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* My Comments Section */}
              {activeSection === 'comments' && (
                <div>
                  <h2 className="text-[16px] font-bold mb-6 text-[#100b09] dark:text-[#f7f1ed]">My Comments</h2>

                  {loading ? (
                    <p className="text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">Loading comments...</p>
                  ) : userComments.length === 0 ? (
                    <p className="text-[13px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">You haven't posted any comments yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {userComments.map((comment) => {
                        const slug = getMovieSlug(comment.movieId);
                        return (
                          <button
                            key={comment.id}
                            onClick={() => slug && navigate(`/movie/${slug}`)}
                            className="w-full text-left p-4 rounded-lg border border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.25)] hover:bg-[rgba(238,167,122,0.1)] dark:hover:bg-[rgba(126,62,21,0.15)] transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-semibold text-[14px] text-[#100b09] dark:text-[#f7f1ed]">
                                {getMovieTitle(comment.movieId)}
                              </h3>
                              <span className="text-[11px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] shrink-0 ml-3">
                                {new Date(comment.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-[13px] text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)]">
                              {comment.text}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* My Ratings Section */}
              {activeSection === 'ratings' && (
                <div>
                  <h2 className="text-[16px] font-bold mb-6 text-[#100b09] dark:text-[#f7f1ed]">My Ratings</h2>

                  {loading ? (
                    <p className="text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">Loading ratings...</p>
                  ) : userRatings.length === 0 ? (
                    <p className="text-[13px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">You haven't rated any movies yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {userRatings.map((rating) => {
                        const slug = getMovieSlug(rating.movieId);
                        return (
                          <button
                            key={rating.movieId}
                            onClick={() => slug && navigate(`/movie/${slug}`)}
                            className="w-full p-4 rounded-lg border border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.25)] flex items-center justify-between hover:bg-[rgba(238,167,122,0.1)] dark:hover:bg-[rgba(126,62,21,0.15)] transition-colors"
                          >
                            <h3 className="font-semibold text-[13px] text-left text-[#100b09] dark:text-[#f7f1ed]">
                              {getMovieTitle(rating.movieId)}
                            </h3>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`size-4 ${
                                    star <= rating.rating
                                      ? 'fill-[#f99251] text-[#f99251] dark:fill-[#a64a11] dark:text-[#a64a11]'
                                      : 'fill-none text-[rgba(16,11,9,0.2)] dark:text-[rgba(247,241,237,0.2)]'
                                  }`}
                                />
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <SiteFooter isDarkMode={isDarkMode} />

      {/* Image Upload Modal */}
      {showImageUpload && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageUpload(false)}
        >
          <div
            className="max-w-md w-full rounded-[10px] p-6 bg-[#fdfaf8] dark:bg-[#18110c] border border-[rgba(208,115,57,0.25)] dark:border-[rgba(126,62,21,0.4)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#100b09] dark:text-[#f7f1ed]">Upload Profile Picture</h3>
              <button
                onClick={() => setShowImageUpload(false)}
                className="text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] hover:text-[#d07339] dark:hover:text-[#c36a32] transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-[13px] mb-4 text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
              Choose a JPG or PNG image (max 5MB)
            </p>

            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handleImageUpload}
              className="w-full text-[13px] text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[13px] file:font-medium file:bg-[#d07339] file:text-white hover:file:bg-[#b8622e] dark:file:bg-[#c36a32] dark:hover:file:bg-[#a85a28] file:cursor-pointer file:transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );
}
