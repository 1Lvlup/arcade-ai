import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileReference } from '@/data/systemArchitectureCategories';
import { Check } from 'lucide-react';
import { useValidatedArchitectureCategories } from '@/hooks/useValidatedArchitectureCategories';

interface SystemArchitectureSelectorProps {
  selectedFileIds: Set<string>;
  onToggleFile: (fileId: string) => void;
  searchFilter: string;
}

export const SystemArchitectureSelector = ({
  selectedFileIds,
  onToggleFile,
  searchFilter,
}: SystemArchitectureSelectorProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const { categories, isLoading } = useValidatedArchitectureCategories();

  const filteredCategories = searchFilter
    ? categories.filter(
        (cat) =>
          cat.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
          cat.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
          cat.files.some((f) => f.path.toLowerCase().includes(searchFilter.toLowerCase()))
      )
    : categories;

  const handleSelectAllInCategory = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    const allSelected = category.files.every((f) => selectedFileIds.has(f.id));
    
    category.files.forEach((file) => {
      if (allSelected && selectedFileIds.has(file.id)) {
        onToggleFile(file.id);
      } else if (!allSelected && !selectedFileIds.has(file.id)) {
        onToggleFile(file.id);
      }
    });
  };

  const getCategorySelectionState = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return { allSelected: false, someSelected: false };

    const selectedCount = category.files.filter((f) => selectedFileIds.has(f.id)).length;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-muted-foreground">Loading categories...</div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No features match your search
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={Array.from(expandedCategories)}
            onValueChange={(value) => setExpandedCategories(new Set(value))}
            className="space-y-1"
          >
            {filteredCategories.map((category) => {
              const { allSelected, someSelected } = getCategorySelectionState(category.id);
              
              return (
                <AccordionItem
                  key={category.id}
                  value={category.id}
                  className="border rounded-lg bg-card/50"
                >
                  <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-2 text-left flex-1">
                      <span className="text-lg">{category.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold truncate">{category.title}</h3>
                        <p className="text-[10px] text-muted-foreground truncate">{category.description}</p>
                      </div>
                      {someSelected && !allSelected && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {category.files.filter((f) => selectedFileIds.has(f.path)).length}/{category.files.length}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-2 space-y-1">
                    <div className="flex justify-end mb-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectAllInCategory(category.id)}
                        className="h-6 text-[10px] px-2"
                      >
                        {allSelected ? (
                          <>
                            <Check className="h-2.5 w-2.5 mr-1" />
                            Deselect All
                          </>
                        ) : (
                          'Select All'
                        )}
                      </Button>
                    </div>
                    
                    {category.files.map((file) => {
                      const isSelected = selectedFileIds.has(file.id);
                      
                      return (
                        <div
                          key={file.id}
                          className="flex items-start gap-1.5 p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Checkbox
                            id={file.id}
                            checked={isSelected}
                            onCheckedChange={() => onToggleFile(file.id)}
                            className="mt-0.5 h-3.5 w-3.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <label
                                      htmlFor={file.id}
                                      className="text-[10px] font-mono cursor-pointer block truncate"
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
                              {getStatusBadge(file.status)}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {file.purpose}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Additional context info */}
                    {(category.database || category.edgeFunctions) && (
                      <div className="mt-2 pt-2 border-t space-y-1.5">
                        {category.database && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Database:</p>
                            <div className="flex flex-wrap gap-1">
                              {category.database.map((table) => (
                                <Badge key={table} variant="outline" className="text-[9px] font-mono h-4 px-1">
                                  {table}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {category.edgeFunctions && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Edge Functions:</p>
                            <div className="flex flex-wrap gap-1">
                              {category.edgeFunctions.map((fn) => (
                                <Badge key={fn} variant="secondary" className="text-[9px] font-mono h-4 px-1">
                                  ⚡ {fn}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
