import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { SharedHeader } from "@/components/SharedHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock, Wrench } from "lucide-react";

const DownGamesDashboard = () => {
    const [games, setGames] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [formData, setFormData] = React.useState({
        name: "",
        location_zone: "",
        status: "New",
        down_since: new Date().toISOString().split('T')[0],
        last_update_note: "",
    });

    const fetchGames = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('down_games')
                .select('*')
                .order('down_since', { ascending: true });

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
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('down_games')
                .insert([{
                    ...formData,
                    last_update: new Date().toISOString(),
                }]);

            if (error) throw error;

            // Reset form and refresh list
            setFormData({
                name: "",
                location_zone: "",
                status: "New",
                down_since: new Date().toISOString().split('T')[0],
                last_update_note: "",
            });
            fetchGames();
        } catch (error) {
            console.error('Error adding game:', error);
            alert('Failed to add game. Please try again.');
        }
    };

    const gamesDownCount = games.length;

    const getDaysDown = (dateString: string) => {
        if (!dateString) return 0;
        const downDate = new Date(dateString);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - downDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(1, diffDays);
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

    return (
        <div className="min-h-screen bg-background">
            <SharedHeader />

            <main className="container mx-auto px-4 py-8 space-y-8">
                {/* Add Game Form */}
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xl font-bold">Add Down Game</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-end">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-medium">Game Name</label>
                                <input
                                    id="name"
                                    name="name"
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="location_zone" className="text-sm font-medium">Area on Floor</label>
                                <input
                                    id="location_zone"
                                    name="location_zone"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.location_zone}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="status" className="text-sm font-medium">Status</label>
                                <select
                                    id="status"
                                    name="status"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                >
                                    <option value="New">New</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Waiting on Parts">Waiting on Parts</option>
                                    <option value="Testing">Testing</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="down_since" className="text-sm font-medium">Down Since</label>
                                <input
                                    type="date"
                                    id="down_since"
                                    name="down_since"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.down_since}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2 lg:col-span-1">
                                <label htmlFor="last_update_note" className="text-sm font-medium">Notes</label>
                                <input
                                    id="last_update_note"
                                    name="last_update_note"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.last_update_note}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="md:col-span-2 lg:col-span-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full md:w-auto"
                                >
                                    Add Game
                                </button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Summary Card */}
                <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <Wrench className="h-6 w-6 text-orange" />
                            GM Dashboard: Down Games
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-foreground">
                            Games currently down: <span className="text-orange">{loading ? "..." : gamesDownCount}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Overview of all machines currently out of order.
                        </p>
                    </CardContent>
                </Card>

                {/* Games List */}
                <Card className="bg-card border-border">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading...</div>
                        ) : gamesDownCount === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                                <h3 className="text-xl font-semibold text-foreground">All Systems Go!</h3>
                                <p className="text-muted-foreground">All games are currently up. No downtime to report.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-b border-border/50">
                                            <TableHead className="w-[200px]">Game</TableHead>
                                            <TableHead>Area</TableHead>
                                            <TableHead>Days Down</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Last Update</TableHead>
                                            <TableHead className="text-right">Note</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {games.map((game) => {
                                            const daysDown = getDaysDown(game.down_since);
                                            const isLongDowntime = daysDown > 3;

                                            return (
                                                <TableRow key={game.id} className="hover:bg-muted/50 border-b border-border/50">
                                                    <TableCell className="font-medium text-foreground">
                                                        {game.name}
                                                    </TableCell>
                                                    <TableCell>{game.location_zone}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <span>{daysDown} days</span>
                                                            {isLongDowntime && (
                                                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                                                    Over 3 days
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={getStatusColor(game.status)} variant="outline">
                                                            {game.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            <span className="text-sm">{new Date(game.last_update).toLocaleDateString()}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right max-w-[250px] truncate" title={game.last_update_note}>
                                                        {game.last_update_note}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default DownGamesDashboard;
