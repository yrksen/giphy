import { Star, Calendar, Film, Trash2, Image, Check } from "lucide-react";
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

export interface Comment {
  id: string;
  movieId: number;
  text: string;
  timestamp: number;
  username: string;
}

interface MovieDetailDialogProps {
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
}

export function MovieDetailDialog({ movie, open, onOpenChange, onDelete, onUpdatePoster, onMarkAsWatched, isToWatchView, comments, onAddComment, onDeleteComment, onUpdateRating, onUpdateTags }: MovieDetailDialogProps) {
  const [newImageUrl, setNewImageUrl] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [pendingAction, setPendingAction] = useState<"delete" | "updatePoster" | "deleteComment" | null>(null);
  const [passwordError, setPasswordError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [username, setUsername] = useState("");
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);

  // Update the input field when the movie changes
  useEffect(() => {
    if (movie) {
      setNewImageUrl(movie.image);
    }
  }, [movie]);

  if (!movie) return null;

  // Filter comments for this movie
  const movieComments = comments.filter(c => c.movieId === movie.id).sort((a, b) => b.timestamp - a.timestamp);

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
        // Check if it's an IMDb media viewer link
        if (newImageUrl.includes('imdb.com/title/') && newImageUrl.includes('/mediaviewer/')) {
          // Extract the IMDb ID and media ID from the URL
          const titleMatch = newImageUrl.match(/title\/(tt\d+)/);
          const mediaMatch = newImageUrl.match(/mediaviewer\/(rm\d+)/);
          
          if (titleMatch && mediaMatch) {
            // Fetch the actual image URL from IMDb
            fetchImdbImage(titleMatch[1], mediaMatch[1]).then(imageUrl => {
              if (imageUrl) {
                onUpdatePoster(movie.id, imageUrl);
              } else {
                alert('Could not fetch image from IMDb link. Please try a direct image URL.');
              }
            });
          } else {
            alert('Invalid IMDb link format.');
          }
        } else {
          // Direct image URL
          onUpdatePoster(movie.id, newImageUrl);
        }
      } else if (pendingAction === "deleteComment" && onDeleteComment && pendingCommentId) {
        onDeleteComment(movie.id, pendingCommentId);
      }
      
      setPendingAction(null);
    } else {
      setPasswordError("Incorrect password");
    }
  };

  const fetchImdbImage = async (titleId: string, mediaId: string): Promise<string | null> => {
    try {
      // Use IMDb's image API pattern
      // The image URL format is typically: https://m.media-amazon.com/images/M/{mediaId}._V1_.jpg
      // We'll try to construct it directly, or fetch from the page
      
      // Try to fetch the page and extract the image
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.imdb.com/title/${titleId}/mediaviewer/${mediaId}/`)}`;
      const response = await fetch(proxyUrl);
      const html = await response.text();
      
      // Look for the high-resolution image in the HTML
      const imgMatch = html.match(/"src":"(https:\/\/m\.media-amazon\.com\/images\/M\/[^"]+)"/);
      if (imgMatch) {
        // Clean up the URL (remove escape characters)
        let imageUrl = imgMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
        // Get the highest quality version
        imageUrl = imageUrl.replace(/\._V1_.*\.jpg/, '._V1_.jpg');
        return imageUrl;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching IMDb image:', error);
      return null;
    }
  };

  const handleCancelPassword = () => {
    setShowPasswordPrompt(false);
    setPassword("");
    setPasswordError("");
    setPendingAction(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto bg-background">
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
              <h2 className="text-3xl font-bold mb-2">{movie.title}</h2>
              
              <div className="flex items-center gap-4 text-gray-600 mb-4">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-4" />
                  <span className="text-sm">{movie.year}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Film className="size-4" />
                  <span className="text-sm">{movie.genre}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <span className="text-2xl">⭐</span>
                <span className="text-2xl font-bold">{movie.rating.toFixed(1)}</span>
                <span className="text-gray-500 text-sm">/ 10</span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Overview</h3>
              <p className="text-gray-700 leading-relaxed">
                {movie.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-500 mb-1">Release Year</p>
                <p className="font-medium">{movie.year}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Genre</p>
                <p className="font-medium">{movie.genre}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Rating</p>
                <p className="font-medium">{movie.rating.toFixed(1)} / 10</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">ID</p>
                <p className="font-medium">#{movie.id}</p>
              </div>
            </div>

            {/* Mark as Watched Button - Only show in To Watch view */}
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
            <div className="border-l pl-6 h-full">
              <h3 className="text-lg font-semibold mb-4">Comments</h3>
              
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
                  className="w-full bg-blue-600 hover:bg-blue-700"
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