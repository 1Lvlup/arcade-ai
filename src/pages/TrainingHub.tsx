import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SharedHeader } from '@/components/SharedHeader';
import { AlertCircle, ClipboardCheck, FileText, Download } from 'lucide-react';

export default function TrainingHub() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Training Hub" />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Training Hub — Admin Console</h1>
            <p className="text-xl text-muted-foreground">
              One place to review model mistakes, verify fixes, and produce high-quality training data.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/inbox')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <AlertCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Review Inbox</CardTitle>
                    <CardDescription>Review queries flagged for improvement</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" className="w-full">
                  Start Reviewing
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/generate')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Generate QA</CardTitle>
                    <CardDescription>Auto-generate training questions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" variant="outline" className="w-full">
                  Generate Questions
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/examples')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ClipboardCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Training Examples</CardTitle>
                    <CardDescription>Manage verified training data</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" variant="outline" className="w-full">
                  View Examples
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/training-hub/export')}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Download className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Export Data</CardTitle>
                    <CardDescription>Download training datasets</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button size="lg" variant="outline" className="w-full">
                  Export
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-3xl">--</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Verified Examples</CardDescription>
                <CardTitle className="text-3xl">--</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Quality Score</CardDescription>
                <CardTitle className="text-3xl">--</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
