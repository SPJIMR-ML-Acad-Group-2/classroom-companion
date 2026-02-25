import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { BatchOption, CourseOption, DivisionOption, fetchBatchOptions, fetchCourseOptions, fetchDivisionOptions } from "@/lib/academic-data";
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
import { Badge } from "@/components/ui/badge";

interface FacultyOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface TimetableEvent {
  event_id: string;
  batch_id: string;
  division_id: string | null;
  course_id: string | null;
  faculty_id: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  notes: string | null;
  is_published: boolean;
  status: string; // scheduled | completed | cancelled
}

interface TimetableImportRow {
  batch_code?: string;
  division: string;
  course_code: string;
  faculty_email: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue?: string;
  notes?: string;
}

function parseTimetableExcel(file: File): Promise<TimetableImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

        const mapped = rows.map((r) => ({
          batch_code: String(r["Batch Code"] ?? r["batch_code"] ?? "").trim(),
          division: String(r["Division"] ?? r["division"] ?? "").trim(),
          course_code: String(r["Course Code"] ?? r["course_code"] ?? "").trim(),
          faculty_email: String(r["Faculty Email"] ?? r["faculty_email"] ?? "").trim(),
          event_date: String(r["Date"] ?? r["event_date"] ?? "").trim(),
          start_time: String(r["Start Time"] ?? r["start_time"] ?? "").trim(),
          end_time: String(r["End Time"] ?? r["end_time"] ?? "").trim(),
          venue: String(r["Venue"] ?? r["venue"] ?? "").trim(),
          notes: String(r["Notes"] ?? r["notes"] ?? "").trim(),
        }));

        resolve(mapped.filter((r) => r.division && r.course_code && r.event_date && r.start_time && r.end_time));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed.length === 5 ? `${trimmed}:00` : trimmed;

  const date = new Date(`1970-01-01T${trimmed}`);
  if (!Number.isNaN(date.getTime())) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}:00`;
  }

  return trimmed;
}

export default function TimetablePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const forcedMode = location.pathname.includes("/publish")
    ? "publish"
    : location.pathname.includes("/view")
      ? "view"
      : "hub";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(forcedMode === "view" ? "view" : "publish");

  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [faculty, setFaculty] = useState<FacultyOption[]>([]);
  const [events, setEvents] = useState<TimetableEvent[]>([]);

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState("all");
  const [previewRows, setPreviewRows] = useState<TimetableImportRow[]>([]);

  const [form, setForm] = useState({
    division_id: "",
    course_id: "",
    faculty_id: "",
    event_date: "",
    start_time: "",
    end_time: "",
    venue: "",
    notes: "",
  });

  const batchByCode = useMemo(() => {
    const map = new Map<string, BatchOption>();
    for (const b of batches) map.set(b.batch_code.toLowerCase(), b);
    return map;
  }, [batches]);

  const divisionByKey = useMemo(() => {
    const map = new Map<string, DivisionOption>();
    for (const d of divisions) {
      map.set(d.division_code.toLowerCase(), d);
      map.set(d.division_name.toLowerCase(), d);
    }
    return map;
  }, [divisions]);

  const courseByCode = useMemo(() => {
    const map = new Map<string, CourseOption>();
    for (const c of courses) map.set(c.course_code.toLowerCase(), c);
    return map;
  }, [courses]);

  const facultyByEmail = useMemo(() => {
    const map = new Map<string, FacultyOption>();
    for (const f of faculty) map.set(f.email.toLowerCase(), f);
    return map;
  }, [faculty]);

  const loadMasterData = async () => {
    setLoading(true);

    try {
      const [batchRows, courseRows, facultyResp] = await Promise.all([
        fetchBatchOptions(),
        fetchCourseOptions(),
        supabase.from("t204_faculty_profile").select("id,first_name,last_name,email").eq("is_active", true),
      ]);

      setBatches(batchRows);
      setCourses(courseRows);
      setFaculty(((facultyResp.data ?? []) as FacultyOption[]));

      const initialBatch = searchParams.get("batch_id") || batchRows[0]?.batch_id || "";
      setSelectedBatchId(initialBatch);
    } catch (error: any) {
      toast.error(`Failed to load timetable metadata: ${error.message}`);
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
      const rows = await fetchDivisionOptions(batchId);
      setDivisions(rows.filter((d) => d.is_active));
      setSelectedDivisionId("all");
    } catch (error: any) {
      toast.error(`Failed to load divisions: ${error.message}`);
    }
  };

  const loadEvents = async (batchId: string, divisionId: string, mode: string) => {
    if (!batchId) {
      setEvents([]);
      return;
    }

    let query = supabase
      .from("t211_timetable_event")
      .select("event_id,batch_id,division_id,course_id,faculty_id,event_date,start_time,end_time,venue,notes,is_published")
      .eq("batch_id", batchId)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (divisionId !== "all") {
      query = query.eq("division_id", divisionId);
    }

    if (mode === "view") {
      query = query.eq("is_published", true);
    }

    const { data, error } = await query;

    if (error) {
      toast.error(`Failed to load timetable events: ${error.message}`);
      return;
    }

    setEvents((data ?? []) as TimetableEvent[]);
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;
    loadDivisions(selectedBatchId);
  }, [selectedBatchId]);

  useEffect(() => {
    if (!selectedBatchId) return;
    loadEvents(selectedBatchId, selectedDivisionId, activeTab);
  }, [selectedBatchId, selectedDivisionId, activeTab]);

  useEffect(() => {
    if (forcedMode !== "hub") {
      setActiveTab(forcedMode);
    }
  }, [forcedMode]);

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBatchId) {
      toast.error("Select a batch first.");
      return;
    }

    if (!form.division_id || !form.course_id || !form.event_date || !form.start_time || !form.end_time) {
      toast.error("Division, course, date, start time and end time are required.");
      return;
    }

    setSaving(true);

    const payload = {
      batch_id: selectedBatchId,
      division_id: form.division_id,
      course_id: form.course_id,
      faculty_id: form.faculty_id || null,
      event_date: form.event_date,
      start_time: normalizeTime(form.start_time),
      end_time: normalizeTime(form.end_time),
      venue: form.venue.trim() || null,
      notes: form.notes.trim() || null,
      is_published: false,
      status: "scheduled",
      created_by: null,
    };

    const { error } = await supabase.from("t211_timetable_event").insert(payload as never);

    setSaving(false);

    if (error) {
      toast.error(`Could not create event: ${error.message}`);
      return;
    }

    toast.success("Timetable event added.");
    setForm({
      division_id: "",
      course_id: "",
      faculty_id: "",
      event_date: "",
      start_time: "",
      end_time: "",
      venue: "",
      notes: "",
    });
    loadEvents(selectedBatchId, selectedDivisionId, activeTab);
  };

  const importEvents = async () => {
    if (!previewRows.length) return;

    setSaving(true);

    try {
      const inserts: Record<string, unknown>[] = [];

      for (const row of previewRows) {
        const resolvedBatch = row.batch_code
          ? batchByCode.get(row.batch_code.toLowerCase())
          : batches.find((b) => b.batch_id === selectedBatchId);

        if (!resolvedBatch) continue;

        if (resolvedBatch.batch_id !== selectedBatchId) continue;

        const division = divisionByKey.get(row.division.toLowerCase());
        const course = courseByCode.get(row.course_code.toLowerCase());

        if (!division || !course) continue;

        const facultyRow = row.faculty_email ? facultyByEmail.get(row.faculty_email.toLowerCase()) : undefined;

        inserts.push({
          batch_id: resolvedBatch.batch_id,
          division_id: division.id,
          course_id: course.id,
          faculty_id: facultyRow?.id ?? null,
          event_date: row.event_date,
          start_time: normalizeTime(row.start_time),
          end_time: normalizeTime(row.end_time),
          venue: row.venue?.trim() || null,
          notes: row.notes?.trim() || null,
          is_published: false,
          created_by: null,
        });
      }

      if (inserts.length === 0) {
        toast.error("No valid rows found for import.");
        return;
      }

      const { error } = await supabase.from("t211_timetable_event").insert(inserts as never[]);

      if (error) {
        toast.error(`Import failed: ${error.message}`);
        return;
      }

      toast.success(`Imported ${inserts.length} timetable events.`);
      setPreviewRows([]);
      loadEvents(selectedBatchId, selectedDivisionId, activeTab);
    } finally {
      setSaving(false);
    }
  };

  const setPublishStateForFiltered = async (isPublished: boolean) => {
    if (events.length === 0) {
      toast.error("No events in the current filter.");
      return;
    }

    const ids = events.map((e) => e.event_id);

    const { error } = await supabase
      .from("t211_timetable_event")
      .update({ is_published: isPublished } as never)
      .in("event_id", ids);

    if (error) {
      toast.error(`Failed to update publish state: ${error.message}`);
      return;
    }

    toast.success(isPublished ? "Events published." : "Events moved to draft.");
    loadEvents(selectedBatchId, selectedDivisionId, activeTab);
  };

  const cancelFilteredEvents = async () => {
    if (events.length === 0) { toast.error("No events in filter."); return; }
    const ids = events.map((e) => e.event_id);
    const { error } = await supabase
      .from("t211_timetable_event")
      .update({ status: "cancelled" } as never)
      .in("event_id", ids);
    if (error) { toast.error(`Failed to cancel: ${error.message}`); return; }
    toast.success("Events marked as cancelled.");
    loadEvents(selectedBatchId, selectedDivisionId, activeTab);
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold leading-none">Timetable</p>
              <p className="text-xs text-muted-foreground mt-0.5">Publish and view class schedules</p>
            </div>
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
              <Label>Division</Label>
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

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {forcedMode === "hub" ? (
            <TabsList>
              <TabsTrigger value="publish">Publish</TabsTrigger>
              <TabsTrigger value="view">View</TabsTrigger>
            </TabsList>
          ) : null}

          <TabsContent value="publish" className="mt-4 space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Add Class Event</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={createEvent} className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Division *</Label>
                    <Select value={form.division_id} onValueChange={(value) => setForm((f) => ({ ...f, division_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.division_code} - {d.division_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Course *</Label>
                    <Select value={form.course_id} onValueChange={(value) => setForm((f) => ({ ...f, course_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_code} - {c.course_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Faculty</Label>
                    <Select value={form.faculty_id} onValueChange={(value) => setForm((f) => ({ ...f, faculty_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                      <SelectContent>
                        {faculty.map((f) => <SelectItem key={f.id} value={f.id}>{f.first_name} {f.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Date *</Label>
                    <Input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Start Time *</Label>
                    <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Time *</Label>
                    <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Venue</Label>
                    <Input value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Notes</Label>
                    <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>

                  <div className="sm:col-span-3">
                    <Button type="submit" disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                      Add Event
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">CSV/Excel Upload</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Upload timetable file with Date/Time/Course/Division columns</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const rows = await parseTimetableExcel(f);
                        setPreviewRows(rows);
                        toast.success(`Parsed ${rows.length} rows.`);
                      } catch {
                        toast.error("Failed to parse timetable file.");
                      }
                    }}
                  />
                </div>

                {previewRows.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{previewRows.length} rows ready for import</p>
                    <Button onClick={importEvents} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Import Events
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPublishStateForFiltered(true)}>Publish Filtered Events</Button>
              <Button variant="outline" onClick={() => setPublishStateForFiltered(false)}>Move Filtered to Draft</Button>
              <Button variant="destructive" onClick={cancelFilteredEvents}>Cancel Filtered Events</Button>
            </div>
          </TabsContent>

          <TabsContent value="view" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Timetable Events ({events.length})</CardTitle></CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No timetable events found for this filter.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Published</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Venue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((e) => {
                        const division = divisions.find((d) => d.id === e.division_id);
                        const course = courses.find((c) => c.id === e.course_id);
                        return (
                          <TableRow key={e.event_id}>
                            <TableCell>{e.event_date}</TableCell>
                            <TableCell>{e.start_time.slice(0, 5)} - {e.end_time.slice(0, 5)}</TableCell>
                            <TableCell>{division ? `${division.division_code}` : "-"}</TableCell>
                            <TableCell>{course ? `${course.course_code}` : "-"}</TableCell>
                            <TableCell>
                              <Badge variant={e.is_published ? "default" : "secondary"}>{e.is_published ? "Published" : "Draft"}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                e.status === "completed" ? "default" :
                                  e.status === "cancelled" ? "destructive" : "secondary"
                              }>
                                {e.status ?? "scheduled"}
                              </Badge>
                            </TableCell>
                            <TableCell>{e.venue ?? "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
