import { useState, useRef, useCallback } from "react";
import { X, Upload, ImageIcon, Loader2, CheckSquare, Square, Plus } from "lucide-react";
import { Movie } from "./MovieCard";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;
const PLACEHOLDER = "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMovies: (movies: Movie[]) => void;
  existingMovies: Movie[];
  isDarkMode: boolean;
}

interface DetectedMovie {
  title: string;
  year: number;
  imdbId: string;
  imdbUrl: string;
  poster: string | null;
  rating: number;
  imdbRating: number;
  genre: string;
  director?: string;
  cast: string[];
  plot?: string;
  runtime?: string;
  selected: boolean;
  alreadyExists: boolean;
}

export function BulkImportModal({ isOpen, onClose, onAddMovies, existingMovies, isDarkMode }: BulkImportModalProps) {
  const [stage, setStage] = useState<"upload" | "detecting" | "results" | "adding">("upload");
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedMovie[]>([]);
  const [titlesExtracted, setTitlesExtracted] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [addProgress, setAddProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStage("upload");
    setPreviewUrl(null);
    setDetected([]);
    setTitlesExtracted([]);
    setError("");
    setAddProgress({ done: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => { resetState(); onClose(); };

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please upload an image file."); return; }
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) processFile(file);
    }
  }, [processFile]);

  const detectMovies = async () => {
    if (!previewUrl) return;
    setStage("detecting");
    setError("");
    try {
      const res = await fetch(`${API}/extract-movies-from-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({ image: previewUrl }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Detection failed. Make sure OPENAI_API_KEY is set in Supabase secrets.");
        setStage("upload");
        return;
      }
      setTitlesExtracted(data.titlesExtracted || []);
      const movies: DetectedMovie[] = (data.movies || []).map((m: any) => ({
        ...m,
        selected: true,
        alreadyExists: existingMovies.some(
          e => e.title.toLowerCase() === m.title.toLowerCase() && e.year === m.year
        ),
      }));
      setDetected(movies);
      setStage("results");
    } catch (err) {
      setError("Network error. Please try again.");
      setStage("upload");
    }
  };

  const toggleSelect = (idx: number) => {
    setDetected(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m));
  };

  const selectAll = () => setDetected(prev => prev.map(m => ({ ...m, selected: !m.alreadyExists })));
  const deselectAll = () => setDetected(prev => prev.map(m => ({ ...m, selected: false })));

  const addSelected = async () => {
    const toAdd = detected.filter(m => m.selected && !m.alreadyExists);
    if (toAdd.length === 0) return;
    setStage("adding");
    setAddProgress({ done: 0, total: toAdd.length });

    const maxId = existingMovies.length > 0 ? Math.max(...existingMovies.map(m => m.id)) : 0;
    const newMovies: Movie[] = toAdd.map((m, i) => ({
      id: maxId + i + 1,
      title: m.title,
      year: m.year,
      genre: m.genre || "Drama",
      rating: m.rating || 7.0,
      imdbRating: m.imdbRating || 0,
      image: m.poster || PLACEHOLDER,
      description: m.plot || "No description available.",
      plot: m.plot,
      runtime: m.runtime,
      imdbId: m.imdbId,
      director: m.director,
      cast: m.cast,
      dateAdded: Date.now() + i,
    }));

    for (let i = 0; i < newMovies.length; i++) {
      onAddMovies([newMovies[i]]);
      setAddProgress({ done: i + 1, total: newMovies.length });
      await new Promise(r => setTimeout(r, 100));
    }

    handleClose();
  };

  if (!isOpen) return null;

  const dark = isDarkMode;
  const bg = dark ? "bg-[#18110c]" : "bg-[#fdfaf8]";
  const border = dark ? "border-[rgba(126,62,21,0.4)]" : "border-[rgba(208,115,57,0.25)]";
  const heading = dark ? "text-[#f7f1ed]" : "text-[#100b09]";
  const sub = dark ? "text-[rgba(247,241,237,0.6)]" : "text-[rgba(16,11,9,0.6)]";
  const accent = "#d07339";
  const selectedCount = detected.filter(m => m.selected && !m.alreadyExists).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onPaste={handlePaste}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[12px] shadow-2xl border ${bg} ${border}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${border}`}>
          <div>
            <h2 className={`text-base font-bold ${heading}`}>Bulk Import from Image</h2>
            <p className={`text-[12px] mt-0.5 ${sub}`}>Upload a screenshot of movie tabs, a poster collage, or any image with movie titles</p>
          </div>
          <button onClick={handleClose} className={`${sub} hover:text-[${accent}] transition-colors`}><X className="size-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* UPLOAD STAGE */}
          {stage === "upload" && (
            <div className="flex flex-col gap-4">
              {/* Drop zone */}
              <div
                className={`relative border-2 border-dashed rounded-[10px] p-8 text-center transition-all cursor-pointer ${
                  dragOver
                    ? "border-[#d07339] bg-[rgba(208,115,57,0.08)]"
                    : dark ? "border-[rgba(126,62,21,0.4)] hover:border-[#7e3e15]" : "border-[rgba(208,115,57,0.3)] hover:border-[#d07339]"
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {previewUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={previewUrl} alt="Preview" className="max-h-48 max-w-full object-contain rounded-lg border border-[rgba(208,115,57,0.2)]" />
                    <p className={`text-[12px] ${sub}`}>Click to change image</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <ImageIcon className="size-12 opacity-30" style={{ color: accent }} />
                    <div>
                      <p className={`text-[14px] font-medium ${heading}`}>Drop image here, click to browse, or paste (Ctrl+V)</p>
                      <p className={`text-[12px] mt-1 ${sub}`}>Screenshots of movie apps, poster grids, watchlists — anything with titles works</p>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[12px]">
                  {error}
                  {error.includes("OPENAI_API_KEY") && (
                    <p className="mt-1 font-mono text-[11px] opacity-70">Run: supabase secrets set OPENAI_API_KEY=sk-...</p>
                  )}
                </div>
              )}

              <button
                onClick={detectMovies}
                disabled={!previewUrl}
                className={`w-full py-3 rounded-[8px] text-[13px] font-semibold text-white transition-all ${previewUrl ? "bg-[#d07339] hover:bg-[#b8622e] cursor-pointer" : "bg-[rgba(208,115,57,0.3)] cursor-not-allowed"}`}
              >
                Detect Movies from Image
              </button>
            </div>
          )}

          {/* DETECTING STAGE */}
          {stage === "detecting" && (
            <div className="flex flex-col items-center gap-6 py-12">
              <Loader2 className="size-12 animate-spin" style={{ color: accent }} />
              <div className="text-center">
                <p className={`text-[15px] font-semibold ${heading}`}>Analyzing image…</p>
                <p className={`text-[13px] mt-1 ${sub}`}>GPT-4o Vision is reading movie titles, then fetching data from OMDb</p>
              </div>
            </div>
          )}

          {/* RESULTS STAGE */}
          {stage === "results" && (
            <div className="flex flex-col gap-4">
              {/* Summary */}
              <div className={`flex items-center justify-between text-[12px] ${sub}`}>
                <span>Found <strong className={heading}>{detected.length}</strong> movies from {titlesExtracted.length} detected titles</span>
                <div className="flex gap-2">
                  <button onClick={selectAll} className={`px-2 py-1 rounded text-[11px] border ${dark ? "border-[rgba(126,62,21,0.4)] hover:bg-[rgba(126,62,21,0.2)]" : "border-[rgba(208,115,57,0.3)] hover:bg-[rgba(208,115,57,0.08)]"} ${heading} transition-colors`}>Select all</button>
                  <button onClick={deselectAll} className={`px-2 py-1 rounded text-[11px] border ${dark ? "border-[rgba(126,62,21,0.4)] hover:bg-[rgba(126,62,21,0.2)]" : "border-[rgba(208,115,57,0.3)] hover:bg-[rgba(208,115,57,0.08)]"} ${heading} transition-colors`}>None</button>
                  <button onClick={() => { resetState(); }}
                    className={`px-2 py-1 rounded text-[11px] border ${dark ? "border-[rgba(126,62,21,0.4)] hover:bg-[rgba(126,62,21,0.2)]" : "border-[rgba(208,115,57,0.3)] hover:bg-[rgba(208,115,57,0.08)]"} ${heading} transition-colors`}>
                    Try another image
                  </button>
                </div>
              </div>

              {detected.length === 0 && (
                <div className={`text-center py-8 ${sub} text-[13px]`}>
                  No movies could be identified. Try a clearer screenshot or an image with visible text titles.
                </div>
              )}

              {/* Movie list */}
              <div className="flex flex-col gap-2">
                {detected.map((m, idx) => (
                  <button
                    key={m.imdbId || idx}
                    onClick={() => !m.alreadyExists && toggleSelect(idx)}
                    className={`flex items-center gap-3 p-3 rounded-[8px] border text-left transition-all ${
                      m.alreadyExists
                        ? dark ? "border-[rgba(126,62,21,0.2)] opacity-40 cursor-not-allowed" : "border-[rgba(208,115,57,0.1)] opacity-40 cursor-not-allowed"
                        : m.selected
                          ? dark ? "border-[#c36a32] bg-[rgba(195,106,50,0.12)]" : "border-[#d07339] bg-[rgba(208,115,57,0.08)]"
                          : dark ? "border-[rgba(126,62,21,0.3)] hover:border-[rgba(126,62,21,0.5)]" : "border-[rgba(208,115,57,0.2)] hover:border-[rgba(208,115,57,0.4)]"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      {m.alreadyExists
                        ? <CheckSquare className="size-4 opacity-30" />
                        : m.selected
                          ? <CheckSquare className="size-4" style={{ color: accent }} />
                          : <Square className="size-4 opacity-40" />
                      }
                    </div>
                    {/* Poster */}
                    <img
                      src={m.poster || PLACEHOLDER}
                      alt={m.title}
                      className="w-9 h-[54px] object-cover rounded flex-shrink-0 border border-[rgba(208,115,57,0.15)]"
                    />
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold ${heading} truncate`}>{m.title}</p>
                      <p className={`text-[11px] ${sub}`}>{m.year}{m.genre ? ` · ${m.genre.split(",")[0]}` : ""}{m.rating ? ` · ★ ${m.rating.toFixed(1)}` : ""}</p>
                      {m.alreadyExists && <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Already in collection</p>}
                    </div>
                    {/* IMDb link */}
                    {m.imdbUrl && (
                      <a
                        href={m.imdbUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className={`text-[10px] px-2 py-1 rounded flex-shrink-0 ${dark ? "bg-[rgba(126,62,21,0.3)] text-[rgba(247,241,237,0.6)] hover:text-[#c36a32]" : "bg-[rgba(208,115,57,0.1)] text-[rgba(16,11,9,0.5)] hover:text-[#d07339]"} transition-colors`}
                      >
                        IMDb
                      </a>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ADDING STAGE */}
          {stage === "adding" && (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="w-16 h-16 relative">
                <Loader2 className="size-16 animate-spin" style={{ color: accent }} />
              </div>
              <div className="text-center">
                <p className={`text-[15px] font-semibold ${heading}`}>Adding movies…</p>
                <p className={`text-[13px] mt-1 ${sub}`}>{addProgress.done} / {addProgress.total} added</p>
              </div>
              <div className={`w-full max-w-xs rounded-full h-2 ${dark ? "bg-[rgba(126,62,21,0.2)]" : "bg-[rgba(208,115,57,0.15)]"}`}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${addProgress.total ? (addProgress.done / addProgress.total) * 100 : 0}%`, background: accent }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {stage === "results" && (
          <div className={`flex items-center justify-between px-6 py-4 border-t ${border}`}>
            <p className={`text-[12px] ${sub}`}>{selectedCount} movie{selectedCount !== 1 ? "s" : ""} selected</p>
            <div className="flex gap-3">
              <button onClick={handleClose} className={`px-4 py-2 text-[13px] rounded-[8px] border ${dark ? "border-[rgba(126,62,21,0.4)] text-[rgba(247,241,237,0.7)] hover:bg-[rgba(126,62,21,0.15)]" : "border-[rgba(208,115,57,0.3)] text-[rgba(16,11,9,0.6)] hover:bg-[rgba(208,115,57,0.06)]"} transition-colors`}>Cancel</button>
              <button
                onClick={addSelected}
                disabled={selectedCount === 0}
                className={`flex items-center gap-2 px-5 py-2 text-[13px] font-semibold text-white rounded-[8px] transition-all ${selectedCount > 0 ? "bg-[#d07339] hover:bg-[#b8622e]" : "bg-[rgba(208,115,57,0.3)] cursor-not-allowed"}`}
              >
                <Plus className="size-4" />
                Add {selectedCount > 0 ? selectedCount : ""} Movie{selectedCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
