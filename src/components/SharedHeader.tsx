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
  BookOpen,
  Menu,
  DollarSign,
  HelpCircle,
  FileText,
  Wrench,
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
    <header className="relative bg-black border-t-2 border-t-orange/30 overflow-hidden max-h-[70px]">
      {/* Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-contain z-0"
        style={{ objectPosition: "center 50%" }}
      >
        <source src="/AIGlitch.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/50 z-[1]" />

      <div className="container mx-auto px-3 py-3 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          {/* Level Up Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-orange" />
            <span className="text-lg font-tech font-bold text-foreground">Level Up</span>
          </Link>

          {/* Main Navigation Links - Always visible */}
          <nav className="flex items-center space-x-1 ml-2">
            <Link to="/">
              <Button variant="minimal" size="sm">
                Home
              </Button>
            </Link>
            <Link to="/what-is-level-up">
              <Button variant="minimal" size="sm">
                What is Level Up?
              </Button>
            </Link>
            <Link to="/blog">
              <Button variant="minimal" size="sm">
                Blog
              </Button>
            </Link>
            <Link to="/downgames">
              <Button variant="minimal" size="sm">
                Facility Dashboard
              </Button>
            </Link>
          </nav>

          {/* Admin Pages Dropdown */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="minimal" size="sm">
                  <Menu className="h-4 w-4 mr-2" />
                  Pages
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-background border-border z-50 max-h-[80vh] overflow-y-auto">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Public</div>
                <DropdownMenuItem asChild>
                  <Link to="/" className="cursor-pointer">
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/forum" className="cursor-pointer">
                    <Users className="mr-2 h-4 w-4" />
                    Forum
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/blog" className="cursor-pointer">
                    <FileText className="mr-2 h-4 w-4" />
                    Blog
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/pricing" className="cursor-pointer">
                    <DollarSign className="mr-2 h-4 w-4" />
                    Pricing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/privacy" className="cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    Privacy Policy
                  </Link>
                </DropdownMenuItem>

                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">User</div>
                    <DropdownMenuItem asChild>
                      <Link to="/chat" className="cursor-pointer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Chat
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/vision-board" className="cursor-pointer">
                        <Brain className="mr-2 h-4 w-4" />
                        Vision Board
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/support" className="cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Support
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Admin</div>
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/manual-management" className="cursor-pointer">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Manual Management
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/manual-admin" className="cursor-pointer">
                      <Database className="mr-2 h-4 w-4" />
                      Manual Admin
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/manual-processing" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Manual Processing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/ai-configuration" className="cursor-pointer">
                      <Brain className="mr-2 h-4 w-4" />
                      AI Config
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/code-assistant" className="cursor-pointer">
                      <Code className="mr-2 h-4 w-4" />
                      Code Assistant
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/game-management" className="cursor-pointer">
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      Game Management
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/training-hub" className="cursor-pointer">
                      <GraduationCap className="mr-2 h-4 w-4" />
                      Training Hub
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/training-dashboard" className="cursor-pointer">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Training Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/training-inbox" className="cursor-pointer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Training Inbox
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/training-examples" className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Training Examples
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/training-qa" className="cursor-pointer">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Training QA
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/training-export" className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      Training Export
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/tenant-management" className="cursor-pointer">
                      <Users className="mr-2 h-4 w-4" />
                      Tenant Management
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/server-capacity" className="cursor-pointer">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Server Capacity
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/user-conversations" className="cursor-pointer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      User Conversations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/qa-analytics" className="cursor-pointer">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      QA Analytics
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/support-tickets" className="cursor-pointer">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Support Tickets
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/blog-admin" className="cursor-pointer">
                      <FileText className="mr-2 h-4 w-4" />
                      Blog Admin
                    </Link>
                  </DropdownMenuItem>
                </>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center space-x-2">
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
                  <Link to="/admin" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                  <Link to="/downgames" className="cursor-pointer">
                    <Wrench className="h-4 w-4 mr-2" />
                    Down Games (GM)
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/blog" className="cursor-pointer">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Blog Management
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
                  <Link to="/profile" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account-settings" className="cursor-pointer">
                    <Settings className="h-4 w-4 mr-2" />
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
                size="sm"
                className="gap-2 font-bold hover-lift backdrop-blur-sm"
                style={{
                  boxShadow: "0 0 20px hsl(24 100% 60% / 0.4)",
                }}
              >
                <User className="h-4 w-4" />
                <span>SIGN IN</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
