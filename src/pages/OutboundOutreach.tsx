import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Copy } from "lucide-react";
import { SharedHeader } from "@/components/SharedHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CadenceStep {
  step_number: number;
  day_offset: number;
  channel: string;
  goal: string;
  script: string;
}

interface GeneratedCadence {
  cadence_name: string;
  target_persona: string;
  steps: CadenceStep[];
}

interface GeneratedScript {
  title: string;
  persona: string;
  phase: string;
  content: string;
}

export default function OutboundOutreach() {
  const queryClient = useQueryClient();

  // Cadence Builder State
  const [cadenceName, setCadenceName] = useState("");
  const [cadencePersona, setCadencePersona] = useState("");
  const [cadenceGoal, setCadenceGoal] = useState("");
  const [generatedCadence, setGeneratedCadence] = useState<GeneratedCadence | null>(null);
  const [isGeneratingCadence, setIsGeneratingCadence] = useState(false);
  const [selectedCadence, setSelectedCadence] = useState<any>(null);

  // Script Library State
  const [scriptPersona, setScriptPersona] = useState("");
  const [scriptPhase, setScriptPhase] = useState("");
  const [scriptType, setScriptType] = useState("");
  const [scriptContext, setScriptContext] = useState("");
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [selectedScript, setSelectedScript] = useState<any>(null);

  // Query cadences
  const { data: cadences = [] } = useQuery({
    queryKey: ["cadences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cadences")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Query scripts
  const { data: scripts = [] } = useQuery({
    queryKey: ["scripts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scripts")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Generate Cadence
  const handleGenerateCadence = async () => {
    if (!cadenceName || !cadencePersona || !cadenceGoal) {
      toast.error("Please fill in all cadence fields");
      return;
    }

    setIsGeneratingCadence(true);
    try {
      const { data, error } = await supabase.functions.invoke("cadence-builder", {
        body: {
          target_persona: cadencePersona,
          goal: cadenceGoal,
        },
      });

      if (error) throw error;

      // Parse the response
      let parsedData: GeneratedCadence;
      if (typeof data === "string") {
        parsedData = JSON.parse(data);
      } else {
        parsedData = data;
      }

      // Override cadence_name with user input
      parsedData.cadence_name = cadenceName;

      setGeneratedCadence(parsedData);
      toast.success("Cadence generated successfully");
    } catch (error: any) {
      console.error("Error generating cadence:", error);
      toast.error(error.message || "Failed to generate cadence");
    } finally {
      setIsGeneratingCadence(false);
    }
  };

  // Save Cadence Mutation
  const saveCadenceMutation = useMutation({
    mutationFn: async (cadence: GeneratedCadence) => {
      const { data, error } = await supabase
        .from("cadences")
        .insert([{
          cadence_name: cadence.cadence_name,
          target_persona: cadence.target_persona,
          steps: cadence.steps as any,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cadences"] });
      toast.success("Cadence saved to library");
      setGeneratedCadence(null);
      setCadenceName("");
      setCadencePersona("");
      setCadenceGoal("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save cadence");
    },
  });

  // Generate Script
  const handleGenerateScript = async () => {
    if (!scriptPersona || !scriptPhase || !scriptType) {
      toast.error("Please fill in persona, phase, and script type");
      return;
    }

    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke("script-library-engine", {
        body: {
          persona: scriptPersona,
          phase: scriptPhase,
          script_type: scriptType,
          context: scriptContext,
        },
      });

      if (error) throw error;

      // Parse the response
      let parsedData: GeneratedScript;
      if (typeof data === "string") {
        parsedData = JSON.parse(data);
      } else {
        parsedData = data;
      }

      setGeneratedScript(parsedData);
      toast.success("Script generated successfully");
    } catch (error: any) {
      console.error("Error generating script:", error);
      toast.error(error.message || "Failed to generate script");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Save Script Mutation
  const saveScriptMutation = useMutation({
    mutationFn: async (script: GeneratedScript) => {
      const { data, error } = await supabase
        .from("scripts")
        .insert([{
          title: script.title,
          persona: script.persona,
          phase: script.phase,
          content: script.content,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scripts"] });
      toast.success("Script saved to library");
      setGeneratedScript(null);
      setScriptPersona("");
      setScriptPhase("");
      setScriptType("");
      setScriptContext("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save script");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader title="Outbound - Outreach" showBackButton={true} backTo="/" />
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Outbound – Outreach</h1>
          <p className="text-muted-foreground">Build cadences and generate sales scripts for your outbound campaigns</p>
        </div>

        {/* SECTION 1: Cadence Builder */}
        <Card>
          <CardHeader>
            <CardTitle>Cadence Builder</CardTitle>
            <CardDescription>Generate multi-touch outbound cadences for different personas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cadence-name">Cadence Name</Label>
                <Input
                  id="cadence-name"
                  placeholder="e.g., FEC Owner Demo Outreach"
                  value={cadenceName}
                  onChange={(e) => setCadenceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cadence-persona">Target Persona</Label>
                <Select value={cadencePersona} onValueChange={setCadencePersona}>
                  <SelectTrigger id="cadence-persona">
                    <SelectValue placeholder="Select persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tech">Tech (Arcade Technician)</SelectItem>
                    <SelectItem value="gm">GM (General Manager)</SelectItem>
                    <SelectItem value="owner">Owner (Decision-Maker)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cadence-goal">Goal / Context</Label>
              <Textarea
                id="cadence-goal"
                placeholder="Describe what you want to achieve (e.g., book first demo with multi-location FEC owners)"
                rows={3}
                value={cadenceGoal}
                onChange={(e) => setCadenceGoal(e.target.value)}
              />
            </div>

            <Button onClick={handleGenerateCadence} disabled={isGeneratingCadence}>
              {isGeneratingCadence && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Cadence
            </Button>

            {generatedCadence && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-xl">{generatedCadence.cadence_name}</CardTitle>
                  <CardDescription>Persona: {generatedCadence.target_persona}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedCadence.steps.map((step) => (
                    <Card key={step.step_number}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">
                              Step {step.step_number} - Day {step.day_offset}
                            </CardTitle>
                            <CardDescription>
                              Channel: {step.channel} | Goal: {step.goal}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <pre className="whitespace-pre-wrap font-mono text-sm bg-background p-3 rounded-md">
                          {step.script}
                        </pre>
                      </CardContent>
                    </Card>
                  ))}
                  <Button
                    onClick={() => saveCadenceMutation.mutate(generatedCadence)}
                    disabled={saveCadenceMutation.isPending}
                  >
                    {saveCadenceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Cadence to Supabase
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Cadence Library */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Cadence Library</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cadence Name</TableHead>
                      <TableHead>Target Persona</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cadences.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No cadences yet. Generate one above!
                        </TableCell>
                      </TableRow>
                    ) : (
                      cadences.map((cadence) => (
                        <TableRow
                          key={cadence.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedCadence(cadence)}
                        >
                          <TableCell className="font-medium">{cadence.cadence_name}</TableCell>
                          <TableCell>{cadence.target_persona}</TableCell>
                          <TableCell>{new Date(cadence.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: Script Library Generator */}
        <Card>
          <CardHeader>
            <CardTitle>Script Library Generator</CardTitle>
            <CardDescription>Generate individual sales scripts for calls, emails, and SMS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="script-persona">Persona</Label>
                <Select value={scriptPersona} onValueChange={setScriptPersona}>
                  <SelectTrigger id="script-persona">
                    <SelectValue placeholder="Select persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tech">Tech</SelectItem>
                    <SelectItem value="gm">GM</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script-phase">Phase</Label>
                <Select value={scriptPhase} onValueChange={setScriptPhase}>
                  <SelectTrigger id="script-phase">
                    <SelectValue placeholder="Select phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospecting">Prospecting</SelectItem>
                    <SelectItem value="outreach">Outreach</SelectItem>
                    <SelectItem value="discovery">Discovery</SelectItem>
                    <SelectItem value="demo">Demo</SelectItem>
                    <SelectItem value="close">Close</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="script-type">Script Type</Label>
                <Input
                  id="script-type"
                  placeholder="e.g., cold_call_opening"
                  value={scriptType}
                  onChange={(e) => setScriptType(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="script-context">Context / Goal (Optional)</Label>
              <Textarea
                id="script-context"
                placeholder="Additional context about the angle or situation"
                rows={2}
                value={scriptContext}
                onChange={(e) => setScriptContext(e.target.value)}
              />
            </div>

            <Button onClick={handleGenerateScript} disabled={isGeneratingScript}>
              {isGeneratingScript && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Script
            </Button>

            {generatedScript && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{generatedScript.title}</CardTitle>
                      <CardDescription>
                        {generatedScript.persona} | {generatedScript.phase}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(generatedScript.content)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-background p-4 rounded-md">
                    {generatedScript.content}
                  </pre>
                  <Button
                    onClick={() => saveScriptMutation.mutate(generatedScript)}
                    disabled={saveScriptMutation.isPending}
                  >
                    {saveScriptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Script to Supabase
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Script Library */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Script Library</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Persona</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scripts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No scripts yet. Generate one above!
                        </TableCell>
                      </TableRow>
                    ) : (
                      scripts.map((script) => (
                        <TableRow
                          key={script.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedScript(script)}
                        >
                          <TableCell className="font-medium">{script.title}</TableCell>
                          <TableCell>{script.persona}</TableCell>
                          <TableCell>{script.phase}</TableCell>
                          <TableCell>{new Date(script.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cadence Detail Dialog */}
      <Dialog open={!!selectedCadence} onOpenChange={() => setSelectedCadence(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCadence?.cadence_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Persona: {selectedCadence?.target_persona}
            </p>
            {selectedCadence?.steps?.map((step: CadenceStep) => (
              <Card key={step.step_number}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Step {step.step_number} - Day {step.day_offset}
                  </CardTitle>
                  <CardDescription>
                    Channel: {step.channel} | Goal: {step.goal}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap font-mono text-sm bg-muted p-3 rounded-md">
                    {step.script}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Script Detail Dialog */}
      <Dialog open={!!selectedScript} onOpenChange={() => setSelectedScript(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedScript?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {selectedScript?.persona} | {selectedScript?.phase}
            </p>
            <div className="relative">
              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted p-4 rounded-md">
                {selectedScript?.content}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(selectedScript?.content)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
