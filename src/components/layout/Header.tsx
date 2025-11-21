'use client';
import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from "next/navigation";
import {
  NotificationsOutlined,
  Fullscreen,
  FullscreenExit,
  Search as SearchIcon,
  SatelliteAlt,
  Map,
  Assessment,
  People,
  Settings,
  AdminPanelSettings,
  Security
} from '@mui/icons-material';
import {
  Avatar,
  Badge,
  IconButton,
  Tooltip,
  useTheme,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { styled } from '@mui/material/styles';
import { SidebarTrigger, useSidebar } from '../sidebar';
import Logo from '@/components/ui/Logo';

// Custom styled components - Dark Royal Blue Theme with Golden Text
const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)', // amber-400 to yellow-400 to amber-400
  backgroundClip: 'text',
  textFillColor: 'transparent',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 'bold',
  cursor: 'pointer',
  filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))',
  letterSpacing: '-0.025em'
}));

const RoleChip = styled(Chip)(({ theme }) => ({
  fontWeight: 'bold',
  fontSize: '0.7rem',
  height: '24px',
  '& .MuiChip-label': { px: 1 }
}));

// Custom hook for mobile detection
const useIsMobile = () => {
  const theme = useTheme();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < theme.breakpoints.values.md);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [theme.breakpoints.values.md]);

  return isMobile;
};

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const { toggleSidebar } = useSidebar();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profileMenuAnchor, setProfileMenuAnchor] = useState<null | HTMLElement>(null);
  const isMobile = useIsMobile();
  const {
    isAuthenticated,
    user,
    permissions,
    logout,
    isSuperAdmin,
    getAccessLevel,
    getAccessTier,
    getUserRoles,
    hasModuleAccess
  } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const fullscreenPref = localStorage.getItem("isFullscreen") === "true";
      setIsFullscreen(fullscreenPref);

      const handleFullscreenChange = () => {
        const isNowFullscreen = !!document.fullscreenElement;
        setIsFullscreen(isNowFullscreen);
        localStorage.setItem("isFullscreen", isNowFullscreen.toString());
      };

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setProfileMenuAnchor(null);
  };

  const handleLogout = async () => {
    handleProfileMenuClose();
    await logout();
  };

  const getRoleColor = (role: string) => {
    const roleColors: { [key: string]: any } = {
      'system_super_admin': 'error',
      'ntro_nodal_officer': 'warning',
      'intelligence_analyst': 'info',
      'state_mining_admin': 'secondary',
      'district_mining_officer': 'primary',
      'senior_geo_officer': 'success',
      'geo_analyst': 'info',
      'ai_model_custodian': 'secondary',
      'auditor': 'warning',
      'research_analyst': 'info',
      'public_user': 'default'
    };
    return roleColors[role] || 'default';
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: { [key: string]: string } = {
      'system_super_admin': 'Super Admin',
      'ntro_nodal_officer': 'NTRO Officer',
      'intelligence_analyst': 'Intelligence Analyst',
      'state_mining_admin': 'State Admin',
      'district_mining_officer': 'District Officer',
      'senior_geo_officer': 'Senior Officer',
      'geo_analyst': 'Geo Analyst',
      'ai_model_custodian': 'AI Custodian',
      'auditor': 'Auditor',
      'research_analyst': 'Researcher',
      'public_user': 'Public User'
    };
    return roleLabels[role] || role;
  };

  const getAccessTierColor = (tier: string) => {
    const tierColors: { [key: string]: any } = {
      'ntro_privileged': 'error',
      'government': 'warning',
      'enterprise': 'info',
      'premium': 'secondary',
      'standard': 'primary',
      'basic': 'default'
    };
    return tierColors[tier] || 'default';
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'analysis':
        router.push('/mining-analysis/new');
        break;
      case 'maps':
        router.push('/maps');
        break;
      case 'reports':
        router.push('/compliance/reports');
        break;
      case 'admin':
        router.push('/admin/users');
        break;
      default:
        break;
    }
  };

  const getHighestRole = () => {
    const roles = getUserRoles();
    if (roles.includes('system_super_admin')) return 'system_super_admin';
    if (roles.includes('ntro_nodal_officer')) return 'ntro_nodal_officer';
    if (roles.includes('intelligence_analyst')) return 'intelligence_analyst';
    if (roles.includes('state_mining_admin')) return 'state_mining_admin';
    if (roles.includes('district_mining_officer')) return 'district_mining_officer';
    if (roles.includes('senior_geo_officer')) return 'senior_geo_officer';
    if (roles.includes('geo_analyst')) return 'geo_analyst';
    return roles[0] || 'public_user';
  };

  const isGeoAnalystDashboard = pathname?.startsWith('/geoanalyst-dashboard');

  const sidebarIconColor = isGeoAnalystDashboard ? '#1f2937' : '#fcd34d';
  const sidebarIconHover = isGeoAnalystDashboard ? 'rgba(15, 23, 42, 0.12)' : 'rgba(251, 191, 36, 0.1)';
  const sidebarIconHoverColor = isGeoAnalystDashboard ? '#0f172a' : '#fbbf24';
  const actionIconColor = isGeoAnalystDashboard ? '#1f2937' : '#fcd34d';
  const actionIconHoverColor = isGeoAnalystDashboard ? '#0f172a' : '#fbbf24';
  const actionIconHoverBg = isGeoAnalystDashboard ? 'rgba(15, 23, 42, 0.08)' : 'rgba(251, 191, 36, 0.1)';

  const renderLeftSection = () => {
    if (isGeoAnalystDashboard) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 } }}>
          <IconButton
            onClick={toggleSidebar}
            sx={{
              color: sidebarIconColor,
              '&:hover': {
                backgroundColor: sidebarIconHover,
                color: sidebarIconHoverColor
              }
            }}
          >
            <SidebarTrigger asChild />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2.5 } }}>
            <Box
              component="img"
              src="https://doc.ux4g.gov.in/assets/img/logo/national-emblem.png"
              alt="National emblem"
              loading="lazy"
              sx={{ height: { xs: 32, md: 44 }, width: 'auto' }}
            />
            <Box
              component="img"
              src="https://doc.ux4g.gov.in/assets/img/logo/company-logo.png"
              alt="Department logo"
              loading="lazy"
              sx={{ height: { xs: 32, md: 44 }, width: 'auto' }}
            />
            <Box
              component="img"
              src="https://doc.ux4g.gov.in/assets/img/logo/g20-summit.png"
              alt="G20 summit"
              loading="lazy"
              sx={{ height: { xs: 28, md: 40 }, width: 'auto', display: { xs: 'none', sm: 'block' } }}
            />
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton
          onClick={toggleSidebar}
          sx={{
            color: sidebarIconColor,
            '&:hover': {
              backgroundColor: sidebarIconHover,
              color: sidebarIconHoverColor
            }
          }}
        >
          <SidebarTrigger asChild />
        </IconButton>
        <Logo size={40} withCircle={true} />
        <GradientText
          variant="h6"
          onClick={() => router.push("/dashboard")}
          sx={{
            ml: 1,
            display: { xs: 'none', sm: 'block' },
            cursor: 'pointer'
          }}
        >
          KhananNetra
        </GradientText>
      </Box>
    );
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: theme.zIndex.drawer + 1,
        background: isGeoAnalystDashboard
          ? '#ffffff'
          : 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)',
        borderBottom: isGeoAnalystDashboard
          ? '1px solid rgba(15, 23, 42, 0.08)'
          : '1px solid rgba(251, 191, 36, 0.2)',
        boxShadow: isGeoAnalystDashboard
          ? '0 18px 45px rgba(15, 23, 42, 0.18)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        color: isGeoAnalystDashboard ? '#1f2937' : '#ffffff'
      }}
    >
      <Toolbar sx={{
        justifyContent: 'space-between',
        p: 0,
        px: isGeoAnalystDashboard ? { xs: 1.5, md: 3 } : { xs: 1, sm: 2 },
        minHeight: isGeoAnalystDashboard ? '56px !important' : '64px !important'
      }}>
        {/* Left: Sidebar + Branding */}
        {renderLeftSection()}

        {/* Center: Quick Actions (Desktop Only) */}
        {!isMobile && isAuthenticated && !isGeoAnalystDashboard && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="New Mining Analysis">
              <Button
                variant="outlined"
                size="small"
                startIcon={<SatelliteAlt />}
                onClick={() => handleQuickAction('analysis')}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontSize: '0.8rem',
                  color: '#fcd34d',
                  borderColor: 'rgba(252, 211, 77, 0.5)',
                  '&:hover': {
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    color: '#fbbf24'
                  }
                }}
              >
                New Analysis
              </Button>
            </Tooltip>

            <Tooltip title="View Maps">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Map />}
                onClick={() => handleQuickAction('maps')}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontSize: '0.8rem',
                  color: '#fcd34d',
                  borderColor: 'rgba(252, 211, 77, 0.5)',
                  '&:hover': {
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    color: '#fbbf24'
                  }
                }}
              >
                Maps
              </Button>
            </Tooltip>

            <Tooltip title="Compliance Reports">
              <Button
                variant="outlined"
                size="small"
                startIcon={<Assessment />}
                onClick={() => handleQuickAction('reports')}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  fontSize: '0.8rem',
                  color: '#fcd34d',
                  borderColor: 'rgba(252, 211, 77, 0.5)',
                  '&:hover': {
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    color: '#fbbf24'
                  }
                }}
              >
                Reports
              </Button>
            </Tooltip>

            {/* Admin Panel Button (for authorized users) */}
            {(isSuperAdmin() || hasModuleAccess('user_management')) && (
              <Tooltip title="Admin Panel">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AdminPanelSettings />}
                  onClick={() => handleQuickAction('admin')}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    fontSize: '0.8rem',
                    backgroundColor: '#fbbf24',
                    color: '#1a1a2e',
                    fontWeight: 600,
                    '&:hover': {
                      backgroundColor: '#fcd34d',
                      boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
                    }
                  }}
                >
                  Admin
                </Button>
              </Tooltip>
            )}
          </Box>
        )}

        {/* Right: User Actions */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 0.5, sm: 1 }
        }}>
          {/* Search Icon */}
          <Tooltip title="Search">
            <IconButton
              onClick={() => router.push('/search')}
              size="small"
              sx={{
                color: actionIconColor,
                '&:hover': {
                  color: actionIconHoverColor,
                  backgroundColor: actionIconHoverBg
                }
              }}
            >
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Notifications */}
          {isAuthenticated && (
            <Tooltip title="Notifications">
              <IconButton
                onClick={() => router.push("/notifications")}
                size="small"
                sx={{
                  color: actionIconColor,
                  '&:hover': {
                    color: actionIconHoverColor,
                    backgroundColor: actionIconHoverBg
                  }
                }}
              >
                <Badge
                  badgeContent={0}
                  overlap="circular"
                  sx={{
                    '& .MuiBadge-badge': {
                      backgroundColor: '#fbbf24',
                      color: '#1a1a2e',
                      fontWeight: 600
                    }
                  }}
                >
                  <NotificationsOutlined fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          {/* User Profile & Role */}
          {isAuthenticated && user && permissions && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {/* Access Level Badge (Desktop Only) */}
              {!isMobile && (
                <>
                  <RoleChip
                    label={`Level ${getAccessLevel()}`}
                    color={getAccessLevel() >= 4 ? 'warning' : 'primary'}
                    size="small"
                  />
                  <RoleChip
                    label={getAccessTier()}
                    color={getAccessTierColor(getAccessTier())}
                    size="small"
                  />
                  <RoleChip
                    label={getRoleLabel(getHighestRole())}
                    color={getRoleColor(getHighestRole())}
                    size="small"
                  />
                </>
              )}

              {/* User Avatar with Menu */}
              <Tooltip title={`${user.name} - ${user.designation}`}>
                <IconButton
                  onClick={handleProfileMenuOpen}
                  size="small"
                  sx={{ p: 0.5 }}
                >
                  <Avatar
                    src={user.profileImage}
                    alt={user.name}
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: isGeoAnalystDashboard ? '#0b9e43' : '#fbbf24',
                      color: isGeoAnalystDashboard ? '#ffffff' : '#1a1a2e',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      border: isGeoAnalystDashboard
                        ? '2px solid rgba(15, 23, 42, 0.12)'
                        : '2px solid rgba(251, 191, 36, 0.5)'
                    }}
                  >
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </Avatar>
                </IconButton>
              </Tooltip>

              {/* Profile Menu */}
              <Menu
                anchorEl={profileMenuAnchor}
                open={Boolean(profileMenuAnchor)}
                onClose={handleProfileMenuClose}
                onClick={handleProfileMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{
                  sx: isGeoAnalystDashboard
                    ? {
                        background: '#ffffff',
                        border: '1px solid rgba(15, 23, 42, 0.08)',
                        boxShadow: '0 20px 45px rgba(15, 23, 42, 0.18)',
                        '& .MuiMenuItem-root': {
                          color: '#1f2937',
                          '&:hover': {
                            backgroundColor: 'rgba(15, 23, 42, 0.06)',
                            color: '#0f172a'
                          }
                        },
                        '& .MuiListItemIcon-root': {
                          color: '#0b9e43'
                        },
                        '& .MuiDivider-root': {
                          borderColor: 'rgba(15, 23, 42, 0.08)'
                        }
                      }
                    : {
                        background: 'linear-gradient(to bottom, #1a1a2e, #16213e)',
                        border: '1px solid rgba(251, 191, 36, 0.2)',
                        '& .MuiMenuItem-root': {
                          color: '#ffffff',
                          '&:hover': {
                            backgroundColor: 'rgba(251, 191, 36, 0.1)',
                            color: '#fcd34d'
                          }
                        },
                        '& .MuiListItemIcon-root': {
                          color: '#fcd34d'
                        },
                        '& .MuiDivider-root': {
                          borderColor: 'rgba(251, 191, 36, 0.2)'
                        }
                      }
                }}
              >
                <MenuItem onClick={() => router.push('/profile')}>
                  <ListItemIcon>
                    <People fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Profile</ListItemText>
                </MenuItem>

                <MenuItem onClick={() => router.push('/auth/permissions')}>
                  <ListItemIcon>
                    <Security fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>My Permissions</ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem onClick={() => router.push('/settings')}>
                  <ListItemIcon>
                    <Settings fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Settings</ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleLogout}>
                  <ListItemText sx={{ color: 'error.main' }}>
                    Logout
                  </ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          )}

          {/* Fullscreen Toggle (Desktop Only) */}
          {!isMobile && (
            <Tooltip title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              <IconButton
                onClick={toggleFullscreen}
                size="small"
                sx={{
                  color: actionIconColor,
                  '&:hover': {
                    color: actionIconHoverColor,
                    backgroundColor: actionIconHoverBg
                  }
                }}
              >
                {isFullscreen ?
                  <FullscreenExit fontSize="small" /> :
                  <Fullscreen fontSize="small" />
                }
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;