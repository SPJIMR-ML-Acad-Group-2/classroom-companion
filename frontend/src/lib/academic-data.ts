import { supabase } from "@/integrations/supabase/client";

export interface BatchOption {
  batch_id: string;
  batch_code: string;
  batch_name: string;
  is_active: boolean;
}

export interface DivisionOption {
  id: string;
  batch_id: string;
  division_code: string;
  division_name: string;
  max_strength: number;
  is_active: boolean;
}

export interface StudentOption {
  id: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  email: string;
  division_id: string;
  specialization_id: string | null;
}

export interface CourseOption {
  id: string;
  course_code: string;
  course_name: string;
}

export interface TimetableEventOption {
  event_id: string;
  batch_id: string;
  division_id: string | null;
  course_id: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  is_published: boolean;
}

export async function fetchBatchOptions(): Promise<BatchOption[]> {
  const { data, error } = await supabase
    .from("t201_batch")
    .select("batch_id,batch_code,batch_name,is_active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BatchOption[];
}

export async function fetchDivisionOptions(batchId: string): Promise<DivisionOption[]> {
  const { data, error } = await supabase
    .from("t203_division")
    .select("id,batch_id,division_code,division_name,max_strength,is_active")
    .eq("batch_id", batchId)
    .order("division_code", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as DivisionOption[];
}

export async function fetchStudentOptions(batchId: string, divisionId?: string): Promise<StudentOption[]> {
  let query = supabase
    .from("t205_student_profile")
    .select("id,roll_number,first_name,last_name,email,division_id,specialization_id")
    .eq("batch_id", batchId)
    .order("roll_number", { ascending: true });

  if (divisionId) {
    query = query.eq("division_id", divisionId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as StudentOption[];
}

export async function fetchCourseOptions(): Promise<CourseOption[]> {
  const { data, error } = await supabase
    .from("t206_course")
    .select("id,course_code,course_name")
    .eq("is_active", true)
    .order("course_code", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as CourseOption[];
}

export async function fetchTimetableEvents(
  batchId: string,
  divisionId?: string
): Promise<TimetableEventOption[]> {
  let query = supabase
    .from("t211_timetable_event")
    .select("event_id,batch_id,division_id,course_id,event_date,start_time,end_time,status,is_published")
    .eq("batch_id", batchId)
    .order("event_date", { ascending: false })
    .order("start_time", { ascending: true });

  if (divisionId && divisionId !== "all") {
    query = query.eq("division_id", divisionId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TimetableEventOption[];
}

export async function fetchAttendanceConfig(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("t401_attendance_config")
    .select("config_key,config_value");

  if (error) {
    console.warn("Could not load attendance config, using defaults:", error.message);
    return { grace_minutes: "10", low_attendance_pct: "75" };
  }

  const result: Record<string, string> = {};
  for (const row of (data ?? []) as { config_key: string; config_value: string }[]) {
    result[row.config_key] = row.config_value;
  }
  return result;
}
