import React, { useEffect, useState } from "react";
import { X, User, MessageCircle, Image } from "lucide-react";
import type { Movie } from "./MovieCard";
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

interface Comment {
  id: string | number;
  movieId: number;
  username: string;
  text: string;
  timestamp: number;
  profilePicture?: string;
  imageUrl?: string;
  parentId?: number;
}

interface AllCommentsModalProps {
  comments: Comment[];
  movies: Movie[];
  onCommentClick: (movie: Movie) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export function AllCommentsModal({ comments: initialComments, movies, onCommentClick, onClose, isDarkMode }: AllCommentsModalProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch fresh comments when modal opens
  useEffect(() => {
    const loadComments = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/comments`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        const data = await response.json();
        setComments(data.comments || []);
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadComments();
  }, []);

  const sorted = [...comments].sort((a, b) => b.timestamp - a.timestamp);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-[#fdfaf8] dark:bg-[#18110c] border border-[rgba(208,115,57,0.25)] dark:border-[rgba(126,62,21,0.4)]" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.3)]">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-[#d07339] dark:text-[#c36a32]" />
            <h2 className="text-sm font-bold text-[#100b09] dark:text-[#f7f1ed]">All Comments</h2>
            <span className="text-[11px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">({sorted.length})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[rgba(208,115,57,0.1)] transition-colors text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-[13px] text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]">
              Loading comments...
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[13px] text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]">
              No comments yet
            </div>
          ) : (
            sorted.map((comment) => {
              const movie = movies.find(m => m.id === comment.movieId);
              if (!movie) return null;

              const words = (comment.text || '').split(' ').filter(Boolean);
              const displayText = words.length > 10
                ? words.slice(0, 10).join(' ') + '…'
                : comment.text || '';

              return (
                <button
                  key={comment.id}
                  onClick={() => { onCommentClick(movie); onClose(); }}
                  className="w-full text-left p-3 rounded-xl border border-[rgba(208,115,57,0.12)] dark:border-[rgba(126,62,21,0.2)] bg-[rgba(238,167,122,0.06)] dark:bg-[rgba(126,62,21,0.06)] hover:bg-[rgba(238,167,122,0.15)] dark:hover:bg-[rgba(126,62,21,0.15)] transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-[rgba(208,115,57,0.15)] dark:bg-[rgba(126,62,21,0.3)]">
                      {comment.profilePicture ? (
                        <img src={comment.profilePicture} alt={comment.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <User className="size-3.5 text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span className="text-[12px] font-semibold text-[#100b09] dark:text-[#f7f1ed] truncate">{comment.username}</span>
                        <span className="text-[10px] text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] shrink-0">
                          {new Date(comment.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-[#d07339] dark:text-[#c36a32] truncate mb-0.5">{movie.title} ({movie.year})</p>
                      {displayText ? (
                        <p className="text-[12px] text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)] leading-snug">{displayText}</p>
                      ) : comment.imageUrl ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)]">
                          <Image className="size-3" />image/GIF
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
