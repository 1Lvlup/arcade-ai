import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { SharedHeader } from '@/components/SharedHeader';
import FigureEnhancementManager from '@/components/FigureEnhancementManager';
import { ChatBot } from '@/components/ChatBot';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

const ManualManagement = () => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleManualRetry = async () => {
    setIsRetrying(true);
    try {
      console.log('Manually retrying processing for virtual-rabbids-troubleshooting-guide');
      
      const { data, error } = await supabase.functions.invoke('retry-text-processing', {
        body: {
          manual_id: 'virtual-rabbids-troubleshooting-guide'
        }
      });

      if (error) {
        console.error('Retry error:', error);
        toast.error('Failed to retry processing: ' + error.message);
        return;
      }

      console.log('Retry response:', data);
      toast.success('Processing triggered! Check back in a moment.');
      
    } catch (error) {
      console.error('Manual retry error:', error);
      toast.error('Failed to retry processing');
    } finally {
      setIsRetrying(false);
    }
  };
  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Document Intelligence" showBackButton={true} />

      <main className="container mx-auto px-8 py-24">
        <div className="text-center section-spacing">
          <div className="space-y-12">
            <div className="caption-text text-primary/80 mb-8">
              Advanced Processing
            </div>
            <h1 className="display-heading text-7xl md:text-8xl text-foreground leading-none">
              Document<br />
              <span className="text-primary brand-glow">Intelligence</span>
            </h1>
            <p className="body-text text-xl text-muted-foreground max-w-5xl mx-auto mt-16">
              Transform complex documents into actionable intelligence with our proprietary AI engine. 
              Experience unprecedented accuracy in extraction, analysis, and structured data creation.
            </p>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="section-spacing">
          <ChatBot />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-16 section-spacing">
          <div className="space-y-12">
            <ManualUpload />
            
            {/* Temporary manual retry button */}
            <div className="premium-card p-8 rounded-3xl">
              <h3 className="premium-text text-lg text-foreground mb-4">Manual Processing</h3>
              <p className="caption-text text-muted-foreground mb-6">
                If your upload is stuck processing, click to manually trigger text extraction.
              </p>
              <Button 
                onClick={handleManualRetry}
                disabled={isRetrying}
                className="w-full primary-gradient hover-lift py-4"
              >
                {isRetrying ? 'Processing...' : 'Retry Text Processing'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-12">
            <ManualsList />
          </div>
        </div>

        <div className="premium-card p-16 rounded-3xl section-spacing">
          <div className="text-center content-spacing">
            <div className="caption-text text-primary/80 mb-6">
              Processing Pipeline
            </div>
            <h3 className="premium-text text-4xl text-foreground">
              Enterprise Workflow
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="text-center space-y-6">
              <div className="glass-card w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                <span className="premium-text text-2xl text-primary">1</span>
              </div>
              <div className="space-y-4">
                <h4 className="premium-text text-lg text-foreground">Document Upload</h4>
                <p className="caption-text text-muted-foreground">Secure file processing with enterprise-grade encryption</p>
              </div>
            </div>
            <div className="text-center space-y-6">
              <div className="glass-card w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                <span className="premium-text text-2xl text-primary">2</span>
              </div>
              <div className="space-y-4">
                <h4 className="premium-text text-lg text-foreground">AI Analysis</h4>
                <p className="caption-text text-muted-foreground">Advanced OCR and intelligent content extraction</p>
              </div>
            </div>
            <div className="text-center space-y-6">
              <div className="glass-card w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                <span className="premium-text text-2xl text-primary">3</span>
              </div>
              <div className="space-y-4">
                <h4 className="premium-text text-lg text-foreground">Semantic Processing</h4>
                <p className="caption-text text-muted-foreground">Context-aware content structuring and categorization</p>
              </div>
            </div>
            <div className="text-center space-y-6">
              <div className="glass-card w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
                <span className="premium-text text-2xl text-primary">4</span>
              </div>
              <div className="space-y-4">
                <h4 className="premium-text text-lg text-foreground">Intelligent Search</h4>
                <p className="caption-text text-muted-foreground">Vector-powered retrieval with 99.9% accuracy</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="section-spacing">
          <FigureEnhancementManager />
        </div>
        
      </main>
    </div>
  );
};

export default ManualManagement;