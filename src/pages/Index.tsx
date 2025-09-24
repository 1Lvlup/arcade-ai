import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, MessageCircle, BookOpen, Eye, Zap, Target, Database, 
  Cpu, Network, ShieldCheck, Workflow, BarChart3, Sparkles,
  Layers, Bot, Lightbulb, Rocket, Settings
} from 'lucide-react';
import { ProcessingMonitor } from '@/components/ProcessingMonitor';
import { ChatBot } from '@/components/ChatBot';
import { SharedHeader } from '@/components/SharedHeader';
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
      <div className="min-h-screen ai-bg">
        <SharedHeader 
          title={selectedManualId ? `Chat: ${selectedManualTitle}` : 'Neural Assistant'}
          showBackButton={true}
          backTo="/"
        />
        <main className="container mx-auto px-4 py-8">
          <ChatBot 
            selectedManualId={selectedManualId}
            manualTitle={selectedManualTitle}
          />
        </main>
      </div>
    );
  }

  const coreFeatures = [
    {
      icon: <Brain className="h-8 w-8" />,
      title: "Neural AI Assistant",
      description: "Advanced conversational AI powered by cutting-edge language models",
      status: "Active",
      onClick: handleStartGeneralChat
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: "Intelligent Document Processing",
      description: "Upload, analyze, and extract insights from technical manuals instantly",
      status: "Active",
      link: "/manuals"
    },
    {
      icon: <Eye className="h-8 w-8" />,
      title: "Strategic Vision Board",
      description: "AI-driven analytics and strategic planning dashboard",
      status: "Active",
      link: "/vision-board"
    }
  ];

  const advancedFeatures = [
    {
      icon: <Workflow className="h-6 w-6" />,
      title: "Automated Workflows",
      description: "Self-optimizing processes that learn from every interaction",
      status: "Coming Soon"
    },
    {
      icon: <Database className="h-6 w-6" />,
      title: "Neural Knowledge Base",
      description: "Dynamic knowledge graphs that evolve with your data",
      status: "Beta"
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Predictive Analytics",
      description: "AI-powered forecasting and trend analysis",
      status: "Development"
    },
    {
      icon: <ShieldCheck className="h-6 w-6" />,
      title: "Quantum Security",
      description: "Next-generation encryption and data protection",
      status: "Planned"
    },
    {
      icon: <Network className="h-6 w-6" />,
      title: "Multi-Agent Systems",
      description: "Collaborative AI agents working in harmony",
      status: "Research"
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: "Autonomous Optimization",
      description: "Self-improving algorithms that enhance performance",
      status: "Planned"
    }
  ];

  return (
    <div className="min-h-screen ai-bg">
      <SharedHeader title="FEC Neural Portal" />

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center space-y-8 mb-20">
          <div className="relative">
            <div className="absolute inset-0 ai-glow opacity-30 rounded-full blur-3xl"></div>
            <h1 className="relative text-6xl font-bold neural-text bg-gradient-to-r from-primary via-primary to-primary bg-clip-text text-transparent">
              NEURAL
            </h1>
          </div>
          <h2 className="text-4xl font-bold text-foreground">
            Artificial Intelligence Platform
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Experience the future of intelligent automation. Our advanced AI system combines 
            machine learning, natural language processing, and predictive analytics to deliver 
            unparalleled performance and insights.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Cpu className="h-4 w-4 mr-2" />
              GPU Accelerated
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Zap className="h-4 w-4 mr-2" />
              Real-time Processing
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Target className="h-4 w-4 mr-2" />
              99.9% Accuracy
            </Badge>
          </div>
        </div>

        {/* Core Features */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-center mb-12 neural-text">Core Intelligence Modules</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {coreFeatures.map((feature, index) => (
              <Card key={index} className="glass-panel hover-lift border-primary/20 relative overflow-hidden group">
                <div className="absolute inset-0 neural-bg opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <CardHeader className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-primary ai-glow p-3 rounded-lg bg-primary/10">
                      {feature.icon}
                    </div>
                    <Badge className="bg-primary/20 text-primary border-primary/30">
                      {feature.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  {feature.onClick ? (
                    <Button onClick={feature.onClick} className="w-full neural-bg border-0">
                      <Bot className="h-4 w-4 mr-2" />
                      Activate Module
                    </Button>
                  ) : (
                    <Link to={feature.link!}>
                      <Button variant="outline" className="w-full border-primary/30 hover:bg-primary/10">
                        <Rocket className="h-4 w-4 mr-2" />
                        Access System
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Advanced Features Grid */}
        <div className="mb-20">
          <h3 className="text-3xl font-bold text-center mb-4 neural-text">Advanced Capabilities</h3>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Cutting-edge AI technologies that push the boundaries of what's possible
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {advancedFeatures.map((feature, index) => (
              <Card key={index} className="glass-panel border-primary/10 hover-lift group">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-primary p-2 rounded-lg bg-primary/10 group-hover:ai-glow transition-all">
                      {feature.icon}
                    </div>
                    <Badge 
                      variant={feature.status === 'Active' ? 'default' : 'outline'}
                      className={
                        feature.status === 'Active' 
                          ? "bg-primary text-primary-foreground" 
                          : feature.status === 'Beta'
                          ? "border-primary/50 text-primary"
                          : "border-muted-foreground/30 text-muted-foreground"
                      }
                    >
                      {feature.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="glass-panel rounded-2xl p-8 mb-20">
          <h3 className="text-2xl font-bold text-center mb-8 neural-text">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Processing Speed", value: "2.3ms", icon: <Zap className="h-5 w-5" /> },
              { label: "Accuracy Rate", value: "99.9%", icon: <Target className="h-5 w-5" /> },
              { label: "Neural Layers", value: "1.2B", icon: <Layers className="h-5 w-5" /> },
              { label: "Active Sessions", value: "24/7", icon: <Settings className="h-5 w-5" /> }
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-primary ai-glow p-3 rounded-lg bg-primary/10 inline-flex mb-3">
                  {stat.icon}
                </div>
                <div className="text-3xl font-bold neural-text">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-6">
          <h3 className="text-3xl font-bold neural-text">Ready to Experience the Future?</h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Join the next generation of intelligent automation and unlock your potential
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Button onClick={handleStartGeneralChat} size="lg" className="neural-bg border-0 px-8">
              <Lightbulb className="h-5 w-5 mr-2" />
              Start Neural Session
            </Button>
            <Link to="/manuals">
              <Button variant="outline" size="lg" className="border-primary/30 hover:bg-primary/10 px-8">
                <Database className="h-5 w-5 mr-2" />
                Explore Knowledge Base
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20">
          <ProcessingMonitor />
        </div>
      </main>
    </div>
  );
};

export default Index;