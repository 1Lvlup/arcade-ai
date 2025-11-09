import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Brain,
  LogOut,
  ArrowLeft,
  Settings,
  Database,
  Home,
  Shield,
  GraduationCap,
  BarChart3,
  Users,
  User,
  ChevronDown,
  Code,
  Upload,
  MessageCircle,
  Plus,
  Gamepad2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageNavigation } from "@/components/PageNavigation";

interface SharedHeaderProps {
  title?: string;
  showBackButton?: boolean;
  backTo?: string;
  onBackClick?: () => void;
  children?: React.ReactNode;
  titleClassName?: string;
}

export const SharedHeader = ({
  title,
  showBackButton = false,
  backTo = "/",
  onBackClick,
  children,
  titleClassName,
}: SharedHeaderProps) => {
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(data || false);
    };
    checkAdmin();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="relative bg-black border-t-2 border-t-orange/30 overflow-hidden max-h-[50px]">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        style={{ objectPosition: "center 50%" }}
      >
        <source src="/AIGlitch.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/50 z-[1]" />

      <div className="container mx-auto px-6 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-6">
          {showBackButton &&
            (onBackClick ? (
              <Button variant="minimal" size="sm" onClick={onBackClick}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            ) : (
              <Link to={backTo}>
                <Button variant="minimal" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            ))}
          {title && (
            <div className="flex items-center space-x-3">
              <Brain className="h-6 w-6 text-orange" />
              <h1 className={titleClassName || "text-xl font-tech font-bold text-foreground"}>{title}</h1>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {children}

          {/* Page Navigation Dropdown */}
          <PageNavigation />

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="minimal" size="sm">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                <DropdownMenuItem asChild>
                  <Link to="/manuals" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/manual-admin" className="cursor-pointer">
                    <Database className="h-4 w-4 mr-2" />
                    Manual Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/game-management" className="cursor-pointer">
                    <Gamepad2 className="h-4 w-4 mr-2" />
                    Game Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ai-config" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    AI Configuration
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/training-hub" className="cursor-pointer">
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Training Hub
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/code-assistant" className="cursor-pointer">
                    <Code className="h-4 w-4 mr-2" />
                    AI Code Assistant
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/vision-board" className="cursor-pointer">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Strategic Analytics Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/tenant-management" className="cursor-pointer">
                    <Users className="h-4 w-4 mr-2" />
                    Tenant & User Management
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/user-conversations" className="cursor-pointer">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    User Conversation History
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="minimal" size="sm">
                  {user.email}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                <DropdownMenuItem asChild>
                  <Link to="/account-settings" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/support-tickets" className="cursor-pointer">
                      <User className="h-4 w-4 mr-2" />
                      Support Tickets
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth">
              <Button
                variant="orange"
                size="lg"
                className="gap-2 font-bold text-base hover-lift"
                style={{
                  boxShadow: "0 0 20px hsl(24 100% 60% / 0.4)",
                }}
              >
                <User className="h-5 w-5" />
                <span>SIGN IN / SIGN UP</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
