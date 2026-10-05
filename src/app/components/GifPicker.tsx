import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

interface GifResult {
  id: string;
  images: {
    fixed_height: { url: string; width: string; height: string };
    original: { url: string };
    fixed_height_small: { url: string };
  };
  title: string;
}

interface GifPickerProps {
  onSelect: (url: string) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export function GifPicker({ onSelect, onClose, isDarkMode }: GifPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const LIMIT = 20;

  const fetchGifs = useCallback(async (searchQuery: string, newOffset: number, append = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: String(LIMIT),
        offset: String(newOffset),
      });
      const res = await fetch(`${API_BASE_URL}/giphy/search?${params}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      const results: GifResult[] = data.data || [];
      setGifs((prev) => (append ? [...prev, ...results] : results));
      setHasMore(results.length === LIMIT);
    } catch (e) {
      console.error("GIF fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load trending on mount
  useEffect(() => {
    fetchGifs("", 0);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      fetchGifs(query, 0);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  const loadMore = () => {
    const next = offset + LIMIT;
    setOffset(next);
    fetchGifs(query, next, true);
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div
        ref={containerRef}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-[#fdfaf8] dark:bg-[#18110c] border border-[rgba(208,115,57,0.25)] dark:border-[rgba(126,62,21,0.4)]"
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.3)]">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]" />
            <input
              type="text"
              placeholder="Search GIFs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border bg-white dark:bg-[#120d09] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[rgba(247,241,237,0.8)] placeholder-[rgba(16,11,9,0.4)] dark:placeholder-[rgba(247,241,237,0.4)] focus:outline-none focus:ring-1 focus:ring-[#d07339]"
            />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[rgba(208,115,57,0.1)] transition-colors text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Label */}
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10px] font-medium tracking-widest uppercase text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]">
            {query ? `Results for "${query}"` : "Trending"}
          </span>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && gifs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#d07339] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[13px] text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]">
              No GIFs found
            </div>
          ) : (
            <>
              <div className="columns-3 gap-1.5 space-y-1.5">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => { onSelect(gif.images.original.url); onClose(); }}
                    className="w-full block rounded-lg overflow-hidden hover:opacity-80 hover:ring-2 hover:ring-[#d07339] transition-all"
                  >
                    <img
                      src={gif.images.fixed_height_small.url}
                      alt={gif.title}
                      className="w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-3 pb-2">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="px-4 py-1.5 text-[12px] font-medium rounded-lg border border-[#eea77a] dark:border-[#7e3e15] text-[#d07339] dark:text-[#c36a32] hover:bg-[rgba(238,167,122,0.1)] disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* GIPHY attribution */}
        <div className="flex items-center justify-center py-2 border-t border-[rgba(208,115,57,0.1)] dark:border-[rgba(126,62,21,0.2)]">
          <span className="text-[10px] text-[rgba(16,11,9,0.35)] dark:text-[rgba(247,241,237,0.35)]">Powered by GIPHY</span>
        </div>
      </div>
    </div>
  );
}
