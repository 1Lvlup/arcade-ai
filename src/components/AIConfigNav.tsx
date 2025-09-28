import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Settings } from 'lucide-react';

export const AIConfigNav = () => {
  const location = useLocation();

  return (
    <Link
      to="/ai-config"
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-accent hover:text-accent-foreground",
        location.pathname === "/ai-config" && "bg-accent text-accent-foreground"
      )}
    >
      <Settings className="h-4 w-4" />
      AI Configuration
    </Link>
  );
};