import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Division {
    id: string;
    batch_id: string;
    division_code: string;
    division_name: string;
    max_strength: number;
    is_active: boolean;
}

interface Batch {
    batch_id: string;
    batch_code: string;
    batch_name: string;
}

export default function ManageDivisionsPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const batchId = params.get("batch_id") ?? "";

    const [batch, setBatch] = useState<Batch | null>(null);
    const [divisions, setDivisions] = useState<Division[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Create form
    const [form, setForm] = useState({ division_code: "", division_name: "", max_strength: "60" });
    // Edit buffer
    const [editBuf, setEditBuf] = useState({ division_name: "", max_strength: "" });

    useEffect(() => {
        if (!batchId) return;
        const load = async () => {
            setLoading(true);
            const [batchRes, divRes] = await Promise.all([
                (supabase as any).from("t201_batch").select("batch_id,batch_code,batch_name").eq("batch_id", batchId).single(),
                (supabase as any).from("t203_division").select("*").eq("batch_id", batchId).order("division_code"),
            ]);
            if (batchRes.data) setBatch(batchRes.data);
            setDivisions(divRes.data ?? []);
            setLoading(false);
        };
        load();
    }, [batchId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.division_code.trim() || !form.division_name.trim()) {
            toast.error("Division code and name are required.");
            return;
        }
        setSaving(true);
        const { data, error } = await (supabase as any)
            .from("t203_division")
            .insert({
                batch_id: batchId,
                division_code: form.division_code.toUpperCase().trim(),
                division_name: form.division_name.trim(),
                max_strength: parseInt(form.max_strength) || 60,
                is_active: true,
            })
            .select()
            .single();
        setSaving(false);
        if (error) { toast.error(`Failed: ${error.message}`); return; }
        setDivisions((d) => [...d, data]);
        setForm({ division_code: "", division_name: "", max_strength: "60" });
        toast.success(`Division "${data.division_name}" created.`);
    };

    const startEdit = (div: Division) => {
        setEditingId(div.id);
        setEditBuf({ division_name: div.division_name, max_strength: String(div.max_strength) });
    };

    const saveEdit = async (div: Division) => {
        const { data, error } = await (supabase as any)
            .from("t203_division")
            .update({ division_name: editBuf.division_name, max_strength: parseInt(editBuf.max_strength) || div.max_strength })
            .eq("id", div.id)
            .select()
            .single();
        if (error) { toast.error(`Update failed: ${error.message}`); return; }
        setDivisions((d) => d.map((x) => (x.id === div.id ? data : x)));
        setEditingId(null);
        toast.success("Division updated.");
    };

    const toggleActive = async (div: Division) => {
        const { data, error } = await (supabase as any)
            .from("t203_division")
            .update({ is_active: !div.is_active })
            .eq("id", div.id)
            .select()
            .single();
        if (error) { toast.error(`Failed: ${error.message}`); return; }
        setDivisions((d) => d.map((x) => (x.id === div.id ? data : x)));
        toast.success(`Division ${data.is_active ? "activated" : "deactivated"}.`);
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
                <div className="container flex h-16 items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/managebatch?batch_id=${batchId}`)} className="gap-2 text-muted-foreground">
                        <ArrowLeft className="h-4 w-4" /> Back to Batches
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div>
                        <p className="font-semibold text-sm">Manage Divisions</p>
                        {batch && <p className="text-xs text-muted-foreground font-mono">{batch.batch_code} · {batch.batch_name}</p>}
                    </div>
                </div>
            </header>

            <main className="container max-w-4xl py-8 space-y-8">
                {/* Create Division */}
                <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Create Division</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-3 items-end">
                            <div className="space-y-1.5">
                                <Label>Code *</Label>
                                <Input className="font-mono" placeholder="A" value={form.division_code} onChange={(e) => setForm((f) => ({ ...f, division_code: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Name *</Label>
                                <Input placeholder="Division A" value={form.division_name} onChange={(e) => setForm((f) => ({ ...f, division_name: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Max Strength</Label>
                                <Input type="number" min={1} value={form.max_strength} onChange={(e) => setForm((f) => ({ ...f, max_strength: e.target.value }))} />
                            </div>
                            <div className="sm:col-span-3">
                                <Button type="submit" disabled={saving} className="gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Division
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Division List */}
                <Card>
                    <CardHeader><CardTitle className="text-base">Existing Divisions ({divisions.length})</CardTitle></CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : divisions.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No divisions yet. Create one above.</p>
                        ) : (
                            <div className="space-y-2">
                                {divisions.map((div) => (
                                    <div key={div.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                        <span className="font-mono font-semibold text-sm w-10">{div.division_code}</span>
                                        {editingId === div.id ? (
                                            <>
                                                <Input className="h-7 text-sm flex-1" value={editBuf.division_name} onChange={(e) => setEditBuf((b) => ({ ...b, division_name: e.target.value }))} />
                                                <Input className="h-7 text-sm w-20" type="number" value={editBuf.max_strength} onChange={(e) => setEditBuf((b) => ({ ...b, max_strength: e.target.value }))} />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(div)}><Check className="h-3.5 w-3.5" /></Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex-1 text-sm">{div.division_name}</span>
                                                <span className="text-xs text-muted-foreground">Max: {div.max_strength}</span>
                                                <Badge variant={div.is_active ? "default" : "secondary"} className="text-xs">{div.is_active ? "Active" : "Inactive"}</Badge>
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(div)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => toggleActive(div)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
