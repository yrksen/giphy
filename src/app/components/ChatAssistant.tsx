import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Movie } from './MovieCard';
import { createSlug } from '../utils/slugify';
import { useNavigate } from 'react-router-dom';

function useAboveFooter(base: number) {
  const [bottom, setBottom] = useState(base);
  useEffect(() => {
    function update() {
      const footer = document.querySelector('footer');
      if (!footer) { setBottom(base); return; }
      const visible = Math.max(0, window.innerHeight - footer.getBoundingClientRect().top);
      setBottom(base + visible);
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [base]);
  return bottom;
}

interface ChatAssistantProps {
  movies: Movie[];
  isDarkMode: boolean;
}

const OMDB_KEY = 'f9062e1';
// Match "imdb", "imbd" (common typo), "omdb", "ombd"
const isImdbIntent = (q: string) => /imdb|imbd|omdb|ombd/i.test(q);
const stripImdbWords = (q: string) => q.replace(/imdb\s*link|imbd\s*link|imdb\s*url|imbd\s*url|imdb|imbd|omdb|ombd|link|url/gi, '').replace(/\s+/g, ' ').trim();

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  suggestions?: Movie[];
  imdbLink?: { title: string; year: string; url: string };
}

export function ChatAssistant({ movies, isDarkMode }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fabBottom = useAboveFooter(24);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [lastQuery, setLastQuery] = useState<string>('');
  const [lastResults, setLastResults] = useState<Movie[]>([]);
  const [resultOffset, setResultOffset] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Initialize with greeting when opening
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: '1',
        text: "Hey! What are you in the mood for today?\n\n• Tell me a genre, actor, or director to find movies\n• Type \"more\" to see more results\n• Type \"[movie title] imdb link\" (e.g. \"Inception imdb link\") to get an IMDb URL you can add via the Add Movie button",
        isUser: false
      }]);
    }
  }, [isOpen, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const analyzeQuery = (query: string): Movie[] => {
    const lowerQuery = query.toLowerCase();
    let results: Movie[] = [];

    // Check for genre matches
    const genreResults = movies.filter(movie =>
      movie.genre && typeof movie.genre === 'string' && movie.genre.toLowerCase().includes(lowerQuery)
    );

    // Check for cast/actor matches (cast is an array)
    const castResults = movies.filter(movie =>
      movie.cast && Array.isArray(movie.cast) && movie.cast.some(actor => actor.toLowerCase().includes(lowerQuery))
    );

    // Check for plot matches
    const plotResults = movies.filter(movie =>
      movie.plot && typeof movie.plot === 'string' && movie.plot.toLowerCase().includes(lowerQuery)
    );

    // Check for director matches
    const directorResults = movies.filter(movie =>
      movie.director && typeof movie.director === 'string' && movie.director.toLowerCase().includes(lowerQuery)
    );

    // Combine results (prioritize exact matches)
    if (genreResults.length > 0) {
      results = genreResults;
    } else if (castResults.length > 0) {
      results = castResults;
    } else if (directorResults.length > 0) {
      results = directorResults;
    } else if (plotResults.length > 0) {
      results = plotResults;
    } else {
      // Try word-by-word matching for better results
      const words = lowerQuery.split(' ').filter(w => w.length > 3);
      results = movies.filter(movie => {
        const genreText = movie.genre && typeof movie.genre === 'string' ? movie.genre.toLowerCase() : '';
        const castText = movie.cast && Array.isArray(movie.cast) ? movie.cast.join(' ').toLowerCase() : '';
        const plotText = movie.plot && typeof movie.plot === 'string' ? movie.plot.toLowerCase() : '';
        const directorText = movie.director && typeof movie.director === 'string' ? movie.director.toLowerCase() : '';
        const searchText = `${genreText} ${castText} ${plotText} ${directorText}`;
        return words.some(word => searchText.includes(word));
      });
    }

    // Sort by rating - return ALL results (not just top 5)
    const withRatings = results.filter(m => m.imdbRating && m.imdbRating > 0);
    const withoutRatings = results.filter(m => !m.imdbRating || m.imdbRating === 0);

    const sortedWithRatings = withRatings.sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
    const combined = [...sortedWithRatings, ...withoutRatings];

    return combined; // Return all results, not just slice(0, 5)
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      isUser: true
    };

    setMessages(prev => [...prev, userMessage]);
    const query = inputValue;
    setInputValue('');

    // Analyze and respond
    setTimeout(async () => {
      // IMDb link intent — search OMDb directly and return link
      if (isImdbIntent(query)) {
        const movieTitle = stripImdbWords(query) || query;
        try {
          const res = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&apikey=${OMDB_KEY}`);
          const data = await res.json();
          if (data.Response === 'True' && data.imdbID) {
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              text: `Found it! Copy the IMDb link and use the "Add Movie" button to add it to your library:`,
              isUser: false,
              imdbLink: { title: data.Title, year: data.Year, url: `https://www.imdb.com/title/${data.imdbID}/` },
            }]);
          } else {
            setMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              text: `Couldn't find "${movieTitle}" on OMDb. Try a different spelling!`,
              isUser: false,
            }]);
          }
        } catch {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            text: 'OMDb search failed. Check your connection and try again.',
            isUser: false,
          }]);
        }
        return;
      }

      const lowerQuery = query.toLowerCase().trim();
      // Remove punctuation for better matching
      const cleanQuery = lowerQuery.replace(/[?!.,;]/g, '').trim();

      // Check if this is a contextual query referring to previous results
      const hasPronouns = /\b(him|her|them|he|she|they|that|this)\b/i.test(lowerQuery);
      const hasContextualWords = /\b(with|by|from|starring|featuring)\b/i.test(lowerQuery);
      const isContextual = lastResults.length > 0 && (hasPronouns || hasContextualWords);

      // Check for "more" variations - use regex for flexible matching
      const isSimpleMore = lastResults.length > 0 && (
        /^(more|others|another)$/.test(cleanQuery) ||
        /^(show|give|get|find)?\s*(me)?\s*(more|others|another|other)\s*(movies?|results?|options?)?$/.test(cleanQuery) ||
        /^(what|any|anything)\s*(else|more)/.test(cleanQuery) ||
        /^(show|give)\s*(me)?\s*(others|other|more)/.test(cleanQuery)
      );

      // Check for filtering requests
      const isBestRated = /\b(best|top|highest|high)\s*(rated|rating)\b/i.test(lowerQuery);
      const isNewMovies = /\b(new|recent|latest|newest)\b/i.test(lowerQuery);

      let suggestions: Movie[] = [];
      let responseText = '';

      // Handle contextual queries with previous results
      if ((isContextual || isSimpleMore || isBestRated || isNewMovies) && lastResults.length > 0) {
        let filteredResults = [...lastResults];

        // Apply filters if specified
        if (isBestRated) {
          // Sort by rating (highest first)
          filteredResults = filteredResults.sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
          setLastResults(filteredResults); // Update stored results with new order
          setResultOffset(0);
          suggestions = filteredResults.slice(0, 5);
          responseText = `Here are the highest-rated movies with ${lastQuery} sorted by rating:`;
        } else if (isNewMovies) {
          // Sort by year (newest first)
          filteredResults = filteredResults.sort((a, b) => {
            const yearA = typeof a.year === 'string' ? parseInt(a.year) : a.year || 0;
            const yearB = typeof b.year === 'string' ? parseInt(b.year) : b.year || 0;
            return yearB - yearA;
          });
          setLastResults(filteredResults); // Update stored results with new order
          setResultOffset(0);
          suggestions = filteredResults.slice(0, 5);
          responseText = `Here are the newest movies with ${lastQuery} sorted by release year:`;
        } else {
          // Show next batch from current results
          const nextOffset = resultOffset + 5;
          suggestions = filteredResults.slice(nextOffset, nextOffset + 5);

          if (suggestions.length > 0) {
            setResultOffset(nextOffset);
            responseText = `Here are ${suggestions.length} more movie${suggestions.length > 1 ? 's' : ''} with ${lastQuery}:`;
          } else {
            // No more results, start from beginning
            suggestions = filteredResults.slice(0, 5);
            setResultOffset(0);
            responseText = `That's all the movies I found for "${lastQuery}"! Here are the first ${suggestions.length} again:`;
          }
        }
      } else {
        // New search query
        const allResults = analyzeQuery(query);
        suggestions = allResults.slice(0, 5);

        // Store for contextual requests
        setLastQuery(query);
        setLastResults(allResults);
        setResultOffset(0);

        if (suggestions.length > 0) {
          const hasMore = allResults.length > 5;
          responseText = `Great choice! Here are ${suggestions.length} movie${suggestions.length > 1 ? 's' : ''} I think you'll love:${hasMore ? ` (I found ${allResults.length} total - type "more" to see more!)` : ''}`;
        } else {
          responseText = "Hmm, I couldn't find any movies matching that. Try a genre like 'comedy' or 'action', an actor name, or type \"[movie title] imdb link\" to get an IMDb URL!";
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        suggestions: suggestions.length > 0 ? suggestions : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
    }, 500);
  };

  const handleMovieClick = (movie: Movie) => {
    navigate(`/movie/${createSlug(movie.title, movie.year)}`);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-3 sm:right-6 z-50 p-4 rounded-full shadow-lg transition-all hover:scale-110 bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] shadow-[0_6px_18px_rgba(208,115,57,0.35)]"
        style={{ bottom: fabBottom }}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed right-3 left-3 sm:left-auto sm:right-6 sm:w-96 z-50 h-[500px] max-h-[calc(100vh-120px)] rounded-[10px] shadow-2xl flex flex-col bg-[#fdfaf8] dark:bg-[#18110c] border border-[#eea77a] dark:border-[#7e3e15]"
          style={{ bottom: fabBottom + 72 }}>
          {/* Header */}
          <div className="p-4 border-b border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#d07339] dark:text-[#c36a32]" />
              <span className="font-semibold text-[#100b09] dark:text-[#f7f1ed]">
                Movie Assistant
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(message => (
              <div key={message.id}>
                <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                    message.isUser
                      ? 'bg-[#d07339] dark:bg-[#c36a32] text-white'
                      : 'bg-[rgba(208,115,57,0.1)] dark:bg-[rgba(126,62,21,0.2)] text-[#100b09] dark:text-[#f7f1ed]'
                  }`}>
                    {message.text}
                  </div>
                </div>

                {/* IMDb link result */}
                {message.imdbLink && (
                  <div className="mt-2">
                    <a href={message.imdbLink.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] bg-[rgba(208,115,57,0.07)] dark:bg-[rgba(126,62,21,0.15)] hover:bg-[rgba(208,115,57,0.14)] dark:hover:bg-[rgba(126,62,21,0.25)] transition-colors no-underline">
                      <span className="text-[#f5c518] text-lg font-bold leading-none">IMDb</span>
                      <div>
                        <div className="text-sm font-medium text-[#100b09] dark:text-[#f7f1ed]">{message.imdbLink.title} ({message.imdbLink.year})</div>
                        <div className="text-xs text-[#d07339] dark:text-[#c36a32] truncate">{message.imdbLink.url}</div>
                      </div>
                    </a>
                  </div>
                )}

                {/* Movie Suggestions */}
                {message.suggestions && (
                  <div className="mt-2 space-y-2">
                    {message.suggestions.map(movie => (
                      <div
                        key={movie.id}
                        onClick={() => handleMovieClick(movie)}
                        className="flex gap-3 p-2 rounded-lg cursor-pointer transition-colors bg-[rgba(208,115,57,0.07)] hover:bg-[rgba(208,115,57,0.14)] dark:bg-[rgba(126,62,21,0.15)] dark:hover:bg-[rgba(126,62,21,0.25)] border border-[rgba(208,115,57,0.15)] dark:border-[rgba(126,62,21,0.25)]"
                      >
                        <img
                          src={movie.image}
                          alt={movie.title}
                          className="w-12 h-16 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="font-medium text-sm truncate text-[#100b09] dark:text-[#f7f1ed]">
                            {movie.title}
                          </div>
                          <div className="text-xs text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)] mt-0.5">
                            {movie.year} • ⭐ {movie.imdbRating?.toFixed(1)}
                          </div>
                          {movie.genre && (
                            <div className="text-xs mt-0.5 truncate text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">
                              {movie.genre}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)]">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-[#120d09] border-[#eea77a] dark:border-[#7e3e15] text-[#100b09] dark:text-[#f7f1ed] placeholder-[rgba(16,11,9,0.4)] dark:placeholder-[rgba(247,241,237,0.3)] focus:outline-none focus:ring-2 focus:ring-[#d07339] text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className={`p-2 rounded-lg transition-colors ${
                  inputValue.trim()
                    ? 'bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white'
                    : 'bg-[rgba(208,115,57,0.1)] dark:bg-[rgba(126,62,21,0.15)] text-[rgba(208,115,57,0.4)] cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
