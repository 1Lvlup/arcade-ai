import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Clock
} from 'lucide-react';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
import { TestEnhancement } from "@/components/TestEnhancement";
import { Link } from 'react-router-dom';

const Index = () => {
  const { user } = useAuth();
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
    return (
      <div className="min-h-screen professional-bg">
        <SharedHeader 
          title={selectedManualId ? `AI Assistant: ${selectedManualTitle}` : 'AI Assistant'} 
          showBackButton={true} 
          backTo="/" 
        />
        <main className="container mx-auto px-4 py-8">
          <ChatBot selectedManualId={selectedManualId} manualTitle={selectedManualTitle} />
        </main>
      </div>
    );
  }

  const coreFeatures = [
    {
      icon: <Brain className="h-8 w-8" />,
      title: "Advanced AI Assistant",
      description: "Breakthrough conversational AI delivering enterprise-grade intelligence and precision",
      status: "Production Ready",
      metrics: "99.9% Uptime",
      onClick: handleStartGeneralChat
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: "Intelligent Document Processing", 
      description: "Transform complex documents into actionable insights with our proprietary AI engine",
      status: "Market Leading",
      metrics: "10x Faster",
      link: "/manuals"
    },
    {
      icon: <Eye className="h-8 w-8" />,
      title: "Strategic Analytics Dashboard",
      description: "Real-time business intelligence powered by predictive AI algorithms",
      status: "Industry First",
      metrics: "94% Accuracy",
      link: "/vision-board"
    }
  ];

  const stats = [
    {
      value: "2.3ms",
      label: "Response Time",
      description: "Industry-leading processing speed",
      icon: <Clock className="h-5 w-5" />
    },
    {
      value: "99.9%",
      label: "Accuracy Rate", 
      description: "Benchmark-setting precision",
      icon: <Target className="h-5 w-5" />
    },
    {
      value: "1.2B+",
      label: "Parameters",
      description: "Advanced neural architecture",
      icon: <Database className="h-5 w-5" />
    },
    {
      value: "24/7",
      label: "Availability",
      description: "Enterprise-grade reliability",
      icon: <Shield className="h-5 w-5" />
    }
  ];

  const capabilities = [
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Predictive Analytics",
      description: "AI-powered forecasting that drives strategic decisions"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Enterprise Security",
      description: "Military-grade encryption and compliance standards"
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: "Global Scale",
      description: "Distributed architecture handling millions of operations"
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Team Collaboration",
      description: "Seamless integration with existing enterprise workflows"
    }
  ];

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="IntelliCore" />

      <main className="container mx-auto px-8 py-24">
        {/* Hero Section */}
        <section className="text-center section-spacing">
          <div className="space-y-12">
            <div className="space-y-8">
              <div className="caption-text text-primary/80 mb-6">
                Next-Generation AI Platform
              </div>
              <h1 className="display-heading text-8xl md:text-9xl lg:text-[12rem] text-foreground leading-none">
                Future of<br />
                <span className="text-primary brand-glow">Intelligence</span>
              </h1>
            </div>
            <p className="body-text text-xl md:text-2xl text-muted-foreground max-w-5xl mx-auto mt-16">
              Revolutionary AI platform that transforms how enterprises operate. Experience 
              unparalleled performance, precision, and scalability that Fortune 500 companies depend on.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-8 mt-20">
            <div className="glass-card px-8 py-4 hover-glow">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="caption-text text-foreground">ISO 27001 Certified</span>
              </div>
            </div>
            <div className="glass-card px-8 py-4 hover-glow">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="caption-text text-foreground">400% ROI Average</span>
              </div>
            </div>
            <div className="glass-card px-8 py-4 hover-glow">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <span className="caption-text text-foreground">Real-time Processing</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-16">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient hover-lift px-12 py-6 text-lg">
              Experience IntelliCore
              <ArrowRight className="h-5 w-5 ml-3" />
            </Button>
            <Link to="/manuals">
              <Button variant="outline" size="xl" className="hover-glow px-12 py-6 text-lg">
                View Documentation
              </Button>
            </Link>
          </div>
        </section>

        {/* Stats Section */}
        <section className="section-spacing">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {stats.map((stat, index) => (
              <div key={index} className="text-center space-y-8">
                <div className="premium-card p-6 rounded-2xl hover-lift mx-auto w-fit">
                  <div className="text-primary">
                    {stat.icon}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="premium-text text-5xl text-foreground">{stat.value}</div>
                  <div className="space-y-2">
                    <div className="font-semibold text-lg text-foreground">{stat.label}</div>
                    <div className="caption-text text-muted-foreground">{stat.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Core Features */}
        <section className="section-spacing">
          <div className="text-center content-spacing">
            <div className="caption-text text-primary/80 mb-8">
              Enterprise Solutions
            </div>
            <h2 className="premium-text text-6xl md:text-7xl text-foreground mb-8">
              Revolutionary AI
            </h2>
            <p className="body-text text-xl text-muted-foreground max-w-4xl mx-auto">
              Transform your enterprise with AI capabilities that redefine what's possible 
              in automation, intelligence, and strategic decision-making.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {coreFeatures.map((feature, index) => (
              <div key={index} className="premium-card hover-lift p-12 rounded-3xl">
                <div className="space-y-8">
                  <div className="flex items-start justify-between">
                    <div className="glass-card p-6 rounded-2xl">
                      <div className="text-primary">
                        {feature.icon}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="glass-card px-4 py-2 rounded-full">
                        <span className="caption-text text-primary">{feature.status}</span>
                      </div>
                      <div className="caption-text text-muted-foreground mt-2">{feature.metrics}</div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h3 className="premium-text text-2xl text-foreground">{feature.title}</h3>
                    <p className="body-text text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <div className="pt-4">
                    {feature.onClick ? (
                      <Button onClick={feature.onClick} className="w-full primary-gradient hover-lift py-6">
                        Launch Assistant
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : (
                      <Link to={feature.link!}>
                        <Button variant="outline" className="w-full hover-glow py-6">
                          Access Platform
                          <ArrowRight className="h-4 w-4 ml-2" />
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
        <section className="section-spacing">
          <div className="text-center content-spacing">
            <div className="caption-text text-primary/80 mb-8">
              Advanced Capabilities
            </div>
            <h2 className="premium-text text-6xl md:text-7xl text-foreground mb-8">
              Industry Standards
            </h2>
            <p className="body-text text-xl text-muted-foreground max-w-4xl mx-auto">
              Cutting-edge features that establish new benchmarks for 
              enterprise AI performance and reliability.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {capabilities.map((capability, index) => (
              <div key={index} className="premium-card hover-lift p-10 rounded-3xl">
                <div className="space-y-6">
                  <div className="glass-card p-5 rounded-2xl inline-flex">
                    <div className="text-primary">
                      {capability.icon}
                    </div>
                  </div>
                  <h3 className="premium-text text-2xl text-foreground">{capability.title}</h3>
                  <p className="body-text text-muted-foreground">
                    {capability.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center section-spacing">
          <div className="content-spacing">
            <div className="caption-text text-primary/80 mb-8">
              Transform Today
            </div>
            <h2 className="premium-text text-6xl md:text-7xl text-foreground mb-8">
              Ready for the Future?
            </h2>
            <p className="body-text text-xl text-muted-foreground max-w-4xl mx-auto">
              Join industry leaders who've already revolutionized their operations 
              with IntelliCore's next-generation AI platform.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient hover-lift px-12 py-6 text-lg">
              Start Free Trial
              <ArrowRight className="h-5 w-5 ml-3" />
            </Button>
            <Link to="/manuals">
              <Button variant="outline" size="xl" className="hover-glow px-12 py-6 text-lg">
                Schedule Demo
              </Button>
            </Link>
          </div>
        </section>

        <div className="mt-20 flex justify-center">
          <TestEnhancement />
        </div>

        <div className="mt-20">
          <ProcessingMonitor />
        </div>
      </main>
    </div>
  );
};

export default Index;