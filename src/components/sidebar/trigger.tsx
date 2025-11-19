import { Menu } from "lucide-react";
import { useSidebar } from "./hooks";

interface SidebarTriggerProps {
  asChild?: boolean;
}

export function SidebarTrigger({ asChild = false }: SidebarTriggerProps) {
  const { toggleSidebar } = useSidebar();

  // If used as child (inside IconButton), just render the icon
  if (asChild) {
    return <Menu className="w-5 h-5" />;
  }

  // Otherwise render as a standalone button
  return (
    <button
      onClick={toggleSidebar}
      className="bg-inherit hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors p-2 rounded"
      aria-label="Toggle sidebar"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}