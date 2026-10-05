import { SiteHeader, SiteFooter } from '../components/SiteLayout';

interface Props {
  currentUser: any;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  setCurrentUser: (u: any) => void;
}

export default function TermsOfServicePage({ currentUser, isDarkMode, setIsDarkMode }: Props) {
  const body = 'text-[13px] text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)]';
  const heading = 'text-lg font-semibold mb-2 text-[#d07339] dark:text-[#c36a32]';

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfaf8] dark:bg-[#120d09]">
      <SiteHeader currentUser={currentUser} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />

      <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
        <div className="bg-white dark:bg-[#18110c] border border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.3)] rounded-[10px] p-6">
          <h1 className="text-2xl font-bold mb-2 text-[#100b09] dark:text-[#f7f1ed]">Terms of Service</h1>
          <p className={`${body} mb-8`}>Effective date: January 1, 2025</p>
          <p className={`${body} mb-6`}>Welcome to Trash Bin! These Terms of Service govern your use of the site. By using it, you agree to these terms.</p>

          <section className="mb-6">
            <h2 className={heading}>Acceptance of Terms</h2>
            <p className={body}>By accessing or using Trash Bin, you agree to be bound by these Terms. If you don't agree, please don't use the site.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Use of the Service</h2>
            <p className={`${body} mb-2`}>You may use Trash Bin to browse movies, leave ratings and comments, and manage your watchlist. You agree not to use the site for any unlawful purpose or in a way that could harm other users.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>User Accounts</h2>
            <p className={body}>You may create an account to save ratings and leave comments. You are responsible for your account credentials and agree to provide accurate information. We reserve the right to suspend accounts that violate these terms.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>User Content</h2>
            <ul className={`list-disc pl-5 space-y-1 ${body}`}>
              <li>You will not post hateful, abusive, or harassing content</li>
              <li>You will not spam or impersonate other users</li>
              <li>Your comments may be visible to all visitors</li>
            </ul>
            <p className={`${body} mt-2`}>We reserve the right to remove comments that violate these guidelines.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Intellectual Property</h2>
            <p className={body}>Movie titles, posters, and metadata belong to their respective copyright holders. Trash Bin is a fan project and does not claim ownership of any movie-related content.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Limitation of Liability</h2>
            <p className={body}>Trash Bin is provided "as is" without warranties. We are not liable for damages arising from use of the site. The site may experience downtime or changes without prior notice.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Changes to Terms</h2>
            <p className={body}>We may update these Terms from time to time. Continued use after changes means you accept the new terms.</p>
          </section>

          <section className="mb-6">
            <h2 className={heading}>Copyright Disclaimer</h2>
            <p className={`${body} mb-3`}>
              All movie posters, TV show artwork, logos, trademarks, and other copyrighted materials featured on this website are the property of their respective copyright owners. This website does not claim ownership of any such materials.
            </p>
            <p className={`${body} mb-3`}>
              Images and related content are used solely for identification, informational, editorial, and reference purposes in the context of a fan-made, non-commercial movie catalogue.
            </p>
            <p className={body}>
              If you are a copyright owner and believe that any content on this website infringes your rights, please{' '}
              <a href="mailto:wannabenargail@gmail.com" className="text-[#d07339] dark:text-[#c36a32] hover:underline">contact us</a>
              {' '}and the material will be promptly reviewed and removed if necessary.
            </p>
          </section>

          <section>
            <h2 className={heading}>Contact</h2>
            <p className={body}>
              Questions? Reach us at{' '}
              <a href="mailto:wannabenargail@gmail.com" className="text-[#d07339] dark:text-[#c36a32] hover:underline">wannabenargail@gmail.com</a>.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter isDarkMode={isDarkMode} />
    </div>
  );
}
