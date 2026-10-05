import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Star, Calendar, Clock, Film, Users, ExternalLink, Trash2, Search, X, User, Check, Tag, ChevronRight, ChevronLeft, Play, FileText, Pencil, ImageIcon, Reply } from 'lucide-react';
import { GifPicker } from '../components/GifPicker';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Movie } from '../components/MovieCard';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { LoginModal } from '../components/LoginModal';
import { AddMovieDialog } from '../components/AddMovieDialog';
import { RecentMoviesCarousel } from '../components/RecentMoviesCarousel';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { TicketGenerator } from '../components/TicketGenerator';
import { createSlug, decodeSlug } from '../utils/slugify';
import { SiteHeader, SiteFooter } from '../components/SiteLayout';
import { supabase } from '../utils/supabaseClient';
const logoImage = 'https://i.imgur.com/vUiVqow.png?direct';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

interface Comment {
  id: number;
  movieId: number;
  username: string;
  text: string;
  timestamp: number;
  profilePicture?: string;
  parentId?: number;
  imageUrl?: string;
  userId?: string; // Store anonymousUserId for non-logged-in users
}

interface MovieDetailPageProps {
  currentUser: any;
  setCurrentUser: (user: any) => void;
}

export function MovieDetailPage({ currentUser, setCurrentUser }: MovieDetailPageProps) {
  const { title: titleSlug } = useParams<{ title: string }>();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [username, setUsername] = useState('');
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [communityRating, setCommunityRating] = useState<number>(0);
  const [ratingCount, setRatingCount] = useState<number>(0);
  const [recentMovies, setRecentMovies] = useState<Movie[]>([]);
  
  // File refs for comment/reply image upload
  const commentImgFileRef = useRef<HTMLInputElement>(null);
  const replyImgFileRef = useRef<HTMLInputElement>(null);

  // Reply + image state for comments
  const [replyingToId, setReplyingToId] = useState<number | null>(null);
  const [replyingToUsername, setReplyingToUsername] = useState<string>('');
  const [replyingToReplyId, setReplyingToReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyUsername, setReplyUsername] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [showReplyImageInput, setShowReplyImageInput] = useState(false);
  const [commentImageUrl, setCommentImageUrl] = useState('');
  const [showCommentImageInput, setShowCommentImageInput] = useState(false);
  const [showCommentGifPicker, setShowCommentGifPicker] = useState(false);
  const [showReplyGifPicker, setShowReplyGifPicker] = useState(false);
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});

  const EMOJIS = ['👍', '👎', '❤️', '😂', '😮'];

  // Role-based access control
  const isAdmin = currentUser?.role === 'admin';
  const isModerator = currentUser?.role === 'moderator';
  const canModerate = isAdmin || isModerator;

  // Password prompt state for deleting comments
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState('');
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<number | null>(null);
  const [pendingDeleteUsername, setPendingDeleteUsername] = useState('');
  
  const [newPosterUrl, setNewPosterUrl] = useState('');

  // Trailer state
  const [newTrailerUrl, setNewTrailerUrl] = useState('');

  // Carousel state (poster/trailer toggle)
  const [carouselView, setCarouselView] = useState<'poster' | 'trailer'>('poster');

  // Trailer playing state - only load iframe when user clicks play
  const [isTrailerPlaying, setIsTrailerPlaying] = useState(false);

  // Tags state — per-user localStorage
  const [newTag, setNewTag] = useState('');
  const [userTags, setUserTags] = useState<string[]>([]);
  const tagsKey = movie && currentUser ? `userTags_${currentUser.username}_${movie.id}` : null;

  // Runtime update state
  const [newRuntime, setNewRuntime] = useState('');
  const [isEditingRuntime, setIsEditingRuntime] = useState(false);

  // For AddMovieDialog
  const [allMovies, setAllMovies] = useState<Movie[]>([]);

  // Track if this movie is from the "to watch" list
  const [isFromToWatch, setIsFromToWatch] = useState(false);


  // Generate or retrieve anonymous user ID for non-logged-in users
  const getAnonymousUserId = () => {
    let anonymousId = localStorage.getItem('anonymousUserId');
    if (!anonymousId) {
      // Generate a unique ID using timestamp + random string
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('anonymousUserId', anonymousId);
    }
    return anonymousId;
  };

  const handleTryMyLuck = () => {
    // Navigate to home page and let it handle the random selection
    navigate('/');
  };

  // Apply dark mode on load and when it changes
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (titleSlug) {
      loadMovieData();
      loadRecentMovies();
    }
  }, [titleSlug]);

  // Load comments and rating after movie is loaded
  useEffect(() => {
    if (movie) {
      loadComments();
      loadUserRating();
    }
  }, [movie?.id, currentUser]);

  // Load per-user tags from localStorage
  useEffect(() => {
    if (movie && currentUser) {
      const key = `userTags_${currentUser.username}_${movie.id}`;
      setUserTags(JSON.parse(localStorage.getItem(key) || '[]'));
    } else {
      setUserTags([]);
    }
  }, [movie?.id, currentUser?.username]);

  const loadRecentMovies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/movies`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      
      if (data.success) {
        // Get 12 most recent movies
        const recent = [...data.movies]
          .sort((a, b) => b.id - a.id)
          .slice(0, 12);
        setRecentMovies(recent);
      }
    } catch (error) {
      console.error('Error loading recent movies:', error);
    }
  };

  const loadMovieData = async () => {
    try {
      setIsLoading(true);
      
      // Load from main movies
      const moviesResponse = await fetch(`${API_BASE_URL}/movies`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const moviesData = await moviesResponse.json();
      
      // Load from to watch
      const toWatchResponse = await fetch(`${API_BASE_URL}/towatch`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const toWatchData = await toWatchResponse.json();
      
      // Combine and find the movie
      const allMoviesData = [...moviesData.movies, ...toWatchData.movies];
      setAllMovies(allMoviesData);

      // The slug format is now "title-year", so we need to match it properly
      const foundMovie = allMoviesData.find((m: Movie) =>
        createSlug(m.title, m.year) === titleSlug
      );
      
      if (foundMovie) {
        console.log('Found movie data:', foundMovie);
        console.log('Movie ID:', foundMovie.id);
        setMovie(foundMovie);
        // Don't set userRating here - let loadUserRating handle it
        
        // Set the poster URL input to current poster by default
        setNewPosterUrl(foundMovie.image);
        
        // Find recommended movies based on the first genre (randomly ordered)
        if (foundMovie.genre) {
          // Get the first genre from the current movie
          const firstGenre = foundMovie.genre.split(',')[0].trim().toLowerCase();
          
          // Filter movies that have the same first genre
          const filtered = allMoviesData.filter((m: Movie) => 
            m.id !== foundMovie.id && // Exclude current movie
            m.genre && 
            m.genre.split(',').some((g: string) => 
              g.trim().toLowerCase() === firstGenre
            )
          );
          
          // Randomize and take 5
          const shuffled = filtered.sort(() => Math.random() - 0.5);
          const similar = shuffled.slice(0, 5);
          
          setSimilarMovies(similar);
        }
        
        // Check if this movie is from the "to watch" list
        setIsFromToWatch(toWatchData.movies.some((m: Movie) => m.id === foundMovie.id));
      } else {
        // Movie not found - redirect to 404 page
        navigate('/404-not-found', { replace: true });
        return;
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading movie:', error);
      setIsLoading(false);
    }
  };

  const loadComments = async () => {
    if (!movie) return;
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      
      const movieComments = data.comments.filter((c: Comment) => c.movieId === movie.id);
      setComments(movieComments.sort((a: Comment, b: Comment) => a.timestamp - b.timestamp));
      await loadReactions();
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadUserRating = async () => {
    if (!movie) return;

    console.log('Loading user rating for movie ID:', movie.id);

    try {
      // Load community rating for this movie
      const ratingsResponse = await fetch(`${API_BASE_URL}/ratings/${movie.id}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const ratingsData = await ratingsResponse.json();
      console.log('Community ratings data:', ratingsData);
      
      if (ratingsData.success) {
        setCommunityRating(ratingsData.average || 0);
        setRatingCount(ratingsData.count || 0);
        
        // Update movie object with community rating
        setMovie({
          ...movie,
          communityRating: ratingsData.average,
          ratingCount: ratingsData.count
        });
      }

      // Determine user identifier
      let userIdentifier = '';
      if (currentUser) {
        userIdentifier = currentUser.username;
      } else {
        userIdentifier = getAnonymousUserId();
      }

      console.log('Fetching ratings for user identifier:', userIdentifier);

      // Load user's personal rating
      const userRatingsResponse = await fetch(`${API_BASE_URL}/user-ratings/${userIdentifier}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const userData = await userRatingsResponse.json();
      console.log('User ratings data:', userData);
      
      if (userData.success && userData.userRatings) {
        const rating = userData.userRatings[movie.id] || 0;
        console.log(`User's rating for movie ${movie.id}:`, rating);
        setUserRating(rating);
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
    }
  };

  const uploadCommentImage = async (file: File): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data, error } = await supabase.storage.from('chat-images').upload(path, file, { upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(path);
        return urlData.publicUrl;
      }
    } catch {}
    // Fallback: base64 for small images
    if (file.size <= 2 * 1024 * 1024) {
      return new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target?.result as string ?? null);
        reader.onerror = () => res(null);
        reader.readAsDataURL(file);
      });
    }
    return null;
  };

  const handleAddComment = async () => {
    const finalUsername = currentUser ? currentUser.username : username.trim();

    if ((!newComment.trim() && !commentImageUrl.trim()) || !finalUsername) {
      alert('Please enter a comment or attach an image/GIF');
      return;
    }

    if (!movie) return;

    // If not logged in, check if username is already taken by a registered user
    if (!currentUser) {
      try {
        const usersResponse = await fetch(`${API_BASE_URL}/users`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const usersData = await usersResponse.json();
        const registeredUsernames = usersData.users?.map((u: any) => u.username.toLowerCase()) || [];

        if (registeredUsernames.includes(finalUsername.toLowerCase())) {
          alert('This username is registered. Please choose a different username or sign in.');
          return;
        }
      } catch (error) {
        console.error('Error checking username:', error);
      }
    }

    try {
      const comment: Comment = {
        id: Date.now(),
        movieId: movie.id,
        username: finalUsername,
        text: newComment.trim(),
        timestamp: Date.now(),
        profilePicture: currentUser?.profilePicture || '',
        ...(commentImageUrl.trim() && { imageUrl: commentImageUrl.trim() }),
        userId: currentUser ? `user_${currentUser.username}` : getAnonymousUserId(), // Prefix registered users with "user_"
      };

      await fetch(`${API_BASE_URL}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(comment),
      });

      setNewComment('');
      setCommentImageUrl('');
      setShowCommentImageInput(false);
      if (!currentUser) setUsername('');
      loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleAddReply = async (parentId: number) => {
    const finalUsername = currentUser ? currentUser.username : replyUsername.trim();

    if ((!replyText.trim() && !replyImageUrl.trim()) || !finalUsername) {
      alert('Please enter a reply or attach an image/GIF');
      return;
    }

    if (!movie) return;

    // If not logged in, check if username is already taken by a registered user
    if (!currentUser) {
      try {
        const usersResponse = await fetch(`${API_BASE_URL}/users`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const usersData = await usersResponse.json();
        const registeredUsernames = usersData.users?.map((u: any) => u.username.toLowerCase()) || [];

        if (registeredUsernames.includes(finalUsername.toLowerCase())) {
          alert('This username is registered. Please choose a different username or sign in.');
          return;
        }
      } catch (error) {
        console.error('Error checking username:', error);
      }
    }

    try {
      const reply: Comment = {
        id: Date.now(),
        movieId: movie.id,
        username: finalUsername,
        text: replyText.trim(),
        timestamp: Date.now(),
        profilePicture: currentUser?.profilePicture || '',
        parentId: parentId,
        ...(replyImageUrl.trim() && { imageUrl: replyImageUrl.trim() }),
        userId: currentUser ? `user_${currentUser.username}` : getAnonymousUserId(), // Prefix registered users with "user_"
      };

      await fetch(`${API_BASE_URL}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reply),
      });

      setReplyText('');
      setReplyImageUrl('');
      setShowReplyImageInput(false);
      setReplyingToId(null);
      setReplyingToReplyId(null);
      if (!currentUser) setReplyUsername('');
      loadComments();
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const loadReactions = async () => {
    if (!movie) return;
    try {
      const res = await fetch(`${API_BASE_URL}/reactions/${movie.id}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.success) setReactions(data.reactions || {});
    } catch (error) {
      console.error('Error loading reactions:', error);
    }
  };

  const handleReact = async (commentId: number, emoji: string) => {
    if (!movie) return;
    const userIdentifier = currentUser ? currentUser.username : getAnonymousUserId();
    try {
      const res = await fetch(`${API_BASE_URL}/reactions/${movie.id}/${commentId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, userIdentifier }),
      });
      const data = await res.json();
      if (data.success) {
        setReactions(prev => ({ ...prev, [String(commentId)]: data.reactions }));
      }
    } catch (error) {
      console.error('Error reacting:', error);
    }
  };

  const canDeleteComment = (commentUserId?: string) => {
    if (canModerate) return true;
    if (!currentUser) return false;
    return commentUserId === `user_${currentUser.username}`;
  };

  const handleDeleteComment = async (commentId: number, commentUsername: string, commentUserId?: string) => {
    if (!movie) return;

    const currentUserId = currentUser ? `user_${currentUser.username}` : getAnonymousUserId();
    const userOwnsComment = commentUserId === currentUserId;

    if (userOwnsComment || canModerate) {
      if (!window.confirm('Are you sure you want to delete this comment?')) return;

      try {
        const response = await fetch(`${API_BASE_URL}/comments/${movie.id}/${commentId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const data = await response.json();
        if (data.success) {
          loadComments();
        } else {
          alert('Failed to delete comment: ' + data.error);
        }
      } catch {
        alert('Error deleting comment. Please try again.');
      }
      return;
    }

    // Non-owner, non-moderator — should not reach here since button is hidden
    setShowDeletePrompt(true);
    setPendingDeleteCommentId(commentId);
    setPendingDeleteUsername(commentUsername);
  };

  const handleDeletePasswordSubmit = async () => {
    if (!pendingDeleteCommentId || !movie) return;

    // Check master password "hassle"
    if (deletePassword !== 'hassle') {
      setDeletePasswordError('Incorrect password');
      return;
    }

    try {
      console.log(`🗑️ [Admin] Deleting comment ${pendingDeleteCommentId} from movie ${movie.id}`);
      const response = await fetch(`${API_BASE_URL}/comments/${movie.id}/${pendingDeleteCommentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await response.json();
      console.log('Delete response:', data);

      if (data.success) {
        console.log('✅ Comment deleted successfully');
        loadComments();
      } else {
        console.error('❌ Delete failed:', data.error);
        setDeletePasswordError('Failed to delete: ' + data.error);
        return;
      }

      setShowDeletePrompt(false);
      setDeletePassword('');
      setDeletePasswordError('');
    } catch (error) {
      console.error('❌ Error deleting comment:', error);
      setDeletePasswordError('Error deleting comment');
    }
  };

  const handleRatingChange = async (rating: number) => {
    if (!movie) return;

    let userIdentifier = '';

    // If logged in, use their username
    if (currentUser) {
      userIdentifier = currentUser.username;
    } else {
      // For non-logged-in users, use anonymous ID
      userIdentifier = getAnonymousUserId();
    }

    console.log('Submitting rating:', { movieId: movie.id, rating, userIdentifier });

    try {
      // Submit rating to the ratings API
      const response = await fetch(`${API_BASE_URL}/ratings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movieId: movie.id,
          rating: rating,
          userIdentifier: userIdentifier,
        }),
      });

      const data = await response.json();
      console.log('Rating submission response:', data);
      
      if (data.success) {
        setUserRating(rating);
        console.log('Rating submitted successfully, reloading ratings...');
        // Reload ratings to update community rating
        await loadUserRating();
      } else {
        console.error('Failed to submit rating:', data.error);
        alert(`Failed to submit rating: ${data.error}`);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating. Please try again.');
    }
  };

  const handleUpdatePoster = async () => {
    if (!movie || !newPosterUrl.trim()) return;
    const confirmed = window.confirm('Update poster with the new URL?');
    if (!confirmed) return;
    try {
      const endpoint = isFromToWatch ? 'towatch' : 'movies';
      const response = await fetch(`${API_BASE_URL}/${endpoint}/${movie.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: newPosterUrl }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update poster');
      }
      setMovie({ ...movie, image: newPosterUrl });
      setNewPosterUrl('');
      alert('Poster updated successfully!');
    } catch (error) {
      console.error('Error updating poster:', error);
      alert(error instanceof Error ? error.message : 'Failed to update poster');
    }
  };

  const handleDeleteMovie = async () => {
    if (!movie) return;
    const confirmed = window.confirm(`Are you sure you want to delete "${movie.title}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await fetch(`${API_BASE_URL}/movies/${movie.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      navigate('/');
    } catch (error) {
      console.error('Error deleting movie:', error);
      alert('Failed to delete movie');
    }
  };

  const handleAddMovie = async (newMovie: Movie) => {
    try {
      // Add to main movies collection
      await fetch(`${API_BASE_URL}/movies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(newMovie),
      });
      
      // Reload movies list
      await loadMovieData();
    } catch (error) {
      console.error('Error adding movie:', error);
    }
  };

  const handleMarkAsWatched = async () => {
    if (!movie) return;

    const confirmed = window.confirm(`Mark "${movie.title}" as watched and move to main list?`);
    if (!confirmed) return;

    try {
      // Get current movies to find max ID
      const moviesRes = await fetch(`${API_BASE_URL}/movies`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const moviesData = await moviesRes.json();
      const currentMovies = moviesData.movies || [];
      const maxId = currentMovies.length > 0 ? Math.max(...currentMovies.map((m: any) => m.id)) : 0;
      const newId = maxId + 1;

      // Fetch all comments for this movie and migrate to new ID
      const commentsRes = await fetch(`${API_BASE_URL}/comments`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const commentsData = await commentsRes.json();
      const movieComments = (commentsData.comments || []).filter((c: Comment) => c.movieId === movie.id);

      for (const comment of movieComments) {
        // Create comment under the new movie ID
        await fetch(`${API_BASE_URL}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ ...comment, movieId: newId }),
        });
        // Delete the old comment (endpoint requires movieId/commentId)
        await fetch(`${API_BASE_URL}/comments/${movie.id}/${comment.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
      }

      // Fetch all ratings for this movie and migrate to new ID
      const ratingsRes = await fetch(`${API_BASE_URL}/ratings/${movie.id}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const ratingsData = await ratingsRes.json();
      const individualRatings = ratingsData.ratings || [];

      for (const ratingEntry of individualRatings) {
        await fetch(`${API_BASE_URL}/ratings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
          body: JSON.stringify({ movieId: newId, rating: ratingEntry.rating, userIdentifier: ratingEntry.userIdentifier }),
        });
      }

      // Delete from to-watch
      await fetch(`${API_BASE_URL}/towatch/${movie.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });

      // Add to main movies with updated timestamp and new ID
      const movieToAdd = {
        ...movie,
        id: newId,
        dateAdded: Date.now(),
      };

      await fetch(`${API_BASE_URL}/movies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(movieToAdd),
      });

      navigate('/');
    } catch (error) {
      console.error('Error marking movie as watched:', error);
      alert('Failed to mark movie as watched. Please try again.');
    }
  };

  const handleAddTag = () => {
    if (!movie || !currentUser || !newTag.trim()) return;
    const tag = newTag.trim();
    if (userTags.includes(tag)) return;
    const updated = [...userTags, tag];
    const key = `userTags_${currentUser.username}_${movie.id}`;
    localStorage.setItem(key, JSON.stringify(updated));
    setUserTags(updated);
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!movie || !currentUser) return;
    const updated = userTags.filter(t => t !== tagToRemove);
    const key = `userTags_${currentUser.username}_${movie.id}`;
    localStorage.setItem(key, JSON.stringify(updated));
    setUserTags(updated);
  };

  const handleUpdateTrailer = async () => {
    if (!movie || !newTrailerUrl.trim()) {
      alert('Please enter a trailer URL');
      return;
    }
    const confirmed = window.confirm('Update trailer with the new URL?');
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_BASE_URL}/movies/${movie.id}/trailer`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trailer: newTrailerUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update trailer');
      }
      setMovie({ ...movie, trailer: newTrailerUrl });
      setNewTrailerUrl('');
      alert('Trailer updated successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error updating trailer:', error);
      alert(`Failed to update trailer: ${error}`);
    }
  };

  const handleUpdateRuntime = async () => {
    if (!movie || !newRuntime.trim()) {
      alert('Please enter a runtime');
      return;
    }
    const confirmed = window.confirm('Update runtime?');
    if (!confirmed) return;
    try {
      const endpoint = isFromToWatch ? 'towatch' : 'movies';
      const response = await fetch(`${API_BASE_URL}/${endpoint}/${movie.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ runtime: newRuntime }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update runtime');
      }
      setMovie({ ...movie, runtime: newRuntime });
      setNewRuntime('');
      setIsEditingRuntime(false);
      alert('Runtime updated successfully!');
    } catch (error) {
      console.error('Error updating runtime:', error);
      alert(`Failed to update runtime: ${error}`);
    }
  };

  // Helper function to extract YouTube video ID
  const getYouTubeVideoId = (url: string | undefined) => {
    if (!url) return null;
    
    try {
      // Handle youtube.com/watch?v= format
      if (url.includes('youtube.com/watch')) {
        const urlObj = new URL(url);
        const videoId = urlObj.searchParams.get('v');
        if (videoId) return videoId;
      }
      
      // Handle youtu.be/ format
      if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1]?.split('?')[0];
        if (videoId) return videoId;
      }
      
      // Handle youtube.com/embed/ format (but NOT embed search)
      if (url.includes('youtube.com/embed/') && !url.includes('listType=search')) {
        const videoId = url.split('youtube.com/embed/')[1]?.split('?')[0];
        if (videoId) return videoId;
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing YouTube URL:', error);
      return null;
    }
  };

  // Helper function to convert YouTube URLs to embed format
  const getYouTubeEmbedUrl = (url: string | undefined) => {
    if (!url) return null;
    
    // If it's already an embed search URL, return as-is
    if (url.includes('youtube.com/embed') && url.includes('listType=search')) {
      return url;
    }
    
    // Otherwise, try to extract video ID and convert
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };
  
  // Helper function to get YouTube thumbnail
  const getYouTubeThumbnail = (url: string | undefined) => {
    if (!url) return null;
    
    // For embed search URLs, we can't get a thumbnail - return a placeholder
    if (url.includes('listType=search')) {
      return 'https://i.ytimg.com/vi//maxresdefault.jpg'; // YouTube's default placeholder
    }
    
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  };

  // Filter movies for search dropdown
  const searchResults = searchQuery
    ? allMovies.filter((movie) => {
        const query = searchQuery.toLowerCase();
        return (
          movie.title.toLowerCase().includes(query) ||
          movie.genre.toLowerCase().includes(query) ||
          movie.year.toString().includes(query)
        );
      })
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fdfaf8] dark:bg-[#0b0704]">
        <div className="flex flex-col items-center gap-4">
          {/* Spinning Logo */}
          <div className="w-16 h-16 animate-spin">
            <img src="https://i.imgur.com/vUiVqow.png?direct" alt="Trash Bin Logo" className="w-full h-full" />
          </div>
          {/* Loading Text */}
          <div className="text-lg font-medium text-[#100b09] dark:text-[#f7f1ed]">
            Bear with us...
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4 dark:text-white">Movie not found</h1>
          <Button onClick={() => navigate('/')}>Go Back Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col bg-[#fdfaf8] dark:bg-[#0b0704] ${isDarkMode ? 'dark' : ''}`}>
      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        isDarkMode={isDarkMode}
      />

      <SiteHeader
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        movies={recentMovies}
        onLoginRequest={() => setIsLoginModalOpen(true)}
      />

      {/* Recent Movies Navigation - no gap to header, no gap to main card */}
      <div className="bg-white dark:bg-[#18110c] rounded-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] p-3">
        <RecentMoviesCarousel movies={recentMovies} onMovieClick={(movie) => navigate(`/movie/${createSlug(movie.title, movie.year)}`)} isDarkMode={isDarkMode} />
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:pb-8">
        <div className="max-w-[1800px] mx-auto lg:px-4 lg:py-6">

          {/* Back Button - desktop only (mobile version is overlaid on poster) */}
          <button
            onClick={() => navigate(-1)}
            className="hidden lg:flex mb-6 items-center gap-2 px-4 py-2 rounded-md bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          {/* Mobile: Tags card (separate from main) */}
          <div className="lg:hidden bg-white dark:bg-[#120d09] rounded-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] px-3 pt-3 pb-3 flex flex-col gap-3">
            <button
              onClick={() => navigate(-1)}
              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white text-sm font-medium transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Tag className="size-5 text-[#100b09] dark:text-[#f7f1ed]" />
                <h2 className="text-lg font-bold text-[#100b09] dark:text-[#f7f1ed]">Tags</h2>
              </div>
              {currentUser && (
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add your tag..."
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white"
                  >
                    Add
                  </button>
                </div>
              )}
              {!currentUser && <p className="text-xs text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] mb-2">Sign in to add tags</p>}
              {userTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {userTags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-[rgba(208,115,57,0.12)] dark:bg-[rgba(195,106,50,0.15)] text-[#d07339] dark:text-[#c36a32] border border-[rgba(208,115,57,0.25)] dark:border-[rgba(195,106,50,0.3)]"
                    >
                      {tag}
                      {currentUser && (
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-0.5 hover:text-red-500 transition-colors text-xs leading-none"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Layout with Sidebar */}
          <div className="flex flex-col lg:grid lg:grid-cols-[320px_1fr_320px] lg:items-start gap-0 lg:gap-8">
            {/* Left Column - Poster Only */}
            <div className="shrink-0">

              {/* Poster Container */}
              <div className="relative bg-white dark:bg-[#120d09] rounded-t-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] overflow-hidden lg:bg-white lg:dark:bg-[#18110c] lg:border lg:border-[rgba(208,115,57,0.2)] lg:dark:border-[rgba(126,62,21,0.3)] lg:rounded-[10px]">
                <img
                  src={movie.image}
                  alt={movie.title}
                  className="w-full object-contain lg:object-cover"
                  loading="lazy"
                />

                {/* Mobile-only: toggle arrows overlaid on poster */}
                {carouselView === 'poster' && (
                  <button
                    onClick={() => setCarouselView('trailer')}
                    className="lg:hidden absolute top-1/2 right-3 -translate-y-1/2 bg-[#d07339]/80 hover:bg-[#d07339] text-white rounded-full p-2 transition-colors z-10"
                    title="View Trailer"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                )}
                {carouselView === 'trailer' && (
                  <button
                    onClick={() => { setCarouselView('poster'); setIsTrailerPlaying(false); }}
                    className="lg:hidden absolute top-1/2 left-3 -translate-y-1/2 bg-[#d07339]/80 hover:bg-[#d07339] text-white rounded-full p-2 transition-colors z-10"
                    title="Back to Description"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                )}

                {/* Update Poster */}
                {canModerate && (
                  <div className="p-3 bg-[#fbf3ee] dark:bg-[#0d0905]">
                    <div className="mb-2">
                      <input
                        type="text"
                        value={newPosterUrl}
                        onChange={(e) => setNewPosterUrl(e.target.value)}
                        className="w-full px-3 py-2 text-[11px] border rounded bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                        placeholder="Paste new poster URL..."
                      />
                    </div>
                    <button
                      onClick={handleUpdatePoster}
                      className="w-full px-4 py-2.5 bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white text-[13px] font-medium rounded transition-colors"
                    >
                      Update Poster
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Middle Column - Movie Details */}
            <div className="flex-1">
              {/* Movie Details Section */}
              <div className="p-4 bg-white dark:bg-[#120d09] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] border-t-0 rounded-b-[10px] relative lg:bg-white lg:dark:bg-[#18110c] lg:border lg:border-[rgba(208,115,57,0.2)] lg:dark:border-[rgba(126,62,21,0.3)] lg:rounded-[10px] lg:p-6 lg:mb-8">
                {/* Name */}
                <h1 className="text-2xl font-bold mb-3 text-[#100b09] dark:text-[#f7f1ed]">{movie.title}</h1>

                {/* Year, Length, Genres */}
                <div className="flex flex-wrap gap-4 mb-4 text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                  {movie.year && (
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4" />
                      <span>{movie.year}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="size-4" />
                    {!isEditingRuntime ? (
                      movie.runtime ? (
                        <div className="flex items-center gap-2 group">
                          <span>{movie.runtime}</span>
                          {canModerate && (
                            <button
                              onClick={() => {
                                setNewRuntime(movie.runtime || '');
                                setIsEditingRuntime(true);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] hover:text-[#d07339]"
                              title="Edit Runtime"
                            >
                              <Pencil className="size-3" />
                            </button>
                          )}
                        </div>
                      ) : canModerate ? (
                        <button
                          onClick={() => setIsEditingRuntime(true)}
                          className="text-[#d07339] dark:text-[#c36a32] hover:underline flex items-center gap-1"
                        >
                          <span>+ Add Time</span>
                        </button>
                      ) : null
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newRuntime}
                          onChange={(e) => setNewRuntime(e.target.value)}
                          placeholder="e.g. 1h 30m"
                          className="w-24 px-2 py-1 text-xs border rounded bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-1 focus:ring-[#d07339]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateRuntime();
                            if (e.key === 'Escape') setIsEditingRuntime(false);
                          }}
                        />
                        <button
                          onClick={handleUpdateRuntime}
                          className="text-green-600 dark:text-green-400 hover:opacity-70"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingRuntime(false);
                            setNewRuntime('');
                          }}
                          className="text-red-600 dark:text-red-400 hover:opacity-70"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {movie.genre && (
                    <div className="flex items-center gap-2">
                      <Film className="size-4" />
                      <span>{movie.genre}</span>
                    </div>
                  )}
                </div>

                {/* Ratings Row: IMDb (left) + User Rating (right) - Only show in poster view */}
                {carouselView === 'poster' && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-8 mb-4">
                      {/* IMDb Rating (Left) */}
                      <div>
                        <h3 className="text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] mb-2">IMDb Rating</h3>
                        <div className="flex items-center gap-2">
                          {(movie.imdbRating || movie.rating) && (
                            <>
                              <Star className="size-5 fill-[#f99251] text-[#f99251] dark:fill-[#a64a11] dark:text-[#a64a11]" />
                              <span className="font-bold text-[#100b09] dark:text-[#f7f1ed] text-lg">
                                {movie.imdbRating || movie.rating}
                              </span>
                              <span className="text-sm text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">/ 10</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* User Rating (Right) */}
                      <div>
                        <h3 className="text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] mb-2">Your Rating</h3>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRatingChange(star)}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              className="transition-transform hover:scale-110"
                            >
                              <Star
                                className={`size-5 ${
                                  star <= (hoverRating || userRating)
                                    ? 'fill-[#f99251] text-[#f99251] dark:fill-[#a64a11] dark:text-[#a64a11]'
                                    : 'fill-none text-[rgba(16,11,9,0.2)] dark:text-[rgba(247,241,237,0.2)] stroke-2'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Community Rating */}
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="size-4 text-[#d07339] dark:text-[#c36a32]" />
                      <span className="font-semibold text-[#100b09] dark:text-[#f7f1ed] text-[15px]">
                        {movie.communityRating ? movie.communityRating.toFixed(1) : '0'}
                      </span>
                      <span className="text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                        ({movie.ratingCount || 0} {movie.ratingCount === 1 ? 'rating' : 'ratings'})
                      </span>
                    </div>
                  </>
                )}

                {/* Show these details only in poster view */}
                {carouselView === 'poster' && (
                  <>
                    {/* Director */}
                    {movie.director && (
                      <div className="mb-2 flex items-center gap-2">
                        <User className="size-4 text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]" />
                        <span className="font-semibold text-[#100b09] dark:text-[#f7f1ed] text-[13px]">Director: </span>
                        <span className="text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] text-[13px]">{movie.director}</span>
                      </div>
                    )}

                    {/* Cast */}
                    {movie.cast && (
                      <div className="mb-2 flex items-start gap-2">
                        <Users className="size-4 text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] mt-0.5" />
                        <div>
                          <span className="font-semibold text-[#100b09] dark:text-[#f7f1ed] text-[13px]">Cast: </span>
                          <span className="text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] text-[13px]">
                            {Array.isArray(movie.cast) ? movie.cast.join(", ") : movie.cast}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Plot */}
                    {movie.plot && (
                      <div className="mb-3">
                        <h3 className="font-semibold mb-1 text-[#100b09] dark:text-[#f7f1ed] text-[13px] flex items-center gap-2">
                          <FileText className="size-4" />
                          Plot:
                        </h3>
                        <p className="text-[rgba(16,11,9,0.8)] dark:text-[rgba(247,241,237,0.8)] whitespace-pre-wrap text-[13px]">{movie.plot}</p>
                      </div>
                    )}

                    {/* View on IMDb */}
                    {movie.imdbId && (
                      <div className="mb-4">
                        <a
                          href={`https://www.imdb.com/title/${movie.imdbId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-[rgba(208,115,57,0.1)] dark:bg-[rgba(126,62,21,0.2)] border-2 border-[#d07339] dark:border-[#c36a32] rounded-full text-[#d07339] dark:text-[#f99251] hover:bg-[rgba(208,115,57,0.2)] dark:hover:bg-[rgba(126,62,21,0.3)] transition-colors text-[13px] font-medium"
                        >
                          <ExternalLink className="size-4" />
                          View on IMDb
                        </a>
                      </div>
                    )}

                    {/* Mark as Watched Section - Only show if this is from "to watch" list */}
                    {isFromToWatch && (
                      <div className="mb-4">
                        <h2 className="font-semibold mb-3 text-[#100b09] dark:text-[#f7f1ed] text-[13px]" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          Mark as Watched
                        </h2>
                        <button
                          onClick={handleMarkAsWatched}
                          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Check className="size-5" />
                          Mark as Watched
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Show trailer in trailer view */}
                {carouselView === 'trailer' && (
                  <div className="mb-4">
                    <h3 className="font-semibold mb-3 text-[#100b09] dark:text-[#f7f1ed] text-lg">Trailer</h3>

                    {/* Show trailer player or message */}
                    {movie.trailer && getYouTubeEmbedUrl(movie.trailer) ? (
                      <div className="mb-4">
                        {!isTrailerPlaying ? (
                          <div
                            className="aspect-video rounded-lg overflow-hidden bg-black relative cursor-pointer group"
                            onClick={() => setIsTrailerPlaying(true)}
                          >
                            <img
                              src={getYouTubeThumbnail(movie.trailer) || ''}
                              alt="Trailer thumbnail"
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                              <div className="bg-red-600 hover:bg-red-700 rounded-full p-4 transition-colors">
                                <Play className="size-12 text-white fill-white" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video rounded-lg overflow-hidden bg-black">
                            <iframe
                              src={getYouTubeEmbedUrl(movie.trailer) || ''}
                              className="w-full h-full"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              title="Movie Trailer"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4 p-8 bg-[rgba(238,167,122,0.1)] dark:bg-[rgba(126,62,21,0.15)] rounded-lg text-center">
                        <p className="text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] text-[13px]">
                          No trailer available
                        </p>
                      </div>
                    )}

                    {canModerate && (
                      <div>
                        <div className="mb-3">
                          <h2 className="font-semibold mb-3 text-[#100b09] dark:text-[#f7f1ed] text-[13px]">Update Trailer URL</h2>
                          <input
                            type="text"
                            value={newTrailerUrl}
                            onChange={(e) => setNewTrailerUrl(e.target.value)}
                            className="w-full px-3 py-2 text-[13px] border rounded bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                            placeholder="YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
                          />
                        </div>
                        <button
                          onClick={handleUpdateTrailer}
                          className="w-full px-4 py-2.5 bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white text-[13px] font-medium rounded-lg transition-colors"
                        >
                          Update Trailer
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags (user's own) */}
                {userTags.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-semibold mb-2 text-[#100b09] dark:text-[#f7f1ed] text-[13px]">My Tags:</h3>
                    <div className="flex flex-wrap gap-2">
                      {userTags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-[#eea77a] dark:bg-[#7e3e15] text-[#100b09] dark:text-[#f7f1ed] rounded-full text-[11px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delete Movie Button */}
                {canModerate && (
                  <div className="mb-4">
                    <h2 className="font-semibold mb-3 text-[#100b09] dark:text-[#f7f1ed] text-[13px]">Delete Movie</h2>
                    <button
                      onClick={handleDeleteMovie}
                      className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </button>
                  </div>
                )}

                {/* Right Arrow to go to Trailer - Only show in poster view, desktop only */}
                {carouselView === 'poster' && (
                  <button
                    onClick={() => setCarouselView('trailer')}
                    className="hidden lg:block absolute top-1/2 right-4 -translate-y-1/2 bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white rounded-full p-2 transition-colors z-10"
                    title="View Trailer"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                )}

                {/* Left Arrow to go back to Description - Only show in trailer view, desktop only */}
                {carouselView === 'trailer' && (
                  <button
                    onClick={() => {
                      setCarouselView('poster');
                      setIsTrailerPlaying(false);
                    }}
                    className="hidden lg:block absolute top-1/2 left-4 -translate-y-1/2 bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white rounded-full p-2 transition-colors z-10"
                    title="Back to Description"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                )}
              </div>

              {/* Comments Section */}
              <div className="p-4 bg-white dark:bg-[#120d09] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] lg:mt-8 lg:bg-white lg:dark:bg-[#18110c] lg:border lg:border-[rgba(208,115,57,0.2)] lg:dark:border-[rgba(126,62,21,0.3)] lg:rounded-[10px] lg:p-6 lg:mb-8">
                <h2 className="text-lg font-bold mb-4 text-[#100b09] dark:text-[#f7f1ed]">Comments</h2>

                {/* Add Comment Form */}
                <div className="mb-6 space-y-3">
                  {!currentUser && (
                    <input
                      type="text"
                      placeholder="Your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                    />
                  )}
                  {currentUser && (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[rgba(238,167,122,0.15)] dark:bg-[rgba(126,62,21,0.15)]">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center overflow-hidden ${isDarkMode ? 'bg-[rgba(126,62,21,0.3)]' : 'bg-[rgba(208,115,57,0.2)]'}`}>
                        {currentUser.profilePicture ? (
                          <img src={currentUser.profilePicture} alt={currentUser.username} className="w-full h-full object-cover" />
                        ) : (
                          <User className="size-4 text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]" />
                        )}
                      </div>
                      <span className="text-[13px] font-medium text-[#100b09] dark:text-[#f7f1ed]">
                        Commenting as {currentUser.username}
                      </span>
                    </div>
                  )}
                  <textarea
                    placeholder="Write your comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-[13px] border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339] resize-none"
                  />
                  <input ref={commentImgFileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    if (file.size > 8 * 1024 * 1024) { alert('Image must be under 8MB'); return; }
                    const url = await uploadCommentImage(file);
                    if (url) setCommentImageUrl(url);
                    e.target.value = '';
                  }} />
                  {showCommentImageInput && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => commentImgFileRef.current?.click()}
                          className="px-3 py-2 text-[13px] rounded-lg border flex items-center gap-1.5 border-[#eea77a] dark:border-[#7e3e15] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:bg-[rgba(238,167,122,0.1)] transition-colors"
                        >
                          📁 Choose File
                        </button>
                        <input
                          type="text"
                          placeholder="Or paste image URL…"
                          value={commentImageUrl}
                          onChange={(e) => setCommentImageUrl(e.target.value)}
                          className="flex-1 px-3 py-2 text-[13px] border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                        />
                      </div>
                      {commentImageUrl && (
                        <img src={commentImageUrl} alt="preview" className="max-h-40 rounded-lg object-contain border border-[rgba(208,115,57,0.2)]" onError={(e) => e.currentTarget.style.display = 'none'} />
                      )}
                    </div>
                  )}
                  {commentImageUrl && !showCommentImageInput && (
                    <div className="relative inline-block">
                      <img src={commentImageUrl} alt="GIF preview" className="max-h-32 rounded-lg object-contain border border-[rgba(208,115,57,0.2)]" onError={(e) => e.currentTarget.style.display = 'none'} />
                      <button onClick={() => setCommentImageUrl('')} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black/80 transition-colors">
                        <X className="size-3 text-white" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCommentGifPicker(true)}
                      className="px-3 py-2 text-[13px] rounded-lg border transition-colors flex items-center gap-1.5 border-[#eea77a] dark:border-[#7e3e15] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:bg-[rgba(238,167,122,0.1)]"
                    >
                      GIF
                    </button>
                    <button
                      onClick={() => { setShowCommentImageInput(!showCommentImageInput); if (showCommentImageInput) setCommentImageUrl(''); }}
                      className={`px-3 py-2 text-[13px] rounded-lg border transition-colors flex items-center gap-1.5 ${showCommentImageInput ? 'bg-[rgba(208,115,57,0.15)] border-[#d07339] text-[#d07339]' : 'border-[#eea77a] dark:border-[#7e3e15] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:bg-[rgba(238,167,122,0.1)]'}`}
                    >
                      <ImageIcon className="size-3.5" />
                      Image
                    </button>
                    <button
                      onClick={handleAddComment}
                      className="flex-1 px-4 py-2.5 bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white text-[13px] font-medium rounded-lg transition-colors"
                    >
                      Post Comment
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-3">
                  {comments.filter(c => !c.parentId).length === 0 ? (
                    <p className="text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] text-center py-8 text-[13px]">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments
                      .filter(c => !c.parentId)
                      .sort((a, b) => a.timestamp - b.timestamp)
                      .map((comment) => {
                        const userId = currentUser ? currentUser.username : getAnonymousUserId();

                        // Recursive function to render a comment and all its nested replies
                        const renderComment = (comment: Comment, depth: number = 0, parentUsername?: string): JSX.Element => {
                          const isTopLevel = depth === 0;
                          const commentReplies = comments.filter(c => c.parentId === comment.id).sort((a, b) => a.timestamp - b.timestamp);
                          const commentReactions = reactions[String(comment.id)] || {};

                          // Format timestamp as "MM/DD/YYYY at HH:MM AM/PM"
                          const formatTimestamp = (timestamp: number) => {
                            const date = new Date(timestamp);
                            const dateStr = date.toLocaleDateString();
                            const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                            return `${dateStr} at ${timeStr}`;
                          };

                          // Adjust sizes based on depth
                          const avatarSize = isTopLevel ? 'w-9 h-9' : 'w-7 h-7';
                          const iconSize = isTopLevel ? 'size-4' : 'size-3.5';
                          const textSize = isTopLevel ? 'text-[13px]' : 'text-[12px]';
                          const timestampSize = isTopLevel ? 'text-[11px]' : 'text-[10px]';
                          const deleteIconSize = isTopLevel ? 'size-3.5' : 'size-3';
                          const replyIconSize = isTopLevel ? 'size-3' : 'size-3';
                          const replyTextSize = isTopLevel ? 'text-[11px]' : 'text-[10px]';
                          const padding = isTopLevel ? 'p-4' : 'p-3';
                          const imageHeight = isTopLevel ? 'max-h-60' : 'max-h-48';

                          // Reply form specific to this comment
                          const replyForm = (
                            <div className="mt-2 space-y-2">
                              {!currentUser && (
                                <input
                                  type="text"
                                  placeholder="Your username"
                                  value={replyUsername}
                                  onChange={(e) => setReplyUsername(e.target.value)}
                                  className="w-full px-3 py-2 text-[13px] border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                                />
                              )}
                              <textarea
                                placeholder={`Reply to ${replyingToUsername}...`}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                                autoFocus
                                className="w-full px-3 py-2 text-[13px] border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339] resize-none"
                              />
                              <input ref={replyImgFileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                                const file = e.target.files?.[0]; if (!file) return;
                                if (file.size > 8 * 1024 * 1024) { alert('Image must be under 8MB'); return; }
                                const url = await uploadCommentImage(file);
                                if (url) setReplyImageUrl(url);
                                e.target.value = '';
                              }} />
                              {showReplyImageInput && (
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => replyImgFileRef.current?.click()}
                                      className="px-3 py-2 text-[13px] rounded-lg border flex items-center gap-1.5 border-[#eea77a] dark:border-[#7e3e15] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:bg-[rgba(238,167,122,0.1)] transition-colors whitespace-nowrap"
                                    >
                                      📁 Choose File
                                    </button>
                                    <input
                                      type="text"
                                      placeholder="Or paste image URL…"
                                      value={replyImageUrl}
                                      onChange={(e) => setReplyImageUrl(e.target.value)}
                                      className="flex-1 px-3 py-2 text-[13px] border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                                    />
                                  </div>
                                  {replyImageUrl && (
                                    <img src={replyImageUrl} alt="preview" className="max-h-32 rounded-lg object-contain border border-[rgba(208,115,57,0.2)]" onError={(e) => e.currentTarget.style.display = 'none'} />
                                  )}
                                </div>
                              )}
                              {replyImageUrl && !showReplyImageInput && (
                                <div className="relative inline-block">
                                  <img src={replyImageUrl} alt="GIF preview" className="max-h-24 rounded-lg object-contain border border-[rgba(208,115,57,0.2)]" onError={(e) => e.currentTarget.style.display = 'none'} />
                                  <button onClick={() => setReplyImageUrl('')} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-black/80 transition-colors">
                                    <X className="size-3 text-white" />
                                  </button>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <button onClick={() => setShowReplyGifPicker(true)} className="px-2.5 py-1.5 text-[12px] rounded-lg border transition-colors border-[#eea77a] dark:border-[#7e3e15] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:bg-[rgba(238,167,122,0.1)]">GIF</button>
                                <button onClick={() => { setShowReplyImageInput(!showReplyImageInput); if (showReplyImageInput) setReplyImageUrl(''); }} className={`px-2.5 py-1.5 text-[12px] rounded-lg border transition-colors flex items-center gap-1 ${showReplyImageInput ? 'bg-[rgba(208,115,57,0.15)] border-[#d07339] text-[#d07339]' : 'border-[#eea77a] dark:border-[#7e3e15] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:bg-[rgba(238,167,122,0.1)]'}`}><ImageIcon className="size-3" />Image</button>
                                <button onClick={() => { setReplyingToId(null); setReplyingToReplyId(null); setReplyingToUsername(''); setReplyText(''); setReplyImageUrl(''); setShowReplyImageInput(false); }} className="px-3 py-1.5 text-[12px] rounded-lg border border-[#eea77a] dark:border-[#7e3e15] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:bg-[rgba(238,167,122,0.1)] transition-colors">Cancel</button>
                                <button onClick={() => handleAddReply(comment.id)} className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white transition-colors">Post Reply</button>
                              </div>
                            </div>
                          );

                          return (
                            <div key={comment.id}>
                              {/* Comment/Reply */}
                              <div className={`border ${isTopLevel ? 'border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.25)]' : 'border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.15)]'} rounded-lg ${padding} ${isTopLevel ? 'hover:bg-[rgba(238,167,122,0.05)] dark:hover:bg-[rgba(126,62,21,0.07)]' : 'bg-[rgba(238,167,122,0.04)] dark:bg-[rgba(126,62,21,0.05)]'} transition-colors`}>
                                <div className="flex items-start gap-3">
                                  <div className={`${avatarSize} rounded-full flex items-center justify-center overflow-hidden shrink-0 ${isDarkMode ? 'bg-[rgba(126,62,21,0.3)]' : 'bg-[rgba(208,115,57,0.15)]'}`}>
                                    {comment.profilePicture ? (
                                      <img src={comment.profilePicture} alt={comment.username} className="w-full h-full object-cover" />
                                    ) : (
                                      <User className={`${iconSize} text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]`} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                      <div className="flex flex-wrap items-baseline gap-1">
                                        {comment.userId?.startsWith('user_') ? (
                                          <Link to={`/users/${comment.username}`} className={`font-semibold text-[#100b09] dark:text-[#f7f1ed] hover:text-[#d07339] dark:hover:text-[#c36a32] hover:underline transition-colors ${textSize}`}>{comment.username}</Link>
                                        ) : (
                                          <span className={`font-semibold text-[#100b09] dark:text-[#f7f1ed] ${textSize}`}>{comment.username}</span>
                                        )}
                                        {parentUsername && (
                                          <>
                                            <span className={`${timestampSize} text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]`}>→</span>
                                            <span className={`font-semibold text-[#d07339] dark:text-[#f99251] ${textSize}`}>@{parentUsername}</span>
                                          </>
                                        )}
                                        <span className={`${timestampSize} text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]`}>{formatTimestamp(comment.timestamp)}</span>
                                      </div>
                                      {canDeleteComment(comment.userId) && (
                                        <button onClick={() => handleDeleteComment(comment.id, comment.username, comment.userId)} className="text-red-500/50 hover:text-red-600 dark:text-red-500/40 dark:hover:text-red-400 transition-colors"><Trash2 className={deleteIconSize} /></button>
                                      )}
                                    </div>
                                    {comment.text && <p className={`text-[rgba(16,11,9,0.8)] dark:text-[rgba(247,241,237,0.8)] ${textSize} leading-relaxed`}>{comment.text}</p>}
                                    {comment.imageUrl && <img src={comment.imageUrl} alt="comment media" className={`${comment.text ? 'mt-2' : ''} ${imageHeight} rounded-lg object-contain border border-[rgba(208,115,57,0.2)]`} onError={(e) => e.currentTarget.style.display = 'none'} />}
                                    {!comment.text && !comment.imageUrl && <p className={`text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] ${textSize} italic`}>[Empty comment]</p>}
                                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[rgba(208,115,57,0.08)] dark:border-[rgba(126,62,21,0.12)]">
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {EMOJIS.map(emoji => {
                                          const users = commentReactions[emoji] || [];
                                          const hasReacted = users.includes(userId);
                                          return (
                                            <button key={emoji} onClick={() => handleReact(comment.id, emoji)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${isTopLevel ? 'text-[13px]' : 'text-[12px]'} transition-all ${hasReacted ? 'bg-[rgba(208,115,57,0.2)] border border-[rgba(208,115,57,0.5)]' : 'border border-transparent hover:bg-[rgba(238,167,122,0.12)] dark:hover:bg-[rgba(126,62,21,0.15)]'}`}>
                                              <span>{emoji}</span>
                                              {users.length > 0 && <span className="text-[10px] font-medium text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] ml-0.5">{users.length}</span>}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <button
                                        onClick={() => { setReplyingToId(comment.id); setReplyingToReplyId(comment.id); setReplyingToUsername(comment.username); setReplyText(''); setReplyImageUrl(''); setShowReplyImageInput(false); }}
                                        className={`text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] hover:text-[#d07339] dark:hover:text-[#c36a32] transition-colors flex items-center gap-1 ${replyTextSize} ml-2 shrink-0`}
                                      >
                                        <Reply className={replyIconSize} />Reply
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Reply form for this comment */}
                              {replyingToId === comment.id && replyingToReplyId === comment.id && (
                                <div className="ml-8 mt-2 pl-4 border-l-2 border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)]">
                                  {replyForm}
                                </div>
                              )}

                              {/* Nested replies with left border */}
                              {commentReplies.length > 0 && (
                                <div className="ml-8 mt-2 space-y-2 border-l-2 border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] pl-4">
                                  {commentReplies.map((reply) => renderComment(reply, depth + 1, comment.username))}
                                </div>
                              )}
                            </div>
                          );
                        };

                        return renderComment(comment, 0);
                      })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Tags + Recommended (desktop only) */}
            <div className="hidden lg:block space-y-6">
              {/* Tags Section */}
              <div className="bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="size-5 text-[#100b09] dark:text-[#f7f1ed]" />
                  <h2 className="text-lg font-bold text-[#100b09] dark:text-[#f7f1ed]">Tags</h2>
                </div>

                {userTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {userTags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#eea77a] dark:bg-[#7e3e15] text-[#100b09] dark:text-[#f7f1ed] rounded-full text-[11px]"
                      >
                        <span>{tag}</span>
                        <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-70 transition-opacity">
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] italic text-sm mb-4">
                    {currentUser ? 'No tags yet — add your own below' : 'Sign in to add tags'}
                  </p>
                )}

                {currentUser && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add your tag..."
                      className="flex-1 px-3 py-2 text-sm rounded-lg border bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-5 py-2 text-sm font-medium rounded-lg transition-colors bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Recommended Section */}
              <div className="bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] p-6">
                <h2 className="text-lg font-bold mb-4 text-[#100b09] dark:text-[#f7f1ed]">Recommended</h2>

                {similarMovies.length === 0 ? (
                  <p className="text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] text-center py-8 text-[13px]">
                    No recommendations found
                  </p>
                ) : (
                  <div className="space-y-4">
                    {similarMovies.map((similarMovie) => (
                      <div
                        key={similarMovie.id}
                        onClick={() => navigate(`/movie/${createSlug(similarMovie.title, similarMovie.year)}`)}
                        className="cursor-pointer group"
                      >
                        <div className="flex gap-3">
                          <img
                            src={similarMovie.image}
                            alt={similarMovie.title}
                            className="w-20 h-28 object-cover rounded-lg group-hover:opacity-80 transition-opacity"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[13px] text-[#100b09] dark:text-[#f7f1ed] group-hover:text-[#d07339] dark:group-hover:text-[#f99251] transition-colors line-clamp-2">
                              {similarMovie.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5">
                              {(similarMovie.imdbRating || similarMovie.rating) && (
                                <div className="flex items-center gap-1">
                                  <Star className="size-3 fill-[#f99251] text-[#f99251] dark:fill-[#a64a11] dark:text-[#a64a11]" />
                                  <span className="text-[11px] font-medium text-[#100b09] dark:text-[#f7f1ed]">
                                    {similarMovie.imdbRating || similarMovie.rating}
                                  </span>
                                </div>
                              )}
                              {similarMovie.userRating && similarMovie.userRating > 0 && (
                                <div className="flex items-center gap-1">
                                  <Star className="size-3 fill-blue-500 text-blue-500 dark:fill-blue-400 dark:text-blue-400" />
                                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                                    {similarMovie.userRating}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                              {similarMovie.runtime && (
                                <>
                                  <span>{similarMovie.runtime}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>{similarMovie.year}</span>
                            </div>
                            {similarMovie.genre && (
                              <p className="text-[11px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] mt-0.5 line-clamp-1">
                                {similarMovie.genre}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile-only Recommended Card */}
          <div className="lg:hidden bg-white dark:bg-[#120d09] rounded-[10px] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] p-5 mt-0">
            <h2 className="text-lg font-bold mb-4 text-[#100b09] dark:text-[#f7f1ed]">Recommended</h2>
            {similarMovies.length === 0 ? (
              <p className="text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] text-center py-4 text-[13px]">No recommendations found</p>
            ) : (
              <div className="space-y-4">
                {similarMovies.map((similarMovie) => (
                  <div key={similarMovie.id} onClick={() => navigate(`/movie/${createSlug(similarMovie.title, similarMovie.year)}`)} className="cursor-pointer group flex gap-3">
                    <img src={similarMovie.image} alt={similarMovie.title} className="w-16 h-24 object-cover rounded-lg group-hover:opacity-80 transition-opacity flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[13px] text-[#100b09] dark:text-[#f7f1ed] group-hover:text-[#d07339] dark:group-hover:text-[#f99251] transition-colors line-clamp-2">{similarMovie.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                        {(similarMovie.imdbRating || similarMovie.rating) && <><Star className="size-3 fill-[#f99251] text-[#f99251]" /><span>{similarMovie.imdbRating || similarMovie.rating}</span><span>•</span></>}
                        <span>{similarMovie.year}</span>
                      </div>
                      {similarMovie.genre && <p className="text-[11px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] mt-0.5 line-clamp-1">{similarMovie.genre}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>


      {/* GIF Pickers */}
      {showCommentGifPicker && (
        <GifPicker
          isDarkMode={isDarkMode}
          onSelect={(url) => { setCommentImageUrl(url); setShowCommentImageInput(false); }}
          onClose={() => setShowCommentGifPicker(false)}
        />
      )}
      {showReplyGifPicker && (
        <GifPicker
          isDarkMode={isDarkMode}
          onSelect={(url) => { setReplyImageUrl(url); setShowReplyImageInput(false); }}
          onClose={() => setShowReplyGifPicker(false)}
        />
      )}

      {/* Delete Comment Password Prompt */}
      {showDeletePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#fdfaf8] dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] p-6 shadow-lg w-80">
            <h2 className="text-lg font-bold mb-4 text-[#100b09] dark:text-[#f7f1ed]">Delete Comment</h2>
            <p className="text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] mb-4">
              Enter the password to delete this comment:
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border rounded-lg bg-[#fdfaf8] dark:bg-[#18110c] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] focus:outline-none focus:ring-2 focus:ring-[#d07339]"
            />
            {deletePasswordError && (
              <p className="text-red-500 text-[13px] mt-2">{deletePasswordError}</p>
            )}
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowDeletePrompt(false)}
                className="text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:opacity-70 transition-opacity mr-2"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePasswordSubmit}
                className="px-4 py-2 bg-red-600 text-white text-[13px] font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <SiteFooter isDarkMode={isDarkMode} />
    </div>
  );
}