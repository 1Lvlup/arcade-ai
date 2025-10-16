import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SharedHeader } from "@/components/SharedHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
  user_id: string;
}

export default function SupportTickets() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading tickets",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateTicket = async () => {
    if (!selectedTicket) return;

    try {
      const updates: any = {
        admin_notes: adminNotes,
      };

      if (newStatus && newStatus !== selectedTicket.status) {
        updates.status = newStatus;
        if (newStatus === "resolved") {
          updates.resolved_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", selectedTicket.id);

      if (error) throw error;

      toast({ title: "Ticket updated successfully" });
      fetchTickets();
      setSelectedTicket(null);
      setAdminNotes("");
      setNewStatus("");
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "default";
      case "in_progress": return "secondary";
      case "resolved": return "outline";
      default: return "default";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SharedHeader title="Support Tickets" />
        <main className="flex-1 container mx-auto px-4 py-8">
          <p>Loading tickets...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SharedHeader title="Support Tickets" />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Support Tickets</h1>
        
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                    <CardDescription>
                      Submitted {format(new Date(ticket.created_at), "PPp")}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant={getStatusColor(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Message:</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {ticket.message}
                  </p>
                </div>

                {ticket.admin_notes && (
                  <div>
                    <p className="text-sm font-medium mb-2">Admin Notes:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {ticket.admin_notes}
                    </p>
                  </div>
                )}

                {selectedTicket?.id === ticket.id ? (
                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={newStatus || ticket.status} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Admin Notes</label>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add notes about this ticket..."
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={updateTicket}>Save Changes</Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedTicket(null);
                          setAdminNotes("");
                          setNewStatus("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setAdminNotes(ticket.admin_notes || "");
                      setNewStatus(ticket.status);
                    }}
                  >
                    Manage Ticket
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {tickets.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No support tickets yet
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
