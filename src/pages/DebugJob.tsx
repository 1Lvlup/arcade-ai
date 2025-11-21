import React, { useState } from 'react';
import { SharedHeader } from '@/components/SharedHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const DebugJob = () => {
  const [jobId, setJobId] = useState('8ca30886-2548-4230-b553-fb7e4f2885c9');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const checkJobStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-job-status', {
        body: { job_id: jobId }
      });

      if (error) throw error;

      setResult(data);
      console.log('Job status result:', data);
      
      toast({
        title: 'Status check complete',
        description: `Job status: ${data.status}`,
      });
    } catch (error: any) {
      console.error('Error checking job:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const testWebhook = async () => {
    setLoading(true);
    try {
      // Test if webhook is accessible by calling it directly
      const { data, error } = await supabase.functions.invoke('llama-webhook', {
        body: {
          jobId: jobId,
          status: 'TEST',
          result: { test: true }
        }
      });

      if (error) throw error;

      toast({
        title: 'Webhook test complete',
        description: 'Webhook is accessible',
      });
    } catch (error: any) {
      console.error('Webhook test error:', error);
      toast({
        title: 'Webhook test failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SharedHeader />
      <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Debug Stalled Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Job ID</label>
            <Input
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              placeholder="Enter job ID to debug"
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={checkJobStatus} disabled={loading}>
              Check Job Status
            </Button>
            <Button onClick={testWebhook} disabled={loading} variant="outline">
              Test Webhook
            </Button>
          </div>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Job Status Results</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded text-sm overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="font-mono">{result.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chunks Created:</span>
                    <span className="font-mono">{result.chunks_created ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Progress:</span>
                    <span className="font-mono">{result.progress}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
};

export default DebugJob;