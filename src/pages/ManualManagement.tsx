import { ManualUpload } from '@/components/ManualUpload';
import { ManualsList } from '@/components/ManualsList';
import { SharedHeader } from '@/components/SharedHeader';
import { TestEnhancement } from '@/components/TestEnhancement';

const ManualManagement = () => {
  return (
    <div className="min-h-screen professional-bg">
      <SharedHeader title="Document Intelligence" showBackButton={true} />

      <main className="container mx-auto px-6 py-12">
        <div className="text-center space-y-8 mb-16">
          <h1 className="display-text text-6xl text-foreground">
            Advanced Document<br />
            <span className="text-primary">Processing</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto font-light leading-relaxed">
            Transform complex documents into actionable intelligence. Our proprietary AI engine 
            extracts, analyzes, and structures information with unprecedented accuracy.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 mb-16">
          <div className="space-y-8">
            <ManualUpload />
          </div>
          
          <div className="space-y-8">
            <ManualsList />
          </div>
        </div>

        <div className="minimal-card p-10 rounded-2xl">
          <h3 className="premium-text text-2xl mb-8 text-foreground text-center">
            Enterprise Processing Pipeline
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center text-xl font-bold mx-auto">
                1
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground">Document Upload</h4>
                <p className="text-muted-foreground text-sm">Secure file processing with enterprise-grade encryption</p>
              </div>
            </div>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center text-xl font-bold mx-auto">
                2
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground">AI Analysis</h4>
                <p className="text-muted-foreground text-sm">Advanced OCR and intelligent content extraction</p>
              </div>
            </div>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center text-xl font-bold mx-auto">
                3
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground">Semantic Processing</h4>
                <p className="text-muted-foreground text-sm">Context-aware content structuring and categorization</p>
              </div>
            </div>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center text-xl font-bold mx-auto">
                4
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground">Intelligent Search</h4>
                <p className="text-muted-foreground text-sm">Vector-powered retrieval with 99.9% accuracy</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-16">
          <TestEnhancement />
        </div>
      </main>
    </div>
  );
};

export default ManualManagement;