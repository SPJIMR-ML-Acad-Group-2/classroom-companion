import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BatchOption, StudentOption, fetchBatchOptions, fetchStudentOptions } from "@/lib/academic-data";
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

interface AcadGroup {
  group_id: string;
  batch_id: string;
  group_code: string;
  group_name: string;
  group_type: string;
  description: string | null;
  is_active: boolean;
}

interface GroupMap {
  id: string;
  student_id: string;
  group_id: string;
  is_active: boolean;
}

export default function BatchAcadGroupsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [groups, setGroups] = useState<AcadGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [mappings, setMappings] = useState<GroupMap[]>([]);

  const [form, setForm] = useState({
    group_code: "",
    group_name: "",
    group_type: "acad",
    description: "",
  });

  const studentById = useMemo(() => {
    const map = new Map<string, StudentOption>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

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

  const loadGroups = async (batchId: string) => {
    if (!batchId) {
      setGroups([]);
      return;
    }

    const { data, error } = await supabase
      .from("t209_acad_group")
      .select("group_id,batch_id,group_code,group_name,group_type,description,is_active")
      .eq("batch_id", batchId)
      .order("group_code", { ascending: true });

    if (error) {
      toast.error(`Failed to load groups: ${error.message}`);
      return;
    }

    const rows = (data ?? []) as AcadGroup[];
    setGroups(rows);

    if (rows.length > 0 && !rows.some((g) => g.group_id === selectedGroupId)) {
      setSelectedGroupId(rows[0].group_id);
    }
  };

  const loadMappings = async (groupId: string) => {
    if (!groupId) {
      setMappings([]);
      return;
    }

    const { data, error } = await supabase
      .from("t210_student_acad_group_map")
      .select("id,student_id,group_id,is_active")
      .eq("group_id", groupId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(`Failed to load group mappings: ${error.message}`);
      return;
    }

    setMappings((data ?? []) as GroupMap[]);
  };

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;

    fetchStudentOptions(selectedBatchId)
      .then((rows) => setStudents(rows))
      .catch((error) => toast.error(`Failed to load students: ${error.message}`));

    loadGroups(selectedBatchId);
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedGroupId) {
      loadMappings(selectedGroupId);
    }
  }, [selectedGroupId]);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBatchId) {
      toast.error("Select a batch first.");
      return;
    }

    if (!form.group_code.trim() || !form.group_name.trim()) {
      toast.error("Group code and name are required.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("t209_acad_group")
      .upsert(
        {
          batch_id: selectedBatchId,
          group_code: form.group_code.trim().toUpperCase(),
          group_name: form.group_name.trim(),
          group_type: form.group_type,
          description: form.description.trim() || null,
          is_active: true,
        } as never,
        { onConflict: "batch_id,group_code" },
      );

    setSaving(false);

    if (error) {
      toast.error(`Failed to save group: ${error.message}`);
      return;
    }

    toast.success("Academic group saved.");
    setForm({ group_code: "", group_name: "", group_type: "acad", description: "" });
    loadGroups(selectedBatchId);
  };

  const assignStudent = async () => {
    if (!selectedGroupId || !selectedStudentId) {
      toast.error("Select both group and student.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("t210_student_acad_group_map")
      .upsert(
        {
          student_id: selectedStudentId,
          group_id: selectedGroupId,
          is_active: true,
        } as never,
        { onConflict: "student_id,group_id" },
      );

    setSaving(false);

    if (error) {
      toast.error(`Failed to assign student: ${error.message}`);
      return;
    }

    toast.success("Student assigned to group.");
    loadMappings(selectedGroupId);
  };

  const removeMapping = async (id: string) => {
    const { error } = await supabase
      .from("t210_student_acad_group_map")
      .update({ is_active: false } as never)
      .eq("id", id);

    if (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
      return;
    }

    toast.success("Student removed from group.");
    loadMappings(selectedGroupId);
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/batches")} className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Batches
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <p className="text-sm font-semibold leading-none">Manage Acad Groups</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create groups and assign students</p>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6 max-w-6xl">
        <Card>
          <CardContent className="p-4">
            <Label>Batch</Label>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>
                {batches.map((b) => <SelectItem key={b.batch_id} value={b.batch_id}>{b.batch_code} - {b.batch_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Create Academic Group</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createGroup} className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Group Code *</Label>
                <Input value={form.group_code} onChange={(e) => setForm((f) => ({ ...f, group_code: e.target.value }))} placeholder="ACAD-A" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Group Name *</Label>
                <Input value={form.group_name} onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))} placeholder="Academic Group A" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.group_type} onValueChange={(value) => setForm((f) => ({ ...f, group_type: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="acad">Academic</SelectItem>
                    <SelectItem value="elective">Elective</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-4">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="sm:col-span-4">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save Group
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Assign Students to Group</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Group</Label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                  <SelectContent>
                    {groups.filter((g) => g.is_active).map((g) => (
                      <SelectItem key={g.group_id} value={g.group_id}>{g.group_code} - {g.group_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.roll_number} - {s.first_name} {s.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={assignStudent} disabled={saving || !selectedGroupId || !selectedStudentId} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Assign Student
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Current Group Membership</CardTitle></CardHeader>
          <CardContent>
            {mappings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students assigned in the selected group.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((m) => {
                    const student = studentById.get(m.student_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono">{student?.roll_number ?? "-"}</TableCell>
                        <TableCell>{student ? `${student.first_name} ${student.last_name}` : "Unknown"}</TableCell>
                        <TableCell>{student?.email ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => removeMapping(m.id)}>Remove</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
