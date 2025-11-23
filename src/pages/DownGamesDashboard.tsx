import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { SharedHeader } from "@/components/SharedHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock, Wrench, Pencil, Trash2, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const DownGamesDashboard = () => {
  const [games, setGames] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editingGame, setEditingGame] = React.useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    status: "New",
    down_since: new Date().toISOString().split('T')[0],
    last_update_note: "",
    parts_changed: "",
    things_tried: ""
  });
  const fetchGames = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('down_games').select('*').order('completed_at', {
        ascending: false,
        nullsFirst: false
      }).order('down_since', {
        ascending: true
      });
      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => {
    fetchGames();
  }, []);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const {
      name,
      value
    } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        error
      } = await supabase.from('down_games').insert([{
        ...formData,
        last_update: new Date().toISOString()
      }]);
      if (error) throw error;

      // Reset form and refresh list
      setFormData({
        name: "",
        status: "New",
        down_since: new Date().toISOString().split('T')[0],
        last_update_note: "",
        parts_changed: "",
        things_tried: ""
      });
      setIsAddDialogOpen(false);
      fetchGames();
    } catch (error) {
      console.error('Error adding game:', error);
      alert('Failed to add game. Please try again.');
    }
  };
  const activeGames = games.filter(g => !g.completed_at);
  const completedGames = games.filter(g => g.completed_at);
  const gamesDownCount = activeGames.length;
  const getDaysDown = (dateString: string) => {
    if (!dateString) return 0;
    const downDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - downDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  };
  const handleEdit = (game: any) => {
    setEditingGame(game);
    setIsEditDialogOpen(true);
  };
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        error
      } = await supabase.from('down_games').update({
        name: editingGame.name,
        status: editingGame.status,
        down_since: editingGame.down_since,
        last_update_note: editingGame.last_update_note,
        parts_changed: editingGame.parts_changed,
        things_tried: editingGame.things_tried,
        last_update: new Date().toISOString()
      }).eq('id', editingGame.id);
      if (error) throw error;
      setIsEditDialogOpen(false);
      setEditingGame(null);
      fetchGames();
    } catch (error) {
      console.error('Error updating game:', error);
      alert('Failed to update game. Please try again.');
    }
  };
  const handleComplete = async (id: string) => {
    if (!confirm('Mark this game as completed? This will archive it with all its history.')) return;
    try {
      const {
        error
      } = await supabase.from('down_games').update({
        completed_at: new Date().toISOString(),
        status: 'Completed',
        last_update: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      fetchGames();
    } catch (error) {
      console.error('Error completing game:', error);
      alert('Failed to complete game. Please try again.');
    }
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;
    try {
      const {
        error
      } = await supabase.from('down_games').delete().eq('id', id);
      if (error) throw error;
      fetchGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game. Please try again.');
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case "New":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "In Progress":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "Waiting on Parts":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "Testing":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };
  return <div className="min-h-screen bg-background">
            <SharedHeader />

            <main className="container mx-auto px-4 py-8 space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Down Games Dashboard</h1>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Down Game
                    </Button>
                </div>

                {/* Summary Card */}
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Wrench className="h-5 w-5 text-orange" />
                            Dashboard: Down Games
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3">
                        <div className="text-xl font-bold text-foreground">
                            Games currently down: <span className="text-orange">{loading ? "..." : gamesDownCount}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Overview of all machines currently out of order.
                        </p>
                    </CardContent>
                </Card>

                {/* Games List */}
                <Card className="bg-card border-border">
                    <CardContent className="p-0">
                        {loading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : <div className="space-y-8">
                                {/* Active Games */}
                                {activeGames.length > 0 && <div>
                                        <h3 className="text-lg mb-4 text-center mx-0 px-0 py-0 text-orange-light font-extrabold bg-stone-950">Active Issues </h3>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent border-b border-border/50">
                                                        <TableHead className="w-[200px]">Game</TableHead>
                                                        <TableHead>Days Down</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>Parts Changed</TableHead>
                                                        <TableHead>Things Tried</TableHead>
                                                        <TableHead>Note</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {activeGames.map(game => {
                      const daysDown = getDaysDown(game.down_since);
                      const isLongDowntime = daysDown > 3;
                      return <TableRow key={game.id} className="hover:bg-muted/50 border-b border-border/50">
                                                                <TableCell className="font-medium text-foreground">
                                                                    {game.name}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{daysDown} days</span>
                                                                        {isLongDowntime && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                                                                Over 3 days
                                                                            </Badge>}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge className={getStatusColor(game.status)} variant="outline">
                                                                        {game.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="max-w-[150px] truncate" title={game.parts_changed}>
                                                                    {game.parts_changed || '-'}
                                                                </TableCell>
                                                                <TableCell className="max-w-[150px] truncate" title={game.things_tried}>
                                                                    {game.things_tried || '-'}
                                                                </TableCell>
                                                                <TableCell className="max-w-[150px] truncate" title={game.last_update_note}>
                                                                    {game.last_update_note || '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button variant="ghost" size="sm" onClick={() => handleComplete(game.id)} title="Mark as completed">
                                                                            <Check className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(game)}>
                                                                            <Pencil className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(game.id)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>;
                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>}

                                {/* Completed Games */}
                                {completedGames.length > 0 && <div>
                                        <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Completed Issues (History)</h3>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent border-b border-border/50">
                                                        <TableHead className="w-[200px]">Game</TableHead>
                                                        <TableHead>Down Duration</TableHead>
                                                        <TableHead>Completed</TableHead>
                                                        <TableHead>Parts Changed</TableHead>
                                                        <TableHead>Things Tried</TableHead>
                                                        <TableHead>Note</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {completedGames.map(game => {
                      const daysDown = getDaysDown(game.down_since);
                      return <TableRow key={game.id} className="hover:bg-muted/50 border-b border-border/50 opacity-70">
                                                                <TableCell className="font-medium text-foreground">
                                                                    {game.name}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {daysDown} days
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                                                        <Clock className="h-3.5 w-3.5" />
                                                                        <span className="text-sm">{new Date(game.completed_at).toLocaleDateString()}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="max-w-[150px] truncate" title={game.parts_changed}>
                                                                    {game.parts_changed || '-'}
                                                                </TableCell>
                                                                <TableCell className="max-w-[150px] truncate" title={game.things_tried}>
                                                                    {game.things_tried || '-'}
                                                                </TableCell>
                                                                <TableCell className="max-w-[200px] truncate" title={game.last_update_note}>
                                                                    {game.last_update_note || '-'}
                                                                </TableCell>
                                                            </TableRow>;
                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>}

                                {activeGames.length === 0 && completedGames.length === 0 && <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                                        <h3 className="text-xl font-semibold text-foreground">All Systems Go!</h3>
                                        <p className="text-muted-foreground">All games are currently up. No downtime to report.</p>
                                    </div>}
                            </div>}
                    </CardContent>
                </Card>

                {/* Add Game Dialog */}
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Down Game</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="add-name" className="text-sm font-medium">Game Name</label>
                                <input id="add-name" name="name" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={formData.name} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="add-status" className="text-sm font-medium">Status</label>
                                <select id="add-status" name="status" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={formData.status} onChange={handleInputChange}>
                                    <option value="New">New</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Waiting on Parts">Waiting on Parts</option>
                                    <option value="Testing">Testing</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="add-down_since" className="text-sm font-medium">Down Since</label>
                                <input type="date" id="add-down_since" name="down_since" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={formData.down_since} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="add-parts_changed" className="text-sm font-medium">Parts Changed</label>
                                <textarea id="add-parts_changed" name="parts_changed" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={formData.parts_changed} onChange={handleInputChange} placeholder="e.g., Control board, power supply..." />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="add-things_tried" className="text-sm font-medium">Things Tried</label>
                                <textarea id="add-things_tried" name="things_tried" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={formData.things_tried} onChange={handleInputChange} placeholder="e.g., Reset, checked connections, tested voltage..." />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="add-last_update_note" className="text-sm font-medium">Notes</label>
                                <textarea id="add-last_update_note" name="last_update_note" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={formData.last_update_note} onChange={handleInputChange} />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Add Game</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Down Game</DialogTitle>
                        </DialogHeader>
                        {editingGame && <form onSubmit={handleUpdate} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="edit-name" className="text-sm font-medium">Game Name</label>
                                    <input id="edit-name" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingGame.name} onChange={e => setEditingGame({
                ...editingGame,
                name: e.target.value
              })} />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="edit-status" className="text-sm font-medium">Status</label>
                                    <select id="edit-status" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingGame.status} onChange={e => setEditingGame({
                ...editingGame,
                status: e.target.value
              })}>
                                        <option value="New">New</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Waiting on Parts">Waiting on Parts</option>
                                        <option value="Testing">Testing</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="edit-down-since" className="text-sm font-medium">Down Since</label>
                                    <input type="date" id="edit-down-since" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editingGame.down_since} onChange={e => setEditingGame({
                ...editingGame,
                down_since: e.target.value
              })} />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="edit-parts_changed" className="text-sm font-medium">Parts Changed</label>
                                    <textarea id="edit-parts_changed" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={editingGame.parts_changed || ''} onChange={e => setEditingGame({
                ...editingGame,
                parts_changed: e.target.value
              })} placeholder="e.g., Control board, power supply..." />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="edit-things_tried" className="text-sm font-medium">Things Tried</label>
                                    <textarea id="edit-things_tried" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={editingGame.things_tried || ''} onChange={e => setEditingGame({
                ...editingGame,
                things_tried: e.target.value
              })} placeholder="e.g., Reset, checked connections, tested voltage..." />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="edit-note" className="text-sm font-medium">Notes</label>
                                    <textarea id="edit-note" rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" value={editingGame.last_update_note || ''} onChange={e => setEditingGame({
                ...editingGame,
                last_update_note: e.target.value
              })} />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit">
                                        Save Changes
                                    </Button>
                                </div>
                            </form>}
                    </DialogContent>
                </Dialog>
            </main>
        </div>;
};
export default DownGamesDashboard;