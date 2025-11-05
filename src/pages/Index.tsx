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
import { AIFlowDiagram } from '@/components/AIFlowDiagram';
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
    // Redirect to auth if not logged in
    if (!user) {
      window.location.href = '/auth';
      return;
    }
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
    return <div className="min-h-screen mesh-gradient flex flex-col">
        <SharedHeader title={selectedManualId ? `AI Assistant: ${selectedManualTitle}` : 'AI Assistant'} showBackButton={true} backTo="/" onBackClick={handleBackToHome} />
        <main className="container mx-auto px-4 py-8 flex-1">
          <ChatBot selectedManualId={selectedManualId} manualTitle={selectedManualTitle} />
        </main>
        <Footer />
      </div>;
  }
  const stats = [{
    value: "2.3 ms",
    label: "response time",
    description: "Feels local, performs global.",
    icon: <Clock className="h-5 w-5" />
  }, {
    value: "99.9%",
    label: "accuracy rate",
    description: "Validated through live service logs.",
    icon: <Target className="h-5 w-5" />
  }, {
    value: "1.2 B+",
    label: "parameters",
    description: "Knowledge-engine trained on field manuals and real game issues.",
    icon: <Database className="h-5 w-5" />
  }, {
    value: "24/7",
    label: "availability",
    description: "Because arcades never sleep.",
    icon: <Shield className="h-5 w-5" />
  }];
  const capabilities = [{
    icon: <BarChart3 className="h-6 w-6" />,
    title: "Predictive Analytics",
    description: "Spot issues before they shut a game down."
  }, {
    icon: <Shield className="h-6 w-6" />,
    title: "Enterprise Security",
    description: "Your data stays yours. Secure by design."
  }, {
    icon: <Globe className="h-6 w-6" />,
    title: "Global Scale",
    description: "Works with every game, every location."
  }, {
    icon: <Users className="h-6 w-6" />,
    title: "Team Collaboration",
    description: "Connect your maintenance team in one shared workspace."
  }];
  return <div className="min-h-screen bg-black">
      <SharedHeader title="Arcade Intelligence" />

      <main className="max-w-[2000px] mx-auto">
        {/* Hero Section */}
        <section className="w-full">
          <div className="relative w-full overflow-hidden">
            <video autoPlay loop muted playsInline className="w-full h-auto">
              <source src="/AIGlitch.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            
            {/* Button overlaying video */}
            <div className="absolute bottom-0 left-0 right-0 pb-8 sm:pb-12">
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-center px-4 gap-3">
              {!user && <p className="text-sm sm:text-base text-primary/80 font-semibold">
                  Create your free account to get started →
                </p>}
              <Button onClick={handleStartGeneralChat} variant="orange" size="xl" className="cta-button hover-lift px-8 sm:px-14 md:px-22 lg:px-32 py-5 sm:py-7 md:py-8 lg:py-9 text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold relative group overflow-hidden w-full sm:w-auto border-2 border-orange" style={{
                  boxShadow: '0 0 20px hsl(24 100% 54% / 0.9), 0 0 40px hsl(24 100% 54% / 0.7), 0 0 60px hsl(24 100% 54% / 0.5)',
                  marginBottom: '1rem'
                }}>
                <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 flex-shrink-0" />
                  <span className="text-center">LAUNCH ARCADE INTELLIGENCE</span>
                  <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange/20 via-transparent to-orange/20 animate-pulse opacity-50"></div>
              </Button>
              <p className="text-xs sm:text-sm text-muted-foreground/80">No credit card • 2-minute setup</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 lg:gap-10 mt-12 sm:mt-16 lg:mt-24 max-w-5xl mx-auto">
            <div className="feature-card p-5 sm:p-6 lg:p-7 rounded-2xl hover-lift transition-all duration-300" style={{
            borderColor: 'hsl(0 0% 100% / 0.3)',
            boxShadow: '0 0 20px hsl(0 0% 100% / 0.9), 0 0 40px hsl(0 0% 100% / 0.7), 0 0 60px hsl(0 0% 100% / 0.5)'
          }} onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 20px hsl(24 100% 54% / 0.8), 0 0 40px hsl(24 100% 54% / 0.6), 0 0 60px hsl(24 100% 54% / 0.4)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 20px hsl(0 0% 100% / 0.9), 0 0 40px hsl(0 0% 100% / 0.7), 0 0 60px hsl(0 0% 100% / 0.5)';
          }}>
              <div className="flex flex-col items-center justify-center gap-4 h-full">
                <div className="p-3 sm:p-4 rounded-full bg-primary/10">
                  <TrendingUp className="h-10 w-10 text-primary" />
                </div>
                <div className="text-center space-y-2 sm:space-y-3">
                  <div className="font-tech font-extrabold text-xl sm:text-2xl lg:text-3xl text-orange px-2 text-recessed-orange">LEVEL UP</div>
                  <div className="font-body text-sm sm:text-base lg:text-lg text-white px-2">The first shared intelligence built for the arcade industry</div>
                </div>
              </div>
            </div>
            <div className="feature-card p-5 sm:p-6 lg:p-7 rounded-2xl hover-lift group transition-all duration-300" style={{
            borderColor: 'hsl(0 0% 100% / 0.3)',
            boxShadow: '0 0 20px hsl(0 0% 100% / 0.9), 0 0 40px hsl(0 0% 100% / 0.7), 0 0 60px hsl(0 0% 100% / 0.5)'
          }} onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 20px hsl(24 100% 54% / 0.8), 0 0 40px hsl(24 100% 54% / 0.6), 0 0 60px hsl(24 100% 54% / 0.4)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 20px hsl(0 0% 100% / 0.9), 0 0 40px hsl(0 0% 100% / 0.7), 0 0 60px hsl(0 0% 100% / 0.5)';
          }}>
              <div className="flex flex-col items-center justify-center gap-4 h-full">
                <div className="p-3 sm:p-4 rounded-full bg-primary/10 group-hover:bg-orange/10 transition-colors">
                  <Brain className="h-10 w-10 text-primary group-hover:text-orange transition-colors" />
                </div>
                <div className="text-center space-y-2 sm:space-y-3">
                  <div className="font-tech font-extrabold text-xl sm:text-2xl lg:text-3xl text-orange px-2 text-recessed-orange">ZERO DOWNTIME</div>
                  <div className="font-body text-sm sm:text-base lg:text-lg text-white px-2">Harnessing AI's capbilities to end downtime for good.</div>
                </div>
              </div>
            </div>
            <div className="feature-card p-5 sm:p-6 lg:p-7 rounded-2xl hover-lift group transition-all duration-300" style={{
            borderColor: 'hsl(0 0% 100% / 0.3)',
            boxShadow: '0 0 20px hsl(0 0% 100% / 0.9), 0 0 40px hsl(0 0% 100% / 0.7), 0 0 60px hsl(0 0% 100% / 0.5)'
          }} onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 20px hsl(24 100% 54% / 0.8), 0 0 40px hsl(24 100% 54% / 0.6), 0 0 60px hsl(24 100% 54% / 0.4)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 20px hsl(0 0% 100% / 0.9), 0 0 40px hsl(0 0% 100% / 0.7), 0 0 60px hsl(0 0% 100% / 0.5)';
          }}>
              <div className="flex flex-col items-center justify-center gap-4 h-full">
                <div className="p-3 sm:p-4 rounded-full bg-primary/10 group-hover:bg-orange/10 transition-colors">
                  <Database className="h-10 w-10 text-primary group-hover:text-orange transition-colors" />
                </div>
                <div className="text-center space-y-2 sm:space-y-3">
                  <div className="font-tech font-extrabold text-xl sm:text-2xl lg:text-3xl text-orange px-2 text-recessed-orange">SHARED INTELLIGENCE</div>
                  <div className="font-body text-sm sm:text-base lg:text-lg text-white px-2">A living, evolving database for every game and every fix.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <section className="pt-24 sm:pt-28 lg:pt-32 pb-16 sm:pb-20 lg:pb-24 relative overflow-hidden">
          {/* Faint Cyan Grid Background */}
          <div className="absolute inset-0 opacity-5">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="networkGrid" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                  <circle cx="50" cy="50" r="1" fill="hsl(var(--brand-cyan))" opacity="0.3">
                    <animate attributeName="opacity" values="0.3;0.6;0.3" dur="5s" repeatCount="indefinite" />
                  </circle>
                  <line x1="50" y1="50" x2="100" y2="50" stroke="hsl(var(--brand-cyan))" strokeWidth="0.5" opacity="0.2" />
                  <line x1="50" y1="50" x2="50" y2="100" stroke="hsl(var(--brand-cyan))" strokeWidth="0.5" opacity="0.2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#networkGrid)" />
            </svg>
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Section Header */}
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-base sm:text-lg font-sans mb-3 italic" style={{ color: '#80E9FF', lineHeight: 1.4 }}>Inside the Intelligence</p>
              <h2 className="text-3xl sm:text-4xl md:text-6xl font-tech font-bold mb-4">
                <span className="text-white text-recessed-white">HOW IT</span> <span className="text-orange text-recessed-orange">WORKS</span>
              </h2>
              <p className="text-lg sm:text-xl font-sans max-w-3xl mx-auto" style={{ color: '#80E9FF', lineHeight: 1.4 }}>
                Precision-built intelligence for the arcade world.
              </p>
            </div>

            {/* Two-Column Explainer */}
            <div className="grid lg:grid-cols-5 gap-8 lg:gap-16 mb-16 sm:mb-20 lg:mb-24 max-w-7xl mx-auto">
              {/* Left Column - Text Content (55%) */}
              <div className="lg:col-span-3 space-y-6 max-w-2xl">
                <div className="pb-6 border-b border-cyan/10">
                  <h3 className="font-bold mb-2 font-tech text-white" style={{ fontSize: '20px', lineHeight: 1.3 }}><span className="text-[#FF6A00]">Specialized</span> parsing and embedding.</h3>
                  <p className="font-sans" style={{ fontSize: '18px', lineHeight: 1.6, color: '#A9B6C7', margin: 0 }}>
                    Each manual, wiring diagram, error code, and field report is converted by a custom parsing pipeline built for arcade logic. Data is embedded into high-dimensional <span className="text-cyan font-medium">vector space</span>, so the system searches by <span className="text-cyan font-medium">meaning</span>, not keywords.
                  </p>
                </div>
                
                <div className="pb-6 border-b border-cyan/10">
                  <h3 className="font-bold mb-2 font-tech text-white" style={{ fontSize: '20px', lineHeight: 1.3 }}><span className="text-[#FF6A00]">AI trained</span> the hard way — over and over.</h3>
                  <p className="font-sans" style={{ fontSize: '18px', lineHeight: 1.6, color: '#A9B6C7', margin: 0 }}>
                    Thousands of real troubleshooting sessions and verified fixes are refined and re-embedded repeatedly. When confidence drops, we rebuild. The result: a neural index that answers with <span className="text-cyan font-medium">certainty</span>, not guesses.
                  </p>
                </div>
                
                <div className="pb-6 border-b border-cyan/10">
                  <h3 className="font-bold mb-2 font-tech text-white" style={{ fontSize: '20px', lineHeight: 1.3 }}><span className="text-[#FF6A00]">True</span> RAG intelligence.</h3>
                  <p className="font-sans" style={{ fontSize: '18px', lineHeight: 1.6, color: '#A9B6C7', margin: 0 }}>
                    On every question, Level Up retrieves the most relevant <span className="text-cyan font-medium">technical context</span> from vector memory, fuses it with <span className="text-cyan font-medium">reasoning models</span>, and returns a step-by-step, machine-specific answer.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-bold mb-2 font-tech text-white italic" style={{ fontSize: '20px', lineHeight: 1.3 }}><span className="text-[#FF6A00]">The outcome.</span></h3>
                  <p className="font-sans" style={{ fontSize: '18px', lineHeight: 1.6, color: '#A9B6C7', margin: 0 }}>
                    An ever-evolving system designed to eliminate downtime—faster, smarter, and more accurate each time it's used.
                  </p>
                </div>
              </div>

              {/* Right Column - AI Flow Diagram (45%) */}
              <div className="lg:col-span-2 flex items-center justify-center">
                <AIFlowDiagram />
              </div>
            </div>

            {/* Timeline-Style System Cards */}
            <div className="relative max-w-7xl mx-auto mb-12 sm:mb-16">
              {/* Cards Container */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
                {/* Card 1 - Parsing */}
                <div className="relative premium-card p-6 rounded-xl group transition-all duration-300 border-t border-orange/25 hover:border-orange/50" style={{
                  boxShadow: '0 4px 20px hsl(24 100% 54% / 0.05)'
                }}>
                  <div className="relative z-10">
                    <div className="mb-3 p-2.5 rounded-full bg-cyan/10 w-fit">
                      <Code className="h-6 w-6 text-cyan" />
                    </div>
                    <h3 className="font-bold text-white mb-1 font-tech" style={{ fontSize: '18px' }}>Parsing</h3>
                    <p className="m-0" style={{ fontSize: '16px', lineHeight: 1.5, color: '#A9B6C7' }}>Converts chaotic data into structure.</p>
                  </div>
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300" style={{
                    boxShadow: '0 0 30px hsl(24 100% 54% / 0.3)'
                  }} />
                  
                  {/* Arrow to next card - Desktop only */}
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <div className="relative">
                      <div className="w-6 h-0.5 bg-orange/30" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-r-2 border-t-2 border-orange/30 rotate-45" />
                      {/* Animated dot */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-orange rounded-full">
                        <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" begin="0s" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2 - Embedding */}
                <div className="relative premium-card p-6 rounded-xl group transition-all duration-300 border-t border-orange/25 hover:border-orange/50" style={{
                  boxShadow: '0 4px 20px hsl(24 100% 54% / 0.05)'
                }}>
                  <div className="relative z-10">
                    <div className="mb-3 p-2.5 rounded-full bg-cyan/10 w-fit">
                      <Database className="h-6 w-6 text-cyan" />
                    </div>
                    <h3 className="font-bold text-white mb-1 font-tech" style={{ fontSize: '18px' }}>Embedding</h3>
                    <p className="m-0" style={{ fontSize: '16px', lineHeight: 1.5, color: '#A9B6C7' }}>Translates meaning into memory.</p>
                  </div>
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300" style={{
                    boxShadow: '0 0 30px hsl(24 100% 54% / 0.3)'
                  }} />
                  
                  {/* Arrow to next card - Desktop only */}
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <div className="relative">
                      <div className="w-6 h-0.5 bg-orange/30" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-r-2 border-t-2 border-orange/30 rotate-45" />
                      {/* Animated dot */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-orange rounded-full">
                        <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" begin="1s" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3 - RAG Engine */}
                <div className="relative premium-card p-6 rounded-xl group transition-all duration-300 border-t border-orange/25 hover:border-orange/50" style={{
                  boxShadow: '0 4px 20px hsl(24 100% 54% / 0.05)'
                }}>
                  <div className="relative z-10">
                    <div className="mb-3 p-2.5 rounded-full bg-cyan/10 w-fit">
                      <Zap className="h-6 w-6 text-cyan" />
                    </div>
                    <h3 className="font-bold text-white mb-1 font-tech" style={{ fontSize: '18px' }}>RAG Engine</h3>
                    <p className="m-0" style={{ fontSize: '16px', lineHeight: 1.5, color: '#A9B6C7' }}>Retrieves and reasons in real time.</p>
                  </div>
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300" style={{
                    boxShadow: '0 0 30px hsl(24 100% 54% / 0.3)'
                  }} />
                  
                  {/* Arrow to next card - Desktop only */}
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                    <div className="relative">
                      <div className="w-6 h-0.5 bg-orange/30" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-r-2 border-t-2 border-orange/30 rotate-45" />
                      {/* Animated dot */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-orange rounded-full">
                        <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" begin="2s" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 4 - Continuous Learning */}
                <div className="relative premium-card p-6 rounded-xl group transition-all duration-300 border-t border-orange/25 hover:border-orange/50" style={{
                  boxShadow: '0 4px 20px hsl(24 100% 54% / 0.05)'
                }}>
                  <div className="relative z-10">
                    <div className="mb-3 p-2.5 rounded-full bg-cyan/10 w-fit">
                      <TrendingUp className="h-6 w-6 text-cyan" />
                    </div>
                    <h3 className="font-bold text-white mb-1 font-tech" style={{ fontSize: '18px' }}>Continuous Learning</h3>
                    <p className="m-0" style={{ fontSize: '16px', lineHeight: 1.5, color: '#A9B6C7' }}>Every fix strengthens the system.</p>
                  </div>
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300" style={{
                    boxShadow: '0 0 30px hsl(24 100% 54% / 0.3)'
                  }} />
                </div>
              </div>
            </div>

            {/* Closing Cinematic Line */}
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-base sm:text-lg text-white font-sans italic" style={{
                textShadow: '0 0 20px hsl(var(--orange) / 0.3)'
              }}>
                The system doesn't just respond — it remembers.
              </p>
            </div>

            {/* Micro-Proof Strip */}
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-10 sm:mb-12">
              <div className="px-4 py-2 rounded-full bg-white border-[6px] border-[#FF6A00]">
                <span className="text-xs sm:text-sm text-black font-semibold">2.3 ms response time</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-white border-[6px] border-[#FF6A00]">
                <span className="text-xs sm:text-sm text-black font-semibold">99.9% accuracy on known fixes</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-white border-[6px] border-[#FF6A00]">
                <span className="text-xs sm:text-sm text-black font-semibold">1.2B+ parameters accessed per query</span>
              </div>
            </div>

            {/* CTA Footer */}
            <div className="text-center">
              <p className="text-lg sm:text-xl text-white mb-6 font-sans">
                Connect your arcade. End downtime.
              </p>
              <Link to="/auth">
                <Button 
                  variant="orange"
                  size="lg" 
                  className="cta-button hover-lift text-white font-semibold px-8 py-6 text-base sm:text-lg rounded-xl transition-all duration-300 border-2 border-orange relative group overflow-hidden"
                  style={{ boxShadow: '0 0 20px hsl(24 100% 54% / 0.9), 0 0 40px hsl(24 100% 54% / 0.7), 0 0 60px hsl(24 100% 54% / 0.5)' }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Launch Arcade Intelligence
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange/20 via-transparent to-orange/20 animate-pulse opacity-50"></div>
                </Button>
              </Link>
              <p className="text-sm text-primary/50 mt-4">No credit card • 2-minute setup</p>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Testimonials & ROI Section */}
        <section className="pt-12 sm:pt-16 lg:pt-20 pb-12 sm:pb-16 lg:pb-24 relative">
          {/* Title above section */}
          <div className="text-center mb-8 sm:mb-10 lg:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-tech font-bold whitespace-nowrap" style={{
              letterSpacing: '0.15em'
            }}>
              <span className="text-white text-recessed-white">REAL</span> <span className="text-orange text-recessed-orange">RESULTS</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-primary/80 font-sans mt-3">Proven ROI from live deployments</p>
          </div>
          
          <div className="premium-card p-6 sm:p-8 lg:p-12 rounded-2xl sm:rounded-3xl relative" style={{
            borderColor: 'hsl(24 100% 54% / 1)',
            boxShadow: '0 0 20px hsl(24 100% 54% / 0.5), 0 0 40px hsl(24 100% 54% / 0.3)'
          }}>
            {/* Connecting lines */}
            <div className="absolute top-1/2 left-[33%] w-[10%] h-0.5 bg-gradient-to-r from-orange/50 to-orange/30 hidden lg:block"></div>
            <div className="absolute top-1/2 right-[33%] w-[10%] h-0.5 bg-gradient-to-l from-orange/50 to-orange/30 hidden lg:block"></div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 items-center relative">
              {/* Left Side - Revenue Stats */}
              <div className="stat-card p-6 sm:p-8 lg:p-10 rounded-2xl hover-lift group hover-glow" style={{
                borderColor: 'hsl(183 100% 50% / 0.3)'
              }}>
                <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                  <div className="p-3 sm:p-4 rounded-full bg-orange/10 inline-flex group-hover:bg-orange/20 transition-colors">
                    <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-orange" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-tech font-extrabold text-orange text-recessed-orange">$400-$900/week</h3>
                  <p className="text-sm sm:text-base lg:text-lg font-body text-white leading-relaxed">
                    Average savings per arcade using Level Up. (Limited Testing)
                  </p>
                </div>
              </div>

              {/* Center - Payback Period */}
              <div className="stat-card p-6 sm:p-8 lg:p-10 rounded-2xl hover-lift group hover-glow" style={{
                borderColor: 'hsl(183 100% 50% / 0.3)'
              }}>
                <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                  <div className="p-3 sm:p-4 rounded-full bg-orange/10 inline-flex group-hover:bg-orange/20 transition-colors">
                    <Clock className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-orange" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-tech font-extrabold text-orange text-recessed-orange">3-6 Months</h3>
                  <p className="text-sm sm:text-base lg:text-lg font-body text-white leading-relaxed">
                    Typical payback period based on reduced technician time and uptime improvements.
                  </p>
                </div>
              </div>

              {/* Right Side - Labor Time Savings */}
              <div className="stat-card p-6 sm:p-8 lg:p-10 rounded-2xl hover-lift group hover-glow" style={{
                borderColor: 'hsl(183 100% 50% / 0.3)'
              }}>
                <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                  <div className="p-3 sm:p-4 rounded-full bg-orange/10 inline-flex group-hover:bg-orange/20 transition-colors">
                    <Target className="h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 text-orange" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-tech font-extrabold text-orange text-recessed-orange">Up to 40%</h3>
                  <p className="text-sm sm:text-base lg:text-lg font-body text-white leading-relaxed">
                    Cut technician labor time — Focus on new revenue, not repeat fixes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Performance Stats Section */}
        <section className="py-12 sm:py-16 lg:py-24">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16 px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-tech font-bold text-foreground mb-3 sm:mb-4" style={{
              letterSpacing: '0.02em'
            }}>Platform <span className="text-orange">Performance</span></h2>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground font-body">Industry-leading metrics that power your arcade operations</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {stats.map((stat, index) => <div key={index} className="stat-card p-6 sm:p-7 lg:p-8 rounded-2xl hover-lift hover-glow text-center" style={{
              borderColor: 'hsl(183 100% 50% / 0.3)'
            }}>
                <div className="flex flex-col items-center space-y-4 sm:space-y-5 lg:space-y-6">
                  <div className="p-3 sm:p-4 rounded-full bg-primary/10">
                    <div className="text-primary">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground">{stat.value}</div>
                    <div className="space-y-1 sm:space-y-2">
                      <div className="font-semibold text-base sm:text-lg text-foreground">{stat.label}</div>
                      <div className="text-xs sm:text-sm text-primary px-2">
                        {stat.description.split('.').map((sentence, i) => i === 0 ? <span key={i} className="font-semibold">{sentence}.</span> : <span key={i}> {sentence}{i < stat.description.split('.').length - 2 ? '.' : ''}</span>)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>)}
          </div>
        </section>


        {/* Capabilities Grid */}
        <section className="py-12 sm:py-16 lg:py-24">
          <div className="text-center mb-12 sm:mb-16 lg:mb-20 px-4">
            <div className="caption-text text-orange/80 mb-4 sm:mb-6 text-xs sm:text-sm tracking-widest uppercase font-mono">
              Advanced Capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-tech font-black text-foreground mb-6 sm:mb-8 tracking-wider">
              Professional <span className="text-orange">Features</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed font-body">
              Enterprise-grade capabilities designed to meet the demanding requirements 
              of professional arcade operations and technical support teams.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
            {capabilities.map((capability, index) => <div key={index} className="premium-card hover-lift p-6 sm:p-8 lg:p-10 rounded-2xl sm:rounded-3xl group" style={{
              borderColor: 'hsl(183 100% 50% / 0.3)'
            }}>
                <div className="space-y-5 sm:space-y-6 lg:space-y-8">
                  <div className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-primary/10 inline-flex group-hover:bg-orange/10 transition-colors">
                    <div className="text-primary group-hover:text-orange transition-colors">
                      {capability.icon}
                    </div>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-tech font-bold text-foreground tracking-wide">{capability.title}</h3>
                  <p className="text-primary leading-relaxed text-sm sm:text-base font-body">
                    {capability.description.split('.').map((sentence, i) => i === 0 ? <span key={i} className="font-semibold">{sentence}.</span> : <span key={i}> {sentence}{i < capability.description.split('.').length - 2 ? '.' : ''}</span>)}
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
              <CardContent className="space-y-2">
                <Link to="/tenant-management">
                  <Button className="w-full" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Tenant Access to Manuals
                  </Button>
                </Link>
                <Link to="/user-conversations">
                  <Button className="w-full" variant="outline">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    View User Conversation History
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </section>}

        {/* Pricing Teaser */}
        <section className="py-12 sm:py-16 lg:py-20 relative">
...
          
          <div className="text-center mb-8 sm:mb-10 lg:mb-12 px-4">
            <div className="caption-text text-orange/80 mb-3 sm:mb-4 text-xs sm:text-sm tracking-widest uppercase font-mono">
              Simple, Transparent Pricing
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-tech font-black text-foreground mb-4 sm:mb-6 tracking-wider">
              Choose Your <span className="text-orange">Level Up</span> Plan
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed font-body">
              Built for busy FEC technicians who want less paperwork and faster fixes
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto mb-8 sm:mb-10 lg:mb-12">
            <div className="premium-card hover-lift p-6 sm:p-8 rounded-2xl sm:rounded-3xl border-2 transition-all group" style={{
              borderColor: 'hsl(183 100% 50% / 0.3)'
            }}>
              <div className="text-center space-y-3 sm:space-y-4">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground">Starter</h3>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-baseline justify-center gap-1 sm:gap-2">
                    <span className="text-lg sm:text-2xl font-semibold text-muted-foreground line-through opacity-50">$299</span>
                    <span className="text-4xl sm:text-5xl font-extrabold text-foreground">$149</span>
                    <span className="text-base sm:text-xl text-primary">/ month</span>
                  </div>
                </div>
                <p className="text-sm text-primary italic" style={{
                  fontVariantNumeric: 'tabular-nums'
                }}>(or $1,345/yr — 3 months free)</p>
                <ul className="text-left space-y-2 sm:space-y-3 pt-4 sm:pt-6">
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Up to <strong className="text-foreground">40 games</strong></span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Unlimited tech accounts</span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Instant AI troubleshooting</span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Email support (24hr)</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="premium-card hover-lift p-6 sm:p-8 rounded-2xl sm:rounded-3xl border-2 transition-all relative" style={{
              borderColor: 'hsl(183 100% 50% / 0.5)'
            }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 rounded-full text-xs font-semibold" style={{
                background: "linear-gradient(90deg, rgba(255,102,0,0.2), rgba(255,102,0,0.05))",
                border: "1px solid rgba(255,102,0,0.45)",
                color: "white"
              }}>
                Recommended
              </div>
              <div className="text-center space-y-3 sm:space-y-4">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground">Pro</h3>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-baseline justify-center gap-1 sm:gap-2">
                    <span className="text-lg sm:text-2xl font-semibold text-muted-foreground line-through opacity-50">$499</span>
                    <span className="text-4xl sm:text-5xl font-extrabold text-foreground">$249</span>
                    <span className="text-base sm:text-xl text-primary">/ month</span>
                  </div>
                </div>
                <p className="text-sm text-primary italic" style={{
                  fontVariantNumeric: 'tabular-nums'
                }}>(or $2,245/yr — 3 months free)</p>
                <ul className="text-left space-y-2 sm:space-y-3 pt-4 sm:pt-6">
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Everything in Starter</span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Up to <strong className="text-foreground">100 games</strong></span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Priority support</span>
                  </li>
                  <li className="flex items-start gap-2 sm:gap-3">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm sm:text-base text-primary">Early access to new modules</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-center px-4">
            <Link to="/pricing">
              <Button variant="orange" size="lg" className="hover-lift px-8 sm:px-12 py-4 sm:py-6 text-base sm:text-lg font-bold">
                View Full Pricing Details
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
              30-day risk-free • No setup fees • Cancel anytime
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center py-12 sm:py-16 lg:py-24">
          <div className="mb-10 sm:mb-12 lg:mb-16 px-4">
            <div className="caption-text text-orange/80 mb-4 sm:mb-6 text-xs sm:text-sm tracking-widest uppercase font-mono">
              Get Started Today
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-tech font-black text-foreground mb-6 sm:mb-8 tracking-wider">
              Ready to Transform Your <span className="text-orange">Arcade Operations</span>?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed font-body">
              Join arcade professionals who've already revolutionized their technical support 
              and troubleshooting processes with our AI-powered platform.
            </p>
          </div>
          <div className="flex items-center justify-center px-4">
            <Button onClick={handleStartGeneralChat} variant="orange" size="xl" className="hover-lift px-8 sm:px-12 md:px-16 lg:px-20 py-6 sm:py-8 lg:py-10 text-lg sm:text-xl lg:text-2xl font-bold relative group overflow-hidden w-full sm:w-auto">
              <span className="relative z-10 flex items-center justify-center gap-2 sm:gap-3">
                <span>Launch Arcade Intelligence</span>
                <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 group-hover:translate-x-1 transition-transform flex-shrink-0" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange/20 via-transparent to-orange/20 animate-pulse opacity-50"></div>
            </Button>
          </div>
        </section>
        </div>


        <div className="mt-12 sm:mt-16 lg:mt-20">
          <ProcessingMonitor />
        </div>
      </main>
      <Footer />
    </div>;
};
export default Index;