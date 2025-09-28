import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { SharedHeader } from '@/components/SharedHeader';

const ManualManagement = () => {
  return (
    <div className="min-h-screen arcade-bg">
      <SharedHeader title="Manual Management" showBackButton={true} />

      <main className="container mx-auto px-4 py-8">
        <div className="text-center space-y-6 mb-12">
          <h2 className="text-4xl font-bold neon-text">Manual Processing</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Upload and manage arcade game manuals for AI-powered troubleshooting. 
            LlamaCloud will extract text, images, and technical diagrams for intelligent search.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <ManualUpload />
          </div>
          
          <div className="space-y-6">
            <ManualsList />
          </div>
        </div>

        <div className="mt-12 p-6 bg-muted/50 rounded-lg border border-primary/10">
          <h3 className="text-lg font-semibold mb-3 text-primary">Processing Pipeline</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold mx-auto mb-2">1</div>
              <p className="font-medium">Upload PDF</p>
              <p className="text-muted-foreground">Select manual file</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-secondary-foreground font-bold mx-auto mb-2">2</div>
              <p className="font-medium">LlamaCloud Parse</p>
              <p className="text-muted-foreground">OCR + image extraction</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-accent-foreground font-bold mx-auto mb-2">3</div>
              <p className="font-medium">Intelligent Chunking</p>
              <p className="text-muted-foreground">Semantic text processing</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold mx-auto mb-2">4</div>
              <p className="font-medium">Vector Search</p>
              <p className="text-muted-foreground">AI-powered retrieval</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManualManagement;