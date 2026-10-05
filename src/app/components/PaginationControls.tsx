import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./ui/button";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "mobile" | "desktop";
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  variant = "desktop"
}: PaginationControlsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to show current page centered
  useEffect(() => {
    if (variant === "mobile" && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const pageButton = container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement;
      
      if (pageButton) {
        // Use requestAnimationFrame to ensure DOM is fully rendered
        requestAnimationFrame(() => {
          const containerRect = container.getBoundingClientRect();
          const buttonRect = pageButton.getBoundingClientRect();
          
          // Calculate how much to scroll to center the button
          const buttonCenter = buttonRect.left + buttonRect.width / 2;
          const containerCenter = containerRect.left + containerRect.width / 2;
          const scrollOffset = buttonCenter - containerCenter;
          
          container.scrollTo({ 
            left: container.scrollLeft + scrollOffset, 
            behavior: 'smooth' 
          });
        });
      }
    }
  }, [currentPage, variant]);

  // Generate page range for desktop (sliding window)
  const getPageRange = () => {
    const maxVisible = 7; // Show 7 pages at most
    
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfVisible = Math.floor(maxVisible / 2);
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    // Adjust if we're near the end
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // When clicking on edges, shift the window to reveal 3 more pages
    if (currentPage === endPage && endPage < totalPages) {
      const shift = Math.min(3, totalPages - endPage);
      startPage = Math.min(startPage + shift, totalPages - maxVisible + 1);
      endPage = Math.min(endPage + shift, totalPages);
    } else if (currentPage === startPage && startPage > 1) {
      const shift = Math.min(3, startPage - 1);
      startPage = Math.max(startPage - shift, 1);
      endPage = Math.max(endPage - shift, maxVisible);
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  };

  if (variant === "mobile") {
    return (
      <div className="mt-6 flex items-center justify-center gap-2">
        {/* Skip to First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-[#eea77a] text-[#100b09] hover:bg-[#f99251] dark:border-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsLeft className="size-4" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-[#eea77a] text-[#100b09] hover:bg-[#f99251] dark:border-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Scrollable Page Numbers */}
        <div ref={scrollContainerRef} className="flex-1 overflow-x-auto scroll-smooth scrollbar-hide">
          <div className="flex items-center gap-1 px-2 min-w-max">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                data-page={page}
                onClick={() => onPageChange(page)}
                className={`h-8 px-3 flex-shrink-0 rounded-lg text-xs font-mono transition-colors ${
                  page === currentPage
                    ? 'bg-[#d07339] text-white dark:bg-[#c36a32]'
                    : 'bg-transparent border border-[#eea77a] text-[#100b09] dark:text-[#f7f1ed] dark:border-[#7e3e15] hover:bg-[#eea77a]/30 dark:hover:bg-[rgba(126,62,21,0.3)]'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-[#eea77a] text-[#100b09] hover:bg-[#f99251] dark:border-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>

        {/* Skip to Last Page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-[#eea77a] text-[#100b09] hover:bg-[#f99251] dark:border-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronsRight className="size-4" />
        </button>
      </div>
    );
  }

  // Desktop variant
  const pageRange = getPageRange();
  const showFirstEllipsis = pageRange[0] > 1;
  const showLastEllipsis = pageRange[pageRange.length - 1] < totalPages;

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#eea77a] text-[#100b09] hover:bg-[#f99251] dark:border-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="size-4" />
      </button>

      <div className="flex items-center gap-1">
        {showFirstEllipsis && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="h-8 px-3 rounded-lg text-xs font-mono transition-colors bg-transparent border border-[#eea77a] text-[#100b09] dark:text-[#f7f1ed] dark:border-[#7e3e15] hover:bg-[#eea77a]/30 dark:hover:bg-[rgba(126,62,21,0.3)]"
            >
              1
            </button>
            <span className="px-2 text-[#eea77a] dark:text-[#7e3e15]">...</span>
          </>
        )}

        {pageRange.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`h-8 px-3 rounded-lg text-xs font-mono transition-colors ${
              page === currentPage
                ? 'bg-[#d07339] text-white dark:bg-[#c36a32]'
                : 'bg-transparent border border-[#eea77a] text-[#100b09] dark:text-[#f7f1ed] dark:border-[#7e3e15] hover:bg-[#eea77a]/30 dark:hover:bg-[rgba(126,62,21,0.3)]'
            }`}
          >
            {page}
          </button>
        ))}

        {showLastEllipsis && (
          <>
            <span className="px-2 text-[#eea77a] dark:text-[#7e3e15]">...</span>
            <button
              onClick={() => onPageChange(totalPages)}
              className="h-8 px-3 rounded-lg text-xs font-mono transition-colors bg-transparent border border-[#eea77a] text-[#100b09] dark:text-[#f7f1ed] dark:border-[#7e3e15] hover:bg-[#eea77a]/30 dark:hover:bg-[rgba(126,62,21,0.3)]"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#eea77a] text-[#100b09] hover:bg-[#f99251] dark:border-[#7e3e15] dark:text-[#f7f1ed] dark:hover:bg-[rgba(126,62,21,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}