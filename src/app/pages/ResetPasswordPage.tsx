import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';
const logoImage = 'https://i.imgur.com/vUiVqow.png?direct';

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

interface ResetPasswordPageProps {
  isDarkMode: boolean;
}

export function ResetPasswordPage({ isDarkMode }: ResetPasswordPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [tokenMode, setTokenMode] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1. PKCE flow: ?code= in query string (Supabase v2 default)
      const code = searchParams.get('code');
      if (code) {
        const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchErr && data.session?.user?.email) {
          setEmail(data.session.user.email);
          setTokenMode(true);
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }
      }

      // 2. Implicit flow: #access_token in hash (older Supabase / email clients)
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const type = params.get('type');
        if (accessToken && type === 'recovery') {
          window.history.replaceState(null, '', window.location.pathname);
          const { data } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: params.get('refresh_token') || '',
          });
          if (data.session?.user?.email) {
            setEmail(data.session.user.email);
            setTokenMode(true);
          }
          return;
        }
      }

      // 3. Session already established (came from /auth/callback → /reset-password)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setEmail(session.user.email);
        setTokenMode(true);
        return;
      }

      // 4. Listen for PASSWORD_RECOVERY event (Supabase may fire this itself)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
        if (event === 'PASSWORD_RECOVERY' && sess?.user?.email) {
          setEmail(sess.user.email);
          setTokenMode(true);
          subscription.unsubscribe();
        }
      });
      return () => subscription.unsubscribe();
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      if (tokenMode) {
        // Session was already set via setSession in useEffect — use Supabase Auth directly
        const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
        if (authError) {
          setError(authError.message);
          setLoading(false);
          return;
        }
        setSuccess(true);
        setTimeout(() => navigate('/'), 2000);
      } else {
        // Fallback: call custom backend reset-password endpoint
        const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email: email.trim(), newPassword }),
        });

        const data = await response.json();

        if (!data.success) {
          setError(data.error || 'Failed to reset password');
          setLoading(false);
          return;
        }

        setSuccess(true);
        setTimeout(() => navigate('/'), 2000);
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = `w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d07339] ${
    isDarkMode
      ? 'bg-[#18110c] border-[#7e3e15] text-[rgba(247,241,237,0.9)] placeholder-[rgba(247,241,237,0.4)]'
      : 'bg-[#fdfaf8] border-[#eea77a] text-[#100b09] placeholder-[rgba(16,11,9,0.5)]'
  }`;

  const labelCls = `block mb-2 text-[13px] font-medium ${isDarkMode ? 'text-[rgba(247,241,237,0.7)]' : 'text-[rgba(16,11,9,0.7)]'}`;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#0b0704]' : 'bg-[#fdfaf8]'}`}>
      <div className={`w-full max-w-md rounded-[10px] shadow-xl p-8 border ${
        isDarkMode
          ? 'bg-[#18110c] border-[rgba(126,62,21,0.4)]'
          : 'bg-[#fdfaf8] border-[rgba(208,115,57,0.25)]'
      }`}>
        <div className="flex justify-center mb-6">
          <img src={logoImage} alt="Trash Bin Logo" className="size-10" />
        </div>

        <h1 className={`text-xl font-bold text-center mb-2 ${isDarkMode ? 'text-[#f7f1ed]' : 'text-[#100b09]'}`}>
          Reset Password
        </h1>

        <p className={`text-center mb-6 text-[13px] ${isDarkMode ? 'text-[rgba(247,241,237,0.6)]' : 'text-[rgba(16,11,9,0.6)]'}`}>
          {tokenMode ? 'Choose a new password for your account.' : 'Enter your email and new password below.'}
        </p>

        {success ? (
          <div className={`p-4 rounded-lg text-center ${isDarkMode ? 'bg-green-900/30 text-green-300' : 'bg-green-50 text-green-800'}`}>
            <p className="font-medium mb-1">Password reset successful!</p>
            <p className="text-[13px]">Redirecting you home...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`p-3 rounded-lg text-[13px] ${isDarkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-800'}`}>
                {error}
              </div>
            )}

            {!tokenMode && (
              <div>
                <label htmlFor="email" className={labelCls}>Email Address</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email" required className={inputCls} />
              </div>
            )}
            {tokenMode && email && (
              <div className={`text-[13px] p-2 rounded ${isDarkMode ? 'bg-[#1e1409] text-[rgba(247,241,237,0.6)]' : 'bg-[rgba(208,115,57,0.08)] text-[rgba(16,11,9,0.6)]'}`}>
                Resetting password for <strong>{email}</strong>
              </div>
            )}

            <div>
              <label htmlFor="new-password" className={labelCls}>New Password</label>
              <input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password" required className={inputCls} />
            </div>

            <div>
              <label htmlFor="confirm-password" className={labelCls}>Confirm New Password</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password" required className={inputCls} />
            </div>

            <button type="submit" disabled={loading}
              className={`w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-colors text-white ${
                loading ? 'opacity-60 cursor-not-allowed' : ''
              } bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28]`}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <button type="button" onClick={() => navigate('/')}
              className={`w-full text-[13px] hover:underline ${isDarkMode ? 'text-[#c36a32]' : 'text-[#d07339]'}`}>
              Back to home
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
