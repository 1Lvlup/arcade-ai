import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { systemArchitectureCategories, FileReference } from '@/data/systemArchitectureCategories';
import { Check } from 'lucide-react';

interface SystemArchitectureSelectorProps {
  selectedFileIds: Set<string>;
  onToggleFile: (filePath: string) => void;
  searchFilter: string;
}

export const SystemArchitectureSelector = ({
  selectedFileIds,
  onToggleFile,
  searchFilter,
}: SystemArchitectureSelectorProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const filteredCategories = searchFilter
    ? systemArchitectureCategories.filter(
        (cat) =>
          cat.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
          cat.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
          cat.files.some((f) => f.path.toLowerCase().includes(searchFilter.toLowerCase()))
      )
    : systemArchitectureCategories;

  const handleSelectAllInCategory = (categoryId: string) => {
    const category = systemArchitectureCategories.find((c) => c.id === categoryId);
    if (!category) return;

    const allSelected = category.files.every((f) => selectedFileIds.has(f.path));
    
    category.files.forEach((file) => {
      if (allSelected && selectedFileIds.has(file.path)) {
        onToggleFile(file.path);
      } else if (!allSelected && !selectedFileIds.has(file.path)) {
        onToggleFile(file.path);
      }
    });
  };

  const getCategorySelectionState = (categoryId: string) => {
    const category = systemArchitectureCategories.find((c) => c.id === categoryId);
    if (!category) return { allSelected: false, someSelected: false };

    const selectedCount = category.files.filter((f) => selectedFileIds.has(f.path)).length;
    return {
      allSelected: selectedCount === category.files.length && category.files.length > 0,
      someSelected: selectedCount > 0 && selectedCount < category.files.length,
    };
  };

  const getStatusBadge = (status: FileReference['status']) => {
    const variants = {
      'working': { variant: 'default' as const, text: '✅', tooltip: 'Working' },
      'needs-attention': { variant: 'destructive' as const, text: '⚠️', tooltip: 'Needs Attention' },
      'in-development': { variant: 'secondary' as const, text: '🔧', tooltip: 'In Development' },
    };
    const { variant, text, tooltip } = variants[status];
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className="text-xs px-1.5 py-0">
              {text}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-2">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No features match your search
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={Array.from(expandedCategories)}
            onValueChange={(value) => setExpandedCategories(new Set(value))}
            className="space-y-2"
          >
            {filteredCategories.map((category) => {
              const { allSelected, someSelected } = getCategorySelectionState(category.id);
              
              return (
                <AccordionItem
                  key={category.id}
                  value={category.id}
                  className="border rounded-lg bg-card/50"
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-3 text-left flex-1">
                      <span className="text-2xl">{category.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate">{category.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">{category.description}</p>
                      </div>
                      {someSelected && !allSelected && (
                        <Badge variant="secondary" className="text-xs">
                          {category.files.filter((f) => selectedFileIds.has(f.path)).length}/{category.files.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-3 space-y-2">
                    <div className="flex justify-end mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAllInCategory(category.id)}
                        className="h-7 text-xs"
                      >
                        {allSelected ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Deselect All
                          </>
                        ) : (
                          'Select All'
                        )}
                      </Button>
                    </div>
                    
                    {category.files.map((file) => {
                      const isSelected = selectedFileIds.has(file.path);
                      
                      return (
                        <div
                          key={file.path}
                          className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={file.path}
                            checked={isSelected}
                            onCheckedChange={() => onToggleFile(file.path)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <label
                                    htmlFor={file.path}
                                    className="text-xs font-mono cursor-pointer block truncate"
                                  >
                                    {file.path.split('/').pop()}
                                  </label>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-md">
                                  <p className="font-mono text-xs mb-1">{file.path}</p>
                                  <p className="text-xs text-muted-foreground">{file.purpose}</p>
                                  {file.lines && (
                                    <p className="text-xs text-muted-foreground mt-1">Lines: {file.lines}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {file.purpose}
                            </p>
                          </div>
                          {getStatusBadge(file.status)}
                        </div>
                      );
                    })}

                    {/* Additional context info */}
                    <div className="mt-3 pt-3 border-t space-y-2">
                      {category.database && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Database:</p>
                          <div className="flex flex-wrap gap-1">
                            {category.database.map((table) => (
                              <Badge key={table} variant="outline" className="text-xs font-mono">
                                {table}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {category.edgeFunctions && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Edge Functions:</p>
                          <div className="flex flex-wrap gap-1">
                            {category.edgeFunctions.map((fn) => (
                              <Badge key={fn} variant="secondary" className="text-xs font-mono">
                                ⚡ {fn}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </ScrollArea>
  );
};
