import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { SharedHeader } from '@/components/SharedHeader';
import { ChatBot } from '@/components/ChatBot';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, MessageSquare } from 'lucide-react';

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
            <p className="body-text text-2xl text-muted-foreground max-w-5xl mx-auto mt-16">
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
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                <ManualUpload />
                <ManualsList />
              </div>
            </TabsContent>
            
            <TabsContent value="chat">
              <ChatBot />
            </TabsContent>
          </Tabs>
        </div>


        <div className="premium-card p-6 rounded-2xl section-spacing mt-24">
          <div className="text-center mb-4">
            <h3 className="premium-text text-lg text-foreground">
              Processing Pipeline
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center space-y-2">
              <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto">
                <span className="premium-text text-sm text-primary">1</span>
              </div>
              <p className="caption-text text-xs text-muted-foreground">Upload</p>
            </div>
            <div className="text-center space-y-2">
              <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto">
                <span className="premium-text text-sm text-primary">2</span>
              </div>
              <p className="caption-text text-xs text-muted-foreground">AI Analysis</p>
            </div>
            <div className="text-center space-y-2">
              <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto">
                <span className="premium-text text-sm text-primary">3</span>
              </div>
              <p className="caption-text text-xs text-muted-foreground">Semantic Processing</p>
            </div>
            <div className="text-center space-y-2">
              <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto">
                <span className="premium-text text-sm text-primary">4</span>
              </div>
              <p className="caption-text text-xs text-muted-foreground">Intelligent Search</p>
            </div>
          </div>
        </div>
        
      </main>
    </div>
  );
};

export default ManualManagement;