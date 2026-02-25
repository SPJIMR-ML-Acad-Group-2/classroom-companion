import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchBatchOptions, fetchDivisionOptions, BatchOption, DivisionOption } from "@/lib/academic-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function BatchDivisionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);

  const [form, setForm] = useState({
    division_code: "",
    division_name: "",
    max_strength: "60",
  });

  const selectedBatch = useMemo(
    () => batches.find((b) => b.batch_id === selectedBatchId) ?? null,
    [batches, selectedBatchId],
  );

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await fetchBatchOptions();
      setBatches(data);

      const preferred = searchParams.get("batch_id") || data[0]?.batch_id || "";
      setSelectedBatchId(preferred);
    } catch (error: any) {
      toast.error(`Failed to load batches: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDivisions = async (batchId: string) => {
    if (!batchId) {
      setDivisions([]);
      return;
    }

    try {
      const data = await fetchDivisionOptions(batchId);
      setDivisions(data);
    } catch (error: any) {
      toast.error(`Failed to load divisions: ${error.message}`);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadDivisions(selectedBatchId);
    }
  }, [selectedBatchId]);

  const createDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      toast.error("Select a batch first.");
      return;
    }

    const code = form.division_code.trim().toUpperCase();
    const name = form.division_name.trim() || `Division ${code}`;
    const strength = Number(form.max_strength || "60");

    if (!code) {
      toast.error("Division code is required.");
      return;
    }

    if (Number.isNaN(strength) || strength <= 0) {
      toast.error("Max strength must be greater than 0.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("t203_division")
      .upsert(
        {
          batch_id: selectedBatchId,
          division_code: code,
          division_name: name,
          max_strength: strength,
          is_active: true,
        } as never,
        { onConflict: "batch_id,division_code" },
      );

    setSaving(false);

    if (error) {
      toast.error(`Could not save division: ${error.message}`);
      return;
    }

    toast.success("Division saved.");
    setForm({ division_code: "", division_name: "", max_strength: "60" });
    loadDivisions(selectedBatchId);
  };

  const updateDivision = async (division: DivisionOption, updates: Partial<DivisionOption>) => {
    const { error } = await supabase
      .from("t203_division")
      .update(updates as never)
      .eq("id", division.id);

    if (error) {
      toast.error(`Could not update division: ${error.message}`);
      return;
    }

    toast.success("Division updated.");
    loadDivisions(selectedBatchId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/managebatch")} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Batches
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <p className="text-sm font-semibold leading-none">Manage Divisions</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create and maintain batch divisions</p>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6 max-w-5xl">
        <Card>
          <CardContent className="p-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.batch_id} value={b.batch_id}>{b.batch_code} - {b.batch_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBatch ? (
              <Badge variant={selectedBatch.is_active ? "default" : "secondary"}>
                {selectedBatch.is_active ? "Active" : "Archived"}
              </Badge>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Create Division</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createDivision} className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input value={form.division_code} onChange={(e) => setForm((f) => ({ ...f, division_code: e.target.value }))} placeholder="A" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Name</Label>
                <Input value={form.division_name} onChange={(e) => setForm((f) => ({ ...f, division_name: e.target.value }))} placeholder="Division A" />
              </div>
              <div className="space-y-1.5">
                <Label>Max Strength</Label>
                <Input type="number" value={form.max_strength} onChange={(e) => setForm((f) => ({ ...f, max_strength: e.target.value }))} min={1} />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" disabled={saving || !selectedBatchId} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save Division
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Existing Divisions</CardTitle></CardHeader>
          <CardContent>
            {divisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No divisions configured for this batch yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {divisions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono">{d.division_code}</TableCell>
                      <TableCell>{d.division_name}</TableCell>
                      <TableCell>{d.max_strength}</TableCell>
                      <TableCell>
                        <Badge variant={d.is_active ? "default" : "secondary"}>{d.is_active ? "Active" : "Archived"}</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => updateDivision(d, { is_active: !d.is_active })}>
                          {d.is_active ? "Archive" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
