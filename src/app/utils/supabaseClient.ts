import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'trash-bin-auth-v1',
  },
});

export function mapSupabaseUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    username:
      user.user_metadata?.username ||
      user.user_metadata?.full_name ||
      user.email?.split('@')[0] ||
      'User',
    profilePicture: user.user_metadata?.profilePicture || '',
    // Role is always 'user' here; App.tsx overwrites it from the profiles table after login.
    // Never read role from user_metadata — it can be self-modified by users.
    role: 'user' as string,
  };
}

// Fetch the authoritative role from the profiles table (server-side truth).
export async function fetchUserRole(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role || 'user';
}
