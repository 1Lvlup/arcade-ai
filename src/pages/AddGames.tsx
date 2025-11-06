import { useState, useEffect } from 'react';
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
import { Upload, Plus, Trash2, Edit2, Check, X, List, CheckCircle } from 'lucide-react';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const gameSchema = z.object({
  game_name: z.string().min(1, 'Game name is required').max(200),
  manufacturer: z.string().max(200).optional(),
  version_model_year: z.string().max(100).optional(),
  fec_location_name: z.string().max(200).optional(),
  input_by: z.string().max(100).optional(),
});

type GameFormData = z.infer<typeof gameSchema>;

interface SubmittedGame {
  id: string;
  game_name: string;
  manufacturer: string | null;
  version_model_year: string | null;
  fec_location_name: string | null;
  input_by: string | null;
  created_at: string;
}

export default function AddGames() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [games, setGames] = useState<GameFormData[]>([{
    game_name: '',
    manufacturer: '',
    version_model_year: '',
    fec_location_name: '',
    input_by: '',
  }]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [submittedGames, setSubmittedGames] = useState<SubmittedGame[]>([]);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editedGameName, setEditedGameName] = useState('');
  const [isLoadingGames, setIsLoadingGames] = useState(false);

  useEffect(() => {
    if (user) {
      loadSubmittedGames();
    }
  }, [user]);

  const loadSubmittedGames = async () => {
    if (!user) return;
    
    setIsLoadingGames(true);
    try {
      const { data, error } = await supabase
        .from('game_submissions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmittedGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your submitted games.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingGames(false);
    }
  };

  const startEditing = (game: SubmittedGame) => {
    setEditingGameId(game.id);
    setEditedGameName(game.game_name);
  };

  const cancelEditing = () => {
    setEditingGameId(null);
    setEditedGameName('');
  };

  const saveGameName = async (gameId: string) => {
    if (!editedGameName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Game name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('game_submissions')
        .update({ game_name: editedGameName.trim() })
        .eq('id', gameId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Game name updated successfully.',
      });

      // Refresh the list
      await loadSubmittedGames();
      cancelEditing();
    } catch (error) {
      console.error('Error updating game name:', error);
      toast({
        title: 'Error',
        description: 'Failed to update game name.',
        variant: 'destructive',
      });
    }
  };

  const deleteGame = async (gameId: string, gameName: string) => {
    if (!confirm(`Are you sure you want to delete "${gameName}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('game_submissions')
        .delete()
        .eq('id', gameId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Game deleted successfully.',
      });

      await loadSubmittedGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete game.',
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGames(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [name]: value };
      return updated;
    });
  };

  const addGame = () => {
    setGames(prev => [...prev, {
      game_name: '',
      manufacturer: '',
      version_model_year: '',
      fec_location_name: '',
      input_by: '',
    }]);
  };

  const removeGame = (index: number) => {
    if (games.length > 1) {
      setGames(prev => prev.filter((_, i) => i !== index));
    }
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
      
      // Validate all games
      const validGames = games.filter(game => game.game_name.trim() !== '');
      
      if (validGames.length === 0) {
        toast({
          title: 'No Games to Submit',
          description: 'Please enter at least one game name.',
          variant: 'destructive',
        });
        return;
      }

      // Validate each game
      const validatedGames = validGames.map(game => gameSchema.parse(game));

      // Get user's tenant ID from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('fec_tenant_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        throw new Error('User profile not found');
      }

      // Insert game submissions
      const { error } = await supabase
        .from('game_submissions')
        .insert(validatedGames.map(game => ({
          game_name: game.game_name,
          manufacturer: game.manufacturer || null,
          version_model_year: game.version_model_year || null,
          fec_location_name: game.fec_location_name || null,
          input_by: game.input_by || null,
          user_id: user.id,
          fec_tenant_id: profile.fec_tenant_id,
        })));

      if (error) throw error;

      toast({
        title: 'Success!',
        description: `${validatedGames.length} game${validatedGames.length > 1 ? 's' : ''} submitted successfully.`,
      });

      // Reset form
      setGames([{
        game_name: '',
        manufacturer: '',
        version_model_year: '',
        fec_location_name: '',
        input_by: '',
      }]);
      
      // Reload submitted games
      await loadSubmittedGames();
    } catch (error) {
      console.error('Error submitting games:', error);
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validation Error',
          description: error.errors[0].message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to submit games. Please try again.',
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
      
      // Reload submitted games
      await loadSubmittedGames();
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
    <div className="min-h-screen bg-black flex flex-col">
      <SharedHeader title="Add These Games" showBackButton backTo="/" />
      
      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Games List */}
        <aside className="hidden lg:block w-80 border-r border-white/10 bg-gradient-to-b from-black via-black/95 to-black overflow-y-auto">
          <div className="p-6 border-b border-white/10">
            <h2 className="font-tech text-lg font-bold text-white flex items-center gap-2">
              <List className="h-5 w-5 text-orange" />
              MY GAMES
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {submittedGames.length} game{submittedGames.length !== 1 ? 's' : ''} submitted
            </p>
          </div>
          
          <div className="p-4">
            {isLoadingGames ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Loading...
              </div>
            ) : submittedGames.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No games yet
              </div>
            ) : (
              <div className="space-y-2">
                {submittedGames.map((game) => (
                  <div 
                    key={game.id} 
                    className="group p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange/30 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {editingGameId === game.id ? (
                          <div className="flex gap-1">
                            <Input
                              value={editedGameName}
                              onChange={(e) => setEditedGameName(e.target.value)}
                              className="h-7 text-sm bg-black/50 border-orange/30"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => saveGameName(game.id)}
                              className="h-7 w-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={cancelEditing}
                              className="h-7 w-7 hover:bg-white/10"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 mb-1">
                              <h3 className="font-medium text-sm text-white truncate">{game.game_name}</h3>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startEditing(game)}
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                            {game.manufacturer && (
                              <p className="text-xs text-muted-foreground truncate">{game.manufacturer}</p>
                            )}
                          </>
                        )}
                      </div>
                      
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteGame(game.id, game.game_name)}
                        className="h-6 w-6 text-destructive/70 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
            {/* Header Section */}
            <div className="mb-8">
              <h1 className="text-3xl sm:text-4xl font-tech font-bold mb-3">
                <span className="text-white">SUBMIT</span> <span className="text-orange">GAMES</span>
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Help us build the ultimate arcade game database
              </p>
            </div>

            {/* Tabs for Single Entry / Upload CSV */}
            <Tabs defaultValue="form" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-auto bg-white/5 border border-white/10">
                <TabsTrigger 
                  value="form" 
                  className="py-3 text-sm data-[state=active]:bg-orange/20 data-[state=active]:text-orange"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Single Entry
                </TabsTrigger>
                <TabsTrigger 
                  value="upload" 
                  className="py-3 text-sm data-[state=active]:bg-orange/20 data-[state=active]:text-orange"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload CSV
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="form" className="space-y-6 mt-6">
                <form onSubmit={handleSubmitSingle} className="space-y-6">
                  {games.map((game, index) => (
                    <div 
                      key={index} 
                      className="space-y-4 p-6 rounded-lg bg-white/5 border border-white/10 relative group hover:border-orange/30 transition-all duration-300"
                    >
                      {games.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeGame(index)}
                          className="absolute top-3 right-3 text-destructive/70 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {games.length > 1 && (
                        <h3 className="font-tech text-sm text-orange">
                          GAME {index + 1}
                        </h3>
                      )}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor={`game_name_${index}`} className="text-white">
                            Game Name <span className="text-orange">*</span>
                          </Label>
                          <Input
                            id={`game_name_${index}`}
                            name="game_name"
                            value={game.game_name}
                            onChange={(e) => handleInputChange(index, e)}
                            placeholder="e.g., Pac-Man"
                            className="bg-black/50 border-white/20 focus:border-orange"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`manufacturer_${index}`} className="text-white">Manufacturer</Label>
                          <Input
                            id={`manufacturer_${index}`}
                            name="manufacturer"
                            value={game.manufacturer}
                            onChange={(e) => handleInputChange(index, e)}
                            placeholder="e.g., Namco"
                            className="bg-black/50 border-white/20 focus:border-primary"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`version_model_year_${index}`} className="text-white">Version / Model / Year</Label>
                          <Input
                            id={`version_model_year_${index}`}
                            name="version_model_year"
                            value={game.version_model_year}
                            onChange={(e) => handleInputChange(index, e)}
                            placeholder="e.g., 2023 Deluxe Edition"
                            className="bg-black/50 border-white/20 focus:border-primary"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`fec_location_name_${index}`} className="text-white">FEC Location / Name</Label>
                          <Input
                            id={`fec_location_name_${index}`}
                            name="fec_location_name"
                            value={game.fec_location_name}
                            onChange={(e) => handleInputChange(index, e)}
                            placeholder="e.g., Main Street Arcade"
                            className="bg-black/50 border-white/20 focus:border-primary"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`input_by_${index}`} className="text-white">Input By (Your Name)</Label>
                          <Input
                            id={`input_by_${index}`}
                            name="input_by"
                            value={game.input_by}
                            onChange={(e) => handleInputChange(index, e)}
                            placeholder="e.g., John Smith"
                            className="bg-black/50 border-white/20 focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addGame}
                      className="flex-1 border-white/20 text-foreground hover:bg-white/5"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Game
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="flex-1 bg-orange hover:bg-orange/80 text-white font-tech"
                    >
                      {isSubmitting ? 'SUBMITTING...' : `SUBMIT ${games.length > 1 ? `${games.length} GAMES` : 'GAME'}`}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="upload" className="space-y-6 mt-6">
                <div className="space-y-6">
                  <div className="p-6 rounded-lg bg-white/5 border border-white/10 space-y-3">
                    <h3 className="font-tech text-white font-semibold">CSV FORMAT REQUIREMENTS</h3>
                    <ul className="text-sm text-muted-foreground space-y-2 list-none">
                      <li className="flex items-start gap-2">
                        <span className="text-orange mt-0.5">•</span>
                        <span><strong className="text-white">Game Name</strong> column is required</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange mt-0.5">•</span>
                        <span>Optional columns: Manufacturer, Version/Model/Year, FEC Location/Name, Input By</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange mt-0.5">•</span>
                        <span>First row should contain column headers</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange mt-0.5">•</span>
                        <span>Example: <code className="text-xs bg-black/50 px-2 py-1 rounded text-muted-foreground border border-white/20">Game Name,Manufacturer,Version</code></span>
                      </li>
                    </ul>
                  </div>

                  <form onSubmit={handleSubmitCSV} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="csv_file" className="text-white">Select CSV File</Label>
                      <Input
                        id="csv_file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="bg-black/50 border-white/20 file:bg-orange file:text-white file:border-0 file:rounded file:px-4 file:py-2 file:font-tech file:text-sm hover:file:bg-orange/80"
                      />
                      {csvFile && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Selected: {csvFile.name}
                        </p>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting || !csvFile} 
                      className="w-full bg-orange hover:bg-orange/80 text-white font-tech"
                    >
                      {isSubmitting ? 'PROCESSING...' : 'UPLOAD CSV'}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
