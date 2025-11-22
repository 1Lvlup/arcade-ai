import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, FolderOpen, Trash2, Edit2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConversationTemplate {
  id: string;
  name: string;
  description?: string;
  selectedFileIds: string[];
  fileCount: number;
  createdAt: string;
}

interface TemplateManagerProps {
  templates: ConversationTemplate[];
  selectedFileIds: Set<string>;
  onSaveTemplate: (name: string, description?: string) => void;
  onLoadTemplate: (template: ConversationTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onRenameTemplate: (templateId: string, newName: string, newDescription?: string) => void;
}

export const TemplateManager = ({
  templates,
  selectedFileIds,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
  onRenameTemplate,
}: TemplateManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ConversationTemplate | null>(null);
  
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleSave = () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    if (selectedFileIds.size === 0) {
      toast.error("Please select at least one file");
      return;
    }

    onSaveTemplate(newTemplateName.trim(), newTemplateDescription.trim() || undefined);
    setNewTemplateName("");
    setNewTemplateDescription("");
    setIsSaveDialogOpen(false);
    toast.success("Template saved successfully");
  };

  const handleLoad = (template: ConversationTemplate) => {
    onLoadTemplate(template);
    setIsOpen(false);
    toast.success(`Loaded template: ${template.name}`);
  };

  const handleDelete = (templateId: string) => {
    onDeleteTemplate(templateId);
    setDeleteConfirmId(null);
    toast.success("Template deleted");
  };

  const handleEdit = (template: ConversationTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || "");
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingTemplate || !editName.trim()) {
      toast.error("Please enter a template name");
      return;
    }

    onRenameTemplate(editingTemplate.id, editName.trim(), editDescription.trim() || undefined);
    setIsEditDialogOpen(false);
    setEditingTemplate(null);
    toast.success("Template updated");
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Templates
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conversation Templates</DialogTitle>
            <DialogDescription>
              Save and load file selections for common workflows
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              onClick={() => setIsSaveDialogOpen(true)}
              className="w-full gap-2"
              variant="default"
            >
              <Save className="h-4 w-4" />
              Save Current Selection as Template
            </Button>

            <div>
              <h4 className="text-sm font-medium mb-3">Your Templates ({templates.length})</h4>
              <ScrollArea className="h-[400px] pr-4">
                {templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No templates saved yet</p>
                    <p className="text-sm mt-1">Save your current file selection to create one</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium truncate">{template.name}</h5>
                            {template.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {template.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{template.fileCount} files</span>
                              <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(template)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLoad(template)}
                              className="h-8 px-3"
                            >
                              Load
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirmId(template.id)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Template</DialogTitle>
            <DialogDescription>
              Save your current file selection ({selectedFileIds.size} files) as a reusable template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                placeholder="e.g., Frontend Components"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="template-description">Description (optional)</Label>
              <Textarea
                id="template-description"
                placeholder="Describe what this template is for..."
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>
              Update template name and description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Template Name *</Label>
              <Input
                id="edit-name"
                placeholder="Template name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe what this template is for..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1.5 resize-none"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
