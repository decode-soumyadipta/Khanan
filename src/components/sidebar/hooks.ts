import { useContext } from "react";
import { SidebarContext } from "./provider";
import type { SidebarContextType } from "./types";

export function useSidebar(): SidebarContextType {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}