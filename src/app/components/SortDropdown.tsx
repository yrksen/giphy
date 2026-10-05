import { ArrowUpDown, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export type SortOption = 'dateAdded' | 'dateAddedLatest' | 'title' | 'titleDesc' | 'year' | 'imdbRating' | 'userRating' | 'communityRating';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'dateAdded', label: 'Date Added (Newest)' },
    { value: 'dateAddedLatest', label: 'Date Added (Latest)' },
    { value: 'title', label: 'Title (A-Z)' },
    { value: 'titleDesc', label: 'Title (Z-A)' },
    { value: 'year', label: 'Year' },
    { value: 'imdbRating', label: 'IMDb Rating' },
    { value: 'communityRating', label: 'Community Rating' },
    { value: 'userRating', label: 'Your Rating' },
  ];

  const currentLabel = sortOptions.find(opt => opt.value === value)?.label || 'Sort by';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 h-10 bg-transparent border border-[#eea77a] dark:border-[#7e3e15] rounded-lg hover:bg-[rgba(238,167,122,0.1)] dark:hover:bg-[rgba(126,62,21,0.2)] transition-colors text-sm font-medium text-[#d07339] dark:text-[#c36a32]"
      >
        <ArrowUpDown className="size-4" />
        <span className="hidden md:inline">{currentLabel}</span>
        <span className="md:hidden">Sort</span>
        <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-[#fdfaf8] dark:bg-[#18110c] border border-[#eea77a] dark:border-[#7e3e15] rounded-lg shadow-lg z-50 overflow-hidden">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                value === option.value
                  ? 'bg-[rgba(208,115,57,0.12)] dark:bg-[rgba(195,106,50,0.15)] text-[#d07339] dark:text-[#c36a32] font-semibold'
                  : 'text-[#100b09] dark:text-[rgba(247,241,237,0.8)] hover:bg-[rgba(208,115,57,0.07)] dark:hover:bg-[rgba(195,106,50,0.1)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}