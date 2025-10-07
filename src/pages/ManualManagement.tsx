import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { SharedHeader } from '@/components/SharedHeader';
import FigureEnhancementManager from '@/components/FigureEnhancementManager';
import { ChatBot } from '@/components/ChatBot';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, MessageSquare } from 'lucide-react';
import { useState } from 'react';

const ManualManagement = () => {
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

        {/* Tab Interface */}
        <div className="section-spacing">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Manuals
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat with AI
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-12">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <ManualUpload />
                <ManualsList />
              </div>
            </TabsContent>
            
            <TabsContent value="chat">
              <ChatBot />
            </TabsContent>
          </Tabs>
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