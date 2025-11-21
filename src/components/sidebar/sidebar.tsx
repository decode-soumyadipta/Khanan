// components/layout/sidebar/sidebar.tsx
"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Button,
  IconButton,
  Tooltip,
  Box,
  Paper,
  Chip,
  Badge,
  Avatar,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  SatelliteAlt as SatelliteIcon,
  Map as MapIcon,
  Assessment as AnalyticsIcon,
  People as UsersIcon,
  Settings as SettingsIcon,
  Logout,
  Login,
  VerifiedUser,
  Security,
  LightMode,
  DarkMode,
  Edit,
} from "@mui/icons-material";
import { useSidebar } from "./hooks";
import { useAuth } from '@/contexts/AuthContext';
import { GeoAnalystItemsInjection } from "./injections/GeoAnalystItemsInjection";
import { InjectedItemsSection } from "./InjectedItemsSection";
import { 
  LayoutDashboard, 
  BarChart3, 
  ShieldCheck,
  FileCheck,
  Building,
  LandPlot,
  Clock
} from 'lucide-react';

// ------------------ Types ------------------
interface UserData {
  id: string;
  _id: string;
  name: string;
  email: string;
  designation: string;
  department: string;
  profileImage?: string;
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt?: string;
}

// ------------------ Sidebar Items ------------------
const getSidebarItems = (userRole: string, isSuperAdmin: boolean, hasModuleAccess: (module: string) => boolean) => [
  // Dashboard Group
  [
    { 
      title: "Dashboard", 
      url: "/dashboard", 
      icon: LayoutDashboard,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'intelligence_analyst', 'state_mining_admin', 'district_mining_officer', 'senior_geo_officer', 'geo_analyst', 'reviewing_officer'],
      requiredPermission: null,
      requiredModule: null
    },
  ],
  // Mining Analysis Group
  [
    { 
      title: "Mining Analysis", 
      url: "/mining-analysis", 
      icon: SatelliteIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'intelligence_analyst', 'state_mining_admin', 'district_mining_officer', 'senior_geo_officer', 'geo_analyst', 'reviewing_officer'],
      requiredPermission: { resource: 'mining_analysis', action: 'read' },
      requiredModule: 'mining_operations'
    },
    { 
      title: "Analysis Results", 
      url: "/mining-analysis/results", 
      icon: BarChart3,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'intelligence_analyst', 'state_mining_admin', 'district_mining_officer', 'senior_geo_officer', 'geo_analyst', 'reviewing_officer'],
      requiredPermission: { resource: 'mining_analysis', action: 'read' },
      requiredModule: 'mining_operations'
    },
  ],
  // Compliance & Monitoring Group
  [
    { 
      title: "Compliance", 
      url: "/compliance", 
      icon: FileCheck,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'state_mining_admin', 'reviewing_officer', 'auditor'],
      requiredPermission: { resource: 'compliance_reports', action: 'read' },
      requiredModule: 'compliance_monitoring'
    },
    { 
      title: "Compliance Reports", 
      url: "/compliance/reports", 
      icon: FileCheck,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'state_mining_admin', 'reviewing_officer', 'auditor'],
      requiredPermission: { resource: 'compliance_reports', action: 'read' },
      requiredModule: 'compliance_monitoring'
    },
    { 
      title: "Approval Queue", 
      url: "/compliance/approvals", 
      icon: ShieldCheck,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'reviewing_officer'],
      requiredPermission: { resource: 'compliance_reports', action: 'approve' },
      requiredModule: 'compliance_monitoring'
    },
  ],
  // Maps & Visualization Group
  [
    { 
      title: "Maps", 
      url: "/maps", 
      icon: MapIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'intelligence_analyst', 'state_mining_admin', 'district_mining_officer', 'senior_geo_officer', 'geo_analyst', 'reviewing_officer', 'research_analyst', 'public_user'],
      requiredPermission: { resource: 'maps', action: 'view' },
      requiredModule: 'public_interface'
    },
    { 
      title: "2D Maps", 
      url: "/maps/2d", 
      icon: MapIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'intelligence_analyst', 'state_mining_admin', 'district_mining_officer', 'senior_geo_officer', 'geo_analyst', 'reviewing_officer', 'research_analyst', 'public_user'],
      requiredPermission: { resource: 'maps', action: 'view' },
      requiredModule: 'public_interface'
    },
    { 
      title: "3D Visualization", 
      url: "/maps/3d", 
      icon: Building,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'intelligence_analyst', 'state_mining_admin', 'district_mining_officer', 'senior_geo_officer', 'geo_analyst', 'reviewing_officer'],
      requiredPermission: { resource: 'maps', action: 'view_3d' },
      requiredModule: 'intelligence_analytics'
    },
  ],
  // Administration Group
  [
    { 
      title: "User Management", 
      url: "/users", 
      icon: UsersIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'state_mining_admin'],
      requiredPermission: { resource: 'user_management', action: 'read' },
      requiredModule: 'user_management'
    },
    { 
      title: "All Users", 
      url: "/users", 
      icon: UsersIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'state_mining_admin'],
      requiredPermission: { resource: 'user_management', action: 'read' },
      requiredModule: 'user_management'
    },
    { 
      title: "Create User", 
      url: "/users/create", 
      icon: UsersIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer', 'state_mining_admin'],
      requiredPermission: { resource: 'user_management', action: 'create' },
      requiredModule: 'user_management'
    },
  ],
  // System Group
  [
    { 
      title: "Settings", 
      url: "/settings", 
      icon: SettingsIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer'],
      requiredPermission: { resource: 'system_config', action: 'read' },
      requiredModule: 'system_config'
    },
    { 
      title: "System Analytics", 
      url: "/analytics", 
      icon: AnalyticsIcon,
      roles: ['system_super_admin', 'ntro_nodal_officer'],
      requiredPermission: { resource: 'system_analytics', action: 'read' },
      requiredModule: 'system_config'
    },
  ],
];

// Role Badge Component
const RoleBadge = ({ role, permissions }: { role: string, permissions: any[] }) => {
  const getRoleColor = () => {
    switch (role) {
      case 'system_super_admin':
        return 'error';
      case 'ntro_nodal_officer':
        return 'warning';
      case 'intelligence_analyst':
        return 'info';
      case 'state_mining_admin':
        return 'secondary';
      case 'district_mining_officer':
        return 'primary';
      case 'senior_geo_officer':
        return 'success';
      case 'geo_analyst':
        return 'default';
      case 'ai_model_custodian':
        return 'secondary';
      case 'auditor':
        return 'warning';
      case 'research_analyst':
        return 'info';
      case 'public_user':
        return 'default';
      default:
        return 'default';
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'system_super_admin':
        return 'Super Admin';
      case 'ntro_nodal_officer':
        return 'NTRO Officer';
      case 'intelligence_analyst':
        return 'Intelligence Analyst';
      case 'state_mining_admin':
        return 'State Admin';
      case 'district_mining_officer':
        return 'District Officer';
      case 'senior_geo_officer':
        return 'Senior Officer';
      case 'geo_analyst':
        return 'Geo Analyst';
      case 'ai_model_custodian':
        return 'AI Custodian';
      case 'auditor':
        return 'Auditor';
      case 'research_analyst':
        return 'Researcher';
      case 'public_user':
        return 'Public User';
      default:
        return role;
    }
  };

  return (
    <Chip
      label={getRoleLabel()}
      color={getRoleColor()}
      size="small"
      sx={{ 
        fontSize: '0.6rem',
        height: '20px',
        '& .MuiChip-label': { px: 1 }
      }}
    />
  );
};

// User Status Component
const UserStatus = ({ user }: { user: UserData }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
    <VerifiedUser 
      sx={{ 
        fontSize: 14, 
        color: user.isVerified ? 'success.main' : 'warning.main'
      }} 
    />
    <Box 
      sx={{ 
        fontSize: '0.7rem', 
        color: user.isVerified ? 'success.main' : 'warning.main',
        fontWeight: 600 
      }}
    >
      {user.isVerified ? 'Verified User' : 'Pending Verification'}
    </Box>
  </Box>
);

// Helper function to check permissions
const hasPermission = (permissions: any, requiredPermission: { resource: string, action: string } | null, isSuperAdmin: boolean, hasModuleAccess: (module: string) => boolean, requiredModule: string | null) => {
  // Super admin has all permissions
  if (isSuperAdmin) return true;
  
  // Check module access if required
  if (requiredModule && !hasModuleAccess(requiredModule)) return false;
  
  // No specific permission required
  if (!requiredPermission) return true;
  
  // Use the enhanced hasPermission method from AuthContext
  // This will be passed as a prop
  return false; // Placeholder - actual check happens in component
};

// ------------------ Sidebar Component ------------------
export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, isMobile, openMobile, setOpenMobile } = useSidebar();
  const { 
    user, 
    logout, 
    isAuthenticated, 
    login, 
    permissions, 
    isSuperAdmin, 
    hasPermission: authHasPermission,
    hasModuleAccess 
  } = useAuth();
  const isExpanded = open || openMobile;
  const isGeoAnalystDashboard = pathname?.startsWith('/geoanalyst-dashboard');

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const handleLogin = () => {
    router.push('/login');
    if (isMobile) setOpenMobile(false);
  };

  // Helper function to determine if user is a geo analyst
  const isGeoAnalyst = () => {
    if (!user || !permissions) return false;

    // Check if user has geo_analyst role in any state
    if (permissions?.states && Array.isArray(permissions.states)) {
      for (const state of permissions.states) {
        if (state.roles && Array.isArray(state.roles)) {
          const hasGeoAnalystRole = state.roles.some((role: any) =>
            role.role === 'geo_analyst' ||
            role.role === 'senior_geo_officer' ||
            role.role === 'ntro_nodal_officer'
          );
          if (hasGeoAnalystRole) return true;
        }
      }
    }

    // Check fallback criteria
    const departmentMatch = user.department === 'NTRO' ||
                           user.department === 'State_Mining' ||
                           user.department === 'District_Mining';
    const designationMatch = user.designation?.toLowerCase().includes('geospatial') ||
                            user.designation?.toLowerCase().includes('geo analyst') ||
                            user.designation?.toLowerCase().includes('analyst');

    return user.userType === 'GEO_ANALYST' || departmentMatch || designationMatch;
  };

  // Get user roles
  const userRoles = user ? ['authenticated'] : ['public_user'];
  const highestRole = isSuperAdmin() ? 'system_super_admin' : 
                     user?.designation?.toLowerCase().includes('admin') ? 'state_mining_admin' : 
                     'district_mining_officer';

  // Filter sidebar items based on user role and permissions
  const filteredSidebarItems = getSidebarItems(highestRole, isSuperAdmin(), hasModuleAccess)
    .map(group => 
      group.filter(item => {
        // Check role access
        const hasRoleAccess = item.roles.some(role => userRoles.includes(role)) || 
                             item.roles.includes('public_user') || 
                             isSuperAdmin();
        
        if (!hasRoleAccess) return false;
        
        // Check permission using AuthContext method
        if (item.requiredPermission) {
          return authHasPermission(
            item.requiredPermission.resource, 
            item.requiredPermission.action
          );
        }
        
        // Check module access
        if (item.requiredModule) {
          return hasModuleAccess(item);
        }
        
        return true;
      })
    )
    .filter(group => group.length > 0);

  const renderGroupedItems = () => (
    <>
      {filteredSidebarItems.map((group, groupIndex) => (
        <Box key={groupIndex} sx={{ mb: 0.5 }}>
          {group.map((item) => {
            const isActive = pathname === item.url;
            const IconComponent = item.icon;
            const activeClasses = isGeoAnalystDashboard
              ? "bg-white border border-[#E2E8F0] shadow-[0_14px_32px_rgba(15,23,42,0.16)] text-[#0f172a]"
              : "bg-blue-100/90 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800";
            const inactiveClasses = isGeoAnalystDashboard
              ? "text-[#1f2937] hover:bg-white/80 hover:shadow-[0_12px_26px_rgba(15,23,42,0.12)] border border-transparent"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent";

            return (
              <Tooltip
                key={item.title}
                title={isExpanded ? "" : item.title}
                placement="right"
              >
                <Link
                  href={item.url}
                  onClick={handleLinkClick}
                  className={cn(
                    "flex items-center p-2 rounded-lg transition-all duration-200 mx-1",
                    isActive ? activeClasses : inactiveClasses
                  )}
                >
                  <IconComponent
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isGeoAnalystDashboard
                        ? isActive
                          ? "text-[#2563eb]"
                          : "text-[#0f172a]"
                        : isActive
                          ? "text-blue-500"
                          : "text-gray-500"
                    )}
                  />
                  {isExpanded && (
                    <span className="ml-3 text-sm font-medium truncate">
                      {item.title}
                    </span>
                  )}
                </Link>
              </Tooltip>
            );
          })}
        </Box>
      ))}
    </>
  );

  // Handle theme toggle
  const handleThemeToggle = () => {
    console.log('Theme toggle clicked');
    // Implement theme logic here
  };

  return (
    <>
      {isMobile && openMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setOpenMobile(false)}
        />
      )}

      <Paper
        elevation={isGeoAnalystDashboard ? 0 : 2}
        sx={{
          background: isGeoAnalystDashboard ? '#ffffff' : undefined,
          boxShadow: isGeoAnalystDashboard
            ? '0 22px 48px rgba(15, 23, 42, 0.18)'
            : undefined,
          borderRight: isGeoAnalystDashboard ? '1px solid rgba(148, 163, 184, 0.25)' : undefined,
          overflow: 'hidden',
          borderRadius: isGeoAnalystDashboard ? '0 22px 22px 0' : undefined
        }}
        className={cn(
          "flex flex-col border-r border-gray-200 dark:border-gray-800",
          isGeoAnalystDashboard ? "bg-white" : "bg-white dark:bg-gray-900",
          "fixed md:relative z-40 h-[calc(100vh-56px)] mt-14",
          isMobile
            ? openMobile
              ? "w-[240px]"
              : "w-0"
            : open
              ? "w-[240px]"
              : "w-[60px]",
          !open && !openMobile && "pt-6",
          "transition-all duration-300 ease-in-out"
        )}
        square
      >
        <div className="h-full flex flex-col">
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Profile Section */}
            {isExpanded ? (
              <div className={cn(
                "border-b border-gray-100 dark:border-gray-800 px-3 py-3",
                isGeoAnalystDashboard
                  ? "bg-white mx-3 mt-6 mb-3"
                  : "bg-linear-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800"
              )}>
                {/* Avatar & Edit Row */}
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    badgeContent={
                      <VerifiedUser sx={{ 
                        fontSize: 16, 
                        color: user?.isVerified ? 'success.main' : 'warning.main',
                        bgcolor: 'white',
                        borderRadius: '50%',
                        p: 0.2
                      }} />
                    }
                  >
                    <Avatar
                      sx={{ 
                        width: 48, 
                        height: 48, 
                        bgcolor: 'primary.main',
                        cursor: 'pointer',
                        '&:hover': { transform: 'scale(1.05)' },
                        transition: 'transform 0.2s'
                      }}
                      onClick={() => router.push("/profile")}
                      src={user?.profileImage}
                    >
                      {user?.name?.charAt(0) || 'U'}
                    </Avatar>
                  </Badge>

                  <IconButton
                    size="small"
                    onClick={() => router.push("/profile/edit")}
                    sx={{
                      border: 1,
                      borderColor: 'primary.main',
                      borderRadius: 2,
                      p: 0.5,
                      minWidth: 'auto',
                      '&:hover': { bgcolor: 'primary.50' }
                    }}
                  >
                    <Edit sx={{ fontSize: 14 }} />
                  </IconButton>
                </div>

                {/* Name & Role */}
                <div className="flex items-center justify-between mb-2">
                  <h2
                    className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-primary cursor-pointer truncate flex-1 mr-2"
                    onClick={() => router.push("/profile")}
                  >
                    {user?.name || "Guest User"}
                  </h2>
                  {user && <RoleBadge role={highestRole} permissions={permissions?.allPermissions || []} />}
                </div>

                {/* Email Display */}
                {user?.email && (
                  <div className="text-xs text-gray-500 mb-2 truncate">
                    {user.email}
                  </div>
                )}

                {/* Department & Designation */}
                <div className="flex items-center text-gray-500 text-xs truncate mb-3">
                  <span className="truncate">
                    {user?.designation} • {user?.department}
                  </span>
                </div>

                {/* User Status */}
                {user && <UserStatus user={user} />}
              </div>
            ) : (
              <div className={cn(
                "relative group pt-6 p-2 flex justify-center border-b border-gray-100 dark:border-gray-800 pb-3",
                isGeoAnalystDashboard && "bg-white mx-2"
              )}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <VerifiedUser sx={{ 
                      fontSize: 14, 
                      color: user?.isVerified ? 'success.main' : 'warning.main',
                      bgcolor: 'white',
                      borderRadius: '50%',
                      p: 0.1
                    }} />
                  }
                >
                  <Tooltip 
                    title={user ? `${user.name} • ${highestRole}` : "Profile"} 
                    placement="right"
                  >
                    <Avatar
                      sx={{ 
                        width: 32, 
                        height: 32, 
                        bgcolor: 'primary.main',
                        cursor: 'pointer',
                        '&:hover': { transform: 'scale(1.1)' },
                        transition: 'transform 0.2s',
                        border: '1px solid',
                        borderColor: 'grey.300'
                      }}
                      onClick={() => router.push("/profile")}
                      src={user?.profileImage}
                    >
                      {user?.name?.charAt(0) || 'U'}
                    </Avatar>
                  </Tooltip>
                </Badge>
              </div>
            )}

            {/* Injected Profile Items Section - GEO ANALYST & OTHER ROLES */}
            <GeoAnalystItemsInjection />
            <InjectedItemsSection 
              section="profile"
              isExpanded={isExpanded}
              onLinkClick={handleLinkClick}
            />

            {/* Navigation Items */}
            <div className={cn(
              "space-y-1 p-2",
              isGeoAnalystDashboard && "bg-white mx-3 mt-7 mb-5"
            )}>
              {renderGroupedItems()}
            </div>
          </div>

          {/* Fixed Footer Section */}
          {(!isMobile || isExpanded) && (
            <div className={cn(
              "border-t border-gray-200 dark:border-gray-800 bg-inherit",
              isGeoAnalystDashboard && "bg-white border-white"
            )}>
              {/* Auth Button */}
              <Tooltip
                title={isExpanded ? "" : isAuthenticated ? "Logout" : "Login"}
                placement="right"
              >
                <Button
                  fullWidth
                  startIcon={
                    isAuthenticated ? (
                      <Logout sx={{ fontSize: 16, color: "error.main" }} />
                    ) : (
                      <Login sx={{ fontSize: 16, color: "primary.main" }} />
                    )
                  }
                  onClick={isAuthenticated ? logout : handleLogin}
                  sx={{
                    justifyContent: isExpanded ? "flex-start" : "center",
                    color: isAuthenticated ? "error.main" : "primary.main",
                    fontSize: "0.7rem",
                    py: 1,
                    px: isExpanded ? 2 : 1,
                    backgroundColor: "transparent",
                    minHeight: "36px",
                    borderRadius: 0,
                    '&:hover': {
                      backgroundColor: isAuthenticated
                        ? "rgba(244, 67, 54, 0.04)"
                        : "rgba(33, 150, 243, 0.04)",
                    },
                  }}
                >
                  {isExpanded && (
                    <span className="font-semibold">
                      {isAuthenticated ? "Logout" : "Login"}
                    </span>
                  )}
                </Button>
              </Tooltip>

              {/* Footer */}
              <Box
                sx={{
                  borderTop: 1,
                  borderColor: "divider",
                  px: isExpanded ? 1.5 : 0.5,
                  py: 1,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    minHeight: "32px",
                  }}
                >
                  {/* About + Contact (only if expanded) */}
                  {isExpanded && (
                    <Box sx={{ 
                      display: "flex", 
                      gap: 0.5,
                      flexWrap: 'nowrap',
                      maxWidth: '70%'
                    }}>
                      <Button
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          px: 0.75,
                          py: 0.25,
                          color: "text.secondary",
                          fontWeight: 600,
                          minWidth: 'auto',
                          textTransform: 'none',
                          lineHeight: 1.2,
                          "&:hover": { 
                            textDecoration: "underline",
                            backgroundColor: 'transparent'
                          },
                        }}
                        onClick={() => router.push("/about")}
                      >
                        About
                      </Button>
                      <Button
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          px: 0.75,
                          py: 0.25,
                          color: "text.secondary",
                          fontWeight: 600,
                          minWidth: 'auto',
                          textTransform: 'none',
                          lineHeight: 1.2,
                          "&:hover": { 
                            textDecoration: "underline",
                            backgroundColor: 'transparent'
                          },
                        }}
                        onClick={() => router.push("/contact")}
                      >
                        Contact
                      </Button>
                    </Box>
                  )}

                  {/* Theme Toggle */}
                  <IconButton
                    size="small"
                    onClick={handleThemeToggle}
                    sx={{ 
                      color: "text.secondary", 
                      ml: isExpanded ? 0 : "auto",
                      mr: isExpanded ? 0 : 'auto',
                      '&:hover': {
                        backgroundColor: 'action.hover'
                      },
                      minWidth: '32px',
                      minHeight: '32px'
                    }}
                  >
                    <DarkMode fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </div>
          )}
        </div>

        <style jsx>{`
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(156, 163, 175, 0.5);
            border-radius: 2px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(156, 163, 175, 0.7);
          }
        `}</style>
      </Paper>
    </>
  );
}