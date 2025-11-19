// components/sidebar/SidebarItemsRegistry.tsx
"use client";

import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react';

/**
 * Sidebar Item Type Definition
 * 
 * Represents a single navigation item that can be displayed in the sidebar.
 * Items can be dynamically injected or ejected based on user context.
 */
export interface SidebarItemConfig {
  id: string; // Unique identifier for the item
  title: string;
  url: string;
  icon: React.ComponentType<any> | any;
  roles?: string[];
  requiredPermission?: {
    resource: string;
    action: string;
  } | null;
  requiredModule?: string | null;
  section?: 'profile' | 'main' | 'footer'; // Where to inject the item
  group?: string; // Group identifier for grouping items
  order?: number; // Order within the section
  isInjected?: boolean;
  isSeparator?: boolean; // For visual separators
}

/**
 * Sidebar Item Group Type
 * 
 * Groups related sidebar items together.
 */
export interface SidebarItemGroup {
  id: string;
  title?: string;
  items: SidebarItemConfig[];
  section: 'profile' | 'main' | 'footer';
}

/**
 * Context Type for Sidebar Items Registry
 */
interface SidebarItemsRegistryContextType {
  // Get all injected items
  getInjectedItems: (section?: string) => SidebarItemConfig[];
  
  // Inject items into the sidebar
  injectItems: (items: SidebarItemConfig | SidebarItemConfig[], section?: string) => void;
  
  // Eject items from the sidebar
  ejectItems: (itemIds: string | string[], section?: string) => void;
  
  // Clear all injected items
  clearItems: (section?: string) => void;
  
  // Get grouped items
  getGroupedItems: (section?: string) => SidebarItemGroup[];
}

const SidebarItemsRegistryContext = createContext<SidebarItemsRegistryContextType | undefined>(undefined);

/**
 * SidebarItemsRegistry Provider
 * 
 * Manages the dynamic injection and ejection of sidebar items.
 * This enables a clean architecture where sidebar items can be added/removed
 * without modifying the core sidebar component.
 * 
 * @example
 * ```tsx
 * <SidebarItemsRegistryProvider>
 *   <AppSidebar />
 * </SidebarItemsRegistryProvider>
 * ```
 */
export function SidebarItemsRegistryProvider({ children }: { children: ReactNode }) {
  const [injectedItems, setInjectedItems] = useState<Map<string, SidebarItemConfig[]>>(
    new Map()
  );

  const getInjectedItems = useCallback((section?: string): SidebarItemConfig[] => {
    if (!section) {
      // Return all items from all sections
      const allItems: SidebarItemConfig[] = [];
      injectedItems.forEach(items => allItems.push(...items));
      return allItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    
    return (injectedItems.get(section) || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [injectedItems]);

  const injectItems = useCallback((items: SidebarItemConfig | SidebarItemConfig[], section: string = 'main') => {
    const itemsArray = Array.isArray(items) ? items : [items];
    
    setInjectedItems(prev => {
      const newMap = new Map(prev);
      const existingItems = newMap.get(section) || [];
      
      // Add new items, avoiding duplicates by ID
      const itemIds = new Set(existingItems.map(i => i.id));
      const itemsToAdd = itemsArray.filter(item => !itemIds.has(item.id));
      
      newMap.set(section, [...existingItems, ...itemsToAdd]);
      return newMap;
    });
  }, []);

  const ejectItems = useCallback((itemIds: string | string[], section?: string) => {
    const idsToRemove = new Set(Array.isArray(itemIds) ? itemIds : [itemIds]);
    
    setInjectedItems(prev => {
      const newMap = new Map(prev);
      
      if (section) {
        // Eject from specific section
        const items = newMap.get(section) || [];
        newMap.set(section, items.filter(item => !idsToRemove.has(item.id)));
      } else {
        // Eject from all sections
        newMap.forEach((items, sec) => {
          newMap.set(sec, items.filter(item => !idsToRemove.has(item.id)));
        });
      }
      
      return newMap;
    });
  }, []);

  const clearItems = useCallback((section?: string) => {
    setInjectedItems(prev => {
      const newMap = new Map(prev);
      if (section) {
        newMap.delete(section);
      } else {
        newMap.clear();
      }
      return newMap;
    });
  }, []);

  const getGroupedItems = useCallback((section?: string): SidebarItemGroup[] => {
    const items = getInjectedItems(section);
    const groupMap = new Map<string, SidebarItemGroup>();
    
    items.forEach(item => {
      const groupId = item.group || 'default';
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          items: [],
          section: item.section || 'main'
        });
      }
      groupMap.get(groupId)!.items.push(item);
    });
    
    return Array.from(groupMap.values());
  }, [getInjectedItems]);

  const value: SidebarItemsRegistryContextType = {
    getInjectedItems,
    injectItems,
    ejectItems,
    clearItems,
    getGroupedItems
  };

  return (
    <SidebarItemsRegistryContext.Provider value={value}>
      {children}
    </SidebarItemsRegistryContext.Provider>
  );
}

/**
 * Hook to use Sidebar Items Registry
 * 
 * Returns the registry context for managing injected sidebar items.
 * Must be used within a SidebarItemsRegistryProvider.
 * 
 * @returns {SidebarItemsRegistryContextType} The sidebar items registry context
 * @throws {Error} If used outside of SidebarItemsRegistryProvider
 * 
 * @example
 * ```tsx
 * const registry = useSidebarItemsRegistry();
 * registry.injectItems(geoAnalystItems, 'profile');
 * ```
 */
export function useSidebarItemsRegistry(): SidebarItemsRegistryContextType {
  const context = useContext(SidebarItemsRegistryContext);
  if (!context) {
    throw new Error('useSidebarItemsRegistry must be used within SidebarItemsRegistryProvider');
  }
  return context;
}
