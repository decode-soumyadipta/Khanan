'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { useSnackbar } from '@/contexts/SnackbarContext';
import Logo from '@/components/ui/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  
  const { login, isAuthenticated, user, loading: authLoading } = useAuth();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  useEffect(() => {
    // Redirect already authenticated users
    if (isAuthenticated && user && !authLoading) {
      console.log('🔄 User already authenticated, redirecting...');
      setRedirecting(true);
      
      // Redirect based on user role
      if (user.userType === 'ADMIN') {
        router.push('/admin');
      } else if (user.userType === 'GEO_ANALYST') {
        router.push('/geoanalyst-dashboard');
      } else {
        router.push('/profile');
      }
    }
  }, [isAuthenticated, user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const success = await login(email, password);
      if (success) {
        showSnackbar('Login successful!', 'success');
        setRedirecting(true);
        // Redirect happens in AuthContext login function
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth or redirecting
  if (authLoading || redirecting) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)',
      }}>
        <CircularProgress sx={{ color: '#fbbf24' }} />
        <Typography sx={{ mt: 2, color: '#fcd34d' }}>
          {redirecting ? 'Redirecting...' : 'Loading...'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to right, #1a1a2e, #16213e, #0f3460)',
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          borderRadius: 2,
          background: 'linear-gradient(to bottom, #1a1a2e, #16213e)',
          border: '1px solid rgba(251, 191, 36, 0.2)',
          boxShadow: '0 8px 32px rgba(251, 191, 36, 0.2)'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Logo size={80} withCircle={true} />
          </Box>
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom 
            fontWeight="bold"
            sx={{
              background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 4px rgba(251, 191, 36, 0.3))'
            }}
          >
            KhananNetra
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(252, 211, 77, 0.8)' }}>
            Government Mining Monitoring System
          </Typography>
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5'
            }}
          >
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': {
                  borderColor: 'rgba(252, 211, 77, 0.3)'
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(252, 211, 77, 0.5)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#fcd34d'
                }
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(252, 211, 77, 0.7)'
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#fcd34d'
              }
            }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': {
                  borderColor: 'rgba(252, 211, 77, 0.3)'
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(252, 211, 77, 0.5)'
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#fcd34d'
                }
              },
              '& .MuiInputLabel-root': {
                color: 'rgba(252, 211, 77, 0.7)'
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#fcd34d'
              }
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ 
              mt: 3, 
              mb: 2,
              backgroundColor: '#fbbf24',
              color: '#1a1a2e',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#fcd34d',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
              },
              '&:disabled': {
                backgroundColor: 'rgba(251, 191, 36, 0.3)',
                color: 'rgba(26, 26, 46, 0.5)'
              }
            }}
          >
            {loading ? <CircularProgress size={24} sx={{ color: '#1a1a2e' }} /> : 'Login'}
          </Button>
        </form>

        <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: 'rgba(252, 211, 77, 0.6)' }}>
          Contact administrator for account access
        </Typography>
      </Paper>
    </Box>
  );
}