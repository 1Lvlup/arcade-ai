import { useState } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TrainingInbox() {
  const navigate = useNavigate();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Training Inbox" showBackButton backTo="/training-hub" />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/training-hub')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Review Inbox</h1>
                <p className="text-muted-foreground">Review and verify query responses</p>
              </div>
            </div>
            
            {selectedItems.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline">Accept Selected ({selectedItems.length})</Button>
                <Button variant="outline">Reject Selected</Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="low_confidence">Low Confidence</TabsTrigger>
              <TabsTrigger value="numeric">Numeric Flagged</TabsTrigger>
              <TabsTrigger value="high_frequency">High Frequency</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-6">
              {/* Placeholder for query logs */}
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg">No queries to review</p>
                  <p className="text-sm mt-2">Queries will appear here as they are logged</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="low_confidence" className="space-y-4 mt-6">
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg">No low confidence queries</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="numeric" className="space-y-4 mt-6">
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg">No numeric-flagged queries</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="high_frequency" className="space-y-4 mt-6">
              <Card className="p-6">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg">No high frequency queries</p>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
