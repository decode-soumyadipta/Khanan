'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from "next/navigation";
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
import { SidebarTrigger } from '../sidebar';

// Custom styled components
const GradientText = styled(Typography)(({ theme }) => ({
  background: 'linear-gradient(45deg, #1976d2 30%, #4caf50 90%)',
  backgroundClip: 'text',
  textFillColor: 'transparent',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  fontWeight: 'bold',
  cursor: 'pointer'
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
  const theme = useTheme();
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
      'geo_analyst': 'default',
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

  return (
    <AppBar 
      position="fixed" 
      color="default" 
      elevation={1}
      sx={{ 
        zIndex: theme.zIndex.drawer + 1,
        backgroundColor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`
      }}
    >
      <Toolbar sx={{ 
        justifyContent: 'space-between',
        p: 0, 
        px: { xs: 1, sm: 2 },
        minHeight: '64px !important'
      }}>
        {/* Left: Sidebar + Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SidebarTrigger />
          <GradientText 
            variant="h6" 
            onClick={() => router.push("/dashboard")}
            sx={{ 
              ml: 1,
              display: { xs: 'none', sm: 'block' }
            }}
          >
            KhananNetra
          </GradientText>
          <Typography 
            variant="h6"
            sx={{ 
              display: { xs: 'block', sm: 'none' },
              color: 'primary.main',
              fontWeight: 'bold'
            }}
          >
            KN
          </Typography>
        </Box>

        {/* Center: Quick Actions (Desktop Only) */}
        {!isMobile && isAuthenticated && (
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
                  fontSize: '0.8rem'
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
                  fontSize: '0.8rem'
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
                  fontSize: '0.8rem'
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
                    backgroundColor: 'warning.main',
                    '&:hover': {
                      backgroundColor: 'warning.dark',
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
              >
                <Badge badgeContent={0} color="error" overlap="circular">
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
                      bgcolor: 'primary.main',
                      fontSize: '0.875rem',
                      fontWeight: 'bold'
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
              <IconButton onClick={toggleFullscreen} size="small">
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