'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Select,
  MenuItem,
  IconButton,
  Link,
} from '@mui/material';
import { LanguageOutlined, LightModeOutlined, DarkModeOutlined } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '@/contexts/AuthContext';
import { useSnackbar } from '@/contexts/SnackbarContext';
import Logo from '@/components/ui/Logo';

const FOOTER_SECTIONS = [
  {
    title: 'Digital India',
    links: ['About Us', 'Initiatives', 'Privacy Policy'],
  },
  {
    title: 'Useful Links',
    links: ['Events', 'Press Release', 'Videos', 'DigiSeva'],
  },
  {
    title: 'Help & Support',
    links: ['Right to Information', 'FAQ'],
  },
];

const FOOTER_CONTACT = [
  'NeGD, Ministry of Electronics & Information Technology (MeitY), 4th Floor, 6, CGO Complex, Electronics Niketan, Lodhi Road New Delhi - 110003 INDIA',
  'Email: webmaster@digitalindia.gov.in',
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [fontPreference, setFontPreference] = useState<'small' | 'default' | 'large'>('default');
  const [language, setLanguage] = useState('en');
  const [isDarkHeader, setIsDarkHeader] = useState(true);
  const headerTopBackground = useMemo(() => (isDarkHeader ? '#16151D' : '#F5F7FA'), [isDarkHeader]);
  const headerTopColor = useMemo(() => (isDarkHeader ? '#FFFFFF' : '#1F2937'), [isDarkHeader]);
  const headerMutedColor = useMemo(() => (isDarkHeader ? 'rgba(255,255,255,0.65)' : 'rgba(31,41,55,0.65)'), [isDarkHeader]);
  const headerIconBackground = useMemo(() => (isDarkHeader ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.08)'), [isDarkHeader]);
  const headerIconColor = useMemo(() => (isDarkHeader ? '#FFFFFF' : '#1F2937'), [isDarkHeader]);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasIncrementedVisitorRef = useRef(false);
  const formattedVisitorCount = useMemo(
    () => (visitorCount !== null ? visitorCount.toString().padStart(7, '0') : '-------'),
    [visitorCount]
  );
  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) {
      return 'Fetching update info...';
    }
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(lastUpdated);
  }, [lastUpdated]);
  const [isOverlayActive, setOverlayActive] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const overlayOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const { login, isAuthenticated, user, loading: authLoading, getLandingRoute } = useAuth();
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  useEffect(() => {
    // Redirect already authenticated users
    if (isAuthenticated && user && !authLoading) {
      console.log('🔄 User already authenticated, redirecting...');
      setRedirecting(true);

      const destination = getLandingRoute();
      router.replace(destination);
    }
  }, [isAuthenticated, user, authLoading, router, getLandingRoute]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (hasIncrementedVisitorRef.current) {
      return;
    }
    try {
      const stored = window.localStorage.getItem('khanan-login-visitor-count');
      const currentCount = stored ? Number.parseInt(stored, 10) : 0;
      const nextCount = Number.isNaN(currentCount) ? 1 : currentCount + 1;
      window.localStorage.setItem('khanan-login-visitor-count', String(nextCount));
      setVisitorCount(nextCount);
      hasIncrementedVisitorRef.current = true;
    } catch (storageError) {
      console.warn('Unable to update visitor count', storageError);
      setVisitorCount(null);
    }
  }, []);

  useEffect(() => {
    const resolveLastUpdatedDate = (): Date => {
      const envValue = process.env.NEXT_PUBLIC_LAST_UPDATED;
      if (envValue) {
        const parsedEnvDate = new Date(envValue);
        if (!Number.isNaN(parsedEnvDate.getTime())) {
          return parsedEnvDate;
        }
      }
      if (typeof document !== 'undefined') {
        const modified = document.lastModified;
        if (modified) {
          const parsedDocumentDate = new Date(modified);
          if (!Number.isNaN(parsedDocumentDate.getTime())) {
            return parsedDocumentDate;
          }
        }
      }
      return new Date();
    };

    setLastUpdated(resolveLastUpdatedDate());
  }, []);

  useEffect(() => {
    if (showLoginModal && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [showLoginModal]);

  useEffect(() => {
    return () => {
      if (overlayOpenTimerRef.current) {
        clearTimeout(overlayOpenTimerRef.current);
      }
      if (overlayCloseTimerRef.current) {
        clearTimeout(overlayCloseTimerRef.current);
      }
    };
  }, []);

  const handleOpenLoginOverlay = () => {
    if (isOverlayActive && showLoginModal) {
      return;
    }
    if (overlayCloseTimerRef.current) {
      clearTimeout(overlayCloseTimerRef.current);
      overlayCloseTimerRef.current = null;
    }
    if (overlayOpenTimerRef.current) {
      clearTimeout(overlayOpenTimerRef.current);
      overlayOpenTimerRef.current = null;
    }
    setError('');
    setEmail('');
    setPassword('');
    setOverlayActive(true);
    setShowLoginModal(false);
    overlayOpenTimerRef.current = setTimeout(() => {
      setShowLoginModal(true);
      overlayOpenTimerRef.current = null;
    }, 180);
  };

  const handleCloseLoginOverlay = () => {
    if (!isOverlayActive || loading) {
      return;
    }
    if (overlayOpenTimerRef.current) {
      clearTimeout(overlayOpenTimerRef.current);
      overlayOpenTimerRef.current = null;
    }
    if (overlayCloseTimerRef.current) {
      clearTimeout(overlayCloseTimerRef.current);
      overlayCloseTimerRef.current = null;
    }
    setShowLoginModal(false);
    overlayCloseTimerRef.current = setTimeout(() => {
      setOverlayActive(false);
      setEmail('');
      setPassword('');
      setError('');
      overlayCloseTimerRef.current = null;
    }, 220);
  };

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
        backgroundColor: '#ffffff',
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
        flexDirection: 'column',
        backgroundColor: '#ffffff',
      }}
    >
      <Box
        component="header"
        sx={{
          width: '100%',
          boxShadow: '0 8px 24px rgba(17, 24, 39, 0.25)',
          bgcolor: headerTopBackground,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, md: 4 },
            py: 1.5,
            color: headerTopColor,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              component="img"
              src="https://doc.ux4g.gov.in/assets/img/icon/in-flag.png"
              alt="Indian flag"
              sx={{ width: 32, height: 20, borderRadius: 0.5 }}
              loading="lazy"
            />
            <Typography variant="subtitle1" fontWeight={700}>
              Government of India
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ display: { xs: 'none', md: 'flex' } }}
            >
              <Button
                size="small"
                variant="text"
                sx={{
                  minWidth: 0,
                  color: fontPreference === 'small' ? headerTopColor : headerMutedColor,
                  fontWeight: fontPreference === 'small' ? 700 : 500,
                }}
                onClick={() => setFontPreference('small')}
              >
                -A
              </Button>
              <Button
                size="small"
                variant="text"
                sx={{
                  minWidth: 0,
                  color: fontPreference === 'default' ? headerTopColor : headerMutedColor,
                  fontWeight: fontPreference === 'default' ? 700 : 500,
                }}
                onClick={() => setFontPreference('default')}
              >
                A
              </Button>
              <Button
                size="small"
                variant="text"
                sx={{
                  minWidth: 0,
                  color: fontPreference === 'large' ? headerTopColor : headerMutedColor,
                  fontWeight: fontPreference === 'large' ? 700 : 500,
                }}
                onClick={() => setFontPreference('large')}
              >
                A+
              </Button>
              <Box component="span" sx={{ color: headerMutedColor }}>|</Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                size="small"
                sx={{
                  bgcolor: headerIconBackground,
                  color: headerIconColor,
                }}
                onClick={() => setIsDarkHeader((prev) => !prev)}
              >
                {isDarkHeader ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <LanguageOutlined sx={{ fontSize: 18 }} />
              <Select
                size="small"
                value={language}
                onChange={(event) => setLanguage(event.target.value as 'en')}
                sx={{
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: headerMutedColor },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: headerTopColor },
                  '& .MuiSelect-icon': { color: headerTopColor },
                  color: headerTopColor,
                  minWidth: 110,
                  backgroundColor: headerIconBackground,
                }}
                displayEmpty
              >
                <MenuItem value="en">English</MenuItem>
              </Select>
            </Stack>
          </Stack>
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: { xs: 2, md: 4 },
            py: { xs: 1.5, md: 2 },
            bgcolor: '#FFFFFF',
          }}
        >
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Box
              component="img"
              src="https://doc.ux4g.gov.in/assets/img/logo/national-emblem.png"
              alt="National emblem"
              loading="lazy"
              sx={{ height: 48, width: 'auto' }}
            />
            <Box
              component="img"
              src="/ntro logo.png"
              alt="National Technical Research Organisation"
              loading="lazy"
              sx={{ height: 48, width: 'auto' }}
            />
            <Box
              sx={{
                width: 0.005,
                height: 40,
                bgcolor: '#E5E7EB',
                borderRadius: 0.5,
                display: { xs: 'none', sm: 'block' },
              }}
            />
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              <Box
                component="img"
                src="/logo.png"
                alt="KhananNetra"
                loading="lazy"
                sx={{ height: 48, width: 'auto' }}
              />
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  fontSize: 18,
                  color: '#111827',
                  fontfamily: '"EB Garamond", "Garamond", "Times New Roman",serif',
                  letterSpacing: 0.5,
                }}
              >
                KhananNetra
              </Typography>
            </Stack>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              size="small"
              onClick={handleOpenLoginOverlay}
              disabled={isOverlayActive}
              sx={{
                backgroundColor: '#EF4444',
                borderRadius: 999,
                px: 3.5,
                fontWeight: 700,
                color: '#FFFFFF',
                boxShadow: '0 12px 28px rgba(239, 68, 68, 0.45)',
                letterSpacing: 0.6,
                transition: 'all 0.25s ease',
                '&:hover': {
                  backgroundColor: '#DC2626',
                  boxShadow: '0 16px 34px rgba(220, 38, 38, 0.5)',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(239, 68, 68, 0.55)',
                  boxShadow: 'none',
                  cursor: 'not-allowed',
                },
              }}
            >
              Login
            </Button>
          </Stack>
        </Box>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Box
          sx={{
            textAlign: 'center',
            maxWidth: 520,
            px: 2,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Logo size={120} withCircle={true} />
          </Box>
          <Typography
            variant="h3"
            component="h1"
            fontWeight="bold"
            sx={{
              background: 'linear-gradient(to right, #fbbf24, #fcd34d, #fbbf24)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 10px rgba(251, 191, 36, 0.35))'
            }}
          >
            KhananNetra
          </Typography>
          <Typography sx={{ mt: 1, fontSize: 18, color: '#92400E', fontWeight: 600 }}>
            Government Mining Monitoring System
          </Typography>
          <Typography sx={{ mt: 3, color: '#4B5563' }}>
            Use the Login button in the header to securely access the portal.
          </Typography>
        </Box>
      </Box>
      {isOverlayActive && (
        <Box
          onClick={handleCloseLoginOverlay}
          sx={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.82)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1400,
            transition: 'opacity 160ms ease',
          }}
        >
          <Paper
            elevation={16}
            onClick={(event) => event.stopPropagation()}
            sx={{
              position: 'relative',
              p: { xs: 3, sm: 4 },
              width: 'min(90vw, 420px)',
              borderRadius: 3,
              backgroundColor: '#ffffff',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              boxShadow: '0 16px 48px rgba(15, 23, 42, 0.35)',
              opacity: showLoginModal ? 1 : 0,
              transform: showLoginModal ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 220ms ease, transform 220ms ease',
              pointerEvents: showLoginModal ? 'auto' : 'none',
            }}
          >
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                handleCloseLoginOverlay();
              }}
              disabled={loading}
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                color: '#9CA3AF',
                backgroundColor: 'rgba(243, 244, 246, 0.8)',
                '&:hover': {
                  backgroundColor: 'rgba(229, 231, 235, 0.95)',
                },
                '&.Mui-disabled': {
                  color: '#D1D5DB',
                },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
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
                  color: '#111827',
                }}
              >
                KhananNetra
              </Typography>
              <Typography variant="body1" sx={{ color: '#4B5563' }}>
                Government Mining Monitoring System
              </Typography>
            </Box>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  backgroundColor: 'rgba(248, 113, 113, 0.12)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  color: '#B91C1C'
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
                inputRef={emailInputRef}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#111827',
                    '& fieldset': {
                      borderColor: 'rgba(209, 213, 219, 0.9)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#6B7280'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#FBBF24'
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#6B7280'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#F59E0B'
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
                    color: '#111827',
                    '& fieldset': {
                      borderColor: 'rgba(209, 213, 219, 0.9)'
                    },
                    '&:hover fieldset': {
                      borderColor: '#6B7280'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#FBBF24'
                    }
                  },
                  '& .MuiInputLabel-root': {
                    color: '#6B7280'
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#F59E0B'
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
                  backgroundColor: '#F59E0B',
                  color: '#111827',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#FBBF24',
                    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
                  },
                  '&:disabled': {
                    backgroundColor: 'rgba(251, 191, 36, 0.35)',
                    color: 'rgba(17, 24, 39, 0.4)'
                  }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: '#1a1a2e' }} /> : 'Login'}
              </Button>
            </form>

            <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: '#6B7280' }}>
              Contact administrator for account access
            </Typography>
          </Paper>
        </Box>
      )}
      <Box
        component="footer"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: '#F3F4F6',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Box
          sx={{
            px: { xs: 3, sm: 6, md: 10 },
            py: { xs: 6, md: 8 },
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 6, md: 8 }}
            alignItems={{ xs: 'flex-start', md: 'stretch' }}
            sx={{ width: '100%' }}
          >
            <Stack spacing={3} maxWidth={{ xs: '100%', md: 320 }}>
              <Stack spacing={2.5} alignItems="flex-start">
                <Box
                  component="img"
                  src="https://cdn.digitalindiacorporation.in/wp-content/themes/di-child/assets/images/dilogonew.svg.gzip"
                  alt="Digital India"
                  loading="lazy"
                  sx={{ height: 64, width: 'auto' }}
                />
                <Button
                  variant="outlined"
                  sx={{
                    color: '#FDE68A',
                    borderColor: 'rgba(253, 224, 71, 0.4)',
                    borderWidth: 1.5,
                    borderRadius: 999,
                    px: 4,
                    py: 1.2,
                    alignSelf: 'flex-start',
                    '&:hover': {
                      borderColor: 'rgba(253, 224, 71, 0.7)',
                      backgroundColor: 'rgba(253, 224, 71, 0.12)',
                    },
                  }}
                >
                  Connect on Social Media
                </Button>
              </Stack>
              <Stack spacing={1.5}>
                <Typography variant="body2" sx={{
                  backgroundColor: 'rgba(253, 224, 71, 0.2)',
                  color: '#FDE68A',
                  borderRadius: 999,
                  px: 3,
                  py: 1,
                  maxWidth: 'fit-content',
                  fontWeight: 600,
                }}>
                  Last Updated: {formattedLastUpdated}
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  Visitor: <Box component="span" sx={{
                    backgroundColor: '#111827',
                    color: '#FCD34D',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    ml: 1,
                    letterSpacing: 2,
                  }}>{formattedVisitorCount}</Box>
                </Typography>
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={{ xs: 4, md: 8 }}
              flexGrow={1}
            >
              {FOOTER_SECTIONS.map((section) => (
                <Stack key={section.title} spacing={2}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#F9FAFB' }}>
                    {section.title}
                  </Typography>
                  <Stack spacing={1.5}>
                    {section.links.map((link) => (
                      <Link
                        key={link}
                        href="#"
                        underline="hover"
                        sx={{
                          color: '#BFDBFE',
                          fontWeight: 500,
                          '&:hover': { color: '#E0F2FE' },
                        }}
                      >
                        {link}
                      </Link>
                    ))}
                  </Stack>
                </Stack>
              ))}
              <Stack spacing={2} maxWidth={{ xs: '100%', md: 320 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#F9FAFB' }}>
                  Contact Us
                </Typography>
                <Stack spacing={1.5}>
                  {FOOTER_CONTACT.map((line) => (
                    <Typography key={line} variant="body2" sx={{ color: '#E5E7EB' }}>
                      {line}
                    </Typography>
                  ))}
                  <Box
                    component="img"
                    src="https://cdn.digitalindiacorporation.in/wp-content/themes/di-child/assets/images/india-gov.png"
                    alt="India.gov.in"
                    loading="lazy"
                    sx={{ height: 36, width: 'auto', mt: 1 }}
                  />
                </Stack>
              </Stack>
            </Stack>
          </Stack>
        </Box>
        <Box
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.6)',
            px: { xs: 3, sm: 6, md: 10 },
            py: { xs: 3, sm: 2.5 },
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 2, sm: 4 }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            sx={{ color: '#E5E7EB', fontSize: 14 }}
          >
            <Typography>
              © 2024 - National Technical Research Organisation (NTRO). All rights reserved.
            </Typography>
            <Stack direction="row" spacing={3}>
              <Link
                href="#"
                underline="hover"
                sx={{ color: '#BFDBFE', fontWeight: 500, '&:hover': { color: '#E0F2FE' } }}
              >
                Terms and Conditions
              </Link>
              <Link
                href="#"
                underline="hover"
                sx={{ color: '#BFDBFE', fontWeight: 500, '&:hover': { color: '#E0F2FE' } }}
              >
                Feedback
              </Link>
            </Stack>
          </Stack>
          <Typography sx={{ mt: 2, color: '#D1D5DB', fontSize: 13 }}>
            The information provided on this website is sourced from publicly available domains.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}