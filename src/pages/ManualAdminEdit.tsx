import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';

interface ManualFormData {
  manual_id: string;
  canonical_title: string;
  canonical_slug: string;
  aliases: string[];
  aliases_slugs: string[];
  manufacturer?: string;
  platform?: string;
  family?: string;
  model_number?: string;
  doc_type?: string;
  version?: string;
  language?: string;
  tags?: string[];
  notes?: string;
}

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const ManualAdminEdit = () => {
  const navigate = useNavigate();
  const { manualId } = useParams();
  const isNew = manualId === 'new';

  const [formData, setFormData] = useState<ManualFormData>({
    manual_id: '',
    canonical_title: '',
    canonical_slug: '',
    aliases: [],
    aliases_slugs: [],
    language: 'en',
    tags: []
  });

  const [aliasInput, setAliasInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isNew && manualId) {
      loadManual();
    }
  }, [manualId, isNew]);

  const loadManual = async () => {
    try {
      const { data, error } = await supabase
        .from('manual_metadata')
        .select('*')
        .eq('manual_id', manualId)
        .single();

      if (error) throw error;
      setFormData(data);
    } catch (error: any) {
      toast.error('Failed to load manual', {
        description: error.message
      });
    }
  };

  const handleTitleChange = (title: string) => {
    const slug = slugify(title);
    
    // Auto-generate common variations as aliases
    const variations = new Set<string>();
    if (title.trim()) {
      variations.add(title.trim()); // Exact title
      variations.add(title.toLowerCase()); // all lowercase
      variations.add(title.toUpperCase()); // ALL UPPERCASE
      variations.add(title.replace(/\s+/g, '')); // NoSpaces
      variations.add(title.replace(/\s+/g, '').toLowerCase()); // nospaces lowercase
      variations.add(slug); // slug-version
    }
    
    const aliasArray = Array.from(variations);
    const aliasSlugArray = aliasArray.map(a => slugify(a));
    
    setFormData(prev => ({
      ...prev,
      canonical_title: title,
      canonical_slug: slug,
      aliases: aliasArray,
      aliases_slugs: aliasSlugArray
    }));
  };

  const addAlias = () => {
    if (aliasInput.trim()) {
      const newAlias = aliasInput.trim();
      const newSlug = slugify(newAlias);
      setFormData(prev => ({
        ...prev,
        aliases: [...prev.aliases, newAlias],
        aliases_slugs: [...prev.aliases_slugs, newSlug]
      }));
      setAliasInput('');
    }
  };

  const removeAlias = (index: number) => {
    setFormData(prev => ({
      ...prev,
      aliases: prev.aliases.filter((_, i) => i !== index),
      aliases_slugs: prev.aliases_slugs.filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag) || []
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_upsert_manual_metadata', {
        p_metadata: formData as any
      });

      if (error) throw error;

      toast.success('Manual saved successfully');
      navigate('/manual-admin');
    } catch (error: any) {
      toast.error('Failed to save manual', {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen mesh-gradient">
      <SharedHeader title="Manual Editor" />
      
      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/manual-admin')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Button>
            <h1 className="text-4xl font-bold neon-text">
              {isNew ? 'Add New Manual' : 'Edit Manual'}
            </h1>
          </div>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Manual Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Manual ID */}
            <div className="space-y-2">
              <Label htmlFor="manual_id">Manual ID *</Label>
              <Input
                id="manual_id"
                value={formData.manual_id}
                onChange={(e) => setFormData(prev => ({ ...prev, manual_id: e.target.value }))}
                disabled={!isNew}
                placeholder="ice-ball"
              />
            </div>

            {/* Canonical Title */}
            <div className="space-y-2">
              <Label htmlFor="canonical_title">Canonical Title *</Label>
              <Input
                id="canonical_title"
                value={formData.canonical_title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ice Ball"
              />
            </div>

            {/* Canonical Slug (auto-generated) */}
            <div className="space-y-2">
              <Label htmlFor="canonical_slug">Canonical Slug (auto-generated)</Label>
              <Input
                id="canonical_slug"
                value={formData.canonical_slug}
                onChange={(e) => setFormData(prev => ({ ...prev, canonical_slug: e.target.value }))}
                placeholder="ice-ball"
              />
            </div>

            {/* Aliases */}
            <div className="space-y-2">
              <Label>Aliases</Label>
              <div className="flex gap-2">
                <Input
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addAlias()}
                  placeholder="Enter alias and press Enter"
                />
                <Button type="button" onClick={addAlias}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.aliases.map((alias, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {alias}
                    <button onClick={() => removeAlias(index)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Manufacturer, Platform, Family */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                  placeholder="BayTek"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Input
                  id="platform"
                  value={formData.platform || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                  placeholder="Redemption"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="family">Family</Label>
                <Input
                  id="family"
                  value={formData.family || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, family: e.target.value }))}
                  placeholder="IntraXion"
                />
              </div>
            </div>

            {/* Model Number, Doc Type, Version */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model_number">Model Number</Label>
                <Input
                  id="model_number"
                  value={formData.model_number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, model_number: e.target.value }))}
                  placeholder="IB-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc_type">Document Type</Label>
                <Input
                  id="doc_type"
                  value={formData.doc_type || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, doc_type: e.target.value }))}
                  placeholder="service manual"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="v1.0"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  placeholder="Enter tag and press Enter"
                />
                <Button type="button" onClick={addTag}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about this manual..."
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => navigate('/manual-admin')}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Saving...' : 'Save Manual'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ManualAdminEdit;