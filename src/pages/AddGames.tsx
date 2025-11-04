import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SharedHeader } from '@/components/SharedHeader';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Plus } from 'lucide-react';
import { z } from 'zod';

const gameSchema = z.object({
  game_name: z.string().min(1, 'Game name is required').max(200),
  manufacturer: z.string().max(200).optional(),
  version_model_year: z.string().max(100).optional(),
  fec_location_name: z.string().max(200).optional(),
  input_by: z.string().max(100).optional(),
});

type GameFormData = z.infer<typeof gameSchema>;

export default function AddGames() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<GameFormData>({
    game_name: '',
    manufacturer: '',
    version_model_year: '',
    fec_location_name: '',
    input_by: '',
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to submit games.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Validate form data
      const validatedData = gameSchema.parse(formData);

      // Get user's tenant ID from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Insert game submission
      const { error } = await supabase
        .from('game_submissions')
        .insert([{
          game_name: validatedData.game_name,
          manufacturer: validatedData.manufacturer || null,
          version_model_year: validatedData.version_model_year || null,
          fec_location_name: validatedData.fec_location_name || null,
          input_by: validatedData.input_by || null,
          user_id: user.id,
          fec_tenant_id: profile.fec_tenant_id,
        }]);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Game submitted successfully.',
      });

      // Reset form
      setFormData({
        game_name: '',
        manufacturer: '',
        version_model_year: '',
        fec_location_name: '',
        input_by: '',
      });
    } catch (error) {
      console.error('Error submitting game:', error);
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to submit game. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast({
        title: 'Invalid File',
        description: 'Please upload a CSV file.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to submit games.',
        variant: 'destructive',
      });
      return;
    }

    if (!csvFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Get user's tenant ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Read CSV file
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('CSV file must contain headers and at least one data row');
      }

      // Parse CSV (simple parsing - assumes no commas in values)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const gameNameIndex = headers.findIndex(h => h.includes('game') && h.includes('name'));
      
      if (gameNameIndex === -1) {
        throw new Error('CSV must contain a "Game Name" column');
      }

      const manufacturerIndex = headers.findIndex(h => h.includes('manufacturer'));
      const versionIndex = headers.findIndex(h => h.includes('version') || h.includes('model') || h.includes('year'));
      const locationIndex = headers.findIndex(h => h.includes('location') || h.includes('fec'));
      const inputByIndex = headers.findIndex(h => h.includes('input') && h.includes('by'));

      // Process rows
      const games: Array<{
        game_name: string;
        manufacturer: string | null;
        version_model_year: string | null;
        fec_location_name: string | null;
        input_by: string | null;
        user_id: string;
        fec_tenant_id: string;
      }> = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const gameName = values[gameNameIndex]?.trim();
        
        if (gameName) {
          games.push({
            game_name: gameName,
            manufacturer: manufacturerIndex >= 0 ? (values[manufacturerIndex] || null) : null,
            version_model_year: versionIndex >= 0 ? (values[versionIndex] || null) : null,
            fec_location_name: locationIndex >= 0 ? (values[locationIndex] || null) : null,
            input_by: inputByIndex >= 0 ? (values[inputByIndex] || null) : null,
            user_id: user.id,
            fec_tenant_id: profile.fec_tenant_id,
          });
        }
      }

      if (games.length === 0) {
        throw new Error('No valid games found in CSV file');
      }

      // Insert games
      const { error } = await supabase
        .from('game_submissions')
        .insert(games);

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `${games.length} game${games.length > 1 ? 's' : ''} submitted successfully.`,
      });

      setCsvFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error submitting CSV:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process CSV file.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen mesh-gradient flex flex-col">
      <SharedHeader title="Add These Games" showBackButton backTo="/" />
      
      <main className="container mx-auto px-4 py-8 flex-1">
        <Card className="max-w-4xl mx-auto premium-card">
          <CardHeader>
            <CardTitle className="text-2xl font-tech">Submit Game Information</CardTitle>
            <CardDescription>
              Help us build our game database by submitting arcade games. You can either fill out the form or upload a CSV file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="form" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="form">
                  <Plus className="h-4 w-4 mr-2" />
                  Single Entry
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="form" className="space-y-6 mt-6">
                <form onSubmit={handleSubmitSingle} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="game_name">
                      Game Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="game_name"
                      name="game_name"
                      value={formData.game_name}
                      onChange={handleInputChange}
                      placeholder="e.g., Pac-Man"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Manufacturer</Label>
                    <Input
                      id="manufacturer"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                      placeholder="e.g., Namco"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="version_model_year">Version / Model / Year</Label>
                    <Input
                      id="version_model_year"
                      name="version_model_year"
                      value={formData.version_model_year}
                      onChange={handleInputChange}
                      placeholder="e.g., 2023 Deluxe Edition"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fec_location_name">FEC Location / Name</Label>
                    <Input
                      id="fec_location_name"
                      name="fec_location_name"
                      value={formData.fec_location_name}
                      onChange={handleInputChange}
                      placeholder="e.g., Main Street Arcade"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="input_by">Input By (Your Name)</Label>
                    <Input
                      id="input_by"
                      name="input_by"
                      value={formData.input_by}
                      onChange={handleInputChange}
                      placeholder="e.g., John Smith"
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? 'Submitting...' : 'Submit Game'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="upload" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="p-4 glass-card rounded-lg space-y-2">
                    <h3 className="font-semibold">CSV Format Requirements:</h3>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li><strong>Game Name</strong> column is required</li>
                      <li>Optional columns: Manufacturer, Version/Model/Year, FEC Location/Name, Input By</li>
                      <li>First row should contain column headers</li>
                      <li>Example: <code className="text-xs bg-muted px-1 py-0.5 rounded">Game Name,Manufacturer,Version</code></li>
                    </ul>
                  </div>

                  <form onSubmit={handleSubmitCSV} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="csv_file">Select CSV File</Label>
                      <Input
                        id="csv_file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                      />
                      {csvFile && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {csvFile.name}
                        </p>
                      )}
                    </div>

                    <Button type="submit" disabled={isSubmitting || !csvFile} className="w-full">
                      {isSubmitting ? 'Processing...' : 'Upload CSV'}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
