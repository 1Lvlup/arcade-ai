import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, MessageCircle, BookOpen, Eye, Zap, Target, Database, Shield, BarChart3, Users, Globe, CheckCircle, ArrowRight, TrendingUp, Clock } from 'lucide-react';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import checkmateLogoImage from '@/assets/checkmate-logo.png';

import { Link } from 'react-router-dom';
const Index = () => {
  const {
    user
  } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState<string>();
  const [selectedManualTitle, setSelectedManualTitle] = useState<string>();
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
    return <div className="min-h-screen professional-bg">
        <SharedHeader title={selectedManualId ? `AI Assistant: ${selectedManualTitle}` : 'AI Assistant'} showBackButton={true} backTo="/" />
        <main className="container mx-auto px-4 py-8">
          <ChatBot selectedManualId={selectedManualId} manualTitle={selectedManualTitle} />
        </main>
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
      <SharedHeader title="IntelliCore" />

      <main className="container mx-auto px-8 py-24">
        {/* Hero Section */}
        <section className="text-center py-24">
          <div className="space-y-16">
            <div className="space-y-12">
              <div className="caption-text text-primary/80 text-lg tracking-wider uppercase">
                Next-Generation AI Platform
              </div>
              <h1 className="display-heading leading-none relative">
                <img 
                  src={checkmateLogoImage} 
                  alt="" 
                  className="absolute inset-0 w-full h-full object-contain opacity-20 -z-10 scale-150"
                />
                <span className="relative z-10 font-normal text-8xl md:text-9xl lg:text-[10rem] text-primary bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  CHECKMATE
                </span>
                <span className="absolute inset-0 text-primary text-8xl md:text-9xl lg:text-[10rem] opacity-10 blur-xl scale-110 -z-10">
                  CHECKMATE
                </span>
              </h1>
            </div>
            <p className="body-text text-xl md:text-2xl text-muted-foreground max-w-5xl mx-auto leading-relaxed">
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
                  <div className="text-sm text-muted-foreground mt-1">Instant Technical Support</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-20">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient hover-lift px-16 py-8 text-xl font-semibold">
              Launch AI Assistant
              <ArrowRight className="h-6 w-6 ml-3" />
            </Button>
            <Link to="/manuals">
              <Button variant="outline" size="xl" className="hover-glow px-16 py-8 text-xl font-semibold border-2 border-primary">
                Browse Manuals
              </Button>
            </Link>
          </div>
        </section>

        {/* Performance Stats Section */}
        <section className="py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Platform Performance</h2>
            <p className="text-xl text-muted-foreground">Industry-leading metrics that power your arcade operations</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="stat-card p-8 rounded-2xl hover-lift hover-glow text-center">
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
              </div>
            ))}
          </div>
        </section>

        {/* Core Features */}
        <section className="py-24">
          <div className="text-center mb-20">
            <div className="caption-text text-primary/80 mb-6 text-lg tracking-wider uppercase">
              Core Features
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-8">
              Arcade AI Solutions
            </h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
              Purpose-built AI tools designed specifically for arcade technicians, operators, 
              and enthusiasts to solve complex technical challenges instantly.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {coreFeatures.map((feature, index) => (
              <div key={index} className="tech-card hover:border-primary/40 p-10 rounded-3xl transition-all duration-300 hover-lift">
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
                    <h3 className="text-2xl font-bold text-primary">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-base">
                      {feature.description}
                    </p>
                  </div>
                  <div className="pt-6">
                    {feature.onClick ? (
                      <Button onClick={feature.onClick} className="w-full btn-tech py-4 text-lg font-semibold">
                        Launch Assistant
                        <ArrowRight className="h-5 w-5 ml-2" />
                      </Button>
                    ) : (
                      <Link to={feature.link!}>
                        <Button variant="outline" className="w-full btn-tech-outline py-4 text-lg font-semibold">
                          Access Platform
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities Grid */}
        <section className="py-24">
          <div className="text-center mb-20">
            <div className="caption-text text-primary/80 mb-6 text-lg tracking-wider uppercase">
              Advanced Capabilities
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-8">
              Professional Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
              Enterprise-grade capabilities designed to meet the demanding requirements 
              of professional arcade operations and technical support teams.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {capabilities.map((capability, index) => (
              <div key={index} className="premium-card hover-lift p-10 rounded-3xl">
                <div className="space-y-8">
                  <div className="p-5 rounded-2xl bg-primary/10 inline-flex">
                    <div className="text-primary">
                      {capability.icon}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{capability.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-base">
                    {capability.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center py-24">
          <div className="mb-16">
            <div className="caption-text text-primary/80 mb-6 text-lg tracking-wider uppercase">
              Get Started Today
            </div>
            <h2 className="text-5xl md:text-6xl font-bold text-foreground mb-8">
              Ready to Transform Your Arcade Operations?
            </h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
              Join arcade professionals who've already revolutionized their technical support 
              and troubleshooting processes with our AI-powered platform.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient hover-lift px-16 py-8 text-xl font-semibold">
              Start Free Trial
              <ArrowRight className="h-6 w-6 ml-3" />
            </Button>
            <Link to="/manuals">
              <Button variant="outline" size="xl" className="hover-glow px-16 py-8 text-xl font-semibold border-2 border-primary">
                Explore Platform
              </Button>
            </Link>
          </div>
        </section>


        <div className="mt-20">
          <ProcessingMonitor />
        </div>
      </main>
    </div>;
};
export default Index;