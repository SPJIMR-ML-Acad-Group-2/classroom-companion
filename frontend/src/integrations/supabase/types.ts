export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      t106_user_profile: {
        Row: {
          user_id: string
          primary_role: string
          access_status: string
        }
        Insert: {
          user_id: string
          primary_role: string
        }
        Update: {
          primary_role?: string
        }
      }
      // Add other tables if needed for Typescript, but we are moving to Backend API
    }
  }
}
