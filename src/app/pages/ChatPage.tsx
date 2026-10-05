import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { ChatPanel } from '../components/LiveChat';
import { SiteHeader } from '../components/SiteLayout';

const GLOBAL_PRESENCE_CHANNEL = 'site-presence-v1';

interface ChatPageProps {
  currentUser?: any;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  setCurrentUser?: (u: any) => void;
}

export function ChatPage({ currentUser, isDarkMode, setIsDarkMode }: ChatPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [onlineUsers, setOnlineUsers] = useState<{ username: string; avatar?: string }[]>([]);
  const presenceRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const initialChannel = searchParams.get('channel') || 'global';
  const initialDM = searchParams.get('dm') || null;

  // Global presence tracking
  useEffect(() => {
    const displayName = currentUser?.username || localStorage.getItem('chat-guest-nick') || `visitor-${Math.random().toString(36).slice(2, 6)}`;
    const ch = supabase.channel(GLOBAL_PRESENCE_CHANNEL, { config: { presence: { key: displayName } } })
      .on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ username: string }>();
        setOnlineUsers(
          Object.entries(state).map(([key, arr]) => ({
            username: (arr[0] as any)?.username || key,
            avatar: localStorage.getItem(`userPic_${(arr[0] as any)?.username || key}`) || undefined,
          }))
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ username: displayName });
        }
      });
    presenceRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [currentUser?.username]);

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ background: isDarkMode ? '#120d09' : '#fdfaf8' }}>
      <SiteHeader
        currentUser={currentUser}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        onLogoClick={() => navigate('/')}
        onLoginRequest={() => navigate('/')}
      />

      {/* Chat area — fills remaining space */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100dvh - 64px)' }}>
        {/* Chat panel with sidebar */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ChatPanel
            currentUser={currentUser}
            showSidebar
            initialChannel={initialChannel}
            initialDM={initialDM}
            style={{ height: '100%' }}
          />
        </div>

        {/* Right: online users — hidden on mobile */}
        <div className="hidden lg:flex flex-col w-44 flex-shrink-0 border-l"
          style={{ borderColor: isDarkMode ? 'rgba(126,62,21,0.25)' : 'rgba(208,115,57,0.15)', background: isDarkMode ? 'rgba(126,62,21,0.04)' : 'rgba(208,115,57,0.02)' }}>
          <div className="px-3 py-2 border-b flex items-center gap-2 flex-shrink-0"
            style={{ borderColor: isDarkMode ? 'rgba(126,62,21,0.2)' : 'rgba(208,115,57,0.12)' }}>
            <Users className="size-3 text-[#d07339]" />
            <span className="text-[10px] font-semibold text-[rgba(16,11,9,0.5)] dark:text-[rgba(247,241,237,0.5)]">
              Online — {onlineUsers.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-px">
            {onlineUsers.length === 0 && (
              <p className="text-[9px] text-[rgba(16,11,9,0.3)] dark:text-[rgba(247,241,237,0.3)] text-center mt-3">Connecting…</p>
            )}
            {onlineUsers.map(u => (
              <button key={u.username} onClick={() => navigate(`/users/${u.username}`)}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[rgba(208,115,57,0.08)] dark:hover:bg-[rgba(126,62,21,0.12)] transition-colors text-left">
                <div className="relative flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-[rgba(208,115,57,0.15)] dark:bg-[rgba(126,62,21,0.3)] overflow-hidden flex items-center justify-center">
                    {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" alt="" /> : <span className="text-[9px]">👤</span>}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 border border-white dark:border-[#120d09]" />
                </div>
                <span className="text-[10px] text-[rgba(16,11,9,0.65)] dark:text-[rgba(247,241,237,0.65)] truncate">{u.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
