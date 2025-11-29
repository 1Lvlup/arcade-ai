import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { systemArchitectureCategories, FeatureCategory, FileReference } from '@/data/systemArchitectureCategories';

export interface IndexedFileReference extends FileReference {
  id: string;
  file_content: string;
}

export interface ValidatedFeatureCategory extends Omit<FeatureCategory, 'files'> {
  files: IndexedFileReference[];
}

export function useValidatedArchitectureCategories() {
  const [categories, setCategories] = useState<ValidatedFeatureCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadValidatedCategories();
  }, []);

  const loadValidatedCategories = async () => {
    setIsLoading(true);
    
    // Fetch all files from indexed_codebase with their content
    const { data: indexedFiles, error } = await supabase
      .from('indexed_codebase')
      .select('id, file_path, file_content');

    if (error) {
      console.error('Error fetching indexed files:', error);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    // Create a map of file paths to their full data
    const fileMap = new Map(indexedFiles?.map(f => [f.file_path, f]) || []);

    // Only include files that actually exist in indexed_codebase
    const validated = systemArchitectureCategories.map(category => ({
      ...category,
      files: category.files
        .filter(file => fileMap.has(file.path))
        .map(file => {
          const indexed = fileMap.get(file.path)!;
          return {
            ...file,
            id: indexed.id,
            file_content: indexed.file_content
          };
        })
    })).filter(category => category.files.length > 0); // Remove categories with no files

    setCategories(validated);
    setIsLoading(false);
  };

  return { categories, isLoading };
}
