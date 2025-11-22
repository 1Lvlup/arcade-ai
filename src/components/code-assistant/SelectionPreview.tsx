import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileCode, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SelectionPreviewProps {
  preview: string;
  show: boolean;
}

export function SelectionPreview({ preview, show }: SelectionPreviewProps) {
  if (!show || !preview) {
    return null;
  }

  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          Auto-Selected Context
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="text-xs prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{preview}</ReactMarkdown>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
