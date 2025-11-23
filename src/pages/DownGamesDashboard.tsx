import React from "react";
import { downGames } from "@/data/downGames";
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
    const gamesDownCount = downGames.length;

    const getDaysDown = (dateString: string) => {
        const downDate = new Date(dateString);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - downDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
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
                            Games currently down: <span className="text-orange">{gamesDownCount}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">
                            Overview of all machines currently out of order.
                        </p>
                    </CardContent>
                </Card>

                {/* Games List */}
                <Card className="bg-card border-border">
                    <CardContent className="p-0">
                        {gamesDownCount === 0 ? (
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
                                        {downGames.map((game) => {
                                            const daysDown = getDaysDown(game.downSince);
                                            const isLongDowntime = daysDown > 3;

                                            return (
                                                <TableRow key={game.id} className="hover:bg-muted/50 border-b border-border/50">
                                                    <TableCell className="font-medium text-foreground">
                                                        {game.name}
                                                    </TableCell>
                                                    <TableCell>{game.locationZone}</TableCell>
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
                                                            <span className="text-sm">{game.lastUpdate}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right max-w-[250px] truncate" title={game.lastUpdateNote}>
                                                        {game.lastUpdateNote}
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
