'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { Box, Typography } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredAction?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredPermission, 
  requiredAction 
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <LoadingSpinner message="Redirecting to login..." />;
  }

  // Check permissions if required
  if (requiredPermission && requiredAction) {
    const hasRequiredPermission = hasPermission(requiredPermission, requiredAction);
    
    if (!hasRequiredPermission) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Access Denied
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            You don't have permission to access this page.
          </Typography>
        </Box>
      );
    }
  }

  return <>{children}</>;
}