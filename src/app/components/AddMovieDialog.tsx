import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Movie } from "./MovieCard";

interface AddMovieDialogProps {
  onAddMovie: (movie: Movie) => void;
  existingMovies: Movie[];
  currentViewMovies?: Movie[]; // Movies from the current view only for duplicate checking
}

const OMDB_KEY = "f9062e1";
const TMDB_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI0MGM0YTAyNzc1ZGQxZWJiY2Q3NmRiZTk3NGI5NjAwOCIsIm5iZiI6MTc4OTY0ODUzOC43MjYsInN1YiI6IjZhYWJkZTlhZWUxNDVhNjkxYTQ1ZjY0MyIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.KYdDb8ZKerW-1S_fX62QEoLwXX1f2OXEyV6I5un5onA";

// Build TMDB request — supports both long JWT (Bearer) and short v3 API key
function tmdbFetch(path: string): Promise<Response> {
  const isJwt = TMDB_KEY.startsWith("ey");
  const url = isJwt
    ? `https://api.themoviedb.org/3${path}`
    : `https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_KEY}`;
  const headers: HeadersInit = isJwt
    ? { Authorization: `Bearer ${TMDB_KEY}`, accept: "application/json" }
    : { accept: "application/json" };
  return fetch(url, { headers });
}

// Fetch from TMDB using IMDb ID as external source
const fetchFromTMDB = async (imdbId: string): Promise<Partial<Movie> | null> => {
  if (!TMDB_KEY) return null;
  try {
    const findRes = await tmdbFetch(`/find/${imdbId}?external_source=imdb_id`);
    const findData = await findRes.json();

    const result = findData.movie_results?.[0] || findData.tv_results?.[0];
    if (!result) return null;

    const isTv = !!findData.tv_results?.[0];
    const tmdbId = result.id;

    const detailRes = await tmdbFetch(
      `/${isTv ? "tv" : "movie"}/${tmdbId}?append_to_response=credits`
    );
    const detail = await detailRes.json();

    const genres = detail.genres?.map((g: any) => g.name).join(", ") || "";
    const director = detail.credits?.crew?.find((c: any) => c.job === "Director")?.name;
    const cast = detail.credits?.cast?.slice(0, 5).map((c: any) => c.name);
    const poster = result.poster_path
      ? `https://image.tmdb.org/t/p/w500${result.poster_path}`
      : undefined;

    let runtime: string | undefined;
    if (isTv) {
      const seasons = detail.number_of_seasons;
      if (seasons) runtime = `${seasons} Season${seasons !== 1 ? "s" : ""}`;
    } else {
      if (detail.runtime) runtime = `${detail.runtime} min`;
    }

    const year = parseInt(
      (isTv ? detail.first_air_date : detail.release_date)?.split("-")[0] || "0"
    );

    return {
      title: detail.name || detail.title,
      year,
      genre: genres,
      description: detail.overview,
      plot: detail.overview,
      poster,
      runtime,
      imdbId,
      director,
      cast,
      rating: 0,
      imdbRating: 0,
    };
  } catch (err) {
    console.error("TMDB fetch error:", err);
    return null;
  }
};

// Fetch movie data — tries OMDb first, falls back to TMDB for new/missing titles
export const fetchMovieFromIMDb = async (imdbUrl: string): Promise<Partial<Movie> | null> => {
  const imdbIdMatch = imdbUrl.match(/tt\d{7,}/);
  if (!imdbIdMatch) return null;

  const imdbId = imdbIdMatch[0];

  // --- Try OMDb ---
  let omdbData: Partial<Movie> | null = null;
  try {
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&plot=full&apikey=${OMDB_KEY}`);
    const data = await res.json();

    if (data.Response !== "False") {
      let runtimeValue: string | undefined;
      if (data.Type === "series") {
        if (data.totalSeasons && data.totalSeasons !== "N/A")
          runtimeValue = `${data.totalSeasons} Season${data.totalSeasons !== "1" ? "s" : ""}`;
      } else {
        if (data.Runtime && data.Runtime !== "N/A") runtimeValue = data.Runtime;
      }

      omdbData = {
        title: data.Title,
        year: parseInt(data.Year),
        genre: data.Genre,
        rating: parseFloat(data.imdbRating) || 0,
        description: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
        poster: data.Poster && data.Poster !== "N/A" ? data.Poster : undefined,
        runtime: runtimeValue,
        imdbId,
        imdbRating: parseFloat(data.imdbRating) || 0,
        director: data.Director && data.Director !== "N/A" ? data.Director : undefined,
        cast: data.Actors && data.Actors !== "N/A" ? data.Actors.split(", ") : undefined,
        plot: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
      };
    }
  } catch (err) {
    console.error("OMDb fetch error:", err);
  }

  // Always call TMDB so we can fill any gaps (e.g. runtime missing from OMDb)
  const tmdbData = await fetchFromTMDB(imdbId);
  if (!tmdbData && !omdbData) return null;

  // Merge: prefer OMDb where it has data, fill gaps from TMDB
  const merged: Partial<Movie> = {
    ...tmdbData,
    ...omdbData,
    poster: omdbData?.poster || tmdbData?.poster,
    description: omdbData?.description || tmdbData?.description,
    plot: omdbData?.plot || tmdbData?.plot,
    genre: omdbData?.genre || tmdbData?.genre,
    director: omdbData?.director || tmdbData?.director,
    cast: omdbData?.cast || tmdbData?.cast,
    runtime: omdbData?.runtime || tmdbData?.runtime,
    title: omdbData?.title || tmdbData?.title,
    year: omdbData?.year || tmdbData?.year,
  };

  return merged;
};

export function AddMovieDialog({ onAddMovie, existingMovies, currentViewMovies }: AddMovieDialogProps) {
  const [open, setOpen] = useState(false);
  const [imdbUrl, setImdbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const movieData = await fetchMovieFromIMDb(imdbUrl.trim());

      if (!movieData) {
        setError("Invalid IMDb URL or movie not found.");
        setLoading(false);
        return;
      }

      // Check if movie already exists by title AND year
      const duplicateMovie = currentViewMovies
        ? currentViewMovies.find(
            (movie) => movie.title.toLowerCase() === movieData.title?.toLowerCase() && movie.year === movieData.year
          )
        : existingMovies.find(
            (movie) => movie.title.toLowerCase() === movieData.title?.toLowerCase() && movie.year === movieData.year
          );

      if (duplicateMovie) {
        setError(`This movie already exists in your collection (ID: #${duplicateMovie.id}).`);
        setLoading(false);
        return;
      }

      const newId = existingMovies.length > 0
        ? Math.max(...existingMovies.map((m) => m.id)) + 1
        : 1;

      // Fallback images if OMDb poster is missing
      const genreImageMap: Record<string, string> = {
        Action: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Comedy: "https://images.unsplash.com/photo-1587042285747-583b4d4d73b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Drama: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Horror: "https://images.unsplash.com/photo-1767048264833-5b65aacd1039?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Romance: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Thriller: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "Sci-Fi": "https://images.unsplash.com/photo-1759267960211-5f445be05c93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Animation: "https://images.unsplash.com/photo-1759267960211-5f445be05c93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      };

      const newMovie: Movie = {
        id: newId,
        title: movieData.title || "Unknown Title",
        year: movieData.year || 2024,
        genre: movieData.genre || "Drama",
        rating: movieData.rating || 7.0,
        image: movieData.poster || genreImageMap[movieData.genre || "Drama"] || genreImageMap.Action,
        description: movieData.description || "No description available.",
        runtime: movieData.runtime,
        imdbId: movieData.imdbId,
        imdbRating: movieData.imdbRating,
        director: movieData.director,
        cast: movieData.cast,
        plot: movieData.plot,
        dateAdded: Date.now(), // Add timestamp for recently added tracking
      };

      onAddMovie(newMovie);
      setOpen(false);
      setImdbUrl("");
    } catch (err) {
      setError("Failed to fetch movie data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="flex items-center gap-2 text-sm font-medium border-2 bg-[#d07339] hover:bg-[#f99251] text-white border-[#d07339] dark:bg-[#c36a32] dark:hover:bg-[#a64a11] dark:border-transparent rounded-lg shadow-[0_6px_18px_rgba(208,115,57,0.25)] dark:shadow-[0_0_12px_rgba(195,106,50,0.25)]">
          <Plus className="size-4" />
          Add Movie
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-[#fdfaf8] dark:bg-[#18110c] border border-[#eea77a] dark:border-[#7e3e15]">
        <DialogHeader>
          <DialogTitle className="text-[#100b09] dark:text-[#f7f1ed]">Add Movie from IMDb</DialogTitle>
          <DialogDescription className="text-[#100b09]/60 dark:text-[rgba(247,241,237,0.55)]">
            Paste an IMDb link to add a movie to your collection.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="imdb-url" className="text-[#100b09] dark:text-[rgba(247,241,237,0.7)]">IMDb URL</Label>
            <Input
              id="imdb-url"
              placeholder="https://www.imdb.com/title/tt1234567/"
              value={imdbUrl}
              onChange={(e) => setImdbUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleSubmit();
              }}
              className="bg-white dark:bg-[#120d09] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[#f7f1ed] placeholder:text-[#100b09]/40 dark:placeholder:text-[rgba(247,241,237,0.3)] focus-visible:ring-[#d07339] dark:focus-visible:ring-[#c36a32]"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setImdbUrl("");
              setError("");
            }}
            className="border-[#eea77a] dark:border-[#7e3e15] text-[#d07339] dark:text-[#c36a32] bg-transparent hover:bg-[rgba(208,115,57,0.08)] dark:hover:bg-[rgba(195,106,50,0.1)]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !imdbUrl.trim()}
            className="bg-[#d07339] hover:bg-[#f99251] dark:bg-[#c36a32] dark:hover:bg-[#a64a11] text-white border-0 disabled:opacity-50"
          >
            {loading ? "Adding..." : "Add Movie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}