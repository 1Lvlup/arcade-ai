import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageCircle, BookOpen, Eye, Zap, Target, Database, Shield, BarChart3, Users, Globe, CheckCircle, ArrowRight, TrendingUp, Clock, Code, Check, Settings } from "lucide-react";
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
  const {
    user
  } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>();
  const [selectedManualTitle, setSelectedManualTitle] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroImageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const {
        data
      } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin"
      });
      setIsAdmin(data || false);
    };
    checkAdmin();
  }, [user]);

  // Parallax scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, {
      passive: true
    });
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
  return <div className="min-h-screen bg-background">
      <SharedHeader title="1LevelUp" titleClassName="text-sm font-semibold text-foreground" />

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-8 md:pt-12 pb-12 md:pb-20 px-0 my-0 mx-0 bg-transparent">
          <div className="container mx-auto px-4 my-0 bg-transparent">
            {/* Centered Text Content */}
            {/* Title - No Box */}
            <div className="max-w-[800px] mx-auto text-center mb-6">
              <h1 className="text-4xl sm:text-5xl tracking-tight leading-tight font-medium font-tech text-slate-50 lg:text-5xl mb-6">
                STOP LOSING MONEY TO <span className="text-primary">DEAD GAMES</span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed font-sans">
                LevelUp is an AI technician for your arcade that understands your exact games and walks any tech through
                from problem to solution, so dead cabinets start earning again fast.
              </p>
            </div>

            {/* Bullet Points - Outside Box */}
            <div className="flex flex-row gap-6 mb-8 text-sm max-w-[1000px] mx-auto justify-center">
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

            {/* CTA Buttons - Outside the box */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 mb-4 mt-8">
              <Button onClick={handleStartGeneralChat} size="lg" variant="orange" className="text-xl font-semibold px-12 sm:w-auto animate-glow-pulse hover:shadow-[0_0_35px_rgba(255,107,0,0.6)] transition-shadow duration-300">
                Launch Arcade Intelligence
              </Button>
              {isAdmin && <Button asChild size="lg" variant="outline" className="text-base font-semibold px-12 w-full sm:w-auto">
                  <Link to="/lead-intelligence">Outbound Sales Hub</Link>
                </Button>}
            </div>

            <p className="text-xs text-muted-foreground font-sans text-center mb-12 md:mb-16">
              No credit card · Built inside a live FEC with 80+ games
            </p>

            {/* Product Screenshot - Full Width Card */}
            <div className="w-[80%] max-w-[1200px] mx-auto mt-12 md:mt-16">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl my-0">
                <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/40 z-10 pointer-events-none" />
                <img ref={heroImageRef} src={chatUIBackground} alt="LevelUp Chat Interface" loading="lazy" decoding="async" className="w-full h-auto brightness-105 object-fill rounded-md shadow-xl opacity-100" />
              </div>
            </div>
          </div>
        </section>

          {/* Features Section */}
          <section className="py-20">
            <div className="mb-12 text-center flex flex-col items-center">
              <p className="text-xs uppercase tracking-widest text-primary mb-2 font-tech">
                ADVANCED CAPABILITIES
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold font-tech uppercase mb-4">
                Built for <span className="text-primary">arcade operators</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl">
                Everything you need to keep your games running, in one intelligent platform.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="border-2 border-border hover:border-primary/60 bg-black/40 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_40px_rgba(255,107,0,0.15)] transition-all duration-300">
                <CardHeader>
                  <Brain className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl font-tech uppercase text-slate-50">AI-powered diagnostics</CardTitle>
                  <CardDescription className="text-base">
                    AI that understands real arcade issues and patterns from the field.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 border-border hover:border-primary/60 bg-black/40 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_40px_rgba(255,107,0,0.15)] transition-all duration-300">
                <CardHeader className="shadow-lg text-[#ff8500] rounded-lg">
                  <Zap className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl font-tech uppercase text-slate-50">Lightning fast</CardTitle>
                  <CardDescription className="text-base">
                    Get answers in seconds instead of hours of manual digging and guesswork.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 border-border hover:border-primary/60 bg-black/40 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_40px_rgba(255,107,0,0.15)] transition-all duration-300">
                <CardHeader>
                  <Database className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl font-tech uppercase text-slate-50">Comprehensive coverage</CardTitle>
                  <CardDescription className="text-base">
                    All your key games and recurring issues in one shared intelligence layer.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 border-border hover:border-primary/60 bg-black/40 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_40px_rgba(255,107,0,0.15)] transition-all duration-300">
                <CardHeader>
                  <BookOpen className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl font-tech uppercase text-slate-50">Smart knowledge base</CardTitle>
                  <CardDescription className="text-base">
                    A living system that connects game behavior, error codes, and proven fixes into one place.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 border-border hover:border-primary/60 bg-black/40 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_40px_rgba(255,107,0,0.15)] transition-all duration-300">
                <CardHeader>
                  <Shield className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl font-tech uppercase text-slate-50">Enterprise security</CardTitle>
                  <CardDescription className="text-base">
                    Your operational data stays yours with strong security controls.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 border-border hover:border-primary/60 bg-black/40 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_40px_rgba(255,107,0,0.15)] transition-all duration-300">
                <CardHeader>
                  <Users className="h-8 w-8 text-primary mb-3" />
                  <CardTitle className="text-xl font-tech uppercase text-slate-50">Team collaboration</CardTitle>
                  <CardDescription className="text-base">
                    Share what works across your maintenance team instead of keeping it in one person's head.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </section>

          {/* How it Works */}
          <section className="py-20 border-t border-border">
            <div className="mb-16 text-center flex flex-col items-center">
              <p className="text-xs uppercase tracking-widest text-primary mb-2 font-tech">
                INSIDE THE INTELLIGENCE
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold font-tech uppercase mb-4">
                How it <span className="text-primary text-4xl font-semibold">works</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl">
                Intelligent retrieval meets deep reasoning so your techs get reliable answers fast.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-4 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center border-2 border-primary shadow-[0_0_20px_rgba(255,107,0,0.4)]">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground font-tech uppercase">Describe the issue</h3>
                <p className="text-muted-foreground">
                  Your tech explains what the game is doing in <span className="text-primary">plain language</span>—no special phrasing needed.
                </p>
              </div>

              <div className="space-y-4 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center border-2 border-primary shadow-[0_0_20px_rgba(255,107,0,0.4)]">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground font-tech uppercase">LevelUp analyzes it</h3>
                <p className="text-muted-foreground">
                  The system uses everything it knows about that game—behavior, wiring, error patterns, and past
                  fixes—to propose a <span className="text-primary">focused troubleshooting path</span>.
                </p>
              </div>

              <div className="space-y-4 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center border-2 border-primary shadow-[0_0_20px_rgba(255,107,0,0.4)]">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="text-xl font-semibold text-foreground font-tech uppercase">You confirm the fix</h3>
                <p className="text-muted-foreground">
                  Your tech follows the guided steps, confirms what worked, and that <span className="text-primary">resolution is saved</span> so the next
                  time it's almost instant.
                </p>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="py-20">
            <div className="mb-16 text-center flex flex-col items-center">
              <p className="text-xs uppercase tracking-widest text-primary mb-2 font-tech">
                SIMPLE, TRANSPARENT PRICING
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold font-tech uppercase mb-4">
                Choose Your <span className="text-primary">Level Up</span> Plan
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl">Built for busy FEC technicians who want less paperwork and faster fixes</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card className="border-2 border-border bg-black/60 backdrop-blur-sm shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-tech uppercase">Starter</CardTitle>
                  <CardDescription className="text-lg mt-2">Perfect for single locations</CardDescription>
                  <div className="mt-6">
                    <span className="text-4xl font-bold text-primary">Free</span>
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

              <Card className="border-2 border-primary bg-black/60 backdrop-blur-sm shadow-[0_0_40px_rgba(255,107,0,0.3)] hover:shadow-[0_0_50px_rgba(255,107,0,0.5)] transition-all duration-300 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most popular</Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-2xl font-tech uppercase">Professional</CardTitle>
                  <CardDescription className="text-lg mt-2">For serious operations</CardDescription>
                  <div className="mt-6">
                    <span className="text-4xl font-bold text-primary">$99</span>
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
                  <Button className="w-full mt-6 bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(255,107,0,0.4)] hover:shadow-[0_0_30px_rgba(255,107,0,0.6)]">
                    Start free trial
                  </Button>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Final CTA */}
          <section className="py-20 border-t border-border">
            <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
              <h2 className="text-4xl sm:text-5xl font-bold font-tech uppercase mb-6">
                Ready to eliminate <span className="text-primary">downtime</span>?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
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
          {isAdmin && <section className="py-12 border-t border-border">
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
          </section>}
        </main>

        <Footer />
        <ProcessingMonitor />
        <LiveProcessingMonitor />
      </div>;
};
export default Index;