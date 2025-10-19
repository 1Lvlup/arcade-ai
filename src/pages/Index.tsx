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
  const coreFeatures = [{
    icon: <Brain className="h-8 w-8" />,
    title: "Advanced AI Assistant",
    description: "Breakthrough conversational AI delivering enterprise-grade intelligence and precision",
    status: "Production Ready",
    metrics: "99.9% Uptime",
    onClick: handleStartGeneralChat
  }, {
    icon: <Code className="h-8 w-8" />,
    title: "AI Code Assistant",
    description: "Generate code, debug issues, and get coding help with AI-powered development tools",
    status: "Developer Tool",
    metrics: "Real-time Help",
    link: "/code-assistant"
  }, {
    icon: <BookOpen className="h-8 w-8" />,
    title: "Intelligent Document Processing",
    description: "Transform complex documents into actionable insights with our proprietary AI engine",
    status: "Market Leading",
    metrics: "10x Faster",
    link: "/manuals"
  }, {
    icon: <Eye className="h-8 w-8" />,
    title: "Strategic Analytics Dashboard",
    description: "Real-time business intelligence powered by predictive AI algorithms",
    status: "Industry First",
    metrics: "94% Accuracy",
    link: "/vision-board"
  }];
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
              <div className="caption-text text-primary/80 text-base tracking-widest uppercase font-mono rounded-lg">
                Next-Generation AI Platform
              </div>
              <h1 className="font-tech font-black text-8xl md:text-9xl text-white tracking-widest glitch-text" data-text="LEVEL UP" style={{
              textShadow: `
                    /* Enhanced glow layers */
                    0 0 15px hsl(185 85% 55% / 1),
                    0 0 30px hsl(185 85% 55% / 0.9),
                    0 0 50px hsl(185 85% 55% / 0.8),
                    0 0 70px hsl(185 85% 55% / 0.7),
                    0 0 100px hsl(185 85% 55% / 0.6),
                    0 0 130px hsl(185 85% 55% / 0.5),
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
              WebkitTextStroke: '2px hsl(185 85% 55% / 0.4)'
            }}>
                LEVEL UP
              </h1>
            </div>
            <p className="body-text text-lg md:text-xl text-muted-foreground max-w-5xl mx-auto leading-relaxed font-body">
              Revolutionary AI platform specifically designed for arcade technicians and operators. 
              Transform complex technical manuals into instant, intelligent assistance.
            </p>
          </div>
          
          {/* Certification/Achievement Badges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-4xl mx-auto">
            <div className="stat-card p-8 rounded-2xl hover-glow hover-lift">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-primary">ISO 27001 Certified</div>
                  <div className="text-sm text-muted-foreground mt-1">Enterprise Security Standard</div>
                </div>
              </div>
            </div>
            <div className="stat-card p-8 rounded-2xl hover-glow hover-lift">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-primary">400% ROI Average</div>
                  <div className="text-sm text-muted-foreground mt-1">Proven Return on Investment</div>
                </div>
              </div>
            </div>
            <div className="stat-card p-8 rounded-2xl hover-glow hover-lift">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 rounded-full bg-primary/10">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-primary">Real-time Processing</div>
                  <div className="text-sm text-muted-foreground mt-1">Instant Troubleshooting - Get answers 24/7, even when support's closed or senior techs are off-shift.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center mt-20">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient hover-lift px-16 py-8 text-xl font-semibold">
              Launch Arcade Intelligence
              <ArrowRight className="h-6 w-6 ml-3" />
            </Button>
          </div>
        </section>

        {/* Testimonials & ROI Section */}
        <section className="py-24">
          <div className="premium-card p-12 rounded-3xl relative">
            {/* Connecting lines */}
            <div className="absolute top-1/2 left-[33%] w-[10%] h-0.5 bg-gradient-to-r from-primary/50 to-primary/30 hidden lg:block"></div>
            <div className="absolute top-1/2 right-[33%] w-[10%] h-0.5 bg-gradient-to-l from-primary/50 to-primary/30 hidden lg:block"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center relative">
              {/* Left Side - Revenue Stats */}
              <div className="stat-card p-10 rounded-2xl hover-lift">
                <div className="space-y-6">
                  <div className="p-4 rounded-full bg-primary/10 inline-flex">
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-3xl font-tech font-bold text-primary">$350 / week</h3>
                  <p className="text-lg text-muted-foreground font-body">
                    Average revenue per arcade game
                  </p>
                  <div className="pt-4 border-t border-primary/20 space-y-3">
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      When just 3–4 games are down, that's ≈ <span className="text-destructive font-semibold">$1,200 lost</span> in a single week.
                    </p>
                    <p className="text-lg text-muted-foreground">
                      Every hour a game sits idle, money bleeds away.
                    </p>
                  </div>
                </div>
              </div>

              {/* Center - Scrolling Testimonials */}
              <div className="tech-card p-8 rounded-2xl overflow-hidden relative z-10">
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-lg">Mike Rodriguez</div>
                      <div className="text-base text-muted-foreground">Arcade Operations Manager</div>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed italic text-lg">
                    "Before Level Up, our average game downtime was 8-12 days. Now we fix issues in under 2 hours. That is literally saving us thousands per incident."
                  </p>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => <div key={i} className="text-primary text-xl">★</div>)}
                  </div>
                </div>
              </div>

              {/* Right Side - Cost of Downtime */}
              <div className="stat-card p-10 rounded-2xl hover-lift">
                <div className="space-y-6">
                  <div className="p-4 rounded-full bg-destructive/10 inline-flex">
                    <Clock className="h-8 w-8 text-destructive" />
                  </div>
                  <div className="space-y-4">
                    <p className="text-lg text-muted-foreground font-body leading-relaxed">
                      Let's be real — when a machine's down and it's not an easy fix, it can stay offline for 3–6 months.
                    </p>
                    <p className="text-lg text-muted-foreground font-body">
                      That's <span className="text-destructive font-semibold text-2xl">$8,400 lost</span> per game.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-primary/20 space-y-2">
                    <p className="text-lg text-primary font-semibold">
                      With Level Up: issues are fixed in hours, not months.
                    </p>
                    <p className="text-lg text-muted-foreground">
                      Less downtime. More revenue. Happier guests.
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
            <h2 className="text-5xl md:text-6xl font-tech font-bold text-foreground mb-4 tracking-wider">Platform Performance</h2>
            <p className="text-xl text-muted-foreground font-body">Industry-leading metrics that power your arcade operations</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => <div key={index} className="stat-card p-8 rounded-2xl hover-lift hover-glow text-center">
                <div className="flex flex-col items-center space-y-6">
                  <div className="p-4 rounded-full bg-primary/10">
                    <div className="text-primary">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-4xl md:text-5xl font-bold text-primary">{stat.value}</div>
                    <div className="space-y-2">
                      <div className="font-semibold text-lg text-foreground">{stat.label}</div>
                      <div className="text-sm text-muted-foreground">{stat.description}</div>
                    </div>
                  </div>
                </div>
              </div>)}
          </div>
        </section>

        {/* Core Features */}
        <section className="py-24">
          <div className="text-center mb-20">
            <div className="caption-text text-primary/80 mb-6 text-sm tracking-widest uppercase font-mono">
              Core Features
            </div>
            <h2 className="text-5xl md:text-7xl font-tech font-black text-foreground mb-8 tracking-wider">
              Arcade AI Solutions
            </h2>
            <p className="text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed font-body">
              Purpose-built AI tools designed specifically for arcade technicians, operators, 
              and enthusiasts to solve complex technical challenges instantly.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {coreFeatures.map((feature, index) => <div key={index} className="tech-card hover:border-primary/40 p-10 rounded-3xl transition-all duration-300 hover-lift">
                <div className="space-y-8">
                  <div className="flex items-start justify-between">
                    <div className="p-5 rounded-2xl bg-primary/10">
                      <div className="text-primary">
                        {feature.icon}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="px-4 py-2 rounded-full bg-primary/10">
                        <span className="font-mono text-xs text-primary uppercase tracking-wider font-semibold">{feature.status}</span>
                      </div>
                      <div className="font-mono text-xs text-primary mt-2 font-medium">{feature.metrics}</div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-2xl font-tech font-bold text-primary tracking-wide">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-base font-body">
                      {feature.description}
                    </p>
                  </div>
                  <div className="pt-6">
                    {feature.onClick ? <Button onClick={feature.onClick} className="w-full btn-tech py-4 text-lg font-semibold">
                        Launch Assistant
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button> : <Link to={feature.link!}>
                        <Button variant="outline" className="w-full btn-tech-outline py-4 text-lg font-semibold">
                          Access Platform
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      </Link>}
                  </div>
                </div>
              </div>)}
          </div>
        </section>

        {/* Capabilities Grid */}
        <section className="py-24">
          <div className="text-center mb-20">
            <div className="caption-text text-primary/80 mb-6 text-sm tracking-widest uppercase font-mono">
              Advanced Capabilities
            </div>
            <h2 className="text-5xl md:text-7xl font-tech font-black text-foreground mb-8 tracking-wider">
              Professional Features
            </h2>
            <p className="text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed font-body">
              Enterprise-grade capabilities designed to meet the demanding requirements 
              of professional arcade operations and technical support teams.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {capabilities.map((capability, index) => <div key={index} className="premium-card hover-lift p-10 rounded-3xl">
                <div className="space-y-8">
                  <div className="p-5 rounded-2xl bg-primary/10 inline-flex">
                    <div className="text-primary">
                      {capability.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-tech font-bold text-foreground tracking-wide">{capability.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-base font-body">
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

        {/* CTA Section */}
        <section className="text-center py-24">
          <div className="mb-16">
            <div className="caption-text text-primary/80 mb-6 text-sm tracking-widest uppercase font-mono">
              Get Started Today
            </div>
            <h2 className="text-5xl md:text-7xl font-tech font-black text-foreground mb-8 tracking-wider">
              Ready to Transform Your Arcade Operations?
            </h2>
            <p className="text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed font-body">
              Join arcade professionals who've already revolutionized their technical support 
              and troubleshooting processes with our AI-powered platform.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient hover-lift px-16 py-8 text-xl font-semibold">
              Launch Arcade Intelligence
              <ArrowRight className="h-6 w-6 ml-3" />
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
