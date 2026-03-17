import React, { createContext, useCallback, useEffect, useState } from 'react';
import keycloak from '../config/keycloak';
import * as authService from '../services/authService';
import { SiteRoles } from '../services/siteService';

// Create context
export const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detect authentication state changes and update user info
  useEffect(() => {
    // Initialize Keycloak without authentication
    if (!keycloak.didInitialize) {
      keycloak.init({
        onLoad: 'login-required',
        pkceMethod: 'S256', // For better security
        enableLogging: process.env.NODE_ENV !== 'production', // Log only in development
        checkLoginIframe: false // Disable iframe checking to prevent issues with redirects
      }).then(authenticated => {
        if (authenticated) {
          console.log('User is already authenticated');
          let userInfo = authService.getUserInfo();
          
          // --- FIX: ENSURE ROLES ARE LOADED ---
          // Explicitly extract realm roles from the Keycloak instance
          // This guarantees we have 'custom-iso-uploader' if assigned in Keycloak
          const keycloakRoles = keycloak.realmAccess ? keycloak.realmAccess.roles : [];
          
          // Merge with any roles authService might have already parsed
          const currentRoles = userInfo.roles || [];
          const finalRoles = [...new Set([...currentRoles, ...keycloakRoles])];
          
          // Update user object with complete roles list
          userInfo = { ...userInfo, roles: finalRoles };
          // ------------------------------------

          setCurrentUser(userInfo);
          setLoading(false);
          
          // Set up token refresh
          keycloak.onTokenExpired = () => {
            console.log('Token expired, attempting refresh...');
            keycloak.updateToken(70)
              .then(refreshed => {
                if (refreshed) {
                  console.log('Token successfully refreshed');
                  // Update roles on refresh too, in case they changed
                  const refreshedRoles = keycloak.realmAccess ? keycloak.realmAccess.roles : [];
                  setCurrentUser(prev => ({ ...prev, roles: refreshedRoles }));
                } else {
                  console.log('Token still valid');
                }
              })
              .catch(error => {
                console.error('Error during token refresh', error);
              });
          };
        } else {
          console.log('Not authenticated');
          setLoading(false);
        }
      }).catch(error => {
        console.error('Failed to initialize Keycloak', error);
        setLoading(false);
        setError('Failed to initialize authentication system');
      });
    }

    // Set up a listener for auth state changes if needed
    const handleTokenExpired = () => {
      console.log('Token expired event received');
    };

    keycloak.onTokenExpired = handleTokenExpired;
  }, []);

  // Login function
  const login = useCallback((option) => {
    setLoading(true);
    try {
      authService.login(option);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to login. Please try again.');
      setLoading(false);
      return false;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    setLoading(true);
    try {
      authService.logout();
      setCurrentUser(null);
      setLoading(false);
    } catch (error) {
      console.error('Logout error:', error);
      setError('Failed to logout. Please try again.');
      setLoading(false);
    }
  }, []);

  // Check if user is a global admin
  const isGlobalAdmin = useCallback(() => {
    if (!currentUser) return false;
    // Check for GLOBAL_ADMIN role
    if (Array.isArray(currentUser.roles)) {
      return currentUser.roles.includes(SiteRoles.GLOBAL_ADMIN.toString());
    }
    return false;
  }, [currentUser]);

  // Check if user is a site admin for a specific site (or any site if siteName is not provided)
  const isSiteAdmin = useCallback((siteName) => {
    if (!currentUser || !Array.isArray(currentUser.roles)) return false;

    // Global admins are automatically site admins for all sites
    if (isGlobalAdmin()) return true;

    // If no specific site name is provided, check if user is admin for any site
    if (!siteName) {
      return currentUser.roles.some(role => role.endsWith('_site_admin'));
    }
    
    // Check for specific site admin role in format: <site_name>_site_admin
    const siteAdminRole = `${siteName}_site_admin`;
    return currentUser.roles.includes(siteAdminRole);
  }, [currentUser, isGlobalAdmin]);

  // Get all sites for which the user is an admin
  const getAdminSites = useCallback(() => {
    if (!currentUser || !Array.isArray(currentUser.roles)) return [];
    
    // If user is global admin, they don't have specific site admin roles (they're admin for all)
    if (isGlobalAdmin()) return [];
    
    // Extract site names from <site_name>_site_admin roles
    return currentUser.roles
      .filter(role => role.endsWith('_site_admin'))
      .map(role => role.replace('_site_admin', ''));
  }, [currentUser, isGlobalAdmin]);

  // Check if user is a regular user
  const isUser = useCallback(() => {
    // All authenticated users have basic user role
    return !!currentUser;
  }, [currentUser]);

  // Get highest user role for UI purposes (used for color coding)
  const getUserHighestRole = useCallback(() => {
    if (isGlobalAdmin()) return SiteRoles.GLOBAL_ADMIN;
    if (isSiteAdmin()) return SiteRoles.SITE_ADMIN;
    return SiteRoles.USER;
  }, [isGlobalAdmin, isSiteAdmin]);

  // Check if user is authorized for a given action
  const isAuthorized = useCallback((requiredRole = SiteRoles.USER) => {
    if (!currentUser) return false;
  
    switch (requiredRole) {
      case SiteRoles.GLOBAL_ADMIN:
        return isGlobalAdmin();
      case SiteRoles.SITE_ADMIN:
        return isGlobalAdmin() || isSiteAdmin();
      case SiteRoles.USER:
        return true; // All authenticated users are basic users
      default:
        return false;
    }
  }, [currentUser, isGlobalAdmin, isSiteAdmin]);

  // Update token (to call before API requests)
  const updateToken = useCallback(async () => {
    try {
      return await authService.updateToken();
    } catch (error) {
      console.error('Error updating token:', error);
      logout(); // Logout if refresh token has expired
      return false;
    }
  }, [logout]);

  // Get current access token
  const getAccessToken = useCallback(() => {
    return authService.getToken();
  }, []);

  // Context value
  const value = {
    currentUser,
    setCurrentUser,
    loading,
    error,
    login,
    logout,
    isGlobalAdmin,
    isSiteAdmin,
    getAdminSites,
    isUser,
    getUserHighestRole,
    isAuthorized,
    updateToken,
    getAccessToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};