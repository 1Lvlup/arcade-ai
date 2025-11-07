import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
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

const Index = () => {
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>();
  const [selectedManualTitle, setSelectedManualTitle] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(data || false);
    };
    checkAdmin();
  }, [user]);

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
    setSelectedManualId(undefined);
    setSelectedManualTitle(undefined);
    setShowChat(true);

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("chat", "true");
    newUrl.searchParams.delete("manual_id");
    newUrl.searchParams.delete("title");
    window.history.pushState({}, "", newUrl.toString());
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

    setSelectedManualId(manualId || undefined);
    setSelectedManualTitle(manualTitle || undefined);
    setShowChat(true);

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("chat", "true");
    if (manualId) {
      newUrl.searchParams.set("manual_id", manualId);
      if (manualTitle) {
        newUrl.searchParams.set("title", manualTitle);
      }
    }
    window.history.pushState({}, "", newUrl.toString());
  };

  if (showChat) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <GameSidebar selectedManualId={selectedManualId} onManualChange={handleManualChange} />
        <SharedHeader
          title={selectedManualId ? `AI Assistant: ${selectedManualTitle}` : "AI Assistant"}
          showBackButton={true}
          backTo="/"
          onBackClick={handleBackToHome}
        />
        <main className="flex-1 ml-56 container mx-auto px-4 py-8">
          <ChatBot selectedManualId={selectedManualId} manualTitle={selectedManualTitle} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="1LevelUp" titleClassName="text-lg font-semibold text-foreground" />

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[700px] bg-background overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 py-16 relative z-10">
            {/* Text Content - At Top */}
            <div className="max-w-3xl mb-12">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
                Stop losing money to dead games.
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-6">
                LevelUp is an AI technician for your arcade that understands your exact games and walks any tech through
                the full troubleshooting path from symptom to fix, so dead cabinets start earning again fast.
              </p>

              <ul className="space-y-3 text-lg text-muted-foreground mb-6">
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Recover revenue from games that would sit dark for days or weeks.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>Give every tech instant access to the highest level arcade technician, 24/7, on their phone.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary mt-1">•</span>
                  <span>
                    Every fix across every arcade keeps LevelUp constantly evolving, so over time it becomes the default
                    way modern arcades stay online.
                  </span>
                </li>
              </ul>

              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Button
                  onClick={handleStartGeneralChat}
                  size="lg"
                  variant="orange"
                  className="text-base font-semibold px-8"
                >
                  Get started free
                </Button>
                <Button variant="link" size="lg" className="text-base font-semibold text-foreground hover:text-primary">
                  Book a 15-minute walkthrough →
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                5 free questions · No credit card · Built inside a live FEC with 80+ games
              </p>
            </div>
          </div>

          {/* Background Image - Below Text */}
          <div className="absolute bottom-0 left-0 right-0 h-[400px] z-0">
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-background z-10" />
            <img
              src={heroBackground}
              alt="LevelUp interface preview"
              className="w-full h-full object-cover object-top opacity-80"
            />
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Stats Section */}
          <section className="py-16 border-y border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div>
                <div className="text-3xl font-bold text-foreground mb-1">2.3ms</div>
                <div className="text-sm text-muted-foreground">Average response time</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground mb-1">99.9%</div>
                <div className="text-sm text-muted-foreground">Accuracy rate</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground mb-1">1.2B+</div>
                <div className="text-sm text-muted-foreground">Training parameters</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground mb-1">24/7</div>
                <div className="text-sm text-muted-foreground">Always available</div>
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
        </div>

        {/* Admin Panel */}
        {isAdmin && (
          <section className="py-12 border-t border-border">
            <h2 className="text-2xl font-bold text-foreground mb-6">Admin Panel</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link to="/manual-management">
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="mr-2 h-5 w-5" />
                  Manual Management
                </Button>
              </Link>
              <Link to="/ai-configuration">
                <Button variant="outline" className="w-full justify-start">
                  <Brain className="mr-2 h-5 w-5" />
                  AI Configuration
                </Button>
              </Link>
              <Link to="/training-hub">
                <Button variant="outline" className="w-full justify-start">
                  <Target className="mr-2 h-5 w-5" />
                  Training Hub
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
