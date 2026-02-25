import { supabase } from "@/integrations/supabase/client";

export interface BatchLite {
  batch_id: string;
  batch_code: string;
}

export interface StudentImportRow {
  roll_number: string;
  first_name: string;
  last_name: string;
  email: string;
  division: string;
  application_number?: string;
  specialization?: string;
  gender?: string;
}

export interface DivisionRecord {
  id: string;
  batch_id: string;
  division_code: string;
  division_name: string;
}

function normalizeDivisionCode(raw: string): string {
  const cleaned = raw
    .replace(/^division\s*/i, "")
    .trim()
    .toUpperCase();

  if (!cleaned) return "GEN";

  // Keep a readable short code suitable for batch-level uniqueness.
  return cleaned.replace(/[^A-Z0-9]/g, "").slice(0, 12) || "GEN";
}

function divisionNameFromCodeOrLabel(raw: string, code: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return `Division ${code}`;
  if (/^division\s+/i.test(trimmed)) return trimmed;
  return `Division ${trimmed}`;
}

function normalizeGender(raw?: string): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "male" || value === "m") return "Male";
  if (value === "female" || value === "f") return "Female";
  if (value === "other") return "Other";
  return "Prefer not to say";
}

async function fetchDivisions(batchId: string): Promise<DivisionRecord[]> {
  const { data, error } = await supabase
    .from("t203_division")
    .select("id,batch_id,division_code,division_name")
    .eq("batch_id", batchId)
    .eq("is_active", true)
    .order("division_code", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DivisionRecord[];
}

export async function ensureBatchDivisions(
  batchId: string,
  labels: string[],
): Promise<Map<string, DivisionRecord>> {
  const requested = new Map<string, { code: string; name: string }>();

  for (const label of labels) {
    const normalized = label.trim();
    if (!normalized) continue;
    const code = normalizeDivisionCode(normalized);
    requested.set(normalized.toLowerCase(), {
      code,
      name: divisionNameFromCodeOrLabel(normalized, code),
    });
  }

  const existing = await fetchDivisions(batchId);
  const byCode = new Map(existing.map((d) => [d.division_code.toLowerCase(), d]));
  const byName = new Map(existing.map((d) => [d.division_name.toLowerCase(), d]));

  const toInsert: { batch_id: string; division_code: string; division_name: string; max_strength: number }[] = [];

  for (const value of requested.values()) {
    if (byCode.has(value.code.toLowerCase())) continue;
    if (byName.has(value.name.toLowerCase())) continue;
    toInsert.push({
      batch_id: batchId,
      division_code: value.code,
      division_name: value.name,
      max_strength: 60,
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("t203_division")
      .upsert(toInsert as never[], { onConflict: "batch_id,division_code" });

    if (error) {
      throw new Error(error.message);
    }
  }

  const refreshed = await fetchDivisions(batchId);
  const result = new Map<string, DivisionRecord>();

  for (const d of refreshed) {
    result.set(d.division_name.toLowerCase(), d);
    result.set(d.division_code.toLowerCase(), d);
  }

  return result;
}

async function resolveSpecializationId(batch: BatchLite, specialization?: string): Promise<string | null> {
  const input = specialization?.trim();
  if (!input) return null;

  // Derive a short code from the input (matches seeded codes like FIN, MKT, OPS)
  const code = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "GEN";

  const name = input;

  // NOTE: t202_specialization.batch_id was seeded with a null FK due to t201_batch
  // using 'batch_id' as PK (not 'id'). To reliably find specs we search only by
  // spec_code or spec_name — NOT by batch_id.
  const { data: existing, error: findError } = await (supabase as any)
    .from("t202_specialization")
    .select("id,spec_code,spec_name")
    .or(`spec_code.ilike.${code},spec_name.ilike.${input}`)
    .limit(1);

  if (!findError && existing && existing.length > 0) {
    return (existing[0] as { id: string }).id;
  }

  // Create new specialisation linked to this batch
  const payload: Record<string, string> = {
    spec_code: code,
    spec_name: name,
    batch_id: batch.batch_id,
  };

  const { data: created, error: createError } = await (supabase as any)
    .from("t202_specialization")
    .upsert(payload, { onConflict: "spec_code" })
    .select("id")
    .single();

  if (createError) {
    return null;
  }

  return (created as { id: string }).id;
}

export async function upsertBatchStudents(
  batch: BatchLite,
  rows: StudentImportRow[],
): Promise<{ inserted: number; failed: number }> {
  const cleanedRows = rows.filter((r) => r.roll_number.trim() && r.email.trim());
  if (cleanedRows.length === 0) return { inserted: 0, failed: 0 };

  // Only build division map for rows that actually have a division value.
  // Division is optional at onboarding — it is assigned later via Manage Divisions.
  const rowsWithDivision = cleanedRows.filter((r) => r.division.trim());
  const divisionMap =
    rowsWithDivision.length > 0
      ? await ensureBatchDivisions(
        batch.batch_id,
        rowsWithDivision.map((r) => r.division),
      )
      : new Map<string, DivisionRecord>();

  const payload: Record<string, unknown>[] = [];
  let failed = 0;

  for (const row of cleanedRows) {
    // Division is optional — resolve only if provided.
    let divisionId: string | null = null;
    if (row.division.trim()) {
      const divisionKey = row.division.trim().toLowerCase();
      const divisionCodeKey = normalizeDivisionCode(row.division).toLowerCase();
      const division = divisionMap.get(divisionKey) ?? divisionMap.get(divisionCodeKey);
      if (!division) {
        // A non-empty division string that couldn't be resolved → skip row
        failed += 1;
        continue;
      }
      divisionId = division.id;
    }

    const specializationId = await resolveSpecializationId(batch, row.specialization);

    payload.push({
      roll_number: row.roll_number.trim(),
      first_name: row.first_name.trim() || "NA",
      last_name: row.last_name.trim() || "NA",
      email: row.email.trim().toLowerCase(),
      application_number: row.application_number?.trim() || null,
      batch_id: batch.batch_id,
      division_id: divisionId,
      specialization_id: specializationId,
      gender: normalizeGender(row.gender),
      is_active: true,
    });
  }

  if (payload.length === 0) {
    return { inserted: 0, failed };
  }

  const { error } = await (supabase as any)
    .from("t205_student_profile")
    .upsert(payload, { onConflict: "roll_number" });

  if (error) {
    throw new Error(error.message);
  }

  return {
    inserted: payload.length,
    failed,
  };
}
