'use client';
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Paper,
  Tooltip,
  IconButton,
  Badge,
  Chip,
  Button,
  Avatar,
} from "@mui/material";
import {
  Home,
  Map,
  BarChart,
  Settings,
  Users,
  Shield,
  FileText,
  LogOut,
  Building,
  Search,
  AlertTriangle,
  TrendingUp,
  Globe,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "../sidebar/hooks";
import { cn } from "@/lib/utils";

// Sidebar items based on roles
const getSidebarItems = (userRole: string) => {
  const commonItems = [
    { title: "Dashboard", url: "/dashboard", icon: Home, permission: "view_dashboard" },
    { title: "Mining Analysis", url: "/dashboard/analysis", icon: Map, permission: "mining_analysis" },
    { title: "Compliance Reports", url: "/dashboard/compliance", icon: FileText, permission: "compliance_reports" },
  ];

  const roleBasedItems = {
    super_admin: [
      { title: "National Overview", url: "/dashboard/national", icon: Globe, permission: "system_config" },
      { title: "User Management", url: "/dashboard/users", icon: Users, permission: "user_management" },
      { title: "System Analytics", url: "/dashboard/analytics", icon: BarChart, permission: "system_analytics" },
    ],
    state_admin: [
      { title: "State Overview", url: "/dashboard/state", icon: Building, permission: "view_analytics" },
      { title: "District Management", url: "/dashboard/districts", icon: Users, permission: "user_management" },
    ],
    district_analyst: [
      { title: "My Analyses", url: "/dashboard/my-analyses", icon: TrendingUp, permission: "mining_analysis" },
      { title: "Violations", url: "/dashboard/violations", icon: AlertTriangle, permission: "compliance_reports" },
    ],
    reviewing_officer: [
      { title: "Pending Reviews", url: "/dashboard/reviews", icon: Shield, permission: "reports_approval" },
      { title: "Audit Logs", url: "/dashboard/audit", icon: FileText, permission: "audit_logs" },
    ],
  };

  return [
    ...commonItems,
    ...(roleBasedItems[userRole as keyof typeof roleBasedItems] || [])
  ];
};

// Group items for better organization
const groupSidebarItems = (items: any[]) => {
  const mainGroup = items.filter(item => 
    ['Dashboard', 'Mining Analysis', 'Compliance Reports'].includes(item.title)
  );
  
  const managementGroup = items.filter(item => 
    ['User Management', 'District Management', 'My Analyses', 'Pending Reviews'].includes(item.title)
  );
  
  const analyticsGroup = items.filter(item => 
    ['National Overview', 'State Overview', 'System Analytics', 'Audit Logs'].includes(item.title)
  );

  return { mainGroup, managementGroup, analyticsGroup };
};

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, isMobile, openMobile, setOpenMobile } = useSidebar();
  const { user, logout, hasPermission } = useAuth();
  
  const isExpanded = open || openMobile;
  const userRole = user?.primaryRole || 'district_analyst';
  
  // Get filtered items based on permissions
  const sidebarItems = getSidebarItems(userRole).filter(item => 
    hasPermission(item.permission.split('_')[0], item.permission.split('_')[1])
  );
  
  const { mainGroup, managementGroup, analyticsGroup } = groupSidebarItems(sidebarItems);

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderNavItem = (item: any) => {
    const isActive = pathname === item.url;
    
    return (
      <Tooltip key={item.title} title={isExpanded ? "" : item.title} placement="right">
        <Link
          href={item.url}
          onClick={handleLinkClick}
          className={cn(
            "flex items-center p-3 rounded-lg transition-all duration-200 mx-2 mb-1",
            isActive
              ? "bg-blue-100/90 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent"
          )}
        >
          <item.icon className={cn("w-5 h-5", isActive ? "text-blue-500" : "text-gray-500")} />
          {isExpanded && (
            <span className="ml-3 text-sm font-medium truncate">{item.title}</span>
          )}
        </Link>
      </Tooltip>
    );
  };

  const renderGroup = (items: any[], title?: string) => (
    <Box sx={{ mb: 2 }}>
      {title && isExpanded && (
        <Box sx={{ px: 2, py: 1 }}>
          <Chip 
            label={title} 
            size="small" 
            variant="outlined"
            sx={{ fontSize: '0.7rem', fontWeight: 600 }}
          />
        </Box>
      )}
      {items.map(renderNavItem)}
    </Box>
  );

  return (
    <>
      {isMobile && openMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setOpenMobile(false)}
        />
      )}

      <Paper
        elevation={2}
        className={cn(
          "flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800",
          "fixed md:relative z-40 h-screen",
          isMobile
            ? openMobile
              ? "w-[280px]"
              : "w-0"
            : open
            ? "w-[280px]"
            : "w-[80px]",
          "transition-all duration-300 ease-in-out"
        )}
        square
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: isExpanded ? 'space-between' : 'center' }}>
              {isExpanded ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img 
                      src="/government-logo.png" 
                      alt="KhananNetra" 
                      className="w-8 h-8"
                    />
                    <Box sx={{ ml: 2 }}>
                      <div className="font-bold text-sm">KhananNetra</div>
                      <div className="text-xs text-gray-500">Government Portal</div>
                    </Box>
                  </Box>
                  <Badge 
                    color="primary" 
                    variant="dot"
                    sx={{ 
                      '& .MuiBadge-dot': { 
                        backgroundColor: user?.isActive ? 'success.main' : 'warning.main' 
                      } 
                    }}
                  >
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      {user?.name?.charAt(0) || 'U'}
                    </Avatar>
                  </Badge>
                </>
              ) : (
                <Tooltip title="KhananNetra" placement="right">
                  <img 
                    src="/government-logo.png" 
                    alt="KhananNetra" 
                    className="w-8 h-8"
                  />
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-4">
            {renderGroup(mainGroup)}
            {managementGroup.length > 0 && renderGroup(managementGroup, isExpanded ? "Management" : undefined)}
            {analyticsGroup.length > 0 && renderGroup(analyticsGroup, isExpanded ? "Analytics" : undefined)}
            
            {/* Settings - Always at bottom */}
            {renderGroup([
              { title: "Settings", url: "/dashboard/settings", icon: Settings, permission: "system_config" }
            ])}
          </div>

          {/* Footer */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            {isExpanded ? (
              <Button
                fullWidth
                startIcon={<LogOut size={16} />}
                onClick={logout}
                variant="outlined"
                size="small"
                sx={{ 
                  justifyContent: 'flex-start',
                  fontSize: '0.8rem',
                  textTransform: 'none'
                }}
              >
                Logout • {user?.name}
              </Button>
            ) : (
              <Tooltip title="Logout" placement="right">
                <IconButton onClick={logout} size="small">
                  <LogOut size={16} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </div>
      </Paper>
    </>
  );
}