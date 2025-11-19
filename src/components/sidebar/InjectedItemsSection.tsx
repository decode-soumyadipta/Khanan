// components/sidebar/InjectedItemsSection.tsx
"use client";

import React from "react";
import { Box } from "@mui/material";
import { cn } from "@/lib/utils";
import { useSidebarItemsRegistry } from "./SidebarItemsRegistry";
import { SidebarItemComponent } from "./SidebarItemComponent";

interface InjectedItemsSectionProps {
  section: 'profile' | 'main' | 'footer';
  isExpanded: boolean;
  onLinkClick: () => void;
  className?: string;
  variant?: 'default' | 'injected';
}

/**
 * InjectedItemsSection Component
 * 
 * Renders all injected sidebar items for a specific section.
 * Items are dynamically rendered based on what has been injected
 * via the SidebarItemsRegistry.
 * 
 * Supports different styling variants for different types of injected content.
 * 
 * @param section - The section to render items for ('profile', 'main', or 'footer')
 * @param isExpanded - Whether the sidebar is expanded
 * @param onLinkClick - Callback when a link is clicked
 * @param className - Additional CSS classes
 * @param variant - Styling variant ('default' or 'injected')
 */
export function InjectedItemsSection({
  section,
  isExpanded,
  onLinkClick,
  className,
  variant = 'injected'
}: InjectedItemsSectionProps) {
  const registry = useSidebarItemsRegistry();
  const injectedItems = registry.getInjectedItems(section);

  // Don't render if no items to display
  if (injectedItems.length === 0) {
    return null;
  }

  return (
    <Box
      component="div"
      className={cn(
        "space-y-2 transition-all",
        section === 'profile' && "border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50",
        isExpanded ? "px-2 py-3" : "px-1 py-2 flex flex-col items-center gap-1",
        className
      )}
    >
      {injectedItems.map((item) => (
        <SidebarItemComponent
          key={item.id}
          item={item}
          isExpanded={isExpanded}
          onLinkClick={onLinkClick}
          variant={variant}
        />
      ))}
    </Box>
  );
}
