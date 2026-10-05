import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
const logoImage = 'https://i.imgur.com/vUiVqow.png?direct';

interface AuthCallbackPageProps {
  isDarkMode: boolean;
}

type CallbackState = 'loading' | 'success' | 'recovery' | 'error';

export function AuthCallbackPage({ isDarkMode }: AuthCallbackPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>('loading');
  const [username, setUsername] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const processCallback = async () => {
      const errorCode = searchParams.get('error_code');
      const errorDesc = searchParams.get('error_description');
      if (errorCode) {
        setErrorMsg(errorDesc || errorCode);
        setState('error');
        return;
      }

      // PKCE flow: ?code=... is in query string
      const code = searchParams.get('code');
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.session) {
          setErrorMsg(error?.message || 'Verification failed. The link may have expired.');
          setState('error');
          return;
        }
        const user = data.session.user;
        const uname = user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
        setUsername(uname);
        // Clean up URL
        window.history.replaceState(null, '', window.location.pathname);
        // EMAIL CONFIRMATION success — show welcome, then redirect home
        setState('success');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      // Implicit flow: #access_token in hash
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const type = params.get('type');
        const refreshToken = params.get('refresh_token') || '';
        window.history.replaceState(null, '', window.location.pathname);

        if (accessToken) {
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error || !data.session) {
            setErrorMsg(error?.message || 'Verification failed.');
            setState('error');
            return;
          }
          const user = data.session.user;
          const uname = user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'there';
          setUsername(uname);

          if (type === 'recovery') {
            setState('recovery');
            setTimeout(() => navigate('/reset-password'), 1500);
            return;
          }

          setState('success');
          setTimeout(() => navigate('/'), 3000);
          return;
        }
      }

      // Listen for Supabase auth events (handles cases where Supabase processes the URL itself)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          const uname = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'there';
          setUsername(uname);
          setState('recovery');
          setTimeout(() => navigate('/reset-password'), 1500);
          subscription.unsubscribe();
        } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
          const uname = session.user.user_metadata?.username || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'there';
          setUsername(uname);
          setState('success');
          setTimeout(() => navigate('/'), 3000);
          subscription.unsubscribe();
        }
      });

      // Fallback timeout
      setTimeout(() => {
        if (state === 'loading') navigate('/');
      }, 5000);
    };

    processCallback();
  }, []);

  const dark = isDarkMode;
  const bg = dark ? 'bg-[#0b0704]' : 'bg-[#fdfaf8]';
  const card = dark
    ? 'bg-[#18110c] border-[rgba(126,62,21,0.4)]'
    : 'bg-[#fdfaf8] border-[rgba(208,115,57,0.25)]';
  const heading = dark ? 'text-[#f7f1ed]' : 'text-[#100b09]';
  const subtext = dark ? 'text-[rgba(247,241,237,0.6)]' : 'text-[rgba(16,11,9,0.6)]';

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>
      <div className={`w-full max-w-md rounded-[10px] shadow-xl p-10 text-center border ${card}`}>
        <img src={logoImage} alt="Trash Bin" className="size-10 mx-auto mb-6" />

        {state === 'loading' && (
          <>
            <div className="w-8 h-8 border-2 border-[#d07339] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className={`text-[14px] ${subtext}`}>Verifying your link…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="text-5xl mb-4">🎉</div>
            <h2 className={`text-xl font-bold mb-2 ${heading}`}>
              Welcome{username ? `, ${username}` : ' back'}!
            </h2>
            <p className={`text-[13px] mb-6 ${subtext}`}>
              Your account is confirmed. Taking you to the library…
            </p>
            <div className="w-full h-1 rounded-full bg-[rgba(208,115,57,0.2)] overflow-hidden">
              <div className="h-full bg-[#d07339] animate-[grow_3s_linear_forwards]" style={{ width: '100%', animation: 'none', transition: 'width 3s linear', transformOrigin: 'left' }} />
            </div>
          </>
        )}

        {state === 'recovery' && (
          <>
            <div className="text-5xl mb-4">🔑</div>
            <h2 className={`text-xl font-bold mb-2 ${heading}`}>Almost there!</h2>
            <p className={`text-[13px] ${subtext}`}>
              Taking you to the password reset form…
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className={`text-xl font-bold mb-2 ${heading}`}>Link expired</h2>
            <p className={`text-[13px] mb-6 ${subtext}`}>
              {errorMsg || 'This link has expired or already been used. Please request a new one.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2.5 text-[13px] font-medium rounded-lg bg-[#d07339] hover:bg-[#b8622e] text-white transition-colors">
              Go home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
