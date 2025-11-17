import { ReactNode, ComponentProps } from "react";

export type SidebarState = "expanded" | "collapsed";

export interface SidebarContextType {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
  
}

export interface SidebarProviderProps extends ComponentProps<"div"> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}