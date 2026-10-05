import { Separator } from "./ui/separator";
import { Check, Sparkles, MessageCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import type { Movie } from "./MovieCard";
import type { Comment } from "./MovieDetailDialog";

interface FilterSidebarProps {
  selectedGenres: string[];
  selectedYears: number[];
  onGenreChange: (genre: string, checked: boolean) => void;
  onClearGenres?: () => void;
  onClearYears?: () => void;
  onYearChange: (year: number, checked: boolean) => void;
  onTryMyLuck?: () => void;
  comments?: Comment[];
  movies?: Movie[];
  allMovies?: Movie[];
  onCommentClick?: (movie: Movie) => void;
  onViewAllComments?: () => void;
  imdbRatingRange?: [number, number];
  onImdbRatingChange?: (range: [number, number]) => void;
  runtimeFilter?: string;
  onRuntimeChange?: (runtime: string) => void;
  selectedTags?: string[];
  onTagChange?: (tag: string, checked: boolean) => void;
  allTags?: string[];
  availableYears?: number[];
  isExpanded?: boolean;
  onToggle?: () => void;
}

const genres = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Short",
  "Sport",
  "Thriller",
  "War",
];

// Generate years from 2025 to 1970
const years = Array.from({ length: 2025 - 1970 + 1 }, (_, i) => 2025 - i);

export function FilterSidebar({
  selectedGenres,
  selectedYears,
  onGenreChange,
  onClearGenres,
  onClearYears,
  onYearChange,
  onTryMyLuck,
  comments,
  movies,
  allMovies,
  onCommentClick,
  onViewAllComments,
  imdbRatingRange,
  onImdbRatingChange,
  runtimeFilter,
  onRuntimeChange,
  selectedTags,
  onTagChange,
  allTags,
  availableYears,
  isExpanded = true,
  onToggle,
}: FilterSidebarProps) {
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

  // Use availableYears if provided, otherwise use the default range
  const displayYears = availableYears && availableYears.length > 0 ? availableYears : years;

  return (
    <aside
      className={`relative transition-all duration-300 ease-in-out h-full bg-[#fbf3ee] dark:bg-[#120d09] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] overflow-hidden ${
        isExpanded ? 'w-full md:w-[211px] p-6 md:p-4' : 'w-0 md:w-12 p-0 md:p-2'
      }`}
    >
      {/* Filters header row: Label + Toggle button - desktop only */}
      <div className={`hidden md:flex items-center ${isExpanded ? 'justify-between mb-6' : 'justify-center'}`}>
        {isExpanded && (
          <h2 className="text-sm font-bold tracking-tight text-[#d07339] dark:text-[#c36a32]">Filters</h2>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white shadow-sm transition-colors flex-shrink-0"
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      <div className={`transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 md:hidden'}`}>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#d07339] dark:text-[#c36a32]">Year</h3>
          {selectedYears.length > 0 && onClearYears && (
            <button
              onClick={onClearYears}
              className="text-[10px] text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] hover:text-[#d07339] dark:hover:text-[#c36a32] transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
            className="w-full px-3 py-2 text-xs text-left border-2 rounded-md bg-[#fdfaf8] dark:bg-[#18110c] text-[#100b09] dark:text-[rgba(247,241,237,0.7)] border-[#eea77a] dark:border-[#7e3e15] hover:bg-[rgba(238,167,122,0.15)] dark:hover:bg-[rgba(126,62,21,0.2)] transition-colors"
          >
            {selectedYears.length > 0
              ? `${selectedYears.length} year${selectedYears.length > 1 ? 's' : ''} selected`
              : 'Select years'}
          </button>

          {isYearDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsYearDropdownOpen(false)}
              />
              <div className="absolute z-20 mt-1 w-full bg-[#fdfaf8] dark:bg-[#18110c] border border-[#eea77a] dark:border-[#7e3e15] rounded-md shadow-lg max-h-[220px] overflow-y-auto overflow-x-hidden p-2" style={{ scrollbarWidth: 'thin' }}>
                {displayYears.map((year) => {
                  const isSelected = selectedYears.includes(year);
                  return (
                    <button
                      key={year}
                      onClick={() => onYearChange(year, !isSelected)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded transition-colors mb-0.5 ${
                        isSelected
                          ? 'bg-[#eea77a] text-[#100b09] dark:bg-[#7e3e15] dark:text-[#f7f1ed]'
                          : 'text-[#100b09] dark:text-[rgba(247,241,237,0.7)] hover:bg-[rgba(238,167,122,0.35)] dark:hover:bg-[rgba(126,62,21,0.35)]'
                      }`}
                    >
                      <span>{year}</span>
                      {isSelected && <Check className="size-3 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <Separator className="my-6 dark:bg-gray-600" />

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#d07339] dark:text-[#c36a32]">Genre</h3>
          {onClearGenres && selectedGenres.length > 0 && (
            <button
              onClick={onClearGenres}
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Clear all genres"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => onGenreChange(genre, !selectedGenres.includes(genre))}
              className={`text-xs text-left transition-colors py-1 px-2 rounded-md ${
                selectedGenres.includes(genre)
                  ? "bg-[#eea77a] text-[#100b09] border-l-[3px] border-[#d07339] pl-[7px] dark:bg-[#7e3e15] dark:text-[#f7f1ed] dark:border-[#c36a32]"
                  : "text-[#100b09] dark:text-[rgba(247,241,237,0.7)] hover:bg-[rgba(238,167,122,0.35)] dark:hover:bg-[rgba(126,62,21,0.35)]"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* IMDb Rating Range Filter */}
      {onImdbRatingChange && imdbRatingRange && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 text-[#d07339] dark:text-[#c36a32]">IMDb Rating</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>{imdbRatingRange[0].toFixed(1)} - {imdbRatingRange[1].toFixed(1)}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>From</span>
                  <span>{imdbRatingRange[0].toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={imdbRatingRange[0]}
                  onChange={(e) => {
                    const newMin = parseFloat(e.target.value);
                    const newMax = Math.max(newMin, imdbRatingRange[1]);
                    onImdbRatingChange([newMin, newMax]);
                  }}
                  className="w-full accent-[#d07339] dark:accent-[#c36a32]"
                />
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>To</span>
                  <span>{imdbRatingRange[1].toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={imdbRatingRange[1]}
                  onChange={(e) => {
                    const newMax = parseFloat(e.target.value);
                    const newMin = Math.min(imdbRatingRange[0], newMax);
                    onImdbRatingChange([newMin, newMax]);
                  }}
                  className="w-full accent-[#d07339] dark:accent-[#c36a32]"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Runtime Filter */}
      {onRuntimeChange && runtimeFilter !== undefined && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 text-[#d07339] dark:text-[#c36a32]">Runtime</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('short')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'short' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Short (≤ 90 min)
                </button>
                {runtimeFilter === 'short' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('medium')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'medium' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Medium (90-150 min)
                </button>
                {runtimeFilter === 'medium' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('long')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'long' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Long (≥ 150 min)
                </button>
                {runtimeFilter === 'long' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('oneSeason')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'oneSeason' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  1 Season
                </button>
                {runtimeFilter === 'oneSeason' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('multiSeason')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'multiSeason' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Multi-Season
                </button>
                {runtimeFilter === 'multiSeason' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tag Filter */}
      {onTagChange && allTags && allTags.length > 0 && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 text-[#d07339] dark:text-[#c36a32]">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagChange(tag, !selectedTags?.includes(tag))}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${
                    selectedTags?.includes(tag)
                      ? 'bg-[#eea77a] text-[#100b09] border-2 border-[#d07339] font-medium dark:bg-[#7e3e15] dark:text-[#f7f1ed] dark:border-[#c36a32]'
                      : 'bg-[rgba(238,167,122,0.15)] text-[#100b09] border border-[#eea77a] dark:bg-[rgba(126,62,21,0.15)] dark:text-[rgba(247,241,237,0.7)] dark:border-[#7e3e15] hover:bg-[rgba(238,167,122,0.35)] dark:hover:bg-[rgba(126,62,21,0.35)]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top Rated Section */}
      {movies && movies.length > 0 && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider mb-3 text-[#d07339] dark:text-[#c36a32]">Top Rated (Your Ratings)</h3>
            <div className="space-y-2">
              {movies
                .filter(m => m.userRating && m.userRating > 0)
                .sort((a, b) => (b.userRating || 0) - (a.userRating || 0))
                .slice(0, 5)
                .map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => onCommentClick && onCommentClick(movie)}
                    className="w-full text-left bg-[rgba(238,167,122,0.15)] dark:bg-[rgba(126,62,21,0.15)] hover:bg-[rgba(238,167,122,0.3)] dark:hover:bg-[rgba(126,62,21,0.3)] p-2 rounded-lg border border-[#eea77a] dark:border-[#7e3e15] transition-colors"
                  >
                    <p className="text-xs font-semibold text-[#100b09] dark:text-[#f7f1ed] line-clamp-1">
                      {movie.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-[#d07339] dark:text-[#f99251] font-bold">★ {movie.userRating}</span>
                      <span className="text-xs text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">({movie.year})</span>
                    </div>
                  </button>
                ))}
              {movies.filter(m => m.userRating && m.userRating > 0).length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No rated movies yet</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Recent Comments Section */}
      {comments && movies && onCommentClick && comments.length > 0 && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#d07339] dark:text-[#c36a32]">Recent Comments</h3>
              {onViewAllComments && (
                <button
                  onClick={onViewAllComments}
                  className="text-[10px] font-medium text-[#d07339] dark:text-[#c36a32] hover:underline transition-opacity hover:opacity-70"
                >
                  View all
                </button>
              )}
            </div>
            <div className="space-y-3">
              {comments
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 5)
                .map((comment) => {
                  const moviePool = allMovies || movies || [];
                  const movie = moviePool.find(m => Number(m.id) === Number(comment.movieId));
                  if (!movie) return null;
                  
                  // Truncate comment to first 6 words if longer
                  const words = comment.text.split(' ');
                  const displayText = words.length > 6 
                    ? words.slice(0, 6).join(' ') + '...'
                    : comment.text;
                  
                  return (
                    <button
                      key={comment.id}
                      onClick={() => onCommentClick(movie)}
                      className="w-full text-left bg-[rgba(238,167,122,0.15)] dark:bg-[rgba(126,62,21,0.15)] hover:bg-[rgba(238,167,122,0.3)] dark:hover:bg-[rgba(126,62,21,0.3)] p-3 rounded-lg border border-[#eea77a] dark:border-[#7e3e15] transition-colors"
                    >
                      <p className="text-xs font-semibold text-[#100b09] dark:text-[#f7f1ed] mb-1">
                        {movie.title} - {movie.year}
                      </p>
                      <p className="text-xs text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)] mb-2">
                        {displayText}
                      </p>
                      <div className="flex items-center justify-between text-xs text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">
                        <span>{comment.username}</span>
                        <span>
                          {new Date(comment.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
      </div>
    </aside>
  );
}