import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  Users, 
  CheckSquare, 
  MessageSquare, 
  Presentation,
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Download
} from "lucide-react";

const navItems = [
  {
    title: "Lead Intelligence",
    href: "/lead-intelligence",
    icon: Sparkles,
    description: "Analyze & score leads"
  },
  {
    title: "Lead Database",
    href: "/outbound-leads",
    icon: Users,
    description: "Manage prospects"
  },
  {
    title: "Tasks & Discovery",
    href: "/outbound-tasks",
    icon: CheckSquare,
    description: "Daily activities"
  },
  {
    title: "Outreach Builder",
    href: "/outbound-outreach",
    icon: MessageSquare,
    description: "Cadences & scripts"
  },
  {
    title: "Demo & Objections",
    href: "/outbound-demo",
    icon: Presentation,
    description: "Demo planning"
  },
  {
    title: "Objection Analytics",
    href: "/outbound-objections",
    icon: AlertTriangle,
    description: "Analyze patterns"
  },
  {
    title: "Pipeline Analytics",
    href: "/outbound-pipeline",
    icon: TrendingUp,
    description: "Momentum insights"
  },
  {
    title: "Import Prospects",
    href: "/outbound-import",
    icon: Download,
    description: "Google Places import"
  }
];

export function OutboundNav() {
  const location = useLocation();

  return (
    <div className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 py-3 overflow-x-auto">
          <LayoutDashboard className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-muted-foreground flex-shrink-0">Outbound Hub:</span>
          <div className="flex gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  asChild
                  className={cn(
                    "flex-shrink-0",
                    !isActive && "hover:bg-muted"
                  )}
                >
                  <Link to={item.href} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.title}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
