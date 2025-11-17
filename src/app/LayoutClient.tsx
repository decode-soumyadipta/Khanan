// app/LayoutClient.tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SnackbarProvider } from '@/contexts/SnackbarContext';


import { Box, CircularProgress } from '@mui/material';
import { SidebarProvider } from "@/components/sidebar/provider";
import { AppSidebar } from "@/components/sidebar/sidebar";
import { Header } from "@/components/layout/Header";

// Auth wrapper for protected content
function ProtectedLayout({ children }: { children: React.ReactNode }) {
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
      <div className="flex h-screen w-full">
        <AppSidebar />
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto pt-14 md:pt-14 pb-20 md:pb-0">
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
  const router = useRouter();

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

  return (
    <body className="bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <SnackbarProvider>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <main className="flex-1">
              {isProtectedPage ? (
                <ProtectedLayout>
                  {children}
                </ProtectedLayout>
              ) : (
                <div className="w-full h-full min-h-screen bg-white dark:bg-gray-900">
                  {children}
                </div>
              )}
            </main>
          </div>
        </AuthProvider>
      </SnackbarProvider>
    </body>
  );
}