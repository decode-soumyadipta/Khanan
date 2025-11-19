// components/sidebar/injections/GeoAnalystItemsInjection.tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebarItemsRegistry, type SidebarItemConfig } from "../SidebarItemsRegistry";
import { SatelliteAlt as SatelliteIcon } from "@mui/icons-material";
import { Clock } from "lucide-react";

/**
 * GeoAnalystItemsInjection
 * 
 * This component handles the dynamic injection of geo-analyst-specific sidebar items.
 * It checks if the user is a geo analyst and injects the "New Analysis" and "Analysis History"
 * items into the profile section of the sidebar.
 * 
 * These items are styled with:
 * - Dark background (gray-900/gray-950)
 * - Amber/orange colored icons
 * - Gradient active state (amber to orange)
 * - White text on active state
 * 
 * This follows the injection/ejection pattern for clean component composition.
 * 
 * When a geo analyst logs in:
 * - "New Analysis" and "Analysis History" items are injected
 * 
 * When a non-geo-analyst (like super admin) accesses the sidebar:
 * - These items are NOT injected or are ejected
 */
export function GeoAnalystItemsInjection() {
  const { user, permissions, isSuperAdmin } = useAuth();
  const registry = useSidebarItemsRegistry();

  // Determine if user is a geo analyst
  const isGeoAnalyst = (): boolean => {
    if (!user || !permissions || isSuperAdmin()) return false;

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

  useEffect(() => {
    if (isGeoAnalyst()) {
      // Inject geo analyst specific items with enhanced styling
      const geoAnalystItems: SidebarItemConfig[] = [
        {
          id: 'geo-analyst-new-analysis',
          title: 'New Analysis',
          url: '/geoanalyst-dashboard',
          icon: SatelliteIcon,
          section: 'profile',
          group: 'geo-analyst-actions',
          order: 1,
          isInjected: true,
          roles: ['geo_analyst', 'senior_geo_officer', 'ntro_nodal_officer']
        },
        {
          id: 'geo-analyst-history',
          title: 'Analysis History',
          url: '/geoanalyst-dashboard/history',
          icon: Clock,
          section: 'profile',
          group: 'geo-analyst-actions',
          order: 2,
          isInjected: true,
          roles: ['geo_analyst', 'senior_geo_officer', 'ntro_nodal_officer']
        }
      ];

      registry.injectItems(geoAnalystItems, 'profile');

      // Cleanup: eject items when component unmounts or user is no longer a geo analyst
      return () => {
        registry.ejectItems(['geo-analyst-new-analysis', 'geo-analyst-history'], 'profile');
      };
    } else {
      // If user is not a geo analyst, make sure items are not injected
      registry.ejectItems(['geo-analyst-new-analysis', 'geo-analyst-history'], 'profile');
    }
  }, [user?.id, permissions, isGeoAnalyst()]);

  // This component doesn't render anything - it only manages injection/ejection
  return null;
}
