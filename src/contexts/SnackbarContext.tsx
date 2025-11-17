'use client';
import React, { createContext, useContext, useState, ReactNode } from "react";
import { 
  Snackbar, 
  Alert, 
  IconButton, 
  Collapse,
  styled,
  useTheme,
  alpha
} from "@mui/material";
import {
  Close,
  ExpandLess,
  ExpandMore
} from "@mui/icons-material";

interface SnackbarContextType {
  showSnackbar: (message: string, severity?: "success" | "error" | "warning" | "info", details?: string) => void;
}

const SnackbarContext = createContext<SnackbarContextType | null>(null);

// Styled components
const FloatingSnackbar = styled(Snackbar)(({ theme }) => ({
  zIndex: 99999,
  '& .MuiSnackbar-root': {
    zIndex: 99999,
  },
}));

const GlassAlert = styled(Alert)(({ theme, severity }) => {
  const getSeverityColor = () => {
    switch (severity) {
      case 'error': return theme.palette.error.main;
      case 'warning': return theme.palette.warning.main;
      case 'info': return theme.palette.info.main;
      default: return theme.palette.success.main;
    }
  };
  
  const severityColor = getSeverityColor();
  
  return {
    borderRadius: '12px',
    boxShadow: theme.shadows[6],
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${alpha(severityColor, 0.2)}`,
    alignItems: 'flex-start',
    maxWidth: '400px',
    backgroundColor: alpha(theme.palette.background.paper, 0.9),
    color: theme.palette.text.primary,
    
    '& .MuiAlert-message': {
      padding: '4px 0',
      flex: 1,
    },
    
    '& .MuiAlert-icon': {
      color: severityColor,
    },
    
    '& .MuiAlert-action': {
      paddingTop: '2px',
    },
  };
});

export const SnackbarProvider = ({ children }: { children: ReactNode }) => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
    expanded: false,
    details: "",
  });
  
  const theme = useTheme();

  const showSnackbar = (message: string, severity: "success" | "error" | "warning" | "info" = "success", details: string = "") => {
    setSnackbar({
      open: true,
      message,
      severity,
      expanded: false,
      details,
    });
  };

  const handleClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const toggleExpand = () => {
    setSnackbar((prev) => ({ ...prev, expanded: !prev.expanded }));
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      {/* Global Snackbar Component */}
      <FloatingSnackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        TransitionComponent={Collapse}
      >
        <GlassAlert
          severity={snackbar.severity}
          action={
            <div>
              {snackbar.details && (
                <IconButton
                  size="small"
                  onClick={toggleExpand}
                  sx={{ mr: 0.5 }}
                >
                  {snackbar.expanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={handleClose}
              >
                <Close />
              </IconButton>
            </div>
          }
        >
          <div>{snackbar.message}</div>
          <Collapse in={snackbar.expanded} timeout="auto" unmountOnExit>
            <div style={{ 
              marginTop: '8px', 
              padding: '8px', 
              borderRadius: '8px',
              backgroundColor: alpha(theme.palette.background.default, 0.4),
              fontSize: '0.875rem'
            }}>
              {snackbar.details}
            </div>
          </Collapse>
        </GlassAlert>
      </FloatingSnackbar>
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
};