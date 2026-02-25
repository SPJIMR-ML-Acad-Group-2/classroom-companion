import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { upsertBatchStudents, StudentImportRow } from "@/lib/batch-utils";
import { BatchOption, DivisionOption, StudentOption, fetchBatchOptions, fetchDivisionOptions, fetchStudentOptions } from "@/lib/academic-data";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function parseExcel(file: File): Promise<StudentImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

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
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function BatchStudentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("all");
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [previewRows, setPreviewRows] = useState<StudentImportRow[]>([]);

  const [manualForm, setManualForm] = useState<StudentImportRow>({
    roll_number: "",
    first_name: "",
    last_name: "",
    email: "",
    division: "",
    specialization: "",
    gender: "",
  });

  const selectedBatch = useMemo(
    () => batches.find((b) => b.batch_id === selectedBatchId) ?? null,
    [batches, selectedBatchId],
  );

  const divisionById = useMemo(() => {
    const map = new Map<string, DivisionOption>();
    for (const d of divisions) map.set(d.id, d);
    return map;
  }, [divisions]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await fetchBatchOptions();
      setBatches(data);
      setSelectedBatchId(searchParams.get("batch_id") || data[0]?.batch_id || "");
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
      setDivisions(data.filter((d) => d.is_active));
      setSelectedDivisionId("all");
    } catch (error: any) {
      toast.error(`Failed to load divisions: ${error.message}`);
    }
  };

  const loadStudents = async (batchId: string, divisionId: string) => {
    if (!batchId) {
      setStudents([]);
      return;
    }

    try {
      const data = await fetchStudentOptions(batchId, divisionId === "all" ? undefined : divisionId);
      setStudents(data);
    } catch (error: any) {
      toast.error(`Failed to load students: ${error.message}`);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadDivisions(selectedBatchId);
      loadStudents(selectedBatchId, selectedDivisionId);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId) {
      loadStudents(selectedBatchId, selectedDivisionId);
    }
  }, [selectedDivisionId]);

  const importPreview = async () => {
    if (!selectedBatch) {
      toast.error("Select a batch first.");
      return;
    }

    if (!previewRows.length) return;

    setSaving(true);
    try {
      const result = await upsertBatchStudents(
        { batch_id: selectedBatch.batch_id, batch_code: selectedBatch.batch_code },
        previewRows,
      );

      toast.success(`Imported ${result.inserted} students.${result.failed ? ` ${result.failed} rows skipped.` : ""}`);
      setPreviewRows([]);
      loadStudents(selectedBatch.batch_id, selectedDivisionId);
      loadDivisions(selectedBatch.batch_id);
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBatch) {
      toast.error("Select a batch first.");
      return;
    }

    if (!manualForm.roll_number || !manualForm.email || !manualForm.division) {
      toast.error("Roll number, email and division are required.");
      return;
    }

    setSaving(true);
    try {
      const result = await upsertBatchStudents(
        { batch_id: selectedBatch.batch_id, batch_code: selectedBatch.batch_code },
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
        loadStudents(selectedBatch.batch_id, selectedDivisionId);
        loadDivisions(selectedBatch.batch_id);
      }
    } catch (error: any) {
      toast.error(`Add failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateStudentDivision = async (studentId: string, divisionId: string) => {
    const { error } = await supabase
      .from("t205_student_profile")
      .update({ division_id: divisionId } as never)
      .eq("id", studentId);

    if (error) {
      toast.error(`Failed to update division: ${error.message}`);
      return;
    }

    toast.success("Student division updated.");
    loadStudents(selectedBatchId, selectedDivisionId);
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
            <p className="text-sm font-semibold leading-none">Manage Students</p>
            <p className="text-xs text-muted-foreground mt-0.5">Onboard students and assign divisions</p>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6 max-w-6xl">
        <Card>
          <CardContent className="p-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => <SelectItem key={b.batch_id} value={b.batch_id}>{b.batch_code} - {b.batch_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Division Filter</Label>
              <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId}>
                <SelectTrigger><SelectValue placeholder="All divisions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All divisions</SelectItem>
                  {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.division_code} - {d.division_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="excel">
          <TabsList>
            <TabsTrigger value="excel">Excel Upload</TabsTrigger>
            <TabsTrigger value="manual">Manual Add</TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Bulk Import</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Upload student Excel (.xlsx/.xls)</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const rows = await parseExcel(f);
                        setPreviewRows(rows);
                        toast.success(`Parsed ${rows.length} rows.`);
                      } catch {
                        toast.error("Could not parse file.");
                      }
                    }}
                  />
                </div>

                {previewRows.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{previewRows.length} rows ready to import</p>
                    <Button onClick={importPreview} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Import
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Add Student</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={addManual} className="grid gap-4 sm:grid-cols-2">
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
                  <div className="sm:col-span-2">
                    <Button type="submit" disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      Add Student
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader><CardTitle className="text-base">Students ({students.length})</CardTitle></CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students found for this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Division</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.roll_number}</TableCell>
                      <TableCell>{s.first_name} {s.last_name}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>
                        <Select value={s.division_id} onValueChange={(value) => updateStudentDivision(s.id, value)}>
                          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {divisions.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.division_code} - {d.division_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">Current: {divisionById.get(s.division_id)?.division_code ?? "-"}</p>
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
