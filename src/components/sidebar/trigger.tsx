import { Menu } from "lucide-react";
import { useSidebar } from "./hooks";

export function SidebarTrigger() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="  bg-inherit hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label="Toggle sidebar"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}