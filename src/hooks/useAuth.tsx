import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: {
    facilityName?: string;
    totalGames?: string;
    position?: string;
    experience?: string;
  }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  signInWithOAuth: (provider: 'google' | 'github' | 'azure') => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔐 Auth: Initializing...');
    
    // Set loading timeout fallback
    const timeout = setTimeout(() => {
      console.warn('⚠️ Auth: Loading timeout - forcing completion');
      setLoading(false);
    }, 3000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state change:', event, session ? 'Has session' : 'No session');
        clearTimeout(timeout);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Handle token refresh events
        if (event === 'TOKEN_REFRESHED') {
          console.log('✅ Auth: Token refreshed successfully');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Auth: Error getting session:', error);
      }
      console.log('🔐 Auth: Initial session check:', session ? 'Has session' : 'No session');
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error('❌ Auth: Fatal error:', err);
      clearTimeout(timeout);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Proactive session refresh - check and refresh before expiry
  useEffect(() => {
    if (!session) return;

    const checkAndRefreshSession = async () => {
      try {
        const expiresAt = session.expires_at;
        if (!expiresAt) return;

        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = expiresAt - now;
        
        // Refresh if less than 5 minutes until expiry
        if (timeUntilExpiry < 300) {
          console.log('🔄 Auth: Proactively refreshing session');
          const { data, error } = await supabase.auth.refreshSession();
          
          if (error) {
            console.error('❌ Auth: Failed to refresh session:', error);
          } else if (data.session) {
            console.log('✅ Auth: Session refreshed proactively');
            setSession(data.session);
            setUser(data.session.user);
          }
        }
      } catch (err) {
        console.error('❌ Auth: Error checking session:', err);
      }
    };

    // Check every minute
    const interval = setInterval(checkAndRefreshSession, 60000);
    
    // Check immediately on mount
    checkAndRefreshSession();

    return () => clearInterval(interval);
  }, [session]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata?: {
    facilityName?: string;
    totalGames?: string;
    position?: string;
    experience?: string;
  }) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          facility_name: metadata?.facilityName || '',
          total_games: metadata?.totalGames || '',
          position: metadata?.position || '',
          experience: metadata?.experience || '',
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  };

  const signInWithOAuth = async (provider: 'google' | 'github' | 'azure') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    signInWithOAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}