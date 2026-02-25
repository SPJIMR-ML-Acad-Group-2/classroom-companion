export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * Permissive Database type for the frontend Supabase client.
 *
 * The live DB has tables from the auto-generated schema (attendance_records, courses, etc.)
 * PLUS the t1xx/t2xx/t3xx tables created via local migrations.
 * Since the auto-generated types don't yet reflect all tables, we use a permissive
 * definition so the client accepts any table name and returns `any` for unknown tables.
 */
export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships?: any[];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [key: string]: {
        Args: Record<string, any>;
        Returns: any;
      };
    };
    Enums: {
      app_role: "student" | "program_office" | "developer" | "user";
      [key: string]: any;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
