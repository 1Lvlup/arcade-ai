import { useState } from 'react';
import { Folder, File, ChevronRight, ChevronDown, FileCode } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
  last_modified: string;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  file?: IndexedFile;
}

interface FileTreeViewProps {
  files: IndexedFile[];
  selectedFileIds: Set<string>;
  onToggleFile: (fileId: string) => void;
  onToggleFolder: (folderPath: string, select: boolean) => void;
  searchFilter: string;
}

export function FileTreeView({ files, selectedFileIds, onToggleFile, onToggleFolder, searchFilter }: FileTreeViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  // Build tree structure from flat file list
  const buildTree = (files: IndexedFile[]): FileNode => {
    const root: FileNode = { name: 'root', path: '', type: 'folder', children: [] };
    
    files.forEach(file => {
      const parts = file.file_path.split('/');
      let current = root;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const currentPath = parts.slice(0, i + 1).join('/');
        const isFile = i === parts.length - 1;
        
        if (!current.children) current.children = [];
        
        let existing = current.children.find(child => child.name === part);
        
        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            file: isFile ? file : undefined,
          };
          current.children.push(existing);
        }
        
        if (!isFile) {
          current = existing;
        }
      }
    });
    
    // Sort: folders first, then files alphabetically
    const sortChildren = (node: FileNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };
    sortChildren(root);
    
    return root;
  };

  // Filter tree based on search
  const filterTree = (node: FileNode, filter: string): FileNode | null => {
    if (filter === '') return node;
    
    const matchesFilter = node.path.toLowerCase().includes(filter.toLowerCase());
    
    if (node.type === 'file') {
      return matchesFilter ? node : null;
    }
    
    const filteredChildren = node.children
      ?.map(child => filterTree(child, filter))
      .filter((child): child is FileNode => child !== null);
    
    if (filteredChildren && filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    
    return matchesFilter ? node : null;
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getFolderFiles = (node: FileNode): IndexedFile[] => {
    const files: IndexedFile[] = [];
    
    const collectFiles = (n: FileNode) => {
      if (n.type === 'file' && n.file) {
        files.push(n.file);
      } else if (n.children) {
        n.children.forEach(collectFiles);
      }
    };
    
    collectFiles(node);
    return files;
  };

  const getFolderSelectedCount = (node: FileNode): { selected: number; total: number } => {
    const folderFiles = getFolderFiles(node);
    const selected = folderFiles.filter(f => selectedFileIds.has(f.id)).length;
    return { selected, total: folderFiles.length };
  };

  const handleFolderCheckboxClick = (node: FileNode) => {
    const folderFiles = getFolderFiles(node);
    const allSelected = folderFiles.every(f => selectedFileIds.has(f.id));
    onToggleFolder(node.path, !allSelected);
  };

  const getLanguageIcon = (language: string | null) => {
    if (!language) return <FileCode className="h-4 w-4 text-muted-foreground" />;
    return <FileCode className="h-4 w-4 text-muted-foreground" />;
  };

  const getFileSize = (content: string): string => {
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const renderNode = (node: FileNode, depth: number = 0): JSX.Element | null => {
    if (node.type === 'file' && node.file) {
      const isSelected = selectedFileIds.has(node.file.id);
      
      return (
        <div
          key={node.path}
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-sm cursor-pointer group"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => onToggleFile(node.file!.id)}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleFile(node.file!.id)}
            onClick={(e) => e.stopPropagation()}
          />
          {getLanguageIcon(node.file.language)}
          <span className="flex-1 text-sm truncate">{node.name}</span>
          <Badge variant="secondary" className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {getFileSize(node.file.file_content)}
          </Badge>
        </div>
      );
    }
    
    if (node.type === 'folder' && node.children) {
      const isExpanded = expandedFolders.has(node.path);
      const { selected, total } = getFolderSelectedCount(node);
      const isPartiallySelected = selected > 0 && selected < total;
      const isFullySelected = selected === total && total > 0;
      
      return (
        <div key={node.path}>
          <div
            className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-sm cursor-pointer group"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <div onClick={(e) => { e.stopPropagation(); handleFolderCheckboxClick(node); }}>
              <Checkbox
                checked={isFullySelected || isPartiallySelected}
                onCheckedChange={() => handleFolderCheckboxClick(node)}
              />
            </div>
            <div className="flex items-center gap-1 flex-1" onClick={() => toggleFolder(node.path)}>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Folder className="h-4 w-4 text-primary" />
              <span className="flex-1 text-sm font-medium">{node.name || 'Project'}</span>
              {total > 0 && (
                <Badge variant="outline" className="text-xs">
                  {selected}/{total}
                </Badge>
              )}
            </div>
          </div>
          {isExpanded && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  const tree = buildTree(files);
  const filteredTree = filterTree(tree, searchFilter);

  if (!filteredTree || (filteredTree.children?.length === 0)) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        {searchFilter ? 'No files match your search' : 'No files indexed yet'}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-280px)]">
      {filteredTree.children?.map(child => renderNode(child, 0))}
    </ScrollArea>
  );
}
