import { useNavigate } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { SiteHeader, SiteFooter } from '../components/SiteLayout';

interface NotFoundPageProps {
  currentUser?: any;
  isDarkMode?: boolean;
  setIsDarkMode?: (v: boolean) => void;
}

export function NotFoundPage({ currentUser, isDarkMode = false, setIsDarkMode }: NotFoundPageProps) {
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen flex flex-col bg-[#fdfaf8] dark:bg-[#120d09] ${isDarkMode ? 'dark' : ''}`}>
      <SiteHeader
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode ?? (() => {})}
      />

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <h1 className="text-9xl font-bold mb-4 text-[#100b09] dark:text-[#f7f1ed]">404</h1>

          <h2 className="text-3xl font-semibold mb-4 text-[#100b09] dark:text-[#f7f1ed]">
            Whoops! Can't find this page
          </h2>

          <p className="text-lg mb-8 text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
            The page you're looking for doesn't exist. It might have been moved, deleted, or the URL might be incorrect.
          </p>

          <div className="mb-8 flex justify-center">
            <div className="text-6xl">🗑️</div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all bg-[#d07339] hover:bg-[#b8622e] text-white"
            >
              <Home className="size-5" />
              Go to Homepage
            </button>

            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all bg-[rgba(208,115,57,0.1)] hover:bg-[rgba(208,115,57,0.2)] text-[#d07339] dark:text-[#c36a32]"
            >
              <Search className="size-5" />
              Search Movies
            </button>
          </div>

          <div className="mt-12">
            <p className="text-sm mb-3 text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">Popular pages:</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button onClick={() => navigate('/')} className="text-sm hover:underline text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                Main Collection
              </button>
              <button onClick={() => navigate('/?view=towatch')} className="text-sm hover:underline text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                To Watch List
              </button>
              <button onClick={() => navigate('/profile')} className="text-sm hover:underline text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
                Profile
              </button>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter isDarkMode={isDarkMode} />
    </div>
  );
}
