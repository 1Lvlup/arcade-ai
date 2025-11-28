import { useState } from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, FileCode, Database, Search, Copy, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { systemArchitectureCategories, FileReference } from '@/data/systemArchitectureCategories';

const SystemArchitecture = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredCategories = searchQuery
    ? systemArchitectureCategories.filter(
        (cat) =>
          cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.files.some((f) => f.path.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : systemArchitectureCategories;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    toast({
      title: 'Copied to clipboard',
      description: text,
    });
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const getStatusBadge = (status: FileReference['status']) => {
    const variants = {
      'working': { variant: 'default' as const, text: '✅ Working' },
      'needs-attention': { variant: 'destructive' as const, text: '⚠️ Needs Attention' },
      'in-development': { variant: 'secondary' as const, text: '🔧 In Dev' },
    };
    const { variant, text } = variants[status];
    return <Badge variant={variant} className="text-xs">{text}</Badge>;
  };

  return (
    <>
      <SharedHeader />
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AdminSidebar activeTab="system" onTabChange={() => {}} />
          
          <SidebarInset className="flex-1">
            <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
              <SidebarTrigger className="-ml-1" />
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Admin
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <FileCode className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">System Architecture</h1>
                  <p className="text-xs text-muted-foreground">File mappings & feature documentation</p>
                </div>
              </div>
            </header>

            <main className="flex-1 p-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Architecture Documentation</CardTitle>
                  <CardDescription>
                    Comprehensive mapping of files, edge functions, and database tables for each feature area.
                    This helps identify which files are responsible for specific functionality.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search features, files, or functionality..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Accordion type="single" collapsible className="w-full space-y-4">
                    {filteredCategories.map((category) => (
                      <AccordionItem
                        key={category.id}
                        value={category.id}
                        className="border rounded-lg bg-card"
                      >
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <div className="flex items-center gap-4 text-left">
                            <span className="text-3xl">{category.icon}</span>
                            <div>
                              <h3 className="text-lg font-semibold">{category.title}</h3>
                              <p className="text-sm text-muted-foreground">{category.description}</p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 space-y-6">
                          {/* Files */}
                          <div>
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <FileCode className="h-4 w-4" />
                              Files
                            </h4>
                            <div className="space-y-2">
                              {category.files.map((file) => (
                                <div
                                  key={file.path}
                                  className="flex items-start gap-3 p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                                >
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <code className="text-xs font-mono bg-background px-2 py-1 rounded">
                                        {file.path}
                                      </code>
                                      {file.lines && (
                                        <Badge variant="outline" className="text-xs">
                                          Lines {file.lines}
                                        </Badge>
                                      )}
                                      {getStatusBadge(file.status)}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{file.purpose}</p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => copyToClipboard(file.path)}
                                  >
                                    {copiedPath === file.path ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Database Tables */}
                          {category.database && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Database Tables & Columns
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {category.database.map((table) => (
                                  <Badge key={table} variant="secondary" className="font-mono text-xs">
                                    {table}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Storage Buckets */}
                          {category.storage && (
                            <div>
                              <h4 className="font-semibold mb-3">Storage Buckets</h4>
                              <div className="flex flex-wrap gap-2">
                                {category.storage.map((bucket) => (
                                  <Badge key={bucket} variant="outline" className="font-mono text-xs">
                                    📦 {bucket}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Edge Functions */}
                          {category.edgeFunctions && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                ⚡ Edge Functions
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  asChild
                                >
                                  <a
                                    href="https://supabase.com/dashboard/project/wryxbfnmecjffxolcgfa/functions"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View in Supabase
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {category.edgeFunctions.map((fn) => (
                                  <Badge key={fn} variant="secondary" className="font-mono text-xs">
                                    {fn}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {filteredCategories.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No features match your search query.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </>
  );
};

export default SystemArchitecture;
