import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SharedHeader } from '@/components/SharedHeader';
import { SimpleChat } from '@/components/SimpleChat';
import { FileText } from 'lucide-react';

export default function ManualDetails() {
  const { manualId } = useParams<{ manualId: string }>();

  const { data: document } = useQuery({
    queryKey: ['document', manualId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('manual_id', manualId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!manualId,
  });

  const { data: chunks } = useQuery({
    queryKey: ['chunks', manualId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chunks_text')
        .select('*')
        .eq('manual_id', manualId)
        .order('page_start', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!manualId,
  });

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Manual Analysis" showBackButton={true} backTo="/manuals" />
      
      {/* Action Bar */}
      <div className="nav-tech border-b border-primary/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-tech-lg text-primary">Technical Documentation</h2>
              <div className="w-px h-6 bg-primary/30"></div>
              <span className="font-mono text-sm text-muted-foreground">
                ID: {document?.manual_id?.split('-').pop()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/manuals">
                <Button className="btn-tech-outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Browse Manuals
                </Button>
              </Link>
              <Link to="/manuals/upload">
                <Button className="btn-tech">
                  Upload New Manual
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Status Overview */}
          <div className="tech-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-tech-xl text-primary text-glow">
                    {document?.title || 'Manual Analysis'}
                  </h1>
                  <p className="font-mono text-sm text-muted-foreground mt-1">
                    Source: {document?.source_filename}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span className="font-mono text-sm text-primary">ANALYZED</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Manual ID</div>
                <div className="font-mono text-sm text-primary mt-1 break-all">{document?.manual_id}</div>
              </div>
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Content Chunks</div>
                <div className="text-tech-base text-primary mt-1">{chunks?.length || 0}</div>
              </div>
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Processing Status</div>
                <div className="text-sm text-green-400 mt-1">✓ COMPLETE</div>
              </div>
              <div className="tech-card p-4 bg-gradient-tech">
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider">File Size</div>
                <div className="text-sm text-foreground mt-1">Optimized</div>
              </div>
            </div>
          </div>
              
          {/* Content Analysis */}
          {chunks && chunks.length > 0 && (
            <div className="tech-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-tech-lg text-primary flex items-center gap-3">
                  <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                  Content Analysis Results
                </h2>
                <div className="font-mono text-sm text-muted-foreground">
                  {chunks.length} segments processed
                </div>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {chunks.map((chunk, index) => (
                  <div key={chunk.id} className="tech-card p-5 hover:border-primary/40 transition-all duration-300 group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                          <span className="font-mono text-xs text-primary font-bold">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-primary uppercase tracking-wider">
                          Segment {index + 1}
                        </div>
                      </div>
                      {chunk.page_start && (
                        <div className="px-3 py-1 rounded-full bg-secondary/30 border border-primary/20">
                          <span className="font-mono text-xs text-muted-foreground">
                            Page {chunk.page_start}{chunk.page_end && chunk.page_end !== chunk.page_start ? `-${chunk.page_end}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-background/50 rounded-lg p-4 border border-primary/10">
                      <div className="text-sm text-foreground/90 leading-relaxed font-body">
                        {chunk.content.length > 400 ? 
                          `${chunk.content.substring(0, 400)}...` : 
                          chunk.content
                        }
                      </div>
                    </div>
                    
                    {chunk.menu_path && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-4 h-px bg-primary/30"></div>
                        <span className="font-mono text-xs text-primary/70">
                          {chunk.menu_path}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Chat Interface */}
          <div className="tech-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="w-6 h-6 text-primary">🤖</div>
              </div>
              <div>
                <h2 className="text-tech-lg text-primary text-glow">
                  AI Technical Assistant
                </h2>
                <p className="font-mono text-sm text-muted-foreground">
                  Ask questions about troubleshooting, repairs, or technical specifications
                </p>
              </div>
            </div>
            <div className="border-t border-primary/10 pt-6">
              <SimpleChat manualId={manualId} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}