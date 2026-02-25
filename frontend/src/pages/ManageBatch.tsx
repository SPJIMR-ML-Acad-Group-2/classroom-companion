import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllowedSubtiles, normalizeRoleCode, SubtileAccess } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  CheckCircle2,
  GraduationCap,
  Loader2,
  LayoutGrid,
  Users,
  BookOpen,
  Pencil,
} from "lucide-react";

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

const SUBTILE_ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  building: LayoutGrid,
  "book-open": BookOpen,
  pencil: Pencil,
};

function resolveSubtileIcon(key: string | null): React.ElementType {
  if (!key) return ArrowRight;
  return SUBTILE_ICON_MAP[key] ?? ArrowRight;
}

function BatchCard({
  batch,
  onArchive,
  onSelect,
}: {
  batch: Batch;
  onArchive: (id: string) => void;
  onSelect: (batch: Batch) => void;
}) {
  return (
    <Card
      className="group border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={() => onSelect(batch)}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="font-semibold leading-tight">{batch.batch_name}</p>
            <p className="text-xs font-mono text-muted-foreground">{batch.batch_code}</p>
          </div>
          <Badge variant={batch.is_active ? "default" : "secondary"}>
            {batch.is_active ? "Active" : "Archived"}
          </Badge>
        </div>

        {batch.batch_description ? (
          <p className="text-sm text-muted-foreground">{batch.batch_description}</p>
        ) : null}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Programme Head: {batch.programme_head}</span>
          <span>{batch.start_date} - {batch.end_date}</span>
          <span>{batch.program_type ?? "General"}</span>
        </div>

        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          {batch.is_active ? (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground hover:text-destructive ml-auto"
              onClick={() => onArchive(batch.batch_id)}
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function BatchDetailView({ batch, roleCode, onBack }: { batch: Batch; roleCode: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [subtiles, setSubtiles] = useState<SubtileAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetchAllowedSubtiles(roleCode, "manage_batch");
      setSubtiles(result);
      setLoading(false);
    };

    load();
  }, [roleCode]);

  const handleSubtileClick = (subtile: SubtileAccess) => {
    if (!subtile.route_path) return;
    navigate(`${subtile.route_path}?batch_id=${batch.batch_id}`);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> All Batches
        </Button>
        <div className="h-4 w-px bg-border" />
        <div>
          <p className="font-semibold text-sm leading-none">{batch.batch_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {batch.batch_code} · {batch.programme_head}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : subtiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <LayoutGrid className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium text-sm">No sub-modules available</p>
            <p className="text-xs text-muted-foreground">Your role does not have access to batch sub-modules.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subtiles.map((st, i) => {
            const Icon = resolveSubtileIcon(st.icon_key);
            return (
              <motion.div
                key={st.subtile_key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => handleSubtileClick(st)}
              >
                <Card className="group cursor-pointer border-border/60 hover:border-accent hover:bg-accent hover:shadow-lg transition-all duration-200 h-full">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-white/20 transition-colors">
                        <Icon className="h-4 w-4 text-primary group-hover:text-white transition-colors" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm group-hover:text-white transition-colors">{st.subtile_label}</p>
                      {st.subtile_description ? (
                        <p className="text-xs text-muted-foreground mt-1 group-hover:text-white/80 transition-colors">{st.subtile_description}</p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export default function ManageBatch() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const roleCode = normalizeRoleCode(role);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  const fetchBatches = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("t201_batch")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      toast.error(`Could not load batches: ${error.message}`);
      return;
    }

    setBatches((data ?? []) as Batch[]);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const archiveBatch = async (id: string) => {
    const { error } = await (supabase as any)
      .from("t201_batch")
      .update({ is_active: false })
      .eq("batch_id", id);

    if (error) {
      toast.error(`Archive failed: ${error.message}`);
      return;
    }

    toast.success("Batch archived.");
    setBatches((b) => b.map((x) => (x.batch_id === id ? { ...x, is_active: false } : x)));
    if (selectedBatch?.batch_id === id) setSelectedBatch(null);
  };

  const activeBatches = batches.filter((b) => b.is_active);
  const archivedBatches = batches.filter((b) => !b.is_active);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container flex h-16 items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-2 text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 flex-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Manage Batch</p>
              <p className="text-xs text-muted-foreground mt-0.5">View and manage academic batches</p>
            </div>
          </div>


        </div>
      </header>

      <main className="container py-8 space-y-8 max-w-5xl">
        {selectedBatch ? (
          <BatchDetailView
            batch={selectedBatch}
            roleCode={roleCode}
            onBack={() => setSelectedBatch(null)}
          />
        ) : (
          <Tabs defaultValue="active">
            <TabsList className="mb-6">
              <TabsTrigger value="active" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Active
                {activeBatches.length > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{activeBatches.length}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="archive" className="gap-2">
                <Archive className="h-4 w-4" />
                Archived
                {archivedBatches.length > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{archivedBatches.length}</Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : activeBatches.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center space-y-3">
                    <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="font-semibold">No active batches yet</p>
                    <p className="text-sm text-muted-foreground">
                      Use create batch to onboard your first cohort.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeBatches.map((b) => (
                    <motion.div key={b.batch_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <BatchCard batch={b} onArchive={archiveBatch} onSelect={setSelectedBatch} />
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="archive">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : archivedBatches.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center space-y-3">
                    <Archive className="h-10 w-10 mx-auto text-muted-foreground" />
                    <p className="font-semibold">No archived batches</p>
                    <p className="text-sm text-muted-foreground">Archived batches will appear here.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {archivedBatches.map((b) => (
                    <BatchCard key={b.batch_id} batch={b} onArchive={archiveBatch} onSelect={setSelectedBatch} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
