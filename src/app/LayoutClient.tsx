// app/LayoutClient.tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SnackbarProvider } from '@/contexts/SnackbarContext';
import { AnalysisProvider } from '@/contexts/AnalysisContext';
import { SidebarItemsRegistryProvider } from "@/components/sidebar/SidebarItemsRegistry";

import { Box, CircularProgress } from '@mui/material';
import { SidebarProvider } from "@/components/sidebar/provider";
import { AppSidebar } from "@/components/sidebar/sidebar";
import { Header } from "@/components/layout/Header";
import { cn } from '@/lib/utils';

// Auth wrapper for protected content
function ProtectedLayout({ children, isGeoAnalystDashboard }: { children: React.ReactNode; isGeoAnalystDashboard: boolean }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <div className={cn("flex h-screen w-full", isGeoAnalystDashboard && "bg-white") }>
        <AppSidebar />
        {/* Main content area */}
        <div className={cn("flex-1 flex flex-col overflow-hidden", isGeoAnalystDashboard && "bg-white") }>
          <Header />
          <main className={cn(
            "flex-1 overflow-auto pt-14 md:pt-14 pb-20 md:pb-0",
            isGeoAnalystDashboard && "bg-white"
          )}>
            {children}
          </main>
          {/* <Footer /> */}
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const unprotectedPages = [
    "/login",
    "/forgot-password",
    "/reset-password",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/",
  ];

  const isProtectedPage = !unprotectedPages.includes(pathname);
  const isGeoAnalystDashboard = pathname?.startsWith('/geoanalyst-dashboard');

  return (
    <body 
      className={cn(
        "bg-gray-50 dark:bg-gray-900 transition-colors duration-300",
        isGeoAnalystDashboard && "bg-white"
      )}
      suppressHydrationWarning
    >
      <SnackbarProvider>
        <AuthProvider>
          <AnalysisProvider>
            <SidebarItemsRegistryProvider>
              <div className="min-h-screen flex flex-col">
                <main className="flex-1">
                  {isProtectedPage ? (
                    <ProtectedLayout isGeoAnalystDashboard={Boolean(isGeoAnalystDashboard)}>
                      {children}
                    </ProtectedLayout>
                  ) : (
                    <div className="w-full h-full min-h-screen bg-white dark:bg-gray-900">
                      {children}
                    </div>
                  )}
                </main>
              </div>
            </SidebarItemsRegistryProvider>
          </AnalysisProvider>
        </AuthProvider>
      </SnackbarProvider>
    </body>
  );
}