import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

const publicUserFromAuth = (authUser, profile) => {
  if (!authUser) return null;

  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name:
      profile?.full_name ??
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      authUser.email?.split('@')[0] ??
      '',
    full_name: profile?.full_name ?? authUser.user_metadata?.full_name ?? '',
    role: profile?.role ?? 'customer',
    phone: profile?.phone ?? authUser.user_metadata?.phone ?? '',
    avatar_url: profile?.avatar_url ?? authUser.user_metadata?.avatar_url ?? null,
    ...profile,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      return null;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load Supabase profile:', error);
      throw error;
    }

    const nextUser = publicUserFromAuth(authUser, profile);
    setUser(nextUser);
    return nextUser;
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) throw error;

      setSession(data.session ?? null);

      if (data.session?.user) {
        await loadProfile(data.session.user);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setSession(null);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'auth_required',
        message: error.message || 'Authentication required',
      });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [loadProfile]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await checkUserAuth();
      } catch (error) {
        if (mounted) {
          console.error('Auth initialization failed:', error);
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession ?? null);
      setIsAuthenticated(Boolean(nextSession?.user));

      if (nextSession?.user) {
        // Defer the profile query so the auth callback remains lightweight.
        setTimeout(() => {
          if (mounted) {
            loadProfile(nextSession.user).catch((error) => {
              console.error('Failed to refresh profile:', error);
              setAuthError({
                type: 'profile_error',
                message: error.message || 'Failed to load user profile',
              });
            });
          }
        }, 0);
      } else {
        setUser(null);
      }

      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkUserAuth, loadProfile]);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout failed:', error);
      throw error;
    }

    setSession(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    window.location.assign('/login');
  };

  const checkAppState = checkUserAuth;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
