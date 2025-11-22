import { 
  FileCode, FileText, FileJson, Image, Database, 
  Settings, Braces, FileType, Paintbrush, Globe,
  Package, Shield, Code2, Server
} from 'lucide-react';

interface EnhancedFileIconProps {
  filePath: string;
  language: string | null;
  className?: string;
}

export function EnhancedFileIcon({ filePath, language, className = "h-4 w-4" }: EnhancedFileIconProps) {
  const getIconForFile = () => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const fileName = filePath.split('/').pop()?.toLowerCase();
    
    // Config files
    if (fileName === 'package.json' || fileName === 'package-lock.json') {
      return <Package className={`${className} text-red-500`} />;
    }
    if (fileName === 'tsconfig.json' || fileName?.includes('config')) {
      return <Settings className={`${className} text-blue-500`} />;
    }
    if (fileName === '.env' || fileName?.startsWith('.env')) {
      return <Shield className={`${className} text-amber-500`} />;
    }
    
    // By extension
    switch (ext) {
      case 'tsx':
      case 'jsx':
        return <Code2 className={`${className} text-cyan-500`} />;
      case 'ts':
      case 'js':
        return <FileCode className={`${className} text-yellow-500`} />;
      case 'json':
        return <FileJson className={`${className} text-green-500`} />;
      case 'css':
      case 'scss':
      case 'sass':
        return <Paintbrush className={`${className} text-pink-500`} />;
      case 'html':
        return <Globe className={`${className} text-orange-500`} />;
      case 'svg':
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp':
        return <Image className={`${className} text-purple-500`} />;
      case 'sql':
        return <Database className={`${className} text-indigo-500`} />;
      case 'md':
      case 'mdx':
        return <FileText className={`${className} text-gray-500`} />;
      default:
        break;
    }
    
    // By path
    if (filePath.includes('supabase/functions')) {
      return <Server className={`${className} text-emerald-500`} />;
    }
    if (filePath.includes('migrations')) {
      return <Database className={`${className} text-indigo-500`} />;
    }
    if (filePath.includes('/components/')) {
      return <Braces className={`${className} text-cyan-500`} />;
    }
    
    // Default
    return <FileType className={className} />;
  };
  
  return getIconForFile();
}
