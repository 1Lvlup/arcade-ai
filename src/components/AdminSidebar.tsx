import { Activity, Database, Brain, BarChart3 } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const adminSections = [
  {
    id: 'system',
    title: 'System Management',
    icon: Activity,
    description: 'Jobs, Capacity, Tenants',
    disabled: false,
  },
  {
    id: 'content',
    title: 'Content Management',
    icon: Database,
    description: 'Manuals, Games, Uploads',
    disabled: false,
  },
  {
    id: 'ai',
    title: 'AI & Training',
    icon: Brain,
    description: 'Config, Training, QA',
    disabled: true,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: BarChart3,
    description: 'Users, Usage, Insights',
    disabled: true,
  },
];

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { open } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin Controls</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminSections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    onClick={() => !section.disabled && onTabChange(section.id)}
                    isActive={activeTab === section.id}
                    disabled={section.disabled}
                    className="h-auto py-3"
                    tooltip={section.title}
                  >
                    <section.icon className="h-5 w-5 shrink-0" />
                    {open && (
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{section.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {section.description}
                        </span>
                      </div>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
