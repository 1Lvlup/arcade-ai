import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, Target, Shield, CheckCircle, ArrowRight, TrendingUp, Clock } from 'lucide-react';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import { Footer } from '@/components/Footer';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>();
  const [selectedManualTitle, setSelectedManualTitle] = useState<string>();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      setIsAdmin(data || false);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
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
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    setSelectedManualId(undefined);
    setSelectedManualTitle(undefined);
    setShowChat(true);

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

    const newUrl = new URL(window.location.href);
    newUrl.search = '';
    window.history.pushState({}, '', newUrl.toString());
  };

  if (showChat) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SharedHeader 
          title={selectedManualId ? `AI Assistant: ${selectedManualTitle}` : 'AI Assistant'} 
          showBackButton={true} 
          backTo="/" 
          onBackClick={handleBackToHome} 
        />
        <main className="container mx-auto px-4 py-8 flex-1">
          <ChatBot selectedManualId={selectedManualId} manualTitle={selectedManualTitle} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Arcade Intelligence" titleClassName="text-lg font-semibold" />

      <main className="relative">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-32 pb-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center space-y-8 max-w-4xl mx-auto">
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                AI-Powered Arcade Support
              </Badge>
              
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight">
                <span className="block text-foreground">Arcade downtime</span>
                <span className="block bg-gradient-to-r from-primary via-purple-light to-primary bg-clip-text text-transparent">
                  ends here
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                The first shared AI intelligence built exclusively for arcade operations. 
                Get instant troubleshooting answers backed by 1.2B+ parameters of game knowledge.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <Button 
                  onClick={handleStartGeneralChat}
                  size="lg"
                  className="text-lg px-8 py-6 shadow-glow hover:shadow-dramatic"
                >
                  Launch Arcade Intelligence
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Link to="/pricing">
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="text-lg px-8 py-6"
                  >
                    View Pricing
                  </Button>
                </Link>
              </div>
              
              <p className="text-sm text-muted-foreground">
                No credit card required • 2-minute setup • 40+ games supported
              </p>
            </div>
          </div>
          
          {/* Gradient blur effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        </section>

        {/* Stats Section */}
        <section className="py-20 px-6 border-y border-border">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-foreground">2.3ms</div>
                <div className="text-sm text-muted-foreground">Response time</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-foreground">99.9%</div>
                <div className="text-sm text-muted-foreground">Accuracy rate</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-foreground">1.2B+</div>
                <div className="text-sm text-muted-foreground">Parameters</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-4xl md:text-5xl font-bold text-foreground">24/7</div>
                <div className="text-sm text-muted-foreground">Availability</div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Built for modern arcade teams
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Every feature designed to minimize downtime and maximize uptime
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <Brain className="h-8 w-8" />,
                  title: "AI-Powered Answers",
                  description: "Get instant, accurate troubleshooting guidance powered by advanced language models trained on arcade manuals and field reports."
                },
                {
                  icon: <Zap className="h-8 w-8" />,
                  title: "Lightning Fast",
                  description: "2.3ms average response time. No more flipping through manuals or waiting on hold for support."
                },
                {
                  icon: <Target className="h-8 w-8" />,
                  title: "99.9% Accurate",
                  description: "Validated through thousands of live troubleshooting sessions. When we don't know, we tell you."
                },
                {
                  icon: <Shield className="h-8 w-8" />,
                  title: "Enterprise Security",
                  description: "Your data stays yours. Bank-level encryption and compliance with industry standards."
                },
                {
                  icon: <TrendingUp className="h-8 w-8" />,
                  title: "Continuous Learning",
                  description: "The system improves with every fix. Shared intelligence across all arcade operators."
                },
                {
                  icon: <Clock className="h-8 w-8" />,
                  title: "Always Available",
                  description: "24/7 uptime. Because arcade issues don't wait for business hours."
                }
              ].map((feature, index) => (
                <div 
                  key={index}
                  className="premium-card hover-lift p-8 rounded-2xl group"
                >
                  <div className="text-primary mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ROI Section */}
        <section className="py-32 px-6 bg-card/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Real results from real arcades
              </h2>
              <p className="text-xl text-muted-foreground">
                See the impact on your bottom line
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="stat-card p-8 rounded-2xl text-center space-y-4">
                <div className="text-5xl font-bold text-primary">$400-900</div>
                <div className="text-lg text-foreground font-medium">Weekly savings</div>
                <div className="text-sm text-muted-foreground">
                  Average per arcade using Level Up (Limited Testing)
                </div>
              </div>

              <div className="stat-card p-8 rounded-2xl text-center space-y-4">
                <div className="text-5xl font-bold text-primary">3-6mo</div>
                <div className="text-lg text-foreground font-medium">Payback period</div>
                <div className="text-sm text-muted-foreground">
                  Typical ROI based on reduced technician time and improved uptime
                </div>
              </div>

              <div className="stat-card p-8 rounded-2xl text-center space-y-4">
                <div className="text-5xl font-bold text-primary">40%</div>
                <div className="text-lg text-foreground font-medium">Time savings</div>
                <div className="text-sm text-muted-foreground">
                  Cut technician labor time. Focus on new revenue, not repeat fixes
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Teaser */}
        <section className="py-32 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-6xl font-bold mb-6">
                Simple, transparent pricing
              </h2>
              <p className="text-xl text-muted-foreground">
                Choose the plan that fits your arcade
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="premium-card hover-lift p-10 rounded-2xl">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Starter</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold">$149</span>
                      <span className="text-xl text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      or $1,345/yr (3 months free)
                    </p>
                  </div>

                  <ul className="space-y-4">
                    {[
                      "Up to 40 games",
                      "Unlimited tech accounts",
                      "Instant AI troubleshooting",
                      "24/7 availability",
                      "Email support"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth" className="block">
                    <Button className="w-full" size="lg">
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="premium-card hover-lift p-10 rounded-2xl border-primary/40">
                <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                  Most Popular
                </Badge>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold mb-2">Professional</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold">$349</span>
                      <span className="text-xl text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      or $3,145/yr (3 months free)
                    </p>
                  </div>

                  <ul className="space-y-4">
                    {[
                      "Unlimited games",
                      "Unlimited tech accounts",
                      "Priority AI troubleshooting",
                      "Advanced analytics",
                      "Priority support",
                      "Custom integrations"
                    ].map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/auth" className="block">
                    <Button className="w-full" size="lg">
                      Get Started
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="text-center mt-12">
              <Link to="/pricing">
                <Button variant="outline" size="lg">
                  View Full Pricing Details
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-4xl md:text-6xl font-bold">
              Ready to end downtime?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join arcade operators already using AI to keep their games running.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={handleStartGeneralChat}
                size="lg"
                className="text-lg px-8 py-6 shadow-glow hover:shadow-dramatic"
              >
                Launch Arcade Intelligence
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link to="/support">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
