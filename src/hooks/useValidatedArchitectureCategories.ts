import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { systemArchitectureCategories, FeatureCategory, FileReference } from '@/data/systemArchitectureCategories';

export interface ValidatedFileReference extends FileReference {
  exists: boolean;
}

export interface ValidatedFeatureCategory extends Omit<FeatureCategory, 'files'> {
  files: ValidatedFileReference[];
}

export function useValidatedArchitectureCategories() {
  const [categories, setCategories] = useState<ValidatedFeatureCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadValidatedCategories();
  }, []);

  const loadValidatedCategories = async () => {
    setIsLoading(true);
    
    // Fetch all file paths from indexed_codebase
    const { data: indexedFiles, error } = await supabase
      .from('indexed_codebase')
      .select('file_path');

    if (error) {
      console.error('Error fetching indexed files:', error);
      setCategories(systemArchitectureCategories as ValidatedFeatureCategory[]);
      setIsLoading(false);
      return;
    }

    const existingPaths = new Set(indexedFiles?.map(f => f.file_path) || []);

    // Add exists flag to each file
    const validated = systemArchitectureCategories.map(category => ({
      ...category,
      files: category.files.map(file => ({
        ...file,
        exists: existingPaths.has(file.path)
      }))
    }));

    setCategories(validated);
    setIsLoading(false);
  };

  return { categories, isLoading };
}
