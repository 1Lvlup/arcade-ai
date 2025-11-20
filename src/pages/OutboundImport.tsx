import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { SharedHeader } from "@/components/SharedHeader";
import { OutboundNav } from "@/components/OutboundNav";
import { Loader2, MapPin, ExternalLink } from "lucide-react";

interface ProspectGoogle {
  id: string;
  place_id: string;
  name: string;
  formatted_address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone_number: string | null;
  website: string | null;
  google_rating: number | null;
  user_ratings_total: number | null;
  types: string[] | null;
  raw_payload: any;
  imported_to_companies: boolean;
  created_at: string;
}

export default function OutboundImport() {
  const [location, setLocation] = useState("");
  const [radiusKm, setRadiusKm] = useState(50);
  const [maxResults, setMaxResults] = useState(40);
  const [searchText, setSearchText] = useState("");
  const [showOnlyNotImported, setShowOnlyNotImported] = useState(false);
  const [convertingIds, setConvertingIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  // Fetch prospects
  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["prospects-google", searchText, showOnlyNotImported],
    queryFn: async () => {
      let query = supabase
        .from("prospects_google")
        .select("*")
        .order("created_at", { ascending: false });

      if (showOnlyNotImported) {
        query = query.eq("imported_to_companies", false);
      }

      if (searchText) {
        query = query.or(`name.ilike.%${searchText}%,formatted_address.ilike.%${searchText}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProspectGoogle[];
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!location.trim()) {
        throw new Error("Location is required");
      }

      const { data, error } = await supabase.functions.invoke("import-arcades-google", {
        body: { location, radius_km: radiusKm, max_results: maxResults },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Imported ${data.inserted} new, ${data.updated} updated, ${data.total_processed} total processed`
      );
      queryClient.invalidateQueries({ queryKey: ["prospects-google"] });
    },
    onError: (error: any) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  // Convert to lead mutation
  const convertToLead = async (prospect: ProspectGoogle) => {
    setConvertingIds((prev) => new Set(prev).add(prospect.id));

    try {
      // 1. Find or create company
      let companyId: string;

      // Try to find existing company by website or name+location
      let existingCompany = null;

      if (prospect.website) {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .eq("website", prospect.website)
          .maybeSingle();
        existingCompany = data;
      }

      if (!existingCompany && prospect.name && prospect.city && prospect.state) {
        const { data } = await supabase
          .from("companies")
          .select("id")
          .eq("name", prospect.name)
          .eq("location", `${prospect.city}, ${prospect.state}`)
          .maybeSingle();
        existingCompany = data;
      }

      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        // Create new company
        const { data: newCompany, error: companyError } = await supabase
          .from("companies")
          .insert({
            name: prospect.name,
            website: prospect.website,
            location: prospect.city && prospect.state ? `${prospect.city}, ${prospect.state}` : prospect.formatted_address,
          })
          .select("id")
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      // 2. Create lead
      const { error: leadError } = await supabase.from("leads").insert({
        company_id: companyId,
        name: "Primary Contact",
        role: null,
        email: null,
        phone: prospect.phone_number,
        stage: "New",
        source: "google-places",
        priority_tier: "B",
        lead_score: 50,
      });

      if (leadError) throw leadError;

      // 3. Mark prospect as imported
      const { error: updateError } = await supabase
        .from("prospects_google")
        .update({ imported_to_companies: true })
        .eq("id", prospect.id);

      if (updateError) throw updateError;

      toast.success(`Converted to lead for ${prospect.name}`);
      queryClient.invalidateQueries({ queryKey: ["prospects-google"] });
    } catch (error: any) {
      toast.error(`Failed to convert: ${error.message}`);
    } finally {
      setConvertingIds((prev) => {
        const next = new Set(prev);
        next.delete(prospect.id);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SharedHeader />
      <OutboundNav />

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Import Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Google Places Import</CardTitle>
            <CardDescription>Import arcade and FEC locations from Google Places</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="text-sm font-medium mb-2 block">Location</label>
                <Input
                  placeholder="City, State or Region (e.g., Fargo, ND)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Radius (km)</label>
                <Input
                  type="number"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  min={1}
                  max={200}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max Results</label>
                <Input
                  type="number"
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                  min={1}
                  max={60}
                />
              </div>
            </div>

            <Button
              onClick={() => importMutation.mutate()}
              disabled={!location.trim() || importMutation.isPending}
              className="w-full md:w-auto"
            >
              {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Import
            </Button>

            {importMutation.isSuccess && (
              <div className="text-sm text-muted-foreground">
                ✓ Last import: {importMutation.data.inserted} new, {importMutation.data.updated} updated,{" "}
                {importMutation.data.total_processed} total
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prospects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Imported Prospects</CardTitle>
            <CardDescription>Browse and convert Google Places results into leads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder="Search name or address..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="md:max-w-sm"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyNotImported}
                  onChange={(e) => setShowOnlyNotImported(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm">Show only not imported</span>
              </label>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : prospects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No prospects found. Run an import to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Website</TableHead>
                      <TableHead>Imported?</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prospects.map((prospect) => (
                      <TableRow key={prospect.id}>
                        <TableCell className="font-medium">{prospect.name}</TableCell>
                        <TableCell>{prospect.city || "—"}</TableCell>
                        <TableCell>{prospect.state || "—"}</TableCell>
                        <TableCell>{prospect.country || "—"}</TableCell>
                        <TableCell>
                          {prospect.google_rating ? (
                            <span>
                              {prospect.google_rating.toFixed(1)} ({prospect.user_ratings_total || 0})
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {prospect.website ? (
                            <a
                              href={prospect.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              Link <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {prospect.imported_to_companies ? (
                            <Badge variant="secondary">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => convertToLead(prospect)}
                              disabled={prospect.imported_to_companies || convertingIds.has(prospect.id)}
                            >
                              {convertingIds.has(prospect.id) && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Convert to Lead
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                            >
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=place_id:${prospect.place_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MapPin className="h-4 w-4" />
                              </a>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
