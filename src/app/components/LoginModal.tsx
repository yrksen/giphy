import { X, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  setCurrentUser?: (user: any) => void;
}

type ModalView = 'login' | 'create-account' | 'forgot-password';

export function LoginModal({ isOpen, onClose, isDarkMode, setCurrentUser }: LoginModalProps) {
  const [view, setView] = useState<ModalView>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setView('login');
    setUsername('');
    setEmail('');
    setPassword('');
    setError('');
    setSuccessMessage('');
    onClose();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }
      // onAuthStateChange in App.tsx will update currentUser
      handleClose();
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSuccessMessage('Account created! Please check your email to confirm your account before signing in.');
    } catch (err) {
      console.error('Signup error:', err);
      setError('An error occurred during account creation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      setSuccessMessage('Password reset link sent! Check your email.');
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const getTitle = () => {
    switch (view) {
      case 'create-account': return 'Create account';
      case 'forgot-password': return 'Reset password';
      default: return 'Sign in';
    }
  };

  const inputClass = `w-full px-3 py-2 text-[13px] border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d07339] bg-[#fdfaf8] border-[#eea77a] text-[#100b09] placeholder-[rgba(16,11,9,0.5)] dark:bg-[#18110c] dark:border-[#7e3e15] dark:text-[rgba(247,241,237,0.9)] dark:placeholder-[rgba(247,241,237,0.4)]`;

  const labelClass = `block mb-2 text-[13px] font-medium text-[rgba(16,11,9,0.7)] dark:text-[rgba(247,241,237,0.7)]`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-[10px] shadow-xl bg-[#fdfaf8] dark:bg-[#18110c] border border-[rgba(208,115,57,0.25)] dark:border-[rgba(126,62,21,0.4)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[rgba(208,115,57,0.2)] dark:border-[rgba(126,62,21,0.35)]">
          <h2 className="text-lg font-bold tracking-tight text-[#100b09] dark:text-[#f7f1ed]">
            {getTitle()}
          </h2>
          <button
            onClick={handleClose}
            className="text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)] hover:text-[#d07339] dark:hover:text-[#c36a32] transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Login View */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px] bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className={labelClass}>Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="login-password" className={labelClass}>Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className={inputClass + ' pr-10'}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] hover:text-[#d07339] transition-colors">
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[13px]">
              <button
                type="button"
                onClick={() => setView('forgot-password')}
                className="text-[#d07339] dark:text-[#c36a32] hover:underline transition-colors"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={() => setView('create-account')}
                className="text-[#d07339] dark:text-[#c36a32] hover:underline transition-colors"
              >
                Create account
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-colors bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-[rgba(208,115,57,0.2)] dark:bg-[rgba(126,62,21,0.3)]" />
              <span className="text-[11px] text-[rgba(16,11,9,0.4)] dark:text-[rgba(247,241,237,0.4)]">or</span>
              <div className="flex-1 h-px bg-[rgba(208,115,57,0.2)] dark:bg-[rgba(126,62,21,0.3)]" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-lg border transition-colors border-[rgba(16,11,9,0.15)] dark:border-[rgba(247,241,237,0.15)] bg-white dark:bg-[#1e1409] text-[#100b09] dark:text-[rgba(247,241,237,0.9)] hover:bg-gray-50 dark:hover:bg-[#251a0e]"
            >
              <img src="https://i.imgur.com/FmLD6jR.png" alt="Google" className="w-5 h-5 object-contain flex-shrink-0" />
              Continue with Google
            </button>
          </form>
        )}

        {/* Create Account View */}
        {view === 'create-account' && (
          <form onSubmit={handleCreateAccountSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px] bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg text-[13px] bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                {successMessage}
              </div>
            )}

            {!successMessage && (
              <>
                <div>
                  <label htmlFor="create-username" className={labelClass}>Username</label>
                  <input
                    id="create-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="create-email" className={labelClass}>Email</label>
                  <input
                    id="create-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="create-password" className={labelClass}>Password</label>
                  <div className="relative">
                    <input
                      id="create-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      required
                      className={inputClass + ' pr-10'}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(16,11,9,0.45)] dark:text-[rgba(247,241,237,0.45)] hover:text-[#d07339] transition-colors">
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-colors bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white disabled:opacity-60"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-[13px] text-[#d07339] dark:text-[#c36a32] hover:underline transition-colors"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password View */}
        {view === 'forgot-password' && (
          <form onSubmit={handleForgotPasswordSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px] bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-lg text-[13px] bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                {successMessage}
              </div>
            )}

            <p className="text-[13px] text-[rgba(16,11,9,0.6)] dark:text-[rgba(247,241,237,0.6)]">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <div>
              <label htmlFor="forgot-email" className={labelClass}>Email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className={inputClass}
              />
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-[13px] text-[#d07339] dark:text-[#c36a32] hover:underline transition-colors"
              >
                Back to sign in
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 text-[13px] font-medium rounded-lg transition-colors bg-[#d07339] hover:bg-[#b8622e] dark:bg-[#c36a32] dark:hover:bg-[#a85a28] text-white disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
