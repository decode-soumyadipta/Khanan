'use client';
import { 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  forwardRef,
  createContext,
  useRef 
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const SIDEBAR_COOKIE_NAME = "khanannetra-sidebar-state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";
export const SIDEBAR_WIDTH = "280px";
export const SIDEBAR_WIDTH_ICON = "80px";

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

export interface SidebarProviderProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const SidebarContext = createContext<SidebarContextType | null>(null);

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

export const SidebarProvider = forwardRef<HTMLDivElement, SidebarProviderProps>(
  (
    {
      defaultOpen = false,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    forwardedRef
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = useState(false);
    const pathname = usePathname();
    const internalRef = useRef<HTMLDivElement>(null);
    
    const combinedRef = useCallback((element: HTMLDivElement) => {
      internalRef.current = element;
      if (typeof forwardedRef === 'function') {
        forwardedRef(element);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement>).current = element;
      }
    }, [forwardedRef]);

    const [_open, _setOpen] = useState(defaultOpen);
    const open = openProp ?? _open;

    const setOpen = useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value;
        setOpenProp?.(openState) ?? _setOpen(openState);
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open]
    );

    const toggleSidebar = useCallback(() => {
      isMobile ? setOpenMobile(v => !v) : setOpen(v => !v);
    }, [isMobile, setOpen]);

    // Keyboard shortcut
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggleSidebar]);

    // Close mobile sidebar on route change
    useEffect(() => {
      if (isMobile) {
        setOpenMobile(false);
      }
    }, [pathname, isMobile]);

    // Click outside handler for mobile
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (isMobile && openMobile && internalRef.current && 
            !internalRef.current.contains(event.target as Node)) {
          setOpenMobile(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isMobile, openMobile]);

    const contextValue = useMemo(() => ({
      state: (open ? "expanded" : "collapsed") as SidebarState,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar
    }), [open, setOpen, isMobile, openMobile, toggleSidebar]);

    return (
      <SidebarContext.Provider value={contextValue}>
        <div
          ref={combinedRef}
          style={{
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style
          } as React.CSSProperties}
          className={cn(
            "group/sidebar-wrapper flex min-h-svh w-full",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    );
  }
);

SidebarProvider.displayName = "SidebarProvider";