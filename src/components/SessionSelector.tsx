import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertTriangle, XCircle, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface TroubleshootingSession {
  id: string;
  session_id: string;
  game_name: string | null;
  symptom: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  location_name: string | null;
}

interface SessionSelectorProps {
  onSelectSession: (sessionId: string) => void;
  selectedSessionId: string | null;
}

export function SessionSelector({ onSelectSession, selectedSessionId }: SessionSelectorProps) {
  const [sessions, setSessions] = useState<TroubleshootingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('troubleshooting_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'escalated':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'stalled':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Play className="h-4 w-4 text-blue-500" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'done':
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case 'escalated':
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case 'stalled':
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No troubleshooting sessions yet. Start a new conversation to begin.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        {sessions.map((session) => (
          <Card
            key={session.id}
            className={`cursor-pointer transition-all hover:bg-accent/50 ${
              selectedSessionId === session.session_id
                ? 'border-primary bg-accent'
                : 'border-border'
            }`}
            onClick={() => onSelectSession(session.session_id)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {session.game_name || 'Unknown Game'}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {session.symptom}
                  </p>
                </div>
                {getStatusIcon(session.status)}
              </div>

              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  className={`text-xs ${getStatusColor(session.status)}`}
                >
                  {session.status}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                </div>
              </div>

              {session.location_name && (
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  📍 {session.location_name}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
