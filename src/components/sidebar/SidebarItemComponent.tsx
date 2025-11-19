// components/sidebar/SidebarItemComponent.tsx
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip } from "@mui/material";
import { cn } from "@/lib/utils";
import type { SidebarItemConfig } from "./SidebarItemsRegistry";

interface SidebarItemComponentProps {
  item: SidebarItemConfig;
  isExpanded: boolean;
  onLinkClick: () => void;
  variant?: 'default' | 'injected'; // Styling variant
}

/**
 * SidebarItemComponent
 * 
 * Reusable component for rendering individual sidebar items.
 * Handles active state, tooltips, and icon rendering.
 * Supports different styling variants for different sections.
 * 
 * @param item - The sidebar item configuration
 * @param isExpanded - Whether the sidebar is expanded
 * @param onLinkClick - Callback when item is clicked
 * @param variant - Styling variant ('default' or 'injected')
 */
export function SidebarItemComponent({
  item,
  isExpanded,
  onLinkClick,
  variant = 'default'
}: SidebarItemComponentProps) {
  const pathname = usePathname();
  const isActive = pathname === item.url;
  const IconComponent = item.icon;

  // Handle separator items
  if (item.isSeparator) {
    return (
      <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
    );
  }

  // Styling variants
  const baseStyles = "flex items-center rounded-lg transition-all duration-200 no-underline";
  
  const styleVariants = {
    default: {
      container: cn(
        baseStyles,
        "p-2 mx-1",
        isActive
          ? "bg-blue-100/90 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-sm"
          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
      ),
      iconColor: isActive ? "text-blue-500" : "text-gray-500 dark:text-gray-400"
    },
    injected: {
      container: cn(
        baseStyles,
        "p-2.5 mx-0.5 font-semibold",
        isActive
          ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md border border-amber-400/30 dark:border-amber-400/40"
          : "bg-gray-900 dark:bg-gray-950 text-gray-100 dark:text-gray-50 hover:bg-gray-800 dark:hover:bg-gray-900 border border-gray-700 dark:border-gray-800 hover:border-amber-500/50"
      ),
      iconColor: isActive 
        ? "text-white" 
        : "text-amber-400 dark:text-amber-300"
    }
  };

  const styles = styleVariants[variant];

  return (
    <Tooltip
      title={isExpanded ? "" : item.title}
      placement="right"
    >
      <Link
        href={item.url}
        onClick={onLinkClick}
        className={styles.container}
      >
        {/* Icon Rendering */}
        {typeof IconComponent === "function" ? (
          <IconComponent
            sx={{
              fontSize: 18,
              color: "inherit"
            }}
            className={cn(
              "w-5 h-5 transition-colors shrink-0",
              styles.iconColor
            )}
          />
        ) : (
          <IconComponent
            className={cn(
              "w-5 h-5 transition-colors shrink-0",
              styles.iconColor
            )}
          />
        )}

        {/* Label */}
        {isExpanded && (
          <span className="ml-3 text-sm font-medium truncate">
            {item.title}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}

