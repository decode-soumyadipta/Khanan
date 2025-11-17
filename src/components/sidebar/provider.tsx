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
import { 
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON
} from "./constants";
import type { SidebarProviderProps, SidebarContextType, SidebarState } from "./types";
import { useIsMobile } from "@/hooks/use-mobile";

export const SidebarContext = createContext<SidebarContextType | null>(null);

// Helper function to combine refs
function useCombinedRefs<T>(...refs: React.Ref<T>[]): React.RefCallback<T> {
  return useCallback(
    (element: T) => {
      refs.forEach(ref => {
        if (!ref) return;
        if (typeof ref === 'function') {
          ref(element);
        } else {
          (ref as React.MutableRefObject<T>).current = element;
        }
      });
    },
    [refs]
  );
}

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
    
    // Combine the forwarded ref with our internal ref
    const combinedRef = useCombinedRefs(forwardedRef, internalRef);

    // Close mobile sidebar when route changes
    useEffect(() => {
      if (isMobile) {
        setOpenMobile(false);
      }
    }, [pathname, isMobile]);

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

    // Keyboard shortcut handler
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

    // Click outside handler for mobile
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          isMobile && 
          openMobile && 
          internalRef.current && 
          !internalRef.current.contains(event.target as Node)
        ) {
          setOpenMobile(false);
        }
      };

      // Also handle touch events for mobile devices
      const handleTouchOutside = (event: TouchEvent) => {
        if (
          isMobile && 
          openMobile && 
          internalRef.current && 
          !internalRef.current.contains(event.target as Node)
        ) {
          setOpenMobile(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleTouchOutside);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleTouchOutside);
      };
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
            "group/sidebar-wrapp flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
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