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
    <div className="min-h-screen professional-bg">
      <SharedHeader title="IntelliCore" />

      <main className="container mx-auto px-6 py-16">
        {/* Hero Section */}
        <section className="text-center space-y-12 mb-32">
          <div className="space-y-6">
            <h1 className="display-text text-7xl md:text-8xl lg:text-9xl text-foreground">
              World's Most<br />
              <span className="text-primary">Advanced AI</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto font-light leading-relaxed">
              Enterprise-grade artificial intelligence platform delivering unmatched performance, 
              precision, and scalability. Trusted by Fortune 500 companies worldwide.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Badge variant="secondary" className="px-6 py-3 text-base font-medium">
              <CheckCircle className="h-4 w-4 mr-2 text-primary" />
              ISO 27001 Certified
            </Badge>
            <Badge variant="secondary" className="px-6 py-3 text-base font-medium">
              <TrendingUp className="h-4 w-4 mr-2 text-primary" />
              400% ROI Average
            </Badge>
            <Badge variant="secondary" className="px-6 py-3 text-base font-medium">
              <Zap className="h-4 w-4 mr-2 text-primary" />
              Real-time Processing
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient">
              Experience IntelliCore
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Link to="/manuals">
              <Button variant="minimal" size="xl">
                View Documentation
              </Button>
            </Link>
          </div>
        </section>

        {/* Stats Section */}
        <section className="mb-32">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="text-primary p-4 rounded-xl bg-primary/10 inline-flex">
                  {stat.icon}
                </div>
                <div className="space-y-2">
                  <div className="premium-text text-4xl text-foreground">{stat.value}</div>
                  <div className="font-semibold text-foreground">{stat.label}</div>
                  <div className="text-sm text-muted-foreground">{stat.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Core Features */}
        <section className="mb-32">
          <div className="text-center space-y-6 mb-16">
            <h2 className="premium-text text-5xl text-foreground">
              Enterprise AI Solutions
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Revolutionary AI capabilities that redefine what's possible in enterprise automation
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {coreFeatures.map((feature, index) => (
              <Card key={index} className="minimal-card hover-elevate border-0 p-8">
                <CardHeader className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="text-primary p-4 rounded-xl bg-primary/10">
                      {feature.icon}
                    </div>
                    <div className="text-right">
                      <Badge className="bg-primary/10 text-primary border-primary/20 font-medium">
                        {feature.status}
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">{feature.metrics}</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <CardTitle className="text-2xl font-bold">{feature.title}</CardTitle>
                    <CardDescription className="text-muted-foreground text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {feature.onClick ? (
                    <Button onClick={feature.onClick} className="w-full primary-gradient">
                      Launch Assistant
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Link to={feature.link!}>
                      <Button variant="minimal" className="w-full">
                        Access Platform
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Capabilities Grid */}
        <section className="mb-32">
          <div className="text-center space-y-6 mb-16">
            <h2 className="premium-text text-5xl text-foreground">
              Advanced Capabilities
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Cutting-edge features that set new industry standards
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {capabilities.map((capability, index) => (
              <Card key={index} className="minimal-card hover-elevate border-0 p-8">
                <CardHeader className="space-y-4">
                  <div className="text-primary p-3 rounded-lg bg-primary/10 inline-flex w-fit">
                    {capability.icon}
                  </div>
                  <CardTitle className="text-xl font-bold">{capability.title}</CardTitle>
                  <CardDescription className="text-muted-foreground text-base">
                    {capability.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center space-y-8 mb-16">
          <h2 className="premium-text text-5xl text-foreground">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Join industry leaders who've already revolutionized their operations with IntelliCore AI
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Button onClick={handleStartGeneralChat} size="xl" className="primary-gradient">
              Start Free Trial
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Link to="/manuals">
              <Button variant="minimal" size="xl">
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