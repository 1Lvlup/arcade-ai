import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  MessageCircle,
  BookOpen,
  Eye,
  Zap,
  Target,
  Database,
  Shield,
  BarChart3,
  Users,
  Globe,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Code,
  Check,
  Settings,
} from "lucide-react";
import { ProcessingMonitor } from "@/components/ProcessingMonitor";
import { ChatBot } from "@/components/ChatBot";
import { SharedHeader } from "@/components/SharedHeader";
import { Footer } from "@/components/Footer";
import { LiveProcessingMonitor } from "@/components/LiveProcessingMonitor";
import { GameSidebar } from "@/components/GameSidebar";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import productScreenshot from "@/assets/product-screenshot.png";
import heroBackground from "@/assets/hero-background.png";
import chatUIBackground from "@/assets/hero-background-optimized.png";

const Index = () => {
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>();
  const [selectedManualTitle, setSelectedManualTitle] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(data || false);
    };
    checkAdmin();
  }, [user]);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const chatMode = urlParams.get("chat");
    const manualId = urlParams.get("manual_id");
    const title = urlParams.get("title");
    if (chatMode === "true") {
      setShowChat(true);
      if (manualId) {
        setSelectedManualId(manualId);
        setSelectedManualTitle(title || undefined);
      }
    }
  }, []);

  const handleStartGeneralChat = () => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    window.location.href = "/chat";
  };

  const handleBackToHome = () => {
    setShowChat(false);
    setSelectedManualId(undefined);
    setSelectedManualTitle(undefined);

    const newUrl = new URL(window.location.href);
    newUrl.search = "";
    window.history.pushState({}, "", newUrl.toString());
  };

  const handleManualChange = (manualId: string | null, manualTitle: string | null) => {
    if (!user) {
      window.location.href = "/auth";
      return;
    }

    const newUrl = `/chat${manualId ? `?manual_id=${manualId}${manualTitle ? `&title=${encodeURIComponent(manualTitle)}` : ""}` : ""}`;
    window.location.href = newUrl;
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="1LevelUp" titleClassName="text-sm font-semibold text-foreground" />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[700px] bg-background overflow-hidden">
          <div className="w-full relative z-20">
            {/* Text Content - Centered at top */}
            <div className="w-full text-center mb-6 px-4 pt-2 md:pt-10 lg:pt-16">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-hero font-bold tracking-tight text-foreground mb-4 leading-tight">
                STOP LOSING MONEY TO DEAD GAMES
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed mb-6 max-w-4xl mx-auto font-sans">
                LevelUp is an AI technician for your arcade that understands your exact games and walks any tech through
                from problem to solution, so dead cabinets start earning again fast.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 max-w-5xl mx-auto text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span className="text-muted-foreground font-sans">
                    Every fix across every arcade is stored into the database.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span className="text-muted-foreground font-sans">
                    Over time it will instantly know every solution to every problem with little to no troubleshooting
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span className="text-muted-foreground font-sans">
                    Recover revenue from games that would sit dark for days or weeks.
                  </span>
                </div>
              </div>

              <div className="flex justify-center mb-3">
                <Button
                  onClick={handleStartGeneralChat}
                  size="lg"
                  variant="orange"
                  className="text-base font-semibold px-12 w-full sm:w-auto"
                >
                  Launch Arcade Intelligence
                </Button>
              </div>

              <p className="text-xs text-muted-foreground font-sans">
                No credit card · Built inside a live FEC with 80+ games
              </p>
            </div>

            {/* Background Image - Main focal point, fully visible */}
            <div className="relative w-full mt-8">
              {/* Dark gradient overlay for depth and readability */}
              <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/20 to-background/80 z-10 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-background/40 z-10 pointer-events-none" />

              <div className="relative rounded-lg overflow-hidden shadow-2xl ml-8 md:ml-12 lg:ml-20">
                <img
                  ref={heroImageRef}
                  src={chatUIBackground}
                  alt="LevelUp Chat Interface"
                  className="w-full h-auto brightness-105"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </section>

          {/* Features Section */}
          <section className="py-20">
            <div className="mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Built for arcade operators</h2>
              <p className="text-xl text-muted-foreground max-w-2xl">
                Everything you need to keep your games running, in one intelligent platform.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-border hover:border-primary/40 transition-colors">
                <CardHeader>
                  <Brain className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl">AI-powered diagnostics</CardTitle>
                  <CardDescription className="text-base">
                    AI that understands real arcade issues and patterns from the field.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border hover:border-primary/40 transition-colors">
                <CardHeader>
                  <Zap className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl">Lightning fast</CardTitle>
                  <CardDescription className="text-base">
                    Get answers in seconds instead of hours of manual digging and guesswork.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border hover:border-primary/40 transition-colors">
                <CardHeader>
                  <Database className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl">Comprehensive coverage</CardTitle>
                  <CardDescription className="text-base">
                    All your key games and recurring issues in one shared intelligence layer.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border hover:border-primary/40 transition-colors">
                <CardHeader>
                  <BookOpen className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl">Smart knowledge base</CardTitle>
                  <CardDescription className="text-base">
                    A living system that connects game behavior, error codes, and proven fixes into one place.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border hover:border-primary/40 transition-colors">
                <CardHeader>
                  <Shield className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl">Enterprise security</CardTitle>
                  <CardDescription className="text-base">
                    Your operational data stays yours with strong security controls.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-border hover:border-primary/40 transition-colors">
                <CardHeader>
                  <Users className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl">Team collaboration</CardTitle>
                  <CardDescription className="text-base">
                    Share what works across your maintenance team instead of keeping it in one person’s head.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>

          {/* How it Works */}
          <section className="py-20 border-t border-border">
            <div className="mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">How it works</h2>
              <p className="text-xl text-muted-foreground max-w-2xl">
                Intelligent retrieval meets deep reasoning so your techs get reliable answers fast.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">Describe the issue</h3>
                <p className="text-muted-foreground">
                  Your tech explains what the game is doing in plain language—no special phrasing needed.
                </p>
              </div>

              <div className="space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">LevelUp analyzes it</h3>
                <p className="text-muted-foreground">
                  The system uses everything it knows about that game—behavior, wiring, error patterns, and past
                  fixes—to propose a focused troubleshooting path.
                </p>
              </div>

              <div className="space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground">You confirm the fix</h3>
                <p className="text-muted-foreground">
                  Your tech follows the guided steps, confirms what worked, and that resolution is saved so the next
                  time it’s almost instant.
                </p>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="py-20">
            <div className="mb-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h2>
              <p className="text-xl text-muted-foreground">Start free, scale as you grow</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-2xl">Starter</CardTitle>
                  <CardDescription className="text-lg mt-2">Perfect for single locations</CardDescription>
                  <div className="mt-6">
                    <span className="text-4xl font-bold">Free</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">50 queries per month</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Core troubleshooting support</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Email support</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-6">
                    Get started
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-primary relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl">Professional</CardTitle>
                  <CardDescription className="text-lg mt-2">For serious operations</CardDescription>
                  <div className="mt-6">
                    <span className="text-4xl font-bold">$99</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Unlimited queries</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Advanced AI diagnostics</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Priority support</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Team collaboration</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Custom integrations</span>
                    </div>
                  </div>
                  <Button className="w-full mt-6">Start free trial</Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Final CTA */}
          <section className="py-20 border-t border-border">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-6">Ready to eliminate downtime?</h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join arcade operators who trust 1LevelUp to keep their games running.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={handleStartGeneralChat} size="lg" className="text-base font-semibold">
                  Get started for free <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="outline" size="lg" className="text-base font-semibold">
                  Contact sales
                </Button>
              </div>
            </div>
          </section>

          {/* Admin Panel */}
          {isAdmin && (
          <section className="py-12 border-t border-border">
            <h2 className="text-2xl font-bold text-foreground mb-6">Admin Panel</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-4 max-w-2xl">
              <Link to="/admin">
                <Button variant="orange" size="lg" className="w-full justify-start h-20">
                  <Settings className="mr-3 h-6 w-6" />
                  <div className="text-left">
                    <div className="font-bold">Admin Dashboard</div>
                    <div className="text-xs opacity-90">Unified control center</div>
                  </div>
                </Button>
              </Link>
              <Link to="/manual-management">
                <Button variant="outline" size="lg" className="w-full justify-start h-20">
                  <BookOpen className="mr-3 h-6 w-6" />
                  <div className="text-left">
                    <div className="font-semibold">Manual Management</div>
                    <div className="text-xs opacity-70">Browse & manage manuals</div>
                  </div>
                </Button>
              </Link>
            </div>
          </section>
          )}
        </main>

        <Footer />
        <ProcessingMonitor />
        <LiveProcessingMonitor />
      </div>
  );
};

export default Index;
