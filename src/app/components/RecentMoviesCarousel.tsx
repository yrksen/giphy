import { Movie } from "./MovieCard";
import { Star } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Carousel3DSpinner } from "./Carousel3DSpinner";

interface RecentMoviesCarouselProps {
  movies: Movie[];
  onMovieClick?: (movie: Movie) => void;
  isDarkMode?: boolean;
}

export function RecentMoviesCarousel({ movies, onMovieClick, isDarkMode = false }: RecentMoviesCarouselProps) {
  // Get the 12 most recently added movies
  const recentMovies = movies.slice(0, 12);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(9);
  const [containerWidth, setContainerWidth] = useState('1424px');
  const containerRef = useRef<HTMLDivElement>(null);
  const [show3DSpinner, setShow3DSpinner] = useState(false);

  // Calculate how many tiles fit on screen
  useEffect(() => {
    const calculateVisibleCount = () => {
      if (window.innerWidth < 768) {
        setVisibleCount(4); // Mobile
        setContainerWidth('100%');
      } else {
        // Desktop: calculate based on actual container width
        const container = containerRef.current;
        if (!container) return;

        // Get the actual available width from the container
        const availableWidth = container.clientWidth;

        // Each tile is 140px + 16px gap = 156px total per tile
        const tileWidth = 156;
        const tilesCount = Math.floor(availableWidth / tileWidth);
        const count = Math.max(2, Math.min(12, tilesCount));
        setVisibleCount(count);

        // Set exact width to show complete tiles only: (tiles * 140px) + (gaps * 16px)
        const exactWidth = (count * 140) + ((count - 1) * 16);
        setContainerWidth(`${exactWidth}px`);
      }
    };

    // Delay initial calculation to ensure DOM is ready
    const timer = setTimeout(calculateVisibleCount, 100);

    // Watch for window resize
    window.addEventListener('resize', calculateVisibleCount);

    // Watch for parent container size changes (e.g., when sidebar expands/collapses)
    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleCount();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateVisibleCount);
      resizeObserver.disconnect();
    };
  }, []);

  // Auto-slide every 5 seconds for both mobile and desktop
  useEffect(() => {
    if (!recentMovies.length) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const maxIndex = recentMovies.length - visibleCount;
        if (prev >= maxIndex) {
          return 0;
        }
        return prev + 1;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [recentMovies.length, visibleCount]);

  if (!recentMovies.length) return null;

  return (
    <>
      {/* 3D Spinner Modal */}
      {show3DSpinner && (
        <Carousel3DSpinner
          movies={movies}
          onMovieClick={(movie) => {
            setShow3DSpinner(false);
            onMovieClick?.(movie);
          }}
          onClose={() => setShow3DSpinner(false)}
          isDarkMode={isDarkMode}
        />
      )}

      <div ref={containerRef} className="w-full">
        {/* Desktop: Dynamic number of movies based on screen width */}
        <div
          className="hidden md:block w-full overflow-hidden select-none"
          onDoubleClick={(e) => {
            e.preventDefault();
            setShow3DSpinner(true);
          }}
          title="Double-click for 3D view"
        >
          <div className="flex justify-center">
            <div className="relative overflow-hidden" style={{ width: containerWidth, maxWidth: '100%' }}>
              <div
                className="flex gap-4 transition-transform duration-700 ease-in-out"
                style={{
                  transform: `translateX(-${currentIndex * 156}px)`
                }}
              >
              {recentMovies.map((movie) => (
                <div
                  key={movie.id}
                  className="flex-shrink-0 w-[140px] rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-transparent hover:border-[#f99251] dark:hover:border-[#a64a11]"
                  onClick={() => onMovieClick?.(movie)}
                >
                  <img
                    src={movie.image}
                    alt={movie.title}
                    className="w-full h-[210px] object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

        {/* Mobile: Show 4 movies with horizontal sliding */}
        <div
          className="md:hidden py-1 select-none"
          onDoubleClick={(e) => {
            e.preventDefault();
            setShow3DSpinner(true);
          }}
          title="Double-click for 3D view"
        >
          <div className="relative overflow-hidden">
            <div
              className="flex gap-2 transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(calc(-${currentIndex} * (25% + 2px)))`
              }}
            >
            {recentMovies.map((movie) => (
              <div
                key={movie.id}
                className="flex-shrink-0 rounded-lg shadow overflow-hidden cursor-pointer"
                style={{ width: 'calc(25% - 6px)' }}
                onClick={() => onMovieClick?.(movie)}
              >
                <img
                  src={movie.image}
                  alt={movie.title}
                  className="w-full h-[155px] object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}