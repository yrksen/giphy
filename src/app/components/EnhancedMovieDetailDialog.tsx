import { Star, Calendar, Film, Trash2, Check, Clock, User, Users, Play, ExternalLink, Tag, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Movie } from "./MovieCard";
import { useState, useEffect } from "react";
import type { Comment } from "./MovieDetailDialog";

interface EnhancedMovieDetailDialogProps {
  movie: Movie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (id: number) => void;
  onUpdatePoster?: (id: number, newImageUrl: string) => void;
  onMarkAsWatched?: (movie: Movie) => void;
  isToWatchView?: boolean;
  comments: Comment[];
  onAddComment?: (movieId: number, text: string) => void;
  onDeleteComment?: (movieId: number, commentId: string) => void;
  onUpdateRating?: (movieId: number, rating: number) => void;
  onUpdateTags?: (movieId: number, tags: string[]) => void;
  onUpdateRuntime?: (movieId: number, runtime: string) => void;
}

export function EnhancedMovieDetailDialog({ 
  movie, 
  open, 
  onOpenChange, 
  onDelete, 
  onUpdatePoster, 
  onMarkAsWatched, 
  isToWatchView, 
  comments, 
  onAddComment, 
  onDeleteComment,
  onUpdateRating,
  onUpdateTags,
  onUpdateRuntime
}: EnhancedMovieDetailDialogProps) {
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<"delete" | "updatePoster" | "deleteComment" | "updateRuntime" | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState("");
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [newTag, setNewTag] = useState("");
  const [newRuntime, setNewRuntime] = useState("");

  useEffect(() => {
    if (movie) {
      setNewImageUrl(movie.image);
      setNewRuntime(movie.runtime || "");
    }
  }, [movie]);

  if (!movie) return null;

  const movieComments = comments.filter(c => c.movieId === movie.id).sort((a, b) => b.timestamp - a.timestamp);

  const handleStarClick = (rating: number) => {
    if (onUpdateRating) {
      onUpdateRating(movie.id, rating);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && onUpdateTags) {
      const currentTags = movie.tags || [];
      if (!currentTags.includes(newTag.trim())) {
        onUpdateTags(movie.id, [...currentTags, newTag.trim()]);
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (onUpdateTags) {
      const currentTags = movie.tags || [];
      onUpdateTags(movie.id, currentTags.filter(t => t !== tagToRemove));
    }
  };

  const handleDelete = () => {
    setPendingAction("delete");
    setShowPasswordPrompt(true);
    setPassword("");
    setPasswordError("");
  };

  const handleUpdatePoster = () => {
    if (newImageUrl.trim() !== "") {
      setPendingAction("updatePoster");
      setShowPasswordPrompt(true);
      setPassword("");
      setPasswordError("");
    }
  };

  const handleDeleteComment = (commentId: string) => {
    setPendingAction("deleteComment");
    setPendingCommentId(commentId);
    setShowPasswordPrompt(true);
    setPassword("");
    setPasswordError("");
  };

  const handlePasswordSubmit = () => {
    if (password === "hassle") {
      setShowPasswordPrompt(false);
      setPassword("");
      setPasswordError("");
      
      if (pendingAction === "delete" && onDelete) {
        if (confirm(`Are you sure you want to delete "${movie.title}"?`)) {
          onDelete(movie.id);
          onOpenChange(false);
        }
      } else if (pendingAction === "updatePoster" && onUpdatePoster) {
        onUpdatePoster(movie.id, newImageUrl);
      } else if (pendingAction === "deleteComment" && onDeleteComment && pendingCommentId) {
        onDeleteComment(movie.id, pendingCommentId);
      } else if (pendingAction === "updateRuntime" && onUpdateRuntime) {
        // Transform "1h 44m" format to "104 min"
        let formattedRuntime = newRuntime.trim();
        const hourMinMatch = formattedRuntime.match(/(\d+)h\s*(\d+)m/i);
        if (hourMinMatch) {
          const hours = parseInt(hourMinMatch[1]);
          const minutes = parseInt(hourMinMatch[2]);
          const totalMinutes = hours * 60 + minutes;
          formattedRuntime = `${totalMinutes} min`;
        }
        
        onUpdateRuntime(movie.id, formattedRuntime);
        setNewRuntime("");
      }
      
      setPendingAction(null);
    } else {
      setPasswordError("Incorrect password");
    }
  };

  const handleCancelPassword = () => {
    setShowPasswordPrompt(false);
    setPassword("");
    setPasswordError("");
    setPendingAction(null);
  };

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (videoIdMatch && videoIdMatch[1]) {
      return `https://www.youtube.com/embed/${videoIdMatch[1]}`;
    }
    return null;
  };

  const embedUrl = getYouTubeEmbedUrl(movie.trailer);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto bg-background dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="sr-only">{movie.title}</DialogTitle>
          <DialogDescription className="sr-only">Movie details</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] md:grid-cols-[250px_1fr] gap-6">
          {/* Poster on the left */}
          <div className="w-full">
            <div className="aspect-[2/3] relative overflow-hidden rounded-lg bg-gray-100 shadow-lg">
              <img
                src={movie.image}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-2">
              <Input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Enter new image URL"
                className="w-full"
              />
              <Button
                onClick={handleUpdatePoster}
                variant="secondary"
                className="w-full mt-2"
              >
                Update Poster
              </Button>
            </div>
          </div>

          {/* Details in the middle */}
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-3xl font-bold mb-2 dark:text-white">{movie.title}</h2>
              
              <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-300 mb-4">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  <span className="text-sm">{movie.year}</span>
                </div>
                {movie.runtime && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-4" />
                    <span className="text-sm">{movie.runtime}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Film className="size-4" />
                  <span className="text-sm">{movie.genre}</span>
                </div>
              </div>

              {/* Ratings Row */}
              <div className="flex items-center gap-4 md:gap-6 mb-6 flex-wrap">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">IMDb Rating</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⭐</span>
                    <span className="text-2xl font-bold dark:text-white">{movie.imdbRating ? movie.imdbRating.toFixed(1) : movie.rating.toFixed(1)}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">/ 10</span>
                  </div>
                </div>
                
                {/* Community Rating */}
                {movie.communityRating && movie.ratingCount && movie.ratingCount > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Community Rating</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⭐</span>
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{movie.communityRating.toFixed(1)}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">({movie.ratingCount} {movie.ratingCount === 1 ? 'rating' : 'ratings'})</span>
                    </div>
                  </div>
                )}
                
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your Rating</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleStarClick(star)}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        className="hover:scale-110 transition-transform"
                      >
                        <Star 
                          className={`size-7 ${
                            (hoveredStar >= star || (movie.userRating && movie.userRating >= star))
                              ? 'fill-blue-500 text-blue-500'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Director and Cast */}
            {(movie.director || (movie.cast && movie.cast.length > 0)) && (
              <div className="grid grid-cols-1 gap-3">
                {movie.director && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="size-4 text-gray-500 dark:text-gray-400" />
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Director</p>
                    </div>
                    <p className="text-gray-900 dark:text-white ml-6">{movie.director}</p>
                  </div>
                )}
                {movie.cast && movie.cast.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="size-4 text-gray-500 dark:text-gray-400" />
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cast</p>
                    </div>
                    <p className="text-gray-900 dark:text-white ml-6">{movie.cast.join(", ")}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-2 dark:text-white">Plot</h3>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                {movie.plot || movie.description}
              </p>
            </div>

            {/* Manual Runtime Input - Show only if no runtime */}
            {!movie.runtime && onUpdateRuntime && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
                  <Clock className="size-4" />
                  Add Runtime
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Runtime information is missing. You can add it manually (e.g., "120 min" or "3 Seasons").
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newRuntime}
                    onChange={(e) => setNewRuntime(e.target.value)}
                    placeholder="e.g., 120 min or 3 Seasons"
                    className="text-sm"
                  />
                  <Button
                    onClick={() => {
                      if (newRuntime.trim()) {
                        setPendingAction("updateRuntime");
                        setShowPasswordPrompt(true);
                        setPassword("");
                        setPasswordError("");
                      }
                    }}
                    size="sm"
                    disabled={!newRuntime.trim()}
                    className="whitespace-nowrap"
                  >
                    Add Runtime
                  </Button>
                </div>
              </div>
            )}

            {/* Trailer */}
            {embedUrl && (
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 dark:text-white">
                  <Play className="size-5" />
                  Trailer
                </h3>
                <div className="aspect-video rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={embedUrl}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            )}

            {/* IMDb Link */}
            {movie.imdbId && (
              <div className="pt-2">
                <a
                  href={`https://www.imdb.com/title/${movie.imdbId}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 rounded-lg transition-colors border border-yellow-300"
                >
                  <ExternalLink className="size-4" />
                  View on IMDb
                </a>
              </div>
            )}

            {/* Mark as Watched Button */}
            {isToWatchView && onMarkAsWatched && (
              <div className="pt-4 border-t">
                <Button
                  onClick={() => {
                    if (confirm(`Mark "${movie.title}" as watched and move to main list?`)) {
                      onMarkAsWatched(movie);
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="size-4 mr-2" />
                  Mark as Watched
                </Button>
              </div>
            )}

            {/* Delete Button */}
            {onDelete && (
              <div className={isToWatchView && onMarkAsWatched ? "pt-4" : "pt-4 border-t"}>
                <Button
                  onClick={handleDelete}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete Movie
                </Button>
              </div>
            )}
          </div>

          {/* Comments Section on the right */}
          <div className="w-full lg:col-start-3 lg:row-start-1 lg:row-span-2 md:col-span-2 lg:col-span-1">
            <div className="border-l dark:border-gray-600 pl-6 h-full">
              {/* Tags Management */}
              <div className="mb-6 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
                  <Tag className="size-4" />
                  Tags
                </p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {movie.tags && movie.tags.length > 0 ? (
                    movie.tags.map((tag, idx) => (
                      <span 
                        key={idx}
                        className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-700 text-purple-700 dark:text-purple-100 border border-purple-300 dark:border-purple-600 flex items-center gap-1"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:bg-purple-200 dark:hover:bg-purple-600 rounded-full p-0.5"
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">No tags yet</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    className="text-xs h-7"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTag();
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddTag}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!newTag.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-4 dark:text-white">Comments</h3>
              
              {/* Add Comment */}
              <div className="mb-4">
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your name..."
                  className="w-full mb-2"
                />
                <Input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="w-full mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newComment.trim() !== "" && username.trim() !== "" && onAddComment) {
                      onAddComment(movie.id, JSON.stringify({ text: newComment, username }));
                      setNewComment("");
                      setUsername("");
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (newComment.trim() !== "" && username.trim() !== "" && onAddComment) {
                      onAddComment(movie.id, JSON.stringify({ text: newComment, username }));
                      setNewComment("");
                      setUsername("");
                    }
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  size="sm"
                  disabled={newComment.trim() === "" || username.trim() === ""}
                >
                  Add Comment
                </Button>
              </div>

              {/* Comments List */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {movieComments.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">No comments yet. Be the first to comment!</p>
                ) : (
                  movieComments.map(comment => (
                    <div key={comment.id} className="bg-gray-50 p-3 rounded-lg border">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-gray-900">{comment.username}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.timestamp).toLocaleDateString()} {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm mb-2">{comment.text}</p>
                      <div className="flex justify-end">
                        {onDeleteComment && (
                          <Button
                            onClick={() => handleDeleteComment(comment.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Password Prompt */}
        {showPasswordPrompt && (
          <div className="mt-6 border-t pt-6">
            <p className="text-sm text-gray-600 mb-2">Enter password to continue:</p>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
            />
            {passwordError && <p className="text-red-500 text-sm mt-1">{passwordError}</p>}
            <div className="flex justify-end gap-2 mt-2">
              <Button
                onClick={handleCancelPassword}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordSubmit}
                variant="primary"
              >
                Submit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}