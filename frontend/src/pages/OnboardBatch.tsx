import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { upsertBatchStudents, StudentImportRow } from "@/lib/batch-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Upload,
  UserPlus,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  Archive,
} from "lucide-react";
import * as XLSX from "xlsx";

interface Batch {
  batch_id: string;
  batch_code: string;
  batch_name: string;
  batch_description: string | null;
  programme_head: string;
  program_type: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

const PROGRAMME_HEADS = [
  "Dr Renuka Kamath",
  "Dr Ashitha Agarwal",
  "Dr Ajinkya Navare",
  "Dr Sajit Mathews",
  "Dr Tulsi Jayakumar",
  "Dr Preeta George",
];

const PROGRAM_TYPES = ["PGDM", "PGDM-BM", "PGPM", "FPM", "Other"];

function parseBatchExcel(file: File): Promise<StudentImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
        });
        const mapped = rows.map((r) => ({
          roll_number: String(r["Roll Number"] ?? r["roll_number"] ?? "").trim(),
          first_name: String(r["First Name"] ?? r["first_name"] ?? "").trim(),
          last_name: String(r["Last Name"] ?? r["last_name"] ?? "").trim(),
          email: String(r["Email"] ?? r["email"] ?? "").trim(),
          division: String(r["Division"] ?? r["division"] ?? "").trim(),
          specialization: String(r["Specialization"] ?? r["specialization"] ?? "").trim(),
          gender: String(r["Gender"] ?? r["gender"] ?? "").trim(),
        }));
        resolve(mapped.filter((r) => r.roll_number && r.email && r.division));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function CreateBatchForm({ onCreated, onCancel }: { onCreated: (batch: Batch) => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    batch_code: "",
    batch_name: "",
    batch_description: "",
    programme_head: "",
    program_type: "",
    start_date: "",
    end_date: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.batch_code || !form.batch_name || !form.programme_head || !form.program_type) {
      toast.error("Batch code, name, programme head and program type are required.");
      return;
    }

    if (!form.start_date || !form.end_date) {
      toast.error("Start date and end date are required.");
      return;
    }

    if (new Date(form.start_date).getTime() >= new Date(form.end_date).getTime()) {
      toast.error("End date must be after start date.");
      return;
    }

    setSaving(true);

    const payload = {
      batch_code: form.batch_code.toUpperCase().trim(),
      batch_name: form.batch_name.trim(),
      batch_description: form.batch_description.trim() || null,
      programme_head: form.programme_head,
      program_type: form.program_type,
      start_date: form.start_date,
      end_date: form.end_date,
      is_active: true,
    };

    const result = await (supabase as any)
      .from("t201_batch")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (result.error) {
      toast.error(`Failed to create batch: ${result.error.message}`);
      return;
    }

    toast.success(`Batch "${result.data.batch_name}" created successfully.`);
    onCreated(result.data as Batch);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="batch_code">Batch Code *</Label>
          <Input id="batch_code" value={form.batch_code} onChange={(e) => set("batch_code", e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="batch_name">Batch Name *</Label>
          <Input id="batch_name" value={form.batch_name} onChange={(e) => set("batch_name", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Programme Head *</Label>
          <Select value={form.programme_head} onValueChange={(v) => set("programme_head", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{PROGRAMME_HEADS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Program Type *</Label>
          <Select value={form.program_type} onValueChange={(v) => set("program_type", v)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>{PROGRAM_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Start Date *</Label>
          <Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>End Date *</Label>
          <Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="batch_description">Description</Label>
        <Input id="batch_description" value={form.batch_description} onChange={(e) => set("batch_description", e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="animate-spin h-4 w-4" /> : null}
          Create Batch
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function StudentOnboardingPanel({ batch }: { batch: Batch }) {
  const [tab, setTab] = useState<"excel" | "manual">("excel");
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<StudentImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const readOnly = !batch.is_active;

  const [manualForm, setManualForm] = useState({
    roll_number: "",
    first_name: "",
    last_name: "",
    email: "",
    division: "",
    specialization: "",
    gender: "",
  });

  const handleFile = async (f: File) => {
    try {
      const rows = await parseBatchExcel(f);
      setPreview(rows);
      toast.success(`Parsed ${rows.length} rows.`);
    } catch {
      toast.error("Failed to parse Excel file.");
    }
  };

  const handleImport = async () => {
    if (readOnly) {
      toast.error("Archived batches are read-only.");
      return;
    }

    if (!preview.length) return;

    setImporting(true);
    try {
      const result = await upsertBatchStudents(
        { batch_id: batch.batch_id, batch_code: batch.batch_code },
        preview,
      );

      toast.success(`Imported ${result.inserted} students.${result.failed ? ` ${result.failed} rows skipped.` : ""}`);
      setPreview([]);
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const addManualStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (readOnly) {
      toast.error("Archived batches are read-only.");
      return;
    }

    if (!manualForm.roll_number || !manualForm.email || !manualForm.division) {
      toast.error("Roll number, email and division are required.");
      return;
    }

    setImporting(true);
    try {
      const result = await upsertBatchStudents(
        { batch_id: batch.batch_id, batch_code: batch.batch_code },
        [manualForm],
      );

      if (result.inserted > 0) {
        toast.success("Student added.");
        setManualForm({
          roll_number: "",
          first_name: "",
          last_name: "",
          email: "",
          division: "",
          specialization: "",
          gender: "",
        });
      } else {
        toast.error("Could not add student.");
      }
    } catch (error: any) {
      toast.error(`Failed to add student: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "excel" | "manual")}> 
      <TabsList>
        <TabsTrigger value="excel" className="gap-1.5">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Excel Upload
        </TabsTrigger>
        <TabsTrigger value="manual" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Manual Add
        </TabsTrigger>
      </TabsList>

      <TabsContent value="excel" className="mt-4 space-y-4">
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => !readOnly && fileRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {readOnly ? "Archived batch (read-only)." : "Drop Excel file here or browse"}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={readOnly}
          />
        </div>

        {preview.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{preview.length} rows ready</span>
            <Button size="sm" onClick={handleImport} disabled={importing || readOnly} className="gap-1.5">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Import
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="manual" className="mt-4">
        <form onSubmit={addManualStudent} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Roll Number *</Label>
            <Input value={manualForm.roll_number} onChange={(e) => setManualForm((f) => ({ ...f, roll_number: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={manualForm.email} onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>First Name</Label>
            <Input value={manualForm.first_name} onChange={(e) => setManualForm((f) => ({ ...f, first_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Last Name</Label>
            <Input value={manualForm.last_name} onChange={(e) => setManualForm((f) => ({ ...f, last_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Division *</Label>
            <Input value={manualForm.division} onChange={(e) => setManualForm((f) => ({ ...f, division: e.target.value }))} placeholder="A / Division A" />
          </div>
          <div className="space-y-1.5">
            <Label>Specialization</Label>
            <Input value={manualForm.specialization} onChange={(e) => setManualForm((f) => ({ ...f, specialization: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Gender</Label>
            <Select value={manualForm.gender} onValueChange={(v) => setManualForm((f) => ({ ...f, gender: v }))}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
                <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={importing || readOnly} size="sm" className="gap-1.5">
              {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Add Student
            </Button>
          </div>
        </form>
      </TabsContent>
    </Tabs>
  );
}

export default function OnboardBatch() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"choose" | "create" | "upload">("choose");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      const { data } = await supabase
        .from("t201_batch")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      setBatches((data ?? []) as Batch[]);
      setLoading(false);
    };

    fetchBatches();
  }, []);

  const handleBatchCreated = (batch: Batch) => {
    setSelectedBatch(batch);
    setStep("upload");
  };

  const activeBatches = batches.filter((b) => b.is_active);
  const archivedBatches = batches.filter((b) => !b.is_active);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card py-4">
        <div className="container flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <h1 className="font-semibold">Onboard Batch</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-12">
        <AnimatePresence mode="wait">
          {step === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Start Batch Onboarding</h2>
                <p className="text-muted-foreground">Create a new batch or continue onboarding in an existing batch.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <Card className="hover:border-primary cursor-pointer transition-colors pt-6" onClick={() => setStep("create")}> 
                  <CardContent className="text-center space-y-4">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <Plus className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Create New Batch</p>
                      <p className="text-sm text-muted-foreground">Setup details from scratch</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-muted/30">
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Existing Batches</CardTitle></CardHeader>
                  <CardContent>
                    {loading ? (
                      <Loader2 className="animate-spin h-4 w-4 mx-auto" />
                    ) : (
                      <Tabs defaultValue="active" className="space-y-3">
                        <TabsList className="w-full">
                          <TabsTrigger value="active" className="flex-1">Ongoing ({activeBatches.length})</TabsTrigger>
                          <TabsTrigger value="archive" className="flex-1">Archived ({archivedBatches.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="active" className="space-y-2">
                          {activeBatches.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No active batches</p>
                          ) : activeBatches.map((b) => (
                            <div
                              key={b.batch_id}
                              onClick={() => {
                                setSelectedBatch(b);
                                setStep("upload");
                              }}
                              className="p-2 bg-background rounded border hover:border-primary cursor-pointer flex justify-between items-center text-sm"
                            >
                              <span>{b.batch_name}</span>
                              <ArrowLeft className="h-3 w-3 rotate-180 opacity-50" />
                            </div>
                          ))}
                        </TabsContent>
                        <TabsContent value="archive" className="space-y-2">
                          {archivedBatches.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No archived batches</p>
                          ) : archivedBatches.map((b) => (
                            <div
                              key={b.batch_id}
                              onClick={() => {
                                setSelectedBatch(b);
                                setStep("upload");
                              }}
                              className="p-2 bg-background rounded border hover:border-primary cursor-pointer flex justify-between items-center text-sm"
                            >
                              <span>{b.batch_name}</span>
                              <Archive className="h-3 w-3 opacity-50" />
                            </div>
                          ))}
                        </TabsContent>
                      </Tabs>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {step === "create" && (
            <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Create New Academic Batch</CardTitle>
                </CardHeader>
                <CardContent>
                  <CreateBatchForm onCreated={handleBatchCreated} onCancel={() => setStep("choose")} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "upload" && selectedBatch && (
            <motion.div key="upload" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{selectedBatch.batch_name}</h2>
                      <p className="text-sm text-muted-foreground">Step 2: Onboard Students ({selectedBatch.is_active ? "Active" : "Archived"})</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setStep("choose")}>Back to List</Button>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <StudentOnboardingPanel batch={selectedBatch} />
                  </CardContent>
                </Card>

                <div className="text-center pt-4">
                  <Button variant="ghost" onClick={() => navigate("/batches")}>Go to Batch Management <ArrowLeft className="h-4 w-4 ml-2 rotate-180" /></Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
