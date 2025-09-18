import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileText, Calendar, Search } from 'lucide-react';

interface Manual {
  id: string;
  manual_id: string;
  title: string;
  source_filename: string;
  created_at: string;
  updated_at: string;
}

export function ManualsList() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchManuals();
  }, []);

  const fetchManuals = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setManuals(data || []);
    } catch (error) {
      console.error('Error fetching manuals:', error);
      toast({
        title: 'Error loading manuals',
        description: 'Failed to load manual list',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProcessingStatus = (manual: Manual) => {
    const createdAt = new Date(manual.created_at);
    const updatedAt = new Date(manual.updated_at);
    const timeDiff = updatedAt.getTime() - createdAt.getTime();
    
    // If updated significantly after creation, likely processed
    if (timeDiff > 60000) { // More than 1 minute difference
      return { status: 'processed', label: 'Processed', variant: 'default' as const };
    } else {
      return { status: 'processing', label: 'Processing', variant: 'secondary' as const };
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Your Manuals</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-3 text-muted-foreground">Loading manuals...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-primary" />
          <span>Your Manuals</span>
        </CardTitle>
        <CardDescription>
          {manuals.length} manual{manuals.length !== 1 ? 's' : ''} available for troubleshooting
        </CardDescription>
      </CardHeader>
      <CardContent>
        {manuals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No manuals uploaded yet</p>
            <p className="text-sm">Upload your first manual to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {manuals.map((manual) => {
              const status = getProcessingStatus(manual);
              return (
                <div
                  key={manual.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium truncate">{manual.title}</h3>
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="truncate">{manual.source_filename}</span>
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(manual.created_at)}</span>
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ID: {manual.manual_id}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={status.status === 'processing'}
                    >
                      <Search className="h-4 w-4 mr-1" />
                      Search
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}