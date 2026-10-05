import { SiteHeader, SiteFooter } from '../components/SiteLayout';

interface Props {
  currentUser: any;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  setCurrentUser: (u: any) => void;
}

export default function PrivacyPolicyPage({ currentUser, isDarkMode, setIsDarkMode }: Props) {
  const body = 'text-[13px] text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)]';
  const heading = 'text-lg font-semibold mb-2 text-[#d07339] dark:text-[#c36a32]';

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfaf8] dark:bg-[#120d09]">
      <SiteHeader currentUser={currentUser} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        <div className="bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] p-6">
          <h1 className="text-2xl font-bold mb-2 text-[#100b09] dark:text-[#f7f1ed]">Privacy Policy</h1>
          <p className={`${body} mb-8`}>Effective date: January 1, 2025</p>
          <p className={`${body} mb-6`}>Trash Bin is a personal movie tracking app built for a small group of friends. We keep things simple and try to collect as little data as possible.</p>

          <section className="mb-6">
            <h2 className={heading}>Data We Collect</h2>
            <p className={`${body} mb-2`}>When you create an account or use Trash Bin, we may collect:</p>
            <ul className={`list-disc pl-5 space-y-1 ${body}`}>
              <li>Your email address (if you sign up)</li>
              <li>A display username you choose</li>
              <li>A profile picture URL (optional)</li>
              <li>Movie ratings and comments you leave on the site</li>
              <li>Basic usage data like which movies you've viewed or rated</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className={heading}>How We Use Your Data</h2>
            <ul className={`list-disc pl-5 space-y-1 ${body} mb-2`}>
              <li>Displaying your username and profile picture on comments and ratings</li>
              <li>Saving your movie ratings and preferences</li>
              <li>Letting you log in and stay authenticated</li>
            </ul>
            <p className={body}>We do not sell your data, use it for advertising, or share it with third parties.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Third-Party Services</h2>
            <ul className={`list-disc pl-5 space-y-1 ${body}`}>
              <li><strong>IMDb</strong> — We display publicly available movie data. We are not affiliated with IMDb.</li>
              <li><strong>OMDb API</strong> — Used to fetch movie metadata. No personal user data is sent.</li>
              <li><strong>Supabase</strong> — Database and authentication. See <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#d07339] dark:text-[#c36a32] hover:underline">supabase.com/privacy</a>.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Cookies &amp; Local Storage</h2>
            <p className={body}>Trash Bin uses browser local storage to save preferences (dark mode, session). We do not use tracking cookies.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Your Rights</h2>
            <ul className={`list-disc pl-5 space-y-1 ${body}`}>
              <li>Request a copy of your personal data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Update your username or profile picture at any time</li>
            </ul>
          </section>

          <section>
            <h2 className={heading}>Contact Us</h2>
            <p className={body}>
              Questions? Contact us at{' '}
              <a href="mailto:wannabenargail@gmail.com" className="text-[#d07339] dark:text-[#c36a32] hover:underline">wannabenargail@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter isDarkMode={isDarkMode} />
    </div>
  );
}
