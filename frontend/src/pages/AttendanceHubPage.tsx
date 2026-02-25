import React, { useState, useCallback, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, RefreshCw } from "lucide-react";
import {
  fetchBatchOptions, fetchDivisionOptions, fetchStudentOptions, fetchCourseOptions,
  fetchTimetableEvents, fetchAttendanceConfig,
  BatchOption, DivisionOption, StudentOption, CourseOption, TimetableEventOption,
} from "@/lib/academic-data";

// ── Interfaces ─────────────────────────────────────────────────────────────

interface AttendanceRecord {
  attendance_id: string;
  batch_id: string;
  division_id: string | null;
  student_id: string;
  course_id: string | null;
  session_date: string;
  status: "Present" | "Absent";
  source: string;
}

interface AttendanceImportRow {
  roll_number: string;
  course_code: string;
  session_date: string;
  status: "Present" | "Absent";
}

// Biometric machine Excel columns: Roll No, Swipe TIme, Error Code, Controller Name
interface BiometricImportRow {
  roll_no: string;
  punch_datetime: string;  // ISO string
  device_id: string | null;
  error_code: string;
}

interface SessionAttendanceRecord {
  attendance_id: string;
  event_id: string;
  student_id: string;
  status: "present" | "absent" | "late";
  first_punch_time: string | null;
  last_punch_time: string | null;
  marked_by: string;
  marked_at: string;
}

// ── Biometric Excel Parser ─────────────────────────────────────────────────
// Parses the biometric machine export. Handles "Swipe TIme" (machine typo)
// and "Swipe Time". Filters rows where Error Code is "success" (case-insensitive).

function formatExcelDatetime(raw: number | string): string {
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}T${pad(parsed.H)}:${pad(parsed.M)}:${pad(parsed.S)}`;
  }
  return String(raw).trim();
}

function parseBiometricExcel(file: File): Promise<BiometricImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const parsed: BiometricImportRow[] = [];
        for (const r of rows) {
          // Roll number column
          const rollNo = String(r["Roll No"] ?? r["roll_no"] ?? "").trim();
          if (!rollNo) continue;

          // Swipe time column – machine has a typo: "Swipe TIme"
          const rawTime = r["Swipe TIme"] ?? r["Swipe Time"] ?? r["swipe_time"] ?? "";
          if (!rawTime) continue;

          // Error code filter – only process rows marked as success
          const errorCode = String(r["Error Code"] ?? r["error_code"] ?? "").trim();
          if (errorCode.toLowerCase() !== "success") continue;

          const deviceId = String(r["Controller Name"] ?? r["device_id"] ?? "").trim() || null;

          const punchDatetime = formatExcelDatetime(rawTime as number | string);

          parsed.push({ roll_no: rollNo, punch_datetime: punchDatetime, device_id: deviceId, error_code: errorCode });
        }

        resolve(parsed);
      } catch (err) {
        reject(new Error("Failed to parse biometric file: " + String(err)));
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Manual Attendance Excel Parser ─────────────────────────────────────────

function parseAttendanceExcel(file: File): Promise<AttendanceImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "array", cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        const parsed: AttendanceImportRow[] = [];
        for (const r of rows) {
          const rollNumber = String(r["Roll Number"] ?? r["roll_number"] ?? "").trim();
          const courseCode = String(r["Course Code"] ?? r["course_code"] ?? "").trim();
          if (!rollNumber || !courseCode) continue;

          let sessionDate = String(r["Session Date"] ?? r["session_date"] ?? "").trim();
          const rawDate = r["Session Date"] ?? r["session_date"];
          if (typeof rawDate === "number") {
            const d = XLSX.SSF.parse_date_code(rawDate);
            sessionDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          }
          if (!sessionDate) continue;

          const rawStatus = String(r["Status"] ?? r["status"] ?? "Present").trim();
          const status: "Present" | "Absent" = rawStatus.toLowerCase() === "absent" ? "Absent" : "Present";

          parsed.push({ roll_number: rollNumber, course_code: courseCode, session_date: sessionDate, status });
        }
        resolve(parsed);
      } catch (err) {
        reject(new Error("Failed to parse attendance file: " + String(err)));
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AttendanceHubPage() {
  // ── Shared filter state ──────────────────────────────────────────────────
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");

  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(75);

  // ── Manual upload state ──────────────────────────────────────────────────
  const [importRows, setImportRows] = useState<AttendanceImportRow[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── View state ───────────────────────────────────────────────────────────
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // ── Biometric state ──────────────────────────────────────────────────────
  const [biometricRows, setBiometricRows] = useState<BiometricImportRow[]>([]);
  const [uploadingBio, setUploadingBio] = useState(false);
  const [timetableEvents, setTimetableEvents] = useState<TimetableEventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("none");
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{
    present: number; absent: number; total: number;
    window_start: string; window_end: string;
  } | null>(null);

  // ── Session attendance (t303) state ─────────────────────────────────────
  const [sessionRecords, setSessionRecords] = useState<SessionAttendanceRecord[]>([]);
  const [sessionBatchId, setSessionBatchId] = useState<string>("all");
  const [sessionEvents, setSessionEvents] = useState<TimetableEventOption[]>([]);
  const [sessionEventId, setSessionEventId] = useState<string>("none");

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchBatchOptions().then(setBatches).catch(console.error);
    fetchCourseOptions().then(setCourses).catch(console.error);
    fetchAttendanceConfig()
      .then((cfg) => setAttendanceThreshold(parseInt(cfg.low_attendance_pct ?? "75", 10)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedBatchId === "all") { setDivisions([]); setStudents([]); return; }
    fetchDivisionOptions(selectedBatchId).then(setDivisions).catch(console.error);
    fetchStudentOptions(selectedBatchId).then(setStudents).catch(console.error);
  }, [selectedBatchId]);

  // Load timetable events for biometric tab when batch/division filter changes
  useEffect(() => {
    if (selectedBatchId === "all") { setTimetableEvents([]); return; }
    fetchTimetableEvents(
      selectedBatchId,
      selectedDivisionId !== "all" ? selectedDivisionId : undefined
    ).then(setTimetableEvents).catch(console.error);
  }, [selectedBatchId, selectedDivisionId]);

  // Load timetable events for session-wise reports
  useEffect(() => {
    if (sessionBatchId === "all") { setSessionEvents([]); return; }
    fetchTimetableEvents(sessionBatchId).then(setSessionEvents).catch(console.error);
  }, [sessionBatchId]);

  // ── Manual attendance upload ─────────────────────────────────────────────

  const handleManualFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseAttendanceExcel(file);
      setImportRows(rows);
      toast.success(`Parsed ${rows.length} rows.`);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const uploadAttendance = useCallback(async () => {
    if (!importRows.length) { toast.error("No rows to upload."); return; }
    if (selectedBatchId === "all") { toast.error("Select a batch first."); return; }
    setUploading(true);

    const studentMap = new Map(students.map((s) => [s.roll_number, s]));
    const courseMap = new Map(courses.map((c) => [c.course_code, c]));

    const inserts: object[] = [];
    const skipped: string[] = [];

    for (const row of importRows) {
      const student = studentMap.get(row.roll_number);
      const course = courseMap.get(row.course_code);
      if (!student || !course) {
        skipped.push(row.roll_number);
        continue;
      }
      inserts.push({
        batch_id: selectedBatchId,
        division_id: student.division_id || null,
        student_id: student.id,
        course_id: course.id,
        session_date: row.session_date,
        status: row.status,
        source: "excel",
      });
    }

    if (inserts.length > 0) {
      const { error } = await supabase
        .from("t301_attendance_record")
        .upsert(inserts as never[], { onConflict: "student_id,course_id,session_date" });
      if (error) { toast.error(`Upload failed: ${error.message}`); setUploading(false); return; }
    }

    toast.success(`Uploaded ${inserts.length} records.${skipped.length ? ` Skipped ${skipped.length} (not found).` : ""}`);
    setImportRows([]);
    setUploading(false);
  }, [importRows, selectedBatchId, students, courses]);

  // ── View attendance ──────────────────────────────────────────────────────

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    let query = supabase
      .from("t301_attendance_record")
      .select("attendance_id,batch_id,division_id,student_id,course_id,session_date,status,source")
      .order("session_date", { ascending: false });

    if (selectedBatchId !== "all") query = query.eq("batch_id", selectedBatchId);
    if (selectedDivisionId !== "all") query = query.eq("division_id", selectedDivisionId);
    if (selectedStudentId !== "all") query = query.eq("student_id", selectedStudentId);
    if (selectedCourseId !== "all") query = query.eq("course_id", selectedCourseId);

    const { data, error } = await query.limit(500);
    if (error) { toast.error(error.message); setLoadingRecords(false); return; }
    setRecords((data ?? []) as AttendanceRecord[]);
    setLoadingRecords(false);
  }, [selectedBatchId, selectedDivisionId, selectedStudentId, selectedCourseId]);

  // ── Biometric upload ─────────────────────────────────────────────────────

  const handleBioFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseBiometricExcel(file);
      setBiometricRows(rows);
      toast.success(`Parsed ${rows.length} valid biometric punches (Error Code = success).`);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);

  const uploadBiometricLogs = useCallback(async () => {
    if (!biometricRows.length) { toast.error("No biometric rows to upload."); return; }
    setUploadingBio(true);
    const importBatchId = `bio-${new Date().toISOString().slice(0, 16).replace("T", "-")}`;
    const inserts = biometricRows.map((r) => ({
      roll_no: r.roll_no,
      punch_datetime: r.punch_datetime,
      device_id: r.device_id,
      error_code: r.error_code,
      import_batch_id: importBatchId,
    }));

    const { error } = await supabase.from("t302_biometric_log").insert(inserts as never[]);
    if (error) { toast.error(`Biometric upload failed: ${error.message}`); setUploadingBio(false); return; }
    toast.success(`Uploaded ${inserts.length} biometric punch records. Batch ID: ${importBatchId}`);
    setBiometricRows([]);
    setUploadingBio(false);
  }, [biometricRows]);

  const processAttendance = useCallback(async () => {
    if (selectedEventId === "none") { toast.error("Select a session to process."); return; }
    setProcessing(true);
    setProcessResult(null);

    const { data, error } = await (supabase as any).rpc(
      "fn_process_attendance_for_event",
      { p_event_id: selectedEventId }
    );

    if (error) { toast.error(`Processing failed: ${error.message}`); setProcessing(false); return; }

    const result = data as {
      present: number; absent: number; total: number;
      window_start: string; window_end: string; error?: string;
    };

    if (result?.error) {
      toast.error(`Engine error: ${result.error}`);
    } else {
      setProcessResult(result);
      toast.success(`Done! Present: ${result.present}, Absent: ${result.absent}`);
    }
    setProcessing(false);
  }, [selectedEventId]);

  // ── Session-wise attendance (t303) ───────────────────────────────────────

  const loadSessionAttendance = useCallback(async () => {
    if (sessionEventId === "none") { toast.error("Select a session."); return; }
    const { data, error } = await supabase
      .from("t303_session_attendance")
      .select("attendance_id,event_id,student_id,status,first_punch_time,last_punch_time,marked_by,marked_at")
      .eq("event_id", sessionEventId)
      .order("status", { ascending: true });

    if (error) { toast.error(error.message); return; }
    setSessionRecords((data ?? []) as SessionAttendanceRecord[]);
  }, [sessionEventId]);

  // ── Reports ──────────────────────────────────────────────────────────────

  const reportByStudent = useMemo(() => {
    const map = new Map<string, { present: number; total: number; name: string; roll: string }>();
    for (const r of records) {
      const s = students.find((x) => x.id === r.student_id);
      const key = r.student_id;
      if (!map.has(key)) {
        map.set(key, {
          present: 0, total: 0,
          name: s ? `${s.first_name} ${s.last_name}` : r.student_id,
          roll: s?.roll_number ?? "-",
        });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      if (r.status === "Present") entry.present += 1;
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      student_id: id, ...v,
      pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    })).sort((a, b) => a.pct - b.pct);
  }, [records, students]);

  const reportByCourse = useMemo(() => {
    const map = new Map<string, { present: number; total: number; code: string; name: string }>();
    for (const r of records) {
      const c = courses.find((x) => x.id === r.course_id);
      const key = r.course_id ?? "unknown";
      if (!map.has(key)) {
        map.set(key, { present: 0, total: 0, code: c?.course_code ?? "-", name: c?.course_name ?? "-" });
      }
      const entry = map.get(key)!;
      entry.total += 1;
      if (r.status === "Present") entry.present += 1;
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      course_id: id, ...v,
      pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    })).sort((a, b) => a.pct - b.pct);
  }, [records, courses]);

  // ── Shared filter bar ────────────────────────────────────────────────────

  const FilterBar = () => (
    <div className="flex flex-wrap gap-2 mb-4">
      <Select value={selectedBatchId} onValueChange={(v) => { setSelectedBatchId(v); setSelectedDivisionId("all"); setSelectedStudentId("all"); }}>
        <SelectTrigger className="w-44"><SelectValue placeholder="All Batches" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Batches</SelectItem>
          {batches.map((b) => <SelectItem key={b.batch_id} value={b.batch_id}>{b.batch_code}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={selectedDivisionId} onValueChange={setSelectedDivisionId} disabled={selectedBatchId === "all"}>
        <SelectTrigger className="w-44"><SelectValue placeholder="All Divisions" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Divisions</SelectItem>
          {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.division_code}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
        <SelectTrigger className="w-52"><SelectValue placeholder="All Courses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Courses</SelectItem>
          {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_code} – {c.course_name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={selectedBatchId === "all"}>
        <SelectTrigger className="w-52"><SelectValue placeholder="All Students" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Students</SelectItem>
          {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.roll_number} – {s.first_name} {s.last_name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload manual attendance, ingest biometric punches, and process session-level attendance.
        </p>
      </div>

      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Manual Upload</TabsTrigger>
          <TabsTrigger value="biometric">Biometric</TabsTrigger>
          <TabsTrigger value="view">View Records</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* ── Manual Upload Tab ──────────────────────────────────────── */}
        <TabsContent value="upload" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Manual Attendance (Excel)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Required columns: <strong>Roll Number</strong>, <strong>Course Code</strong>,{" "}
                <strong>Session Date</strong> (YYYY-MM-DD), <strong>Status</strong> (Present / Absent).
              </p>

              <FilterBar />

              <div className="flex items-center gap-3">
                <label
                  htmlFor="att-file"
                  className="flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer hover:bg-muted text-sm"
                >
                  <Upload className="w-4 h-4" /> Choose Excel File
                </label>
                <input id="att-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleManualFileChange} />
                {importRows.length > 0 && (
                  <span className="text-sm text-muted-foreground">{importRows.length} rows parsed</span>
                )}
              </div>

              {importRows.length > 0 && (
                <div className="rounded-md border overflow-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll</TableHead><TableHead>Course</TableHead>
                        <TableHead>Date</TableHead><TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importRows.slice(0, 20).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.roll_number}</TableCell>
                          <TableCell>{r.course_code}</TableCell>
                          <TableCell>{r.session_date}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === "Present" ? "default" : "destructive"}>{r.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importRows.length > 20 && <p className="text-xs text-center py-1 text-muted-foreground">Showing first 20 of {importRows.length}</p>}
                </div>
              )}

              <Button onClick={uploadAttendance} disabled={uploading || !importRows.length}>
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload to Attendance Records
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Biometric Tab ──────────────────────────────────────────── */}
        <TabsContent value="biometric" className="space-y-4 mt-4">

          {/* Step 1: Upload raw biometric file */}
          <Card>
            <CardHeader>
              <CardTitle>Step 1 — Upload Biometric Punches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export from the biometric machine and upload here.
                Only rows where <strong>Error Code = success</strong> are stored.
                Columns used: <strong>Roll No</strong>, <strong>Swipe TIme</strong>, <strong>Error Code</strong>, <strong>Controller Name</strong>.
              </p>

              <div className="flex items-center gap-3">
                <label
                  htmlFor="bio-file"
                  className="flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer hover:bg-muted text-sm"
                >
                  <Upload className="w-4 h-4" /> Choose Biometric Excel
                </label>
                <input id="bio-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBioFileChange} />
                {biometricRows.length > 0 && (
                  <span className="text-sm text-muted-foreground">{biometricRows.length} valid punches parsed</span>
                )}
              </div>

              {biometricRows.length > 0 && (
                <div className="rounded-md border overflow-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll No</TableHead>
                        <TableHead>Punch Time</TableHead>
                        <TableHead>Device</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {biometricRows.slice(0, 20).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.roll_no}</TableCell>
                          <TableCell>{r.punch_datetime}</TableCell>
                          <TableCell>{r.device_id ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {biometricRows.length > 20 && <p className="text-xs text-center py-1 text-muted-foreground">Showing first 20 of {biometricRows.length}</p>}
                </div>
              )}

              <Button onClick={uploadBiometricLogs} disabled={uploadingBio || !biometricRows.length}>
                {uploadingBio && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Store Punches to Biometric Log
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Process a session */}
          <Card>
            <CardHeader>
              <CardTitle>Step 2 — Process Attendance for a Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a batch, division (optional), and a session. The engine will match stored biometric
                punches to each student in the division using the configured grace window.
              </p>

              {/* Batch + division selectors */}
              <div className="flex flex-wrap gap-2">
                <Select value={selectedBatchId} onValueChange={(v) => { setSelectedBatchId(v); setSelectedDivisionId("all"); setSelectedEventId("none"); }}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => <SelectItem key={b.batch_id} value={b.batch_id}>{b.batch_code}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={selectedDivisionId} onValueChange={(v) => { setSelectedDivisionId(v); setSelectedEventId("none"); }} disabled={selectedBatchId === "all"}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="All Divisions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.division_code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Session selector */}
              <Select value={selectedEventId} onValueChange={setSelectedEventId} disabled={!timetableEvents.length}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={timetableEvents.length ? "Select a session" : "Select batch first"} />
                </SelectTrigger>
                <SelectContent>
                  {timetableEvents.map((ev) => (
                    <SelectItem key={ev.event_id} value={ev.event_id}>
                      {ev.event_date} · {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)} · {ev.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={processAttendance} disabled={processing || selectedEventId === "none"}>
                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Process Attendance
              </Button>

              {processResult && (
                <div className="p-4 rounded-md bg-muted text-sm space-y-1">
                  <p><strong>Present:</strong> {processResult.present} &nbsp;|&nbsp; <strong>Absent:</strong> {processResult.absent} &nbsp;|&nbsp; <strong>Total:</strong> {processResult.total}</p>
                  <p className="text-muted-foreground text-xs">
                    Window: {new Date(processResult.window_start).toLocaleTimeString()} – {new Date(processResult.window_end).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── View Records Tab ───────────────────────────────────────── */}
        <TabsContent value="view" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>View Manual Attendance Records</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterBar />
              <Button variant="outline" onClick={loadRecords} disabled={loadingRecords}>
                {loadingRecords ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Load Records
              </Button>

              {records.length > 0 && (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead><TableHead>Course</TableHead>
                        <TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => {
                        const s = students.find((x) => x.id === r.student_id);
                        const c = courses.find((x) => x.id === r.course_id);
                        return (
                          <TableRow key={r.attendance_id}>
                            <TableCell>{s ? `${s.roll_number} · ${s.first_name}` : r.student_id}</TableCell>
                            <TableCell>{c?.course_code ?? "-"}</TableCell>
                            <TableCell>{r.session_date}</TableCell>
                            <TableCell><Badge variant={r.status === "Present" ? "default" : "destructive"}>{r.status}</Badge></TableCell>
                            <TableCell className="text-muted-foreground text-xs">{r.source}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reports Tab ────────────────────────────────────────────── */}
        <TabsContent value="reports" className="space-y-6 mt-4">

          {/* Manual attendance analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Attendance — Student Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterBar />
              <Button variant="outline" onClick={loadRecords} disabled={loadingRecords}>
                {loadingRecords ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh
              </Button>
              {reportByStudent.length > 0 && (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll No</TableHead><TableHead>Student</TableHead>
                        <TableHead>Present</TableHead><TableHead>Total</TableHead><TableHead>%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportByStudent.map((r) => (
                        <TableRow key={r.student_id} className={r.pct < attendanceThreshold ? "bg-destructive/10" : ""}>
                          <TableCell>{r.roll}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.present}</TableCell>
                          <TableCell>{r.total}</TableCell>
                          <TableCell>
                            <Badge variant={r.pct < attendanceThreshold ? "destructive" : "default"}>{r.pct}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session-wise attendance from t303 */}
          <Card>
            <CardHeader>
              <CardTitle>Session-wise Attendance (Biometric-processed)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Select value={sessionBatchId} onValueChange={(v) => { setSessionBatchId(v); setSessionEventId("none"); setSessionRecords([]); }}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => <SelectItem key={b.batch_id} value={b.batch_id}>{b.batch_code}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={sessionEventId} onValueChange={setSessionEventId} disabled={!sessionEvents.length}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder={sessionEvents.length ? "Select Session" : "Select batch first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionEvents.map((ev) => (
                      <SelectItem key={ev.event_id} value={ev.event_id}>
                        {ev.event_date} · {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)} · {ev.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={loadSessionAttendance} disabled={sessionEventId === "none"}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Load
                </Button>
              </div>

              {sessionRecords.length > 0 && (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>First Punch</TableHead>
                        <TableHead>Last Punch</TableHead>
                        <TableHead>Marked By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionRecords.map((r) => {
                        const s = students.find((x) => x.id === r.student_id);
                        return (
                          <TableRow key={r.attendance_id}>
                            <TableCell>{s ? `${s.roll_number} · ${s.first_name}` : r.student_id}</TableCell>
                            <TableCell>
                              <Badge variant={r.status === "present" ? "default" : r.status === "late" ? "secondary" : "destructive"}>
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{r.first_punch_time ? new Date(r.first_punch_time).toLocaleTimeString() : "—"}</TableCell>
                            <TableCell className="text-xs">{r.last_punch_time ? new Date(r.last_punch_time).toLocaleTimeString() : "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.marked_by}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="p-2 text-xs text-muted-foreground flex gap-4">
                    <span>Present: {sessionRecords.filter(r => r.status === "present").length}</span>
                    <span>Absent: {sessionRecords.filter(r => r.status === "absent").length}</span>
                    <span>Total: {sessionRecords.length}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Course-wise summary */}
          <Card>
            <CardHeader><CardTitle>Manual Attendance — Course Summary</CardTitle></CardHeader>
            <CardContent>
              {reportByCourse.length > 0 ? (
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead><TableHead>Course</TableHead>
                        <TableHead>Present</TableHead><TableHead>Total</TableHead><TableHead>%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportByCourse.map((r) => (
                        <TableRow key={r.course_id}>
                          <TableCell>{r.code}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.present}</TableCell>
                          <TableCell>{r.total}</TableCell>
                          <TableCell>
                            <Badge variant={r.pct < attendanceThreshold ? "destructive" : "default"}>{r.pct}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Load records in the View tab first.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
