import { X, Shuffle } from "lucide-react";

interface TiredOfScrollingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRandomMovie: () => void;
  isDarkMode: boolean;
}

export function TiredOfScrollingModal({
  isOpen,
  onClose,
  onRandomMovie,
  isDarkMode
}: TiredOfScrollingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative max-w-md w-full rounded-[10px] p-6 shadow-xl bg-[#fdfaf8] dark:bg-[#18110c] border border-[rgba(208,115,57,0.25)] dark:border-[rgba(126,62,21,0.4)]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 transition-colors hover:opacity-70 text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] hover:text-[#d07339] dark:hover:text-[#c36a32]"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {/* Content */}
        <div className="text-center space-y-4">
          <div className="text-4xl mb-2">😴</div>
          <h2 className="text-2xl font-bold text-[#100b09] dark:text-[#f7f1ed]">Tired of scrolling?</h2>
          <p className="text-sm text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
            Let us pick a random movie for you!
          </p>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-[#eea77a] dark:border-[#7e3e15] bg-transparent text-[#d07339] dark:text-[#c36a32] hover:bg-[rgba(238,167,122,0.1)] dark:hover:bg-[rgba(126,62,21,0.2)] transition-colors"
            >
              Keep Scrolling
            </button>
            <button
              onClick={() => {
                onRandomMovie();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white transition-colors flex items-center justify-center gap-2"
            >
              <Shuffle className="size-4" />
              Surprise Me!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
