import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BarChart3, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { BatchOption, CourseOption, DivisionOption, StudentOption, fetchBatchOptions, fetchCourseOptions, fetchDivisionOptions, fetchStudentOptions } from "@/lib/academic-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface AttendanceImportRow {
  roll_number: string;
  course_code: string;
  session_date: string;
  status: "Present" | "Absent" | string;
  division?: string;
}

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

function parseAttendanceExcel(file: File): Promise<AttendanceImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

        const mapped = rows.map((r) => {
          let sessionDate = String(r["Session Date"] ?? r["session_date"] ?? "").trim();

          const rawDate = r["Session Date"] ?? r["session_date"];
          if (typeof rawDate === "number") {
            const d = XLSX.SSF.parse_date_code(rawDate);
            sessionDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          }

          return {
            roll_number: String(r["Roll Number"] ?? r["roll_number"] ?? "").trim(),
            course_code: String(r["Course Code"] ?? r["course_code"] ?? "").trim(),
            session_date: sessionDate,
            status: String(r["Status"] ?? r["Attendance Status"] ?? r["status"] ?? "").trim(),
            division: String(r["Division"] ?? r["division"] ?? "").trim(),
          };
        });

        resolve(mapped.filter((r) => r.roll_number && r.course_code && r.session_date && r.status));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function normalizeStatus(status: string): "Present" | "Absent" | null {
  const value = status.trim().toLowerCase();
  if (value === "present" || value === "p") return "Present";
  if (value === "absent" || value === "a") return "Absent";
  return null;
}

export default function AttendanceHubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const forcedMode = location.pathname.includes("/upload")
    ? "upload"
    : location.pathname.includes("/view")
      ? "view"
      : location.pathname.includes("/reports")
        ? "reports"
        : "hub";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(forcedMode === "hub" ? "upload" : forcedMode);

  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState("all");
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState("all");

  const [previewRows, setPreviewRows] = useState<AttendanceImportRow[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const studentByRoll = useMemo(() => {
    const map = new Map<string, StudentOption>();
    for (const s of students) map.set(s.roll_number.toLowerCase(), s);
    return map;
  }, [students]);

  const courseByCode = useMemo(() => {
    const map = new Map<string, CourseOption>();
    for (const c of courses) map.set(c.course_code.toLowerCase(), c);
    return map;
  }, [courses]);

  const divisionByKey = useMemo(() => {
    const map = new Map<string, DivisionOption>();
    for (const d of divisions) {
      map.set(d.division_code.toLowerCase(), d);
      map.set(d.division_name.toLowerCase(), d);
    }
    return map;
  }, [divisions]);

  const studentById = useMemo(() => {
    const map = new Map<string, StudentOption>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  const courseById = useMemo(() => {
    const map = new Map<string, CourseOption>();
    for (const c of courses) map.set(c.id, c);
    return map;
  }, [courses]);

  const divisionById = useMemo(() => {
    const map = new Map<string, DivisionOption>();
    for (const d of divisions) map.set(d.id, d);
    return map;
  }, [divisions]);

  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [batchRows, courseRows] = await Promise.all([
        fetchBatchOptions(),
        fetchCourseOptions(),
      ]);

      setBatches(batchRows);
      setCourses(courseRows);
      setSelectedBatchId(batchRows[0]?.batch_id || "");
    } catch (error: any) {
      toast.error(`Failed to load attendance metadata: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadDivisionAndStudents = async (batchId: string) => {
    if (!batchId) {
      setDivisions([]);
      setStudents([]);
      return;
    }

    try {
      const [divisionRows, studentRows] = await Promise.all([
        fetchDivisionOptions(batchId),
        fetchStudentOptions(batchId),
      ]);

      setDivisions(divisionRows.filter((d) => d.is_active));
      setStudents(studentRows);

      setSelectedDivisionId("all");
      setSelectedCourseId("all");
      setSelectedStudentId("all");
    } catch (error: any) {
      toast.error(`Failed to load filters: ${error.message}`);
    }
  };

  const loadRecords = async () => {
    if (!selectedBatchId) {
      setRecords([]);
      return;
    }

    let query = supabase
      .from("t301_attendance_record")
      .select("attendance_id,batch_id,division_id,student_id,course_id,session_date,status,source")
      .eq("batch_id", selectedBatchId)
      .order("session_date", { ascending: false });

    if (selectedDivisionId !== "all") query = query.eq("division_id", selectedDivisionId);
    if (selectedCourseId !== "all") query = query.eq("course_id", selectedCourseId);
    if (selectedStudentId !== "all") query = query.eq("student_id", selectedStudentId);

    const { data, error } = await query;

    if (error) {
      toast.error(`Failed to load attendance records: ${error.message}`);
      return;
    }

    setRecords((data ?? []) as AttendanceRecord[]);
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      loadDivisionAndStudents(selectedBatchId);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId && (activeTab === "view" || activeTab === "reports")) {
      loadRecords();
    }
  }, [selectedBatchId, selectedDivisionId, selectedCourseId, selectedStudentId, activeTab]);

  useEffect(() => {
    if (forcedMode !== "hub") {
      setActiveTab(forcedMode);
    }
  }, [forcedMode]);

  const uploadAttendance = async () => {
    if (!selectedBatchId) {
      toast.error("Select a batch first.");
      return;
    }

    if (previewRows.length === 0) return;

    setSaving(true);
    try {
      const inserts: Record<string, unknown>[] = [];

      for (const row of previewRows) {
        const student = studentByRoll.get(row.roll_number.toLowerCase());
        const course = courseByCode.get(row.course_code.toLowerCase());
        const status = normalizeStatus(row.status);

        if (!student || !course || !status) continue;

        const division = row.division
          ? divisionByKey.get(row.division.toLowerCase())
          : undefined;

        inserts.push({
          batch_id: selectedBatchId,
          division_id: division?.id ?? student.division_id,
          student_id: student.id,
          course_id: course.id,
          session_date: row.session_date,
          status,
          source: "excel",
          created_by: null,
        });
      }

      if (inserts.length === 0) {
        toast.error("No valid rows found for upload.");
        return;
      }

      const { error } = await supabase
        .from("t301_attendance_record")
        .upsert(inserts as never[], { onConflict: "student_id,course_id,session_date" });

      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }

      toast.success(`Uploaded ${inserts.length} attendance records.`);
      setPreviewRows([]);
      loadRecords();
    } finally {
      setSaving(false);
    }
  };

  const reportByStudent = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();

    for (const r of records) {
      const current = map.get(r.student_id) ?? { present: 0, total: 0 };
      current.total += 1;
      if (r.status === "Present") current.present += 1;
      map.set(r.student_id, current);
    }

    return Array.from(map.entries())
      .map(([studentId, value]) => ({
        studentId,
        present: value.present,
        total: value.total,
        percentage: value.total > 0 ? (value.present / value.total) * 100 : 0,
      }))
      .sort((a, b) => a.percentage - b.percentage);
  }, [records]);

  const reportByCourse = useMemo(() => {
    const map = new Map<string, { present: number; total: number }>();

    for (const r of records) {
      if (!r.course_id) continue;
      const current = map.get(r.course_id) ?? { present: 0, total: 0 };
      current.total += 1;
      if (r.status === "Present") current.present += 1;
      map.set(r.course_id, current);
    }

    return Array.from(map.entries()).map(([courseId, value]) => ({
      courseId,
      present: value.present,
      total: value.total,
      percentage: value.total > 0 ? (value.present / value.total) * 100 : 0,
    })).sort((a, b) => a.percentage - b.percentage);
  }, [records]);

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
            <BarChart3 className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold leading-none">Attendance Hub</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upload, filter and analyze attendance</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6 max-w-6xl">
        <Card>
          <CardContent className="p-4 grid gap-4 sm:grid-cols-4">
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
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {divisions.map((d) => <SelectItem key={d.id} value={d.id}>{d.division_code} - {d.division_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Course</Label>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.course_code} - {c.course_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.roll_number} - {s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {forcedMode === "hub" ? (
            <TabsList>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="view">View</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
          ) : null}

          <TabsContent value="upload" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Upload Attendance</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Upload Excel with Roll Number, Course Code, Session Date, Status</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        const rows = await parseAttendanceExcel(f);
                        setPreviewRows(rows);
                        toast.success(`Parsed ${rows.length} rows.`);
                      } catch {
                        toast.error("Failed to parse attendance file.");
                      }
                    }}
                  />
                </div>

                {previewRows.length > 0 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{previewRows.length} rows ready to upload</p>
                    <Button onClick={uploadAttendance} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="view" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Attendance Records ({records.length})</CardTitle></CardHeader>
              <CardContent>
                {records.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No records found for the selected filters.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Roll Number</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Division</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => {
                        const student = studentById.get(r.student_id);
                        const division = r.division_id ? divisionById.get(r.division_id) : null;
                        const course = r.course_id ? courseById.get(r.course_id) : null;

                        return (
                          <TableRow key={r.attendance_id}>
                            <TableCell>{r.session_date}</TableCell>
                            <TableCell className="font-mono">{student?.roll_number ?? "-"}</TableCell>
                            <TableCell>{student ? `${student.first_name} ${student.last_name}` : "-"}</TableCell>
                            <TableCell>{division ? division.division_code : "-"}</TableCell>
                            <TableCell>{course ? course.course_code : "-"}</TableCell>
                            <TableCell>
                              <Badge variant={r.status === "Present" ? "default" : "secondary"}>{r.status}</Badge>
                            </TableCell>
                            <TableCell>{r.source}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Student-wise Attendance Percentage</CardTitle></CardHeader>
              <CardContent>
                {reportByStudent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No records available for reporting.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll Number</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Present</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Attendance %</TableHead>
                        <TableHead>Flag</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportByStudent.map((row) => {
                        const student = studentById.get(row.studentId);
                        const isLow = row.percentage < 75;
                        return (
                          <TableRow key={row.studentId}>
                            <TableCell className="font-mono">{student?.roll_number ?? "-"}</TableCell>
                            <TableCell>{student ? `${student.first_name} ${student.last_name}` : "-"}</TableCell>
                            <TableCell>{row.present}</TableCell>
                            <TableCell>{row.total}</TableCell>
                            <TableCell>{row.percentage.toFixed(1)}%</TableCell>
                            <TableCell>
                              {isLow ? (
                                <span className="inline-flex items-center gap-1 text-xs text-status-danger">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Low
                                </span>
                              ) : (
                                <span className="text-xs text-status-success">OK</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Course-wise Attendance Percentage</CardTitle></CardHeader>
              <CardContent>
                {reportByCourse.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No course-level records available.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Present</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Attendance %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportByCourse.map((row) => {
                        const course = courseById.get(row.courseId);
                        return (
                          <TableRow key={row.courseId}>
                            <TableCell>{course ? `${course.course_code} - ${course.course_name}` : "-"}</TableCell>
                            <TableCell>{row.present}</TableCell>
                            <TableCell>{row.total}</TableCell>
                            <TableCell>{row.percentage.toFixed(1)}%</TableCell>
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
