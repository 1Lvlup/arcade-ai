import { useNavigate, useLocation } from 'react-router-dom';
import { Home, ChevronDown, LayoutDashboard, FileText, MessageSquare, Settings, Users, Brain, LineChart, Server, Gamepad2, Receipt, HelpCircle } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_ROUTES = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
  { path: '/manuals', label: 'Manual Management', icon: FileText },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/ai-config', label: 'AI Configuration', icon: Settings },
  { path: '/manual-admin', label: 'Manual Admin', icon: FileText },
  { path: '/tenant-management', label: 'Tenant Management', icon: Users },
  { path: '/training-hub', label: 'Training Hub', icon: Brain },
  { path: '/training-hub/inbox', label: 'Training Inbox', icon: Brain },
  { path: '/training-hub/examples', label: 'Training Examples', icon: Brain },
  { path: '/training-hub/qa-generate', label: 'QA Generation', icon: Brain },
  { path: '/training-hub/export', label: 'Training Export', icon: Brain },
  { path: '/qa-analytics', label: 'QA Analytics', icon: LineChart },
  { path: '/user-conversations', label: 'User Conversations', icon: MessageSquare },
  { path: '/reingest-manual', label: 'Re-ingest Manual', icon: FileText },
  { path: '/vision-board', label: 'Vision Board', icon: LayoutDashboard },
  { path: '/server-capacity', label: 'Server Capacity', icon: Server },
  { path: '/game-management', label: 'Game Management', icon: Gamepad2 },
  { path: '/support-tickets', label: 'Support Tickets', icon: Receipt },
  { path: '/account-settings', label: 'Account Settings', icon: Settings },
  { path: '/support', label: 'Support', icon: HelpCircle },
  { path: '/code-assistant', label: 'Code Assistant', icon: Brain },
  { path: '/add-games', label: 'Add Games', icon: Gamepad2 },
];

const USER_ROUTES = [
  { path: '/', label: 'Home', icon: Home },
];

export const PageNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { data: isAdmin = false } = useQuery({
    queryKey: ['user-admin-status'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });

      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }

      return data === true;
    },
  });

  const routes = isAdmin ? ADMIN_ROUTES : USER_ROUTES;
  const currentRoute = routes.find(r => r.path === location.pathname);
  const CurrentIcon = currentRoute?.icon || Home;

  return (
    <div className="flex items-center gap-2 p-2 border-b border-white/20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="minimal" className="gap-2 border-0">
            <CurrentIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{currentRoute?.label || 'Navigation'}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-56 bg-background z-50"
          sideOffset={5}
        >
          <DropdownMenuLabel>Navigate to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {routes.map((route) => {
            const Icon = route.icon;
            return (
              <DropdownMenuItem
                key={route.path}
                onClick={() => navigate(route.path)}
                className="cursor-pointer"
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{route.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
