import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, FileCode, Check, Eye } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useToast } from '@/hooks/use-toast';
import { diffLines, Change } from 'diff';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeSuggestionProps {
  filePath: string;
  code: string;
  language: string;
  action: 'CREATE' | 'EDIT';
  existingContent?: string;
}

export function CodeSuggestion({ filePath, code, language, action, existingContent }: CodeSuggestionProps) {
  const [copied, setCopied] = useState(false);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({
      title: 'Code copied!',
      description: `Code for ${filePath} copied to clipboard`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const getDiff = (): Change[] => {
    if (!existingContent || action === 'CREATE') {
      return [];
    }
    return diffLines(existingContent, code);
  };

  const renderDiff = () => {
    const diff = getDiff();
    
    if (diff.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          No existing file to compare. This will create a new file.
        </div>
      );
    }

    return (
      <ScrollArea className="h-[500px]">
        <div className="font-mono text-sm">
          {diff.map((part, index) => {
            const bgColor = part.added 
              ? 'bg-green-500/20' 
              : part.removed 
              ? 'bg-red-500/20' 
              : 'bg-transparent';
            
            const linePrefix = part.added ? '+' : part.removed ? '-' : ' ';
            const textColor = part.added 
              ? 'text-green-400' 
              : part.removed 
              ? 'text-red-400' 
              : 'text-foreground';

            return (
              <div key={index} className={`${bgColor} ${textColor} px-4 py-1`}>
                {part.value.split('\n').map((line, lineIndex) => (
                  line && (
                    <div key={lineIndex} className="whitespace-pre-wrap">
                      <span className="select-none opacity-50 mr-2">{linePrefix}</span>
                      {line}
                    </div>
                  )
                ))}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    );
  };

  return (
    <>
      <Card className="border-primary/20 bg-card/50">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-primary" />
              <code className="text-sm font-mono text-foreground">{filePath}</code>
              <Badge variant={action === 'CREATE' ? 'default' : 'secondary'}>
                {action}
              </Badge>
            </div>
            <div className="flex gap-2">
              {action === 'EDIT' && existingContent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowDiffDialog(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Diff
                </Button>
              )}
              <Button
                size="sm"
                variant="default"
                onClick={handleCopy}
                className="min-w-[100px]"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="rounded-lg overflow-hidden border border-border">
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: '0.875rem',
                maxHeight: '300px',
              }}
            >
              {code}
            </SyntaxHighlighter>
          </div>

          <div className="text-xs text-muted-foreground">
            💡 Click "Copy Code" to copy this code, then manually apply it to your project
          </div>
        </div>
      </Card>

      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Code Diff Preview</DialogTitle>
            <DialogDescription>
              Comparing changes for <code className="text-xs">{filePath}</code>
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="diff" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="diff">Diff View</TabsTrigger>
              <TabsTrigger value="new">New Code</TabsTrigger>
            </TabsList>
            
            <TabsContent value="diff" className="mt-4">
              {renderDiff()}
            </TabsContent>
            
            <TabsContent value="new" className="mt-4">
              <ScrollArea className="h-[500px]">
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    fontSize: '0.875rem',
                  }}
                  showLineNumbers
                >
                  {code}
                </SyntaxHighlighter>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button onClick={() => setShowDiffDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
