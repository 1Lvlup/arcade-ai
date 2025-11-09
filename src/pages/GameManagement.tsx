import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SharedHeader } from '@/components/SharedHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Trash2, Edit2, Check, X, CheckSquare, Square } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Game {
  id: string;
  game_name: string;
  manufacturer: string | null;
  version_model_year: string | null;
  fec_location_name: string | null;
  input_by: string | null;
  created_at: string;
}

export default function GameManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editedGame, setEditedGame] = useState<Partial<Game>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [gamesToDelete, setGamesToDelete] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadGames();
    }
  }, [user]);

  useEffect(() => {
    // Filter games based on search query
    if (searchQuery.trim() === '') {
      setFilteredGames(games);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredGames(
        games.filter(
          (game) =>
            game.game_name.toLowerCase().includes(query) ||
            game.manufacturer?.toLowerCase().includes(query) ||
            game.version_model_year?.toLowerCase().includes(query) ||
            game.fec_location_name?.toLowerCase().includes(query) ||
            game.input_by?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, games]);

  const loadGames = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      console.log('Fetching games for user:', user.id);
      const { data, error } = await supabase
        .from('game_submissions')
        .select('id, game_name, manufacturer, version_model_year, fec_location_name, input_by, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Successfully loaded games:', data?.length || 0);
      console.log('Games data:', data);
      setGames(data || []);
      setFilteredGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
      toast({
        title: 'Error',
        description: 'Failed to load games.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedGames.size === filteredGames.length) {
      setSelectedGames(new Set());
    } else {
      setSelectedGames(new Set(filteredGames.map((g) => g.id)));
    }
  };

  const toggleSelectGame = (gameId: string) => {
    const newSelected = new Set(selectedGames);
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId);
    } else {
      newSelected.add(gameId);
    }
    setSelectedGames(newSelected);
  };

  const startEditing = (game: Game) => {
    setEditingGameId(game.id);
    setEditedGame({ ...game });
  };

  const cancelEditing = () => {
    setEditingGameId(null);
    setEditedGame({});
  };

  const saveGame = async () => {
    if (!editedGame.game_name?.trim()) {
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
        .update({
          game_name: editedGame.game_name,
          manufacturer: editedGame.manufacturer,
          version_model_year: editedGame.version_model_year,
          fec_location_name: editedGame.fec_location_name,
          input_by: editedGame.input_by,
        })
        .eq('id', editingGameId!);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Game updated successfully.',
      });

      await loadGames();
      cancelEditing();
    } catch (error) {
      console.error('Error updating game:', error);
      toast({
        title: 'Error',
        description: 'Failed to update game.',
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = (gameIds: string[]) => {
    setGamesToDelete(gameIds);
    setDeleteDialogOpen(true);
  };

  const deleteGames = async () => {
    try {
      const { error } = await supabase
        .from('game_submissions')
        .delete()
        .in('id', gamesToDelete);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${gamesToDelete.length} game${gamesToDelete.length > 1 ? 's' : ''} deleted successfully.`,
      });

      setSelectedGames(new Set());
      await loadGames();
    } catch (error) {
      console.error('Error deleting games:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete games.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setGamesToDelete([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedGames.size === 0) return;
    confirmDelete(Array.from(selectedGames));
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Game Management" showBackButton backTo="/" />

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="text-2xl font-tech">Manage Games</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search games..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            {selectedGames.size > 0 && (
              <div className="flex items-center gap-2 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedGames.size} selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-4">Loading games...</p>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery ? 'No games match your search.' : 'No games found.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedGames.size === filteredGames.length && filteredGames.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Game Name</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Version/Model</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Added By</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGames.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedGames.has(game.id)}
                            onCheckedChange={() => toggleSelectGame(game.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {editingGameId === game.id ? (
                            <Input
                              value={editedGame.game_name || ''}
                              onChange={(e) =>
                                setEditedGame({ ...editedGame, game_name: e.target.value })
                              }
                              className="h-8"
                            />
                          ) : (
                            <span className="font-medium">{game.game_name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingGameId === game.id ? (
                            <Input
                              value={editedGame.manufacturer || ''}
                              onChange={(e) =>
                                setEditedGame({ ...editedGame, manufacturer: e.target.value })
                              }
                              className="h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">{game.manufacturer || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingGameId === game.id ? (
                            <Input
                              value={editedGame.version_model_year || ''}
                              onChange={(e) =>
                                setEditedGame({ ...editedGame, version_model_year: e.target.value })
                              }
                              className="h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">{game.version_model_year || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingGameId === game.id ? (
                            <Input
                              value={editedGame.fec_location_name || ''}
                              onChange={(e) =>
                                setEditedGame({ ...editedGame, fec_location_name: e.target.value })
                              }
                              className="h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">{game.fec_location_name || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingGameId === game.id ? (
                            <Input
                              value={editedGame.input_by || ''}
                              onChange={(e) =>
                                setEditedGame({ ...editedGame, input_by: e.target.value })
                              }
                              className="h-8"
                            />
                          ) : (
                            <span className="text-muted-foreground">{game.input_by || '—'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingGameId === game.id ? (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={saveGame}
                                className="h-8 w-8 text-green-500 hover:text-green-400"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={cancelEditing}
                                className="h-8 w-8"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startEditing(game)}
                                className="h-8 w-8"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => confirmDelete([game.id])}
                                className="h-8 w-8 text-destructive/70 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {gamesToDelete.length} game{gamesToDelete.length > 1 ? 's' : ''}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGamesToDelete([])}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteGames} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
