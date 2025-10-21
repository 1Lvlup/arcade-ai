import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageCircle, BookOpen, Eye, Zap, Target, Database, Shield, BarChart3, Users, Globe, CheckCircle, ArrowRight, TrendingUp, Clock, Code } from 'lucide-react';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import { Footer } from '@/components/Footer';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
const Index = () => {
  const {
    user
  } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>();
  const [selectedManualTitle, setSelectedManualTitle] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const {
        data
      } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      setIsAdmin(data || false);
    };
    checkAdmin();
  }, [user]);
  useEffect(() => {
    // Check URL parameters for chat mode
    const urlParams = new URLSearchParams(window.location.search);
    const chatMode = urlParams.get('chat');
    const manualId = urlParams.get('manual_id');
    const title = urlParams.get('title');
    if (chatMode === 'true') {
      setShowChat(true);
      if (manualId) {
        setSelectedManualId(manualId);
        setSelectedManualTitle(title || undefined);
      }
    }
  }, []);
  const handleStartGeneralChat = () => {
    setSelectedManualId(undefined);
    setSelectedManualTitle(undefined);
    setShowChat(true);

    // Update URL without manual-specific parameters
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('chat', 'true');
    newUrl.searchParams.delete('manual_id');
    newUrl.searchParams.delete('title');
    window.history.pushState({}, '', newUrl.toString());
  };
  const handleBackToHome = () => {
    setShowChat(false);
    setSelectedManualId(undefined);
    setSelectedManualTitle(undefined);

    // Clear URL parameters
    const newUrl = new URL(window.location.href);
    newUrl.search = '';
    window.history.pushState({}, '', newUrl.toString());
  };
  if (showChat) {
    return <div className="min-h-screen professional-bg flex flex-col">
        <SharedHeader title={selectedManualId ? `AI Assistant: ${selectedManualTitle}` : 'AI Assistant'} showBackButton={true} backTo="/" onBackClick={handleBackToHome} />
        <main className="container mx-auto px-4 py-8 flex-1">
          <ChatBot selectedManualId={selectedManualId} manualTitle={selectedManualTitle} />
        </main>
        <Footer />
      </div>;
  }
  const stats = [{
    value: "2.3ms",
    label: "Response Time",
    description: "Industry-leading processing speed",
    icon: <Clock className="h-5 w-5" />
  }, {
    value: "99.9%",
    label: "Accuracy Rate",
    description: "Benchmark-setting precision",
    icon: <Target className="h-5 w-5" />
  }, {
    value: "1.2B+",
    label: "Parameters",
    description: "Advanced neural architecture",
    icon: <Database className="h-5 w-5" />
  }, {
    value: "24/7",
    label: "Availability",
    description: "Enterprise-grade reliability",
    icon: <Shield className="h-5 w-5" />
  }];
  const capabilities = [{
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Predictive Analytics",
    description: "AI-powered forecasting that drives strategic decisions"
  }, {
    icon: <Shield className="h-6 w-6" />,
    title: "Enterprise Security",
    description: "Military-grade encryption and compliance standards"
  }, {
    icon: <Globe className="h-6 w-6" />,
    title: "Global Scale",
    description: "Distributed architecture handling millions of operations"
  }, {
    icon: <Users className="h-6 w-6" />,
    title: "Team Collaboration",
    description: "Seamless integration with existing enterprise workflows"
  }];
  return <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Arcade Intelligence" />

      <main className="container mx-auto px-8 py-24 max-w-[2000px]">
        {/* Hero Section */}
        <section className="text-center py-24">
          <div className="space-y-16">
            <div className="space-y-12">
              <div className="caption-text text-base tracking-widest uppercase font-mono rounded-lg" style={{
                color: 'hsl(24 100% 54%)',
                textShadow: '0 0 1px hsl(0 0% 100%), 0 0 2px hsl(0 0% 100%)',
                WebkitTextStroke: '0.5px hsl(0 0% 100%)'
              }}>
                The future of arcade tech—built by all of us.
              </div>
              <h1 className="font-tech font-black text-8xl md:text-9xl text-white glitch-text" data-text="LEVEL UP" style={{
              letterSpacing: '0.02em',
              textShadow: `
                    /* Enhanced glow layers */
                    0 0 15px hsl(183 100% 50% / 1),
                    0 0 30px hsl(183 100% 50% / 0.9),
                    0 0 50px hsl(183 100% 50% / 0.8),
                    0 0 70px hsl(183 100% 50% / 0.7),
                    0 0 100px hsl(183 100% 50% / 0.6),
                    0 0 130px hsl(183 100% 50% / 0.5),
                    /* Dramatic 3D bevel effect - light top-left */
                    -3px -3px 0 rgba(255, 255, 255, 0.3),
                    -6px -6px 0 rgba(255, 255, 255, 0.2),
                    -9px -9px 0 rgba(255, 255, 255, 0.15),
                    -12px -12px 0 rgba(255, 255, 255, 0.1),
                    -15px -15px 0 rgba(255, 255, 255, 0.05),
                    /* Dramatic 3D depth - dark bottom-right */
                    3px 3px 0 rgba(0, 0, 0, 0.5),
                    6px 6px 0 rgba(0, 0, 0, 0.55),
                    9px 9px 0 rgba(0, 0, 0, 0.6),
                    12px 12px 0 rgba(0, 0, 0, 0.65),
                    15px 15px 0 rgba(0, 0, 0, 0.7),
                    18px 18px 0 rgba(0, 0, 0, 0.75),
                    21px 21px 0 rgba(0, 0, 0, 0.8),
                    /* Deep shadow */
                    24px 24px 40px rgba(0, 0, 0, 0.9),
                    30px 30px 60px rgba(0, 0, 0, 0.7)
                   `,
              WebkitTextStroke: '2px hsl(183 100% 50% / 0.4)'
            }}>
                LEVEL UP
              </h1>
            </div>
            <p className="body-text text-lg md:text-xl text-muted-foreground max-w-5xl mx-auto font-body" style={{ lineHeight: '1.6' }}>
              Revolutionary AI platform specifically designed for arcade technicians and operators.
            </p>
          </div>
          
          {/* Certification/Achievement Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
            <div className="stat-card p-10 rounded-2xl hover-glow hover-lift group" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
              <div className="flex flex-col items-center gap-6">
                <div className="p-4 rounded-full bg-primary/10 group-hover:bg-orange/10 transition-colors">
                  <CheckCircle className="h-10 w-10 text-primary group-hover:text-orange transition-colors" />
                </div>
                <div className="text-center space-y-3">
                  <div className="font-bold text-2xl text-foreground">Built For Real Arcades</div>
                  <div className="text-base text-primary leading-relaxed">Built by the kind of guy who used to call tech support—and hated it.</div>
                </div>
              </div>
            </div>
            <div className="stat-card p-10 rounded-2xl hover-glow hover-lift" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
              <div className="flex flex-col items-center gap-6">
                <div className="p-4 rounded-full bg-primary/10">
                  <TrendingUp className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center space-y-3">
                  <div className="font-bold text-2xl text-foreground">The More Arcades Connect, The Smarter Everyone Gets</div>
                  <div className="text-base text-primary leading-relaxed">One connected intelligence, powered by every arcade that joins</div>
                </div>
              </div>
            </div>
            <div className="stat-card p-10 rounded-2xl hover-glow hover-lift group" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
              <div className="flex flex-col items-center gap-6">
                <div className="p-4 rounded-full bg-primary/10 group-hover:bg-orange/10 transition-colors">
                  <Zap className="h-10 w-10 text-primary group-hover:text-orange transition-colors" />
                </div>
                <div className="text-center space-y-3">
                  <div className="font-bold text-2xl text-foreground">Real-time Processing</div>
                  <div className="text-base text-primary leading-relaxed">Instant Troubleshooting - Get answers 24/7, even when support's closed or senior techs are off-shift.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center mt-20">
            <Button 
              onClick={handleStartGeneralChat} 
              variant="orange"
              size="xl" 
              className="hover-lift px-32 py-12 text-3xl font-bold relative group overflow-hidden"
              style={{
                boxShadow: '0 0 30px hsl(24 100% 54% / 0.6), 0 0 60px hsl(24 100% 54% / 0.4), 0 0 90px hsl(24 100% 54% / 0.2)'
              }}
            >
              <span className="relative z-10 flex items-center gap-3">
                Launch Arcade Intelligence
                <ArrowRight className="h-8 w-8 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange/20 via-transparent to-orange/20 animate-pulse opacity-50"></div>
            </Button>
          </div>
        </section>

        {/* Testimonials & ROI Section */}
        <section className="py-24">
          <div className="premium-card p-12 rounded-3xl relative">
            {/* Connecting lines */}
            <div className="absolute top-1/2 left-[33%] w-[10%] h-0.5 bg-gradient-to-r from-orange/50 to-orange/30 hidden lg:block"></div>
            <div className="absolute top-1/2 right-[33%] w-[10%] h-0.5 bg-gradient-to-l from-orange/50 to-orange/30 hidden lg:block"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center relative">
              {/* Left Side - Revenue Stats */}
              <div className="stat-card p-10 rounded-2xl hover-lift group" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
                <div className="space-y-6">
                  <div className="p-4 rounded-full bg-orange/10 inline-flex group-hover:bg-orange/20 transition-colors">
                    <TrendingUp className="h-8 w-8 text-orange" />
                  </div>
                  <h3 className="text-3xl font-tech font-bold text-foreground">$350 / week</h3>
                  <p className="text-lg text-primary font-body leading-relaxed">
                    Average revenue per arcade game
                  </p>
                  <div className="pt-4 border-t border-primary/20 space-y-4">
                    <p className="text-lg text-primary leading-relaxed">
                      When just 3–4 games are down, that's ≈ <span className="text-destructive font-semibold">$1,200 lost</span> in a single week.
                    </p>
                    <p className="text-lg text-primary leading-relaxed">
                      Every hour a game sits idle, money bleeds away.
                    </p>
                  </div>
                </div>
              </div>

              {/* Center - Key Message */}
              <div className="tech-card p-10 rounded-2xl relative z-10 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <p className="text-2xl font-tech font-bold text-orange leading-relaxed">
                    With Level Up: issues are fixed in hours, not months.
                  </p>
                  <p className="text-xl text-muted-foreground font-body leading-relaxed">
                    Less downtime. More revenue. Happier guests.
                  </p>
                </div>
              </div>

              {/* Right Side - Cost of Downtime */}
              <div className="stat-card p-10 rounded-2xl hover-lift group" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
                <div className="space-y-6">
                  <div className="p-4 rounded-full bg-orange/10 inline-flex group-hover:bg-orange/20 transition-colors">
                    <Clock className="h-8 w-8 text-orange" />
                  </div>
                  <h3 className="text-3xl font-tech font-bold text-foreground">3-6 months</h3>
                  <p className="text-lg text-primary font-body leading-relaxed">
                    Average downtime for complex repairs
                  </p>
                  <div className="pt-4 border-t border-primary/20 space-y-4">
                    <p className="text-lg text-primary leading-relaxed">
                      When a machine's down and it's not an easy fix, it can stay offline for months.
                    </p>
                    <p className="text-lg text-primary leading-relaxed">
                      That's <span className="text-destructive font-semibold">$8,400 lost</span> per game.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Performance Stats Section */}
        <section className="py-24">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-tech font-bold text-foreground mb-4" style={{ letterSpacing: '0.02em' }}>Platform <span className="text-orange">Performance</span></h2>
            <p className="text-xl text-muted-foreground font-body">Industry-leading metrics that power your arcade operations</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => <div key={index} className="stat-card p-8 rounded-2xl hover-lift hover-glow text-center" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
                <div className="flex flex-col items-center space-y-6">
                  <div className="p-4 rounded-full bg-primary/10">
                    <div className="text-primary">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-4xl md:text-5xl font-bold text-foreground">{stat.value}</div>
                    <div className="space-y-2">
                      <div className="font-semibold text-lg text-foreground">{stat.label}</div>
                      <div className="text-sm text-primary">{stat.description}</div>
                    </div>
                  </div>
                </div>
              </div>)}
          </div>
        </section>


        {/* Capabilities Grid */}
        <section className="py-24">
          <div className="text-center mb-20">
            <div className="caption-text text-orange/80 mb-6 text-sm tracking-widest uppercase font-mono">
              Advanced Capabilities
            </div>
            <h2 className="text-5xl md:text-7xl font-tech font-black text-foreground mb-8 tracking-wider">
              Professional <span className="text-orange">Features</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed font-body">
              Enterprise-grade capabilities designed to meet the demanding requirements 
              of professional arcade operations and technical support teams.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {capabilities.map((capability, index) => <div key={index} className="premium-card hover-lift p-10 rounded-3xl group" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
                <div className="space-y-8">
                  <div className="p-5 rounded-2xl bg-primary/10 inline-flex group-hover:bg-orange/10 transition-colors">
                    <div className="text-primary group-hover:text-orange transition-colors">
                      {capability.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-tech font-bold text-foreground tracking-wide">{capability.title}</h3>
                  <p className="text-primary leading-relaxed text-base font-body">
                    {capability.description}
                  </p>
                </div>
              </div>)}
          </div>
        </section>

        {/* Admin Quick Access */}
        {isAdmin && <section className="py-12">
            <Card className="premium-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Admin Panel
                </CardTitle>
                <CardDescription>Quick access to administrative functions</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/tenant-management">
                  <Button className="w-full" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Tenant Access to Manuals
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </section>}

        {/* Pricing Teaser */}
        <section className="py-20 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0"
                 style={{
                   background: "radial-gradient(1000px 500px at 50% 50%, rgba(0,245,255,0.12), rgba(0,0,0,0) 70%)",
                 }}
            />
          </div>
          
          <div className="text-center mb-12">
            <div className="caption-text text-orange/80 mb-4 text-sm tracking-widest uppercase font-mono">
              Simple, Transparent Pricing
            </div>
            <h2 className="text-4xl md:text-6xl font-tech font-black text-foreground mb-6 tracking-wider">
              Choose Your <span className="text-orange">Level Up</span> Plan
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed font-body">
              Built for busy FEC technicians who want less paperwork and faster fixes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
            <div className="premium-card hover-lift p-8 rounded-3xl border-2 transition-all group" style={{ borderColor: 'hsl(183 100% 50% / 0.3)' }}>
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-bold text-foreground">Starter</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-extrabold text-foreground">$299</span>
                  <span className="text-xl text-primary">/ month</span>
                </div>
                <p className="text-sm text-primary italic" style={{ fontVariantNumeric: 'tabular-nums' }}>(or $2,700/yr — 3 months free)</p>
                <ul className="text-left space-y-3 pt-6">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Up to <strong className="text-foreground">40 games</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Unlimited tech accounts</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Instant AI troubleshooting</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Email support (24hr)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="premium-card hover-lift p-8 rounded-3xl border-2 transition-all relative" style={{ borderColor: 'hsl(183 100% 50% / 0.5)' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold"
                   style={{
                     background: "linear-gradient(90deg, rgba(255,102,0,0.2), rgba(255,102,0,0.05))",
                     border: "1px solid rgba(255,102,0,0.45)",
                     color: "white",
                   }}>
                Recommended
              </div>
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-bold text-foreground">Pro</h3>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-extrabold text-foreground">$499</span>
                  <span className="text-xl text-primary">/ month</span>
                </div>
                <p className="text-sm text-primary italic" style={{ fontVariantNumeric: 'tabular-nums' }}>(or $4,500/yr — 3 months free)</p>
                <ul className="text-left space-y-3 pt-6">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Everything in Starter</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Up to <strong className="text-foreground">100 games</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Priority support</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-primary">Early access to new modules</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link to="/pricing">
              <Button 
                variant="orange"
                size="lg" 
                className="hover-lift px-12 py-6 text-lg font-bold"
              >
                View Full Pricing Details
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              30-day risk-free • No setup fees • Cancel anytime
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center py-24">
          <div className="mb-16">
            <div className="caption-text text-orange/80 mb-6 text-sm tracking-widest uppercase font-mono">
              Get Started Today
            </div>
            <h2 className="text-5xl md:text-7xl font-tech font-black text-foreground mb-8 tracking-wider">
              Ready to Transform Your <span className="text-orange">Arcade Operations</span>?
            </h2>
            <p className="text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed font-body">
              Join arcade professionals who've already revolutionized their technical support 
              and troubleshooting processes with our AI-powered platform.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <Button 
              onClick={handleStartGeneralChat} 
              variant="orange"
              size="xl" 
              className="hover-lift px-20 py-10 text-2xl font-bold relative group overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-3">
                Launch Arcade Intelligence
                <ArrowRight className="h-7 w-7 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange/20 via-transparent to-orange/20 animate-pulse opacity-50"></div>
            </Button>
          </div>
        </section>


        <div className="mt-20">
          <ProcessingMonitor />
        </div>
      </main>
      <Footer />
    </div>;
};
export default Index;
