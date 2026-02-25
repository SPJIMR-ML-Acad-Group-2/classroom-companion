import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const GROUP_TYPES = ["acad", "elective", "circle", "project"] as const;

interface AcadGroup {
    group_id: string;
    batch_id: string;
    group_code: string;
    group_name: string;
    group_type: string;
    description: string | null;
    is_active: boolean;
}

interface Batch {
    batch_id: string;
    batch_code: string;
    batch_name: string;
}

interface Student {
    id: string;
    roll_number: string;
    first_name: string;
    last_name: string;
}

interface Mapping {
    id: string;
    student_id: string;
    group_id: string;
}

export default function ManageAcadGroupsPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const batchId = params.get("batch_id") ?? "";

    const [batch, setBatch] = useState<Batch | null>(null);
    const [groups, setGroups] = useState<AcadGroup[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [mappings, setMappings] = useState<Mapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("");
    const [selectedStudentId, setSelectedStudentId] = useState<string>("");

    const [form, setForm] = useState({
        group_code: "",
        group_name: "",
        group_type: "acad" as string,
        description: "",
    });

    const [editBuf, setEditBuf] = useState({ group_name: "", description: "" });

    useEffect(() => {
        if (!batchId) return;
        const load = async () => {
            setLoading(true);
            const [batchRes, groupRes, studentRes, mapRes] = await Promise.all([
                (supabase as any).from("t201_batch").select("batch_id,batch_code,batch_name").eq("batch_id", batchId).single(),
                (supabase as any).from("t209_acad_group").select("*").eq("batch_id", batchId).order("group_code"),
                (supabase as any).from("t205_student_profile").select("id,roll_number,first_name,last_name").eq("batch_id", batchId).eq("is_active", true).order("roll_number"),
                (supabase as any).from("t210_student_acad_group_map").select("id,student_id,group_id"),
            ]);
            if (batchRes.data) setBatch(batchRes.data);
            setGroups(groupRes.data ?? []);
            setStudents(studentRes.data ?? []);
            setMappings(mapRes.data ?? []);
            setLoading(false);
        };
        load();
    }, [batchId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.group_code.trim() || !form.group_name.trim()) {
            toast.error("Group code and name are required.");
            return;
        }
        setSaving(true);
        const { data, error } = await (supabase as any)
            .from("t209_acad_group")
            .insert({
                batch_id: batchId,
                group_code: form.group_code.toUpperCase().trim(),
                group_name: form.group_name.trim(),
                group_type: form.group_type,
                description: form.description.trim() || null,
                is_active: true,
            })
            .select()
            .single();
        setSaving(false);
        if (error) { toast.error(`Failed: ${error.message}`); return; }
        setGroups((g) => [...g, data]);
        setForm({ group_code: "", group_name: "", group_type: "acad", description: "" });
        toast.success(`Group "${data.group_name}" created.`);
    };

    const startEdit = (g: AcadGroup) => {
        setEditingId(g.group_id);
        setEditBuf({ group_name: g.group_name, description: g.description ?? "" });
    };

    const saveEdit = async (g: AcadGroup) => {
        const { data, error } = await (supabase as any)
            .from("t209_acad_group")
            .update({ group_name: editBuf.group_name, description: editBuf.description || null })
            .eq("group_id", g.group_id)
            .select()
            .single();
        if (error) { toast.error(`Update failed: ${error.message}`); return; }
        setGroups((gs) => gs.map((x) => (x.group_id === g.group_id ? data : x)));
        setEditingId(null);
        toast.success("Group updated.");
    };

    const assignStudent = async () => {
        if (!selectedGroupId || !selectedStudentId) {
            toast.error("Select both a group and a student.");
            return;
        }
        const already = mappings.find((m) => m.group_id === selectedGroupId && m.student_id === selectedStudentId);
        if (already) { toast.error("Student already in this group."); return; }

        const { data, error } = await (supabase as any)
            .from("t210_student_acad_group_map")
            .insert({ group_id: selectedGroupId, student_id: selectedStudentId, is_active: true })
            .select()
            .single();
        if (error) { toast.error(`Failed: ${error.message}`); return; }
        setMappings((m) => [...m, data]);
        toast.success("Student assigned to group.");
    };

    const removeMapping = async (mappingId: string) => {
        const { error } = await (supabase as any).from("t210_student_acad_group_map").delete().eq("id", mappingId);
        if (error) { toast.error(`Failed: ${error.message}`); return; }
        setMappings((m) => m.filter((x) => x.id !== mappingId));
        toast.success("Student removed from group.");
    };

    const studentsInGroup = (groupId: string) =>
        mappings
            .filter((m) => m.group_id === groupId)
            .map((m) => students.find((s) => s.id === m.student_id))
            .filter(Boolean) as Student[];

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
                <div className="container flex h-16 items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/managebatch?batch_id=${batchId}`)} className="gap-2 text-muted-foreground">
                        <ArrowLeft className="h-4 w-4" /> Back to Batches
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div>
                        <p className="font-semibold text-sm">Manage Academic Groups</p>
                        {batch && <p className="text-xs text-muted-foreground font-mono">{batch.batch_code} · {batch.batch_name}</p>}
                    </div>
                </div>
            </header>

            <main className="container max-w-4xl py-8 space-y-8">
                {/* Create Group */}
                <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Create Academic Group</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-1.5">
                                    <Label>Code *</Label>
                                    <Input className="font-mono" placeholder="GRP-A" value={form.group_code} onChange={(e) => setForm((f) => ({ ...f, group_code: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Name *</Label>
                                    <Input placeholder="Finance Elective" value={form.group_name} onChange={(e) => setForm((f) => ({ ...f, group_name: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Type</Label>
                                    <Select value={form.group_type} onValueChange={(v) => setForm((f) => ({ ...f, group_type: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{GROUP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Description</Label>
                                <Textarea placeholder="Optional description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                            </div>
                            <Button type="submit" disabled={saving} className="gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Group
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Assign Students */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Assign Students to Groups</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Group</Label>
                                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                                    <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
                                    <SelectContent>{groups.map((g) => <SelectItem key={g.group_id} value={g.group_id}>{g.group_name} ({g.group_code})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Student</Label>
                                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                    <SelectTrigger><SelectValue placeholder="Select student..." /></SelectTrigger>
                                    <SelectContent>
                                        {students.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.roll_number} — {s.first_name} {s.last_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button size="sm" onClick={assignStudent} className="gap-2"><Plus className="h-3.5 w-3.5" /> Assign</Button>
                    </CardContent>
                </Card>

                {/* Group List with members */}
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : (
                    <div className="space-y-4">
                        {groups.map((g) => {
                            const members = studentsInGroup(g.group_id);
                            return (
                                <Card key={g.group_id}>
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-semibold text-sm">{g.group_code}</span>
                                                {editingId === g.group_id ? (
                                                    <>
                                                        <Input className="h-7 text-sm w-48" value={editBuf.group_name} onChange={(e) => setEditBuf((b) => ({ ...b, group_name: e.target.value }))} />
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(g)}><Check className="h-3.5 w-3.5" /></Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="font-semibold text-sm">{g.group_name}</span>
                                                        <Badge variant="outline" className="text-xs">{g.group_type}</Badge>
                                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(g)}><Pencil className="h-3 w-3" /></Button>
                                                    </>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{members.length} students</span>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {members.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">No students assigned yet.</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {members.map((s) => {
                                                    const mapping = mappings.find((m) => m.group_id === g.group_id && m.student_id === s.id);
                                                    return (
                                                        <div key={s.id} className="flex items-center gap-1 bg-muted rounded px-2 py-0.5 text-xs">
                                                            <span>{s.roll_number} — {s.first_name} {s.last_name}</span>
                                                            <button
                                                                onClick={() => mapping && removeMapping(mapping.id)}
                                                                className="ml-1 text-muted-foreground hover:text-destructive"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                        {groups.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">No groups yet. Create one above.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
