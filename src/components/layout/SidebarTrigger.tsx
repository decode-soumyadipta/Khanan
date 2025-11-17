'use client';
import { Menu } from "lucide-react";
import { IconButton } from "@mui/material";
import { useSidebar } from "../sidebar/hooks";

export function SidebarTrigger() {
  const { toggleSidebar } = useSidebar();

  return (
    <IconButton
      onClick={toggleSidebar}
      sx={{ 
        color: 'text.primary',
        '&:hover': { backgroundColor: 'action.hover' }
      }}
      aria-label="Toggle sidebar"
    >
      <Menu className="w-5 h-5" />
    </IconButton>
  );
}