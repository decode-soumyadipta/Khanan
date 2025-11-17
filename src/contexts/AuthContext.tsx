'use client';
import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@mui/material';
import { useSnackbar } from '@/contexts/SnackbarContext';
import apiClient from '@/services/apiClient';
import LoginForm from '@/app/login/LoginForm';

// Enhanced User Interface with hierarchical permissions
export interface User {
  primaryRole: any;
  id: string;
  _id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  profileImage?: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Enhanced Permission Interface
export interface Permission {
  _id: string;
  permissionKey: string;
  resource: string;
  action: string;
  module: string;
  category: string;
  scope: string;
  severityLevel: string;
  description: string;
  isSystemPermission: boolean;
  requiresSuperAdmin: boolean;
}

export interface PermissionAssignment {
  _id: string;
  permissionRef: Permission;
  permissionKey: string;
  resource: string;
  action: string;
  module: string;
  status: string;
  grantedAt: string;
  expiresAt?: string;
  grantedBy?: string;
  approvedBy?: string;
  overrides?: {
    isAllowed: boolean;
    scope?: string;
    conditions?: any;
  };
}

export interface Role {
  _id: string;
  role: string;
  description: string;
  level: number;
  category: string;
  permissions: PermissionAssignment[];
  roleStatus: string;
  isActive: boolean;
  assignedAt: string;
  roleExpiresAt?: string;
  config?: {
    maxConcurrentSessions: number;
    sessionTimeout: number;
    mfaRequired: boolean;
    ipRestrictions: string[];
    accessHours: {
      start: string;
      end: string;
      timezone: string;
    };
  };
}

export interface District {
  _id: string;
  districtName: string;
  districtCode: string;
  category: string;
  isActive: boolean;
  activatedAt?: string;
  miningData?: {
    totalLeases: number;
    activeMines: number;
    complianceRate: number;
    environmentalRisk: string;
  };
}

export interface UserState {
  _id: string;
  stateName: string;
  stateCode: string;
  region: string;
  districts: District[];
  roles: Role[];
  isActive: boolean;
  stateConfig?: {
    maxMiningArea: number;
    reportingFrequency: string;
    complianceThreshold: number;
    environmentalRules: {
      waterBodyProtection: boolean;
      forestAreaRestricted: boolean;
    };
    alerts: {
      violation: boolean;
      newMining: boolean;
      environmental: boolean;
      compliance: boolean;
    };
  };
  performance?: {
    totalDetections: number;
    violationRate: number;
    avgProcessingTime: number;
  };
}

export interface UserPermissions {
  // Hierarchical structure
  states: UserState[];
  // Flattened for easy access
  allPermissions: Array<{
    resource: string;
    action: string;
    module: string;
    scope: string;
    role: string;
    state: string;
  }>;
  // Quick access flags
  accessLevel: {
    isSuperAdmin: boolean;
    globalVerificationLevel: number;
    accessTier: string;
    departments: string[];
  };
  // Jurisdictions for location-based access
  jurisdictions: {
    states: Array<{
      stateName: string;
      stateCode: string;
      region: string;
    }>;
    districts: Array<{
      districtName: string;
      districtCode: string;
      stateCode: string;
      category: string;
    }>;
    national: boolean;
  };
}

interface AuthResponse {
  status: string;
  message: string;
  data: {
    user: User;
    permissions: UserPermissions;
    session?: {
      sessionId: string;
      riskScore: number;
      requiresReauth: boolean;
    };
  };
}

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  permissions: UserPermissions | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (updatedUserData: Partial<User>) => void;
  showLogin: (options?: { showGuestAccess?: boolean; guestRedirect?: string }) => void;
  hideLogin: () => void;
  allowGuestAccess: boolean;
  setAllowGuestAccess: (value: boolean) => void;
  refreshUser: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  loginModalOpen: boolean;
  
  // Enhanced Permission utilities for hierarchical system
  hasPermission: (resource: string, action: string, stateCode?: string, districtCode?: string, options?: any) => boolean;
  hasAnyPermission: (permissions: Array<{resource: string, action: string, stateCode?: string}>) => boolean;
  hasAllPermissions: (permissions: Array<{resource: string, action: string, stateCode?: string}>) => boolean;
  hasModuleAccess: (module: string) => boolean;
  getUserRoles: () => string[];
  getUserStates: () => string[];
  getUserDistricts: () => Array<{stateCode: string, districtCode: string}>;
  canManageResource: (resource: string, stateCode?: string) => boolean;
  isSuperAdmin: () => boolean;
  getAccessLevel: () => number;
  getAccessTier: () => string;
  // Permission checking with detailed context
  checkPermission: (resource: string, action: string, stateCode?: string, districtCode?: string) => Promise<{
    hasPermission: boolean;
    reason?: string;
    code?: string;
    role?: string;
    stateCode?: string;
  }>;
  // Additional utilities
  getTotalPermissionCount: () => number;
  getAccessibleModules: () => string[];
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cookie management utilities
const cookieManager = {
  getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  },

  deleteCookie(name: string) {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname};`;
  },

  hasAuthCookies(): boolean {
    return !!(this.getCookie('accessToken') || this.getCookie('refreshToken'));
  }
};

const AuthLoading = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      backgroundColor: 'background.paper',
      zIndex: 9999,
    }}
  >
    Loading ....
  </div>
);

const clearAllStorage = () => {
  if (typeof window !== 'undefined') {
    // Clear localStorage
    localStorage.removeItem('authState');
    localStorage.removeItem('userData');
    localStorage.removeItem('authPermissions');
    localStorage.removeItem('authTokens');
    localStorage.removeItem('swr-cache');
    
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('auth_') || key.startsWith('user_') || key.startsWith('session_')) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear cookies
    const cookieNames = ['accessToken', 'refreshToken', 'sessionId', 'auth_token', 'auth', 'token'];
    cookieNames.forEach(name => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname};`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
    });
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowGuestAccess, setAllowGuestAccess] = useState(false);
  const [loginContext, setLoginContext] = useState<{
    showGuestAccess?: boolean;
    guestRedirect?: string;
  }>({});

  // Track if we've done the initial auth check
  const initialAuthCheckDone = useRef(false);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔐 Checking authentication...');
      const response = await apiClient.get('/auth/me');
      
      if (response.data.data?.user) {
        const { user, permissions } = response.data.data;
        
        console.log('✅ Auth check successful - User:', user.name);
        console.log('✅ Permissions structure:', permissions);
        console.log('✅ Is Super Admin:', permissions?.accessLevel?.isSuperAdmin);
        console.log('✅ States access:', permissions?.jurisdictions?.states?.length || 0);
        
        setUser(user);
        setPermissions(permissions);
        setIsAuthenticated(true);
        
        // Store in localStorage
        localStorage.setItem('authState', 'authenticated');
        localStorage.setItem('userData', JSON.stringify(user));
        localStorage.setItem('authPermissions', JSON.stringify(permissions));
        
        return true;
      }
      throw new Error('No user data');
    } catch (error: any) {
      console.log('❌ Auth check failed:', error?.message);
      
      // Clear auth state on any error
      setIsAuthenticated(false);
      setUser(null);
      setPermissions(null);
      
      // Clear storage on 401 errors
      if (error?.status === 401) {
        console.log('🔄 Clearing storage due to 401 error');
        clearAllStorage();
      }
      
      return false;
    }
  }, []);

  // Initialize auth state from localStorage on mount
  const initializeAuthFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return;

    const storedAuthState = localStorage.getItem('authState');
    const storedUserData = localStorage.getItem('userData');
    const storedPermissions = localStorage.getItem('authPermissions');

    if (storedAuthState === 'authenticated' && storedUserData && storedPermissions) {
      try {
        const userData = JSON.parse(storedUserData);
        const permissionsData = JSON.parse(storedPermissions);
        
        setUser(userData);
        setPermissions(permissionsData);
        setIsAuthenticated(true);
        
        console.log('🔄 Auth state restored from storage');
      } catch (error) {
        console.error('Error parsing stored auth data:', error);
        clearAllStorage();
      }
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    // Only run the initial auth check once on component mount
    if (!initialAuthCheckDone.current) {
      initialAuthCheckDone.current = true;
      
      const initializeAuth = async () => {
        try {
          // First, set auth state from localStorage for immediate UI response
          initializeAuthFromStorage();
          
          // Then verify with the server in the background
          await checkAuth();
        } catch (error) {
          console.error('Auth initialization failed:', error);
        }
      };

      initializeAuth();
    }
  }, [checkAuth, initializeAuthFromStorage]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    console.log('🔐 Attempting login...');
    setLoading(true);
    
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', { 
        email, 
        password 
      }, {
        withCredentials: true
      });
      
      console.log('✅ Login API response received');
      
      if (response.data.status === 'success') {
        const { user, permissions } = response.data.data;
        
        console.log('👤 Setting user state:', user.name);
        console.log('🔐 Setting permissions structure:', permissions);
        
        setUser(user);
        setPermissions(permissions);
        setIsAuthenticated(true);
        
        // Store in localStorage
        localStorage.setItem('authState', 'authenticated');
        localStorage.setItem('userData', JSON.stringify(user));
        localStorage.setItem('authPermissions', JSON.stringify(permissions));
        
        setLoginModalOpen(false);
        showSnackbar('Login successful!', 'success');
        
        console.log('✅ Login completed successfully');
        return true;
      }
      
      showSnackbar('Login failed. Please try again.', 'error');
      return false;
    } catch (error: any) {
      const errorMessage = error.data?.message || error.message || 'Login failed';
      console.error('❌ Login error:', errorMessage);
      
      showSnackbar(errorMessage, 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  const logout = useCallback(async (): Promise<void> => {
    console.log('🚪 Logging out...');
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('Logout API failed:', err);
    } finally {
      // Clear state
      setIsAuthenticated(false);
      setUser(null);
      setPermissions(null);
      setLoginModalOpen(false);
      
      // Clear storage
      clearAllStorage();
      
      // Reset the auth check flag
      initialAuthCheckDone.current = false;
      
      showSnackbar('Logged out successfully', 'info');
      router.push('/');
    }
  }, [showSnackbar, router]);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.get('/auth/me');
      if (response.data.data?.user) {
        const { user, permissions } = response.data.data;
        
        setUser(user);
        setPermissions(permissions);
        
        // Update localStorage
        localStorage.setItem('userData', JSON.stringify(user));
        localStorage.setItem('authPermissions', JSON.stringify(permissions));
        
        showSnackbar('Profile updated', 'success');
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      showSnackbar('Failed to update profile', 'error');
    }
  }, [showSnackbar]);

  const updateUser = useCallback((updatedUserData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const newUser = { ...prev, ...updatedUserData };
      localStorage.setItem('userData', JSON.stringify(newUser));
      return newUser;
    });
  }, []);

  const showLogin = useCallback((options?: { showGuestAccess?: boolean; guestRedirect?: string }) => {
    setLoginContext(options || {});
    setLoginModalOpen(true);
  }, []);

  const hideLogin = useCallback(() => {
    setLoginModalOpen(false);
  }, []);

  const handleGuestAccess = useCallback(() => {
    setAllowGuestAccess(true);
    setLoginModalOpen(false);
    showSnackbar('Continuing as guest', 'info');
    if (loginContext?.guestRedirect) {
      router.push(loginContext.guestRedirect);
    }
  }, [showSnackbar, router, loginContext]);

  const handleModalClose = (_: {}, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick') {
      hideLogin();
      showSnackbar('Please sign in to access this feature', 'info');
      return;
    }
    if (reason === 'escapeKeyDown') {
      hideLogin();
    }
  };

  // Enhanced Permission checking utilities for hierarchical system with super admin support
  const hasPermission = useCallback((resource: string, action: string, stateCode?: string, districtCode?: string): boolean => {
    // Super admin has all permissions (check both accessLevel and role-based)
    const isUserSuperAdmin = permissions?.accessLevel?.isSuperAdmin || 
                            permissions?.states?.some(state => 
                              state.roles?.some(role => role.role === 'system_super_admin' && role.isActive)
                            );
    
    if (isUserSuperAdmin) return true;
    
    // Check in flattened permissions
    if (permissions?.allPermissions && permissions.allPermissions.length > 0) {
      return permissions.allPermissions.some(permission => 
        permission.resource === resource && 
        permission.action === action &&
        (!stateCode || permission.state === stateCode || permission.scope === 'national' || permission.scope === 'global')
      );
    }
    
    return false;
  }, [permissions]);

  const hasAnyPermission = useCallback((requiredPermissions: Array<{resource: string, action: string, stateCode?: string}>): boolean => {
    return requiredPermissions.some(({ resource, action, stateCode }) => 
      hasPermission(resource, action, stateCode)
    );
  }, [hasPermission]);

  const hasAllPermissions = useCallback((requiredPermissions: Array<{resource: string, action: string, stateCode?: string}>): boolean => {
    return requiredPermissions.every(({ resource, action, stateCode }) => 
      hasPermission(resource, action, stateCode)
    );
  }, [hasPermission]);

  const hasModuleAccess = useCallback((module: string): boolean => {
    // Super admin has access to all modules
    if (isSuperAdmin()) return true;
    
    if (permissions?.allPermissions && permissions.allPermissions.length > 0) {
      return permissions.allPermissions.some(permission => permission.module === module);
    }
    
    return false;
  }, [permissions, ]);

  const canManageResource = useCallback((resource: string, stateCode?: string): boolean => {
    return hasPermission(resource, 'manage', stateCode) || 
           hasPermission(resource, 'admin', stateCode) ||
           hasPermission(resource, 'configure', stateCode);
  }, [hasPermission]);

  // SAFE ACCESS METHODS - Handle null/undefined permissions and super admin logic
  const isSuperAdmin = useCallback((): boolean => {
    return permissions?.accessLevel?.isSuperAdmin || 
           permissions?.states?.some(state => 
             state.roles?.some(role => role.role === 'system_super_admin' && role.isActive)
           ) || false;
  }, [permissions]);

  const getAccessLevel = useCallback((): number => {
    return permissions?.accessLevel?.globalVerificationLevel || 1;
  }, [permissions]);

  const getAccessTier = useCallback((): string => {
    return permissions?.accessLevel?.accessTier || 'basic';
  }, [permissions]);

  const getUserRoles = useCallback((): string[] => {
    if (!permissions?.states) return [];
    
    const roles = new Set<string>();
    
    permissions.states.forEach(state => {
      state.roles?.forEach(role => {
        if (role.isActive && role.roleStatus === 'active') {
          roles.add(role.role);
        }
      });
    });
    
    return Array.from(roles);
  }, [permissions]);

  const getUserStates = useCallback((): string[] => {
    if (!permissions?.jurisdictions?.states) return [];
    return permissions.jurisdictions.states.map(state => state.stateCode);
  }, [permissions]);

  const getUserDistricts = useCallback((): Array<{stateCode: string, districtCode: string}> => {
    return permissions?.jurisdictions?.districts || [];
  }, [permissions]);

  const checkPermission = useCallback(async (
    resource: string, 
    action: string, 
    stateCode?: string, 
    districtCode?: string
  ): Promise<{
    hasPermission: boolean;
    reason?: string;
    code?: string;
    role?: string;
    stateCode?: string;
  }> => {
    try {
      const response = await apiClient.post('/auth/check-permission', {
        resource,
        action,
        stateCode,
        districtCode
      });
      
      return response.data.data.details || { hasPermission: false };
    } catch (error) {
      console.error('Permission check failed:', error);
      return { hasPermission: false, reason: 'Permission check failed', code: 'CHECK_FAILED' };
    }
  }, []);

  // Get total permission count (including super admin auto-grant)
  const getTotalPermissionCount = useCallback((): number => {
    if (isSuperAdmin()) {
      return Number.MAX_SAFE_INTEGER; // Super admin has infinite permissions
    }
    
    return permissions?.allPermissions?.length || 0;
  }, [permissions, isSuperAdmin]);

  // Get modules the user has access to
  const getAccessibleModules = useCallback((): string[] => {
    if (isSuperAdmin()) {
      // Return all possible modules for super admin
      return [
        "user_management", "role_management", "system_config", "mining_operations",
        "compliance_monitoring", "intelligence_analytics", "data_export", 
        "public_interface", "audit_logs"
      ];
    }
    
    if (!permissions?.allPermissions) return [];
    
    const modules = new Set<string>();
    permissions.allPermissions.forEach(permission => modules.add(permission.module));
    return Array.from(modules);
  }, [permissions, isSuperAdmin]);

  const value = useMemo(() => ({
    isAuthenticated,
    user,
    permissions,
    loading,
    login,
    logout,
    updateUser,
    showLogin,
    hideLogin,
    allowGuestAccess,
    setAllowGuestAccess,
    refreshUser,
    checkAuth,
    loginModalOpen,
    
    // Enhanced Permission utilities
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    getUserRoles,
    getUserStates,
    getUserDistricts,
    canManageResource,
    isSuperAdmin,
    getAccessLevel,
    getAccessTier,
    checkPermission,
    
    // Additional utilities
    getTotalPermissionCount,
    getAccessibleModules,
  }), [
    isAuthenticated, user, permissions, loading, loginModalOpen,
    login, logout, updateUser, showLogin, hideLogin, allowGuestAccess,
    refreshUser, checkAuth, hasPermission, hasAnyPermission, hasAllPermissions,
    hasModuleAccess, getUserRoles, getUserStates, getUserDistricts, 
    canManageResource, isSuperAdmin, getAccessLevel, getAccessTier, checkPermission,
    getTotalPermissionCount, getAccessibleModules
  ]);

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AuthLoading /> : children}

      <Dialog 
        open={loginModalOpen} 
        onClose={handleModalClose} 
        sx={{ zIndex: 99999 }}
        maxWidth="sm"
        fullWidth
      >
        <LoginForm
          onLoginSuccess={async (email, password) => {
            const success = await login(email, password);
            if (success) hideLogin();
          }}
          onSignUp={() => {
            hideLogin();
            showSnackbar('Please contact system administrator for account access', 'info');
          }}
          onForgotPassword={() => {
            hideLogin();
            showSnackbar('Please contact system administrator for password reset', 'info');
          }}
          loading={loading}
          showGuestOption={loginContext?.showGuestAccess ?? true}
          onGuestAccess={handleGuestAccess}
        />
      </Dialog>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};