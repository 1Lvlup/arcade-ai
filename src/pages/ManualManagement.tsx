import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { BulkManualImport } from '@/components/BulkManualImport';
import { StructuredCSVImport } from '@/components/StructuredCSVImport';
import { SharedHeader } from '@/components/SharedHeader';

const ManualManagement = () => {
  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Document Intelligence" showBackButton={true} />

      <main className="container mx-auto px-8 py-12">
        <div className="section-spacing space-y-12">
          <div className="text-center section-spacing">
            <div className="space-y-12">
              <div className="caption-text text-orange/80 mb-8">
                Advanced Processing
              </div>
              <h1 className="display-heading text-7xl md:text-8xl text-foreground leading-none">
                Document<br />
                <span className="text-orange brand-glow">Intelligence</span>
              </h1>
              <p className="body-text text-2xl text-muted-foreground max-w-5xl mx-auto mt-16">
                Transform complex documents into actionable intelligence with our proprietary AI engine. 
                Experience unprecedented accuracy in extraction, analysis, and structured data creation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            <ManualUpload />
            <ManualsList />
          </div>

          <div className="mt-12 space-y-12">
            <BulkManualImport />
            <StructuredCSVImport />
          </div>

          <div className="premium-card p-6 rounded-2xl mt-24">
            <div className="text-center mb-4">
              <h3 className="premium-text text-lg text-foreground">
                Processing Pipeline
              </h3>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center space-y-2">
                <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto border border-orange/30">
                  <span className="premium-text text-sm text-orange">1</span>
                </div>
                <p className="caption-text text-xs text-muted-foreground">Upload</p>
              </div>
              <div className="text-center space-y-2">
                <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto border border-orange/30">
                  <span className="premium-text text-sm text-orange">2</span>
                </div>
                <p className="caption-text text-xs text-muted-foreground">AI Analysis</p>
              </div>
              <div className="text-center space-y-2">
                <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto border border-orange/30">
                  <span className="premium-text text-sm text-orange">3</span>
                </div>
                <p className="caption-text text-xs text-muted-foreground">Semantic Processing</p>
              </div>
              <div className="text-center space-y-2">
                <div className="glass-card w-10 h-10 rounded-xl flex items-center justify-center mx-auto border border-orange/30">
                  <span className="premium-text text-sm text-orange">4</span>
                </div>
                <p className="caption-text text-xs text-muted-foreground">Intelligent Search</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManualManagement;