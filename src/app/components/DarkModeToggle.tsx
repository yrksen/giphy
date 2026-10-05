import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

interface DarkModeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function DarkModeToggle({ isDark, onToggle }: DarkModeToggleProps) {
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center transition-colors text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] hover:text-[#d07339] dark:hover:text-[#c36a32]"
      style={{ width: 20, height: 20 }}
      aria-label="Toggle dark mode"
    >
      {isDark ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </button>
  );
}
