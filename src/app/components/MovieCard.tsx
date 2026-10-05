import { Star, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createSlug } from "../utils/slugify";

export interface Movie {
  id: number;
  title: string;
  year: number;
  genre: string;
  rating: number;
  image: string;
  description: string;
  imdbRating?: number;
  director?: string;
  cast?: string[];
  runtime?: string;
  plot?: string;
  imdbId?: string;
  trailer?: string;
  userRating?: number;
  tags?: string[];
  communityRating?: number;
  ratingCount?: number;
  dateAdded?: number;
}

interface MovieCardProps {
  movie: Movie;
  onClick?: () => void;
  onDelete?: (id: number) => void;
}

export function MovieCard({ movie, onClick, onDelete }: MovieCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/movie/${createSlug(movie.title, movie.year)}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete && window.confirm(`Delete "${movie.title}"?`)) {
      onDelete(movie.id);
    }
  };

  return (
    <div
      className="flex flex-col rounded-[10px] overflow-hidden transition-all duration-300 cursor-pointer relative group border border-transparent hover:border-[#f99251] md:border-transparent md:hover:border-[#f99251] dark:hover:border-[#a64a11] bg-white dark:bg-[#18110c] hover:scale-[1.02]"
      style={{
        boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        transition: 'box-shadow 0.3s, transform 0.3s, border 0.3s'
      }}
      onMouseEnter={(e) => {
        const isDark = document.documentElement.classList.contains('dark');
        e.currentTarget.style.boxShadow = isDark ? '0 10px 30px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        const isDark = document.documentElement.classList.contains('dark');
        e.currentTarget.style.boxShadow = isDark ? '0 2px 10px rgba(0,0,0,0.06)' : '0 4px 14px rgba(0,0,0,0.08)';
      }}
      onClick={handleCardClick}
    >
      {/* Only render delete button when onDelete is provided (admin/moderator) */}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          aria-label="Delete movie"
        >
          <Trash2 className="size-4" />
        </button>
      )}

      <div className="relative w-full aspect-[2/3] overflow-hidden bg-black">
        <img
          src={movie.image}
          alt={movie.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="p-1.5 md:p-3 flex flex-col gap-1 md:gap-1.5">
        <h3 title={movie.title} className="font-medium text-[11px] leading-tight line-clamp-2 md:line-clamp-1 text-[#100b09] dark:text-[#f7f1ed]">{movie.title}</h3>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 leading-none">
            <span className="text-[11px] text-[rgba(16,11,9,0.8)] dark:text-[rgba(247,241,237,0.8)] leading-none">{(movie.imdbRating || movie.rating).toFixed(1)}</span>
            <Star className="size-3 fill-[#f99251] text-[#f99251] dark:fill-[#a64a11] dark:text-[#a64a11] flex-shrink-0" />
          </div>
          {movie.userRating && movie.userRating > 0 && (
            <div className="flex items-center gap-1 leading-none">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 leading-none">{movie.userRating}</span>
              <Star className="size-3 fill-blue-600 text-blue-600 dark:fill-blue-400 dark:text-blue-400 flex-shrink-0" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] leading-normal">
          {movie.runtime && (
            <>
              <span>{movie.runtime}</span>
              <span>•</span>
            </>
          )}
          <span>{movie.year}</span>
        </div>

        {movie.genre && (() => {
          const genres = movie.genre.split(',').map(g => g.trim()).filter(Boolean);
          return (
            <div className="flex items-center gap-1">
              <span className="text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-[#d07339] dark:bg-[#c36a32] text-white truncate">
                {genres[0]}
              </span>
              {genres.length > 1 && (
                <span className="flex-shrink-0 text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-[#d07339]/50 dark:bg-[#c36a32]/50 text-white">
                  +{genres.length - 1}
                </span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
