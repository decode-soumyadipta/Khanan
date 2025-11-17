'use client';
import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Divider,
  IconButton,
  InputAdornment,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface LoginFormProps {
  onLoginSuccess: (email: string, password: string) => Promise<void>;
  onSignUp: () => void;
  onForgotPassword: () => void;
  loading: boolean;
  showGuestOption?: boolean;
  onGuestAccess?: () => void;
}

export default function LoginForm({
  onLoginSuccess,
  onSignUp,
  onForgotPassword,
  loading,
  showGuestOption = true,
  onGuestAccess,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      await onLoginSuccess(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box sx={{ width: 400, maxWidth: '90vw' }}>
      <Paper elevation={0} sx={{ p: 4 }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <img 
            src="/government-logo.png" 
            alt="KhananNetra" 
            style={{ width: 80, height: 80, margin: '0 auto 16px' }}
          />
          <Typography variant="h5" component="h1" gutterBottom fontWeight="bold">
            KhananNetra
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Government Mining Monitoring System
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
            disabled={loading}
            placeholder="Enter your official email"
          />
          <TextField
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            disabled={loading}
            placeholder="Enter your password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={handleTogglePassword}
                    edge="end"
                    disabled={loading}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Forgot Password Link */}
          <Box sx={{ textAlign: 'right', mt: 1, mb: 2 }}>
            <Button
              onClick={onForgotPassword}
              disabled={loading}
              sx={{ textTransform: 'none' }}
            >
              Forgot Password?
            </Button>
          </Box>

          {/* Login Button */}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 2, mb: 2 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Login'}
          </Button>
        </form>

        {/* Guest Access Option */}
        {showGuestOption && onGuestAccess && (
          <>
            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                OR
              </Typography>
            </Divider>
            <Button
              fullWidth
              variant="outlined"
              onClick={onGuestAccess}
              disabled={loading}
              sx={{ mb: 2 }}
            >
              Continue as Guest
            </Button>
          </>
        )}

        {/* Footer Links */}
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Button
              onClick={onSignUp}
              disabled={loading}
              sx={{ textTransform: 'none', fontWeight: 'bold' }}
            >
              Contact Administrator
            </Button>
          </Typography>
        </Box>

        {/* Security Notice */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" align="center">
            🔒 Secure government portal. Access is restricted to authorized personnel only.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}