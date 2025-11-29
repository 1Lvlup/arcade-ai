import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronDown, File, Folder, Code, FileCode } from 'lucide-react';

interface IndexedFile {
  id: string;
  file_path: string;
  file_content: string;
  language: string | null;
}

interface SimplifiedFileTreeProps {
  files: IndexedFile[];
  selectedFileIds: Set<string>;
  onToggleFile: (fileId: string) => void;
  searchFilter: string;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  fileId?: string;
  language?: string | null;
}

export function SimplifiedFileTree({ files, selectedFileIds, onToggleFile, searchFilter }: SimplifiedFileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']));

  const fileTree = useMemo(() => {
    const root: TreeNode = { name: 'root', path: '', type: 'folder', children: [] };

    const filteredFiles = searchFilter
      ? files.filter(f => f.file_path.toLowerCase().includes(searchFilter.toLowerCase()))
      : files;

    filteredFiles.forEach(file => {
      const parts = file.file_path.split('/');
      let currentNode = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const path = parts.slice(0, index + 1).join('/');

        if (!currentNode.children) currentNode.children = [];

        let existingNode = currentNode.children.find(n => n.name === part);

        if (!existingNode) {
          existingNode = {
            name: part,
            path,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            fileId: isFile ? file.id : undefined,
            language: isFile ? file.language : undefined,
          };
          currentNode.children.push(existingNode);
        }

        currentNode = existingNode;
      });
    });

    const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    };

    const sortTree = (node: TreeNode) => {
      if (node.children) {
        node.children = sortNodes(node.children);
        node.children.forEach(sortTree);
      }
    };

    sortTree(root);
    return root;
  }, [files, searchFilter]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (language: string | null | undefined) => {
    if (!language) return <File className="h-4 w-4 text-muted-foreground" />;
    
    const langLower = language.toLowerCase();
    if (langLower.includes('typescript') || langLower.includes('javascript')) {
      return <Code className="h-4 w-4 text-blue-400" />;
    }
    if (langLower.includes('python')) {
      return <FileCode className="h-4 w-4 text-yellow-400" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    if (node.type === 'file' && node.fileId) {
      const isSelected = selectedFileIds.has(node.fileId);
      
      return (
        <div
          key={node.path}
          className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
            isSelected ? 'bg-muted' : ''
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => onToggleFile(node.fileId!)}
        >
          <Checkbox checked={isSelected} className="h-4 w-4" />
          {getFileIcon(node.language)}
          <span className="text-sm truncate flex-1">{node.name}</span>
          {node.language && (
            <Badge variant="outline" className="text-xs px-1 h-5">
              {node.language}
            </Badge>
          )}
        </div>
      );
    }

    if (node.type === 'folder' && node.children) {
      const isExpanded = expandedFolders.has(node.path);
      const selectedInFolder = node.children.filter(
        c => c.type === 'file' && c.fileId && selectedFileIds.has(c.fileId)
      ).length;

      return (
        <div key={node.path}>
          <div
            className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Folder className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium flex-1">{node.name}</span>
            {selectedInFolder > 0 && (
              <Badge variant="secondary" className="text-xs h-5">
                {selectedInFolder}
              </Badge>
            )}
          </div>
          {isExpanded && node.children.map(child => renderNode(child, depth + 1))}
        </div>
      );
    }

    return null;
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {fileTree.children?.map(node => renderNode(node, 0))}
      </div>
    </ScrollArea>
  );
}
