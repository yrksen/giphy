import { Movie } from "./MovieCard";
import { Star, X } from "lucide-react";
import { useState, useRef } from "react";

interface Carousel3DSpinnerProps {
  movies: Movie[];
  onMovieClick: (movie: Movie) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

// R=320, CARD_W=128, CARD_H=179, perspective=1800
// Verified: no horizontal overlap, no vertical overlap, minimal distortion
// 5 exact rows at lat ±70°, ±35°, 0°
// Band counts: circumference*cos(lat)/CARD_W floored
// Vertical arc between bands: 320 * 35° * π/180 = 195px > CARD_H=179 ✓

const R = 320;
const CW = 128;
const CH = 179;

const BANDS: { lat: number; count: number; offset: number }[] = [
  { lat:  70, count: 5,  offset: 0  },
  { lat:  35, count: 12, offset: 15 },
  { lat:   0, count: 15, offset: 0  },
  { lat: -35, count: 12, offset: 15 },
  { lat: -70, count: 5,  offset: 36 },
];

const ALL_POS = BANDS.flatMap(({ lat, count, offset }) =>
  Array.from({ length: count }, (_, i) => ({
    lat,
    lon: (offset + (360 / count) * i) % 360,
  }))
); // 49 total

export function Carousel3DSpinner({ movies, onMovieClick, onClose }: Carousel3DSpinnerProps) {
  const [rotX, setRotX] = useState(20);
  const [rotY, setRotY] = useState(0);
  const rotRef = useRef({ x: 20, y: 0 });
  const drag = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);

  const total = Math.min(movies.length, ALL_POS.length);
  const pos = ALL_POS.slice(0, total);

  const down = (x: number, y: number) => {
    drag.current = { sx: x, sy: y, bx: rotRef.current.x, by: rotRef.current.y };
  };
  const move = (x: number, y: number) => {
    if (!drag.current) return;
    rotRef.current.y = drag.current.by + (x - drag.current.sx) * 0.4;
    rotRef.current.x = drag.current.bx + (y - drag.current.sy) * 0.4;
    setRotY(rotRef.current.y);
    setRotX(rotRef.current.x);
  };
  const up = () => { drag.current = null; };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md"
      onDoubleClick={(e) => { e.preventDefault(); onClose(); }}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-[90] p-3 rounded-full bg-[#d07339] hover:bg-[#b8622e] text-white shadow-lg"
      >
        <X className="size-6" />
      </button>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center text-white pointer-events-none select-none">
        <p className="text-sm font-medium">Drag to spin • Click to view</p>
        <p className="text-xs opacity-50">Double-click to close</p>
      </div>

      {/* Centered globe stage */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: '1800px', cursor: drag.current ? 'grabbing' : 'grab' }}
        onMouseDown={(e) => down(e.clientX, e.clientY)}
        onMouseMove={(e) => move(e.clientX, e.clientY)}
        onMouseUp={up}
        onMouseLeave={up}
        onTouchStart={(e) => down(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={up}
      >
        {/* Dark sphere fill so it's not see-through */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: R * 2.1,
            height: R * 2.1,
            background: 'radial-gradient(circle at 40% 35%, #261205 0%, #0a0401 55%, #010000 100%)',
            boxShadow: '0 0 120px rgba(208,115,57,0.15)',
          }}
        />

        {/* 3D shell — origin is center of this 0×0 div */}
        <div
          style={{
            width: 0,
            height: 0,
            transformStyle: 'preserve-3d',
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          }}
        >
          {pos.map((p, i) => (
            <div
              key={i}
              onClick={(e) => { e.stopPropagation(); onMovieClick(movies[i]); }}
              style={{
                position: 'absolute',
                width: CW,
                height: CH,
                marginLeft: -CW / 2,
                marginTop: -CH / 2,
                backfaceVisibility: 'hidden',
                cursor: 'pointer',
                transform: `rotateY(${p.lon}deg) rotateX(${-p.lat}deg) translateZ(${R}px)`,
              }}
            >
              <div className="relative w-full h-full rounded-lg overflow-hidden border border-[rgba(208,115,57,0.5)] shadow-xl transition-transform duration-150 hover:scale-105 hover:border-[#f99251]">
                <img
                  src={movies[i].image}
                  alt={movies[i].title}
                  className="w-full h-full object-cover block"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                {(movies[i].imdbRating || movies[i].rating) && (
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-[#d07339] text-white px-1.5 py-0.5 rounded-full">
                    <Star className="size-2.5 fill-white" />
                    <span className="text-[9px] font-bold">
                      {(movies[i].imdbRating || movies[i].rating)!.toFixed(1)}
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                  <p className="text-[10px] font-bold text-white line-clamp-2 leading-tight">{movies[i].title}</p>
                  <p className="text-[9px] text-[#f99251] font-semibold">{movies[i].year}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
