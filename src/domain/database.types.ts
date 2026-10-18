
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "coach_usage": {
                  Row: {
                    "calls": number,"cost_micro_usd": number,"input_tokens": number,"output_tokens": number,"period": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "calls"?: number,"cost_micro_usd"?: number,"input_tokens"?: number,"output_tokens"?: number,"period": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "calls"?: number,"cost_micro_usd"?: number,"input_tokens"?: number,"output_tokens"?: number,"period"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"exercises": {
                  Row: {
                    "assistant": string | null,"base_difficulty": string,"cues": string,"equipment": NonNullable<Json>,"equipment_label": string,"id": string,"movement_pattern": string,"muscle_group": string,"name_es": string,"secondary": (string)[],"tracking": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assistant"?: string | null,"base_difficulty": string,"cues": string,"equipment": NonNullable<Json>,"equipment_label": string,"id": string,"movement_pattern": string,"muscle_group": string,"name_es": string,"secondary"?: (string)[],"tracking": string
                  }
                  Update: {
                    "assistant"?: string | null,"base_difficulty"?: string,"cues"?: string,"equipment"?: NonNullable<Json>,"equipment_label"?: string,"id"?: string,"movement_pattern"?: string,"muscle_group"?: string,"name_es"?: string,"secondary"?: (string)[],"tracking"?: string
                  }
                  Relationships: [
                    
                  ]
                },"goals": {
                  Row: {
                    "created_at": string,"deadline": string | null,"id": string,"metric_name": string,"status": string,"target": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deadline"?: string | null,"id"?: string,"metric_name": string,"status"?: string,"target": number,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"deadline"?: string | null,"id"?: string,"metric_name"?: string,"status"?: string,"target"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"metrics": {
                  Row: {
                    "computed_at": string,"id": string,"name": string,"schema_version": number,"scope": string,"session_id": string,"set_id": string | null,"unit": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"id"?: string,"name": string,"schema_version"?: number,"scope": string,"session_id": string,"set_id"?: string | null,"unit": string,"user_id": string,"value": number
                  }
                  Update: {
                    "computed_at"?: string,"id"?: string,"name"?: string,"schema_version"?: number,"scope"?: string,"session_id"?: string,"set_id"?: string | null,"unit"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "metrics_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "birth_year": number | null,"created_at": string,"days_per_week": number,"display_name": string,"equipment": (string)[],"experience_level": string,"goal": string,"height_cm": number | null,"preferred_camera": string,"program_type": string,"public_profile": boolean,"session_minutes": number,"training_location": string,"updated_at": string,"user_id": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_year"?: number | null,"created_at"?: string,"days_per_week"?: number,"display_name": string,"equipment"?: (string)[],"experience_level"?: string,"goal"?: string,"height_cm"?: number | null,"preferred_camera"?: string,"program_type"?: string,"public_profile"?: boolean,"session_minutes"?: number,"training_location"?: string,"updated_at"?: string,"user_id": string,"weight_kg"?: number | null
                  }
                  Update: {
                    "birth_year"?: number | null,"created_at"?: string,"days_per_week"?: number,"display_name"?: string,"equipment"?: (string)[],"experience_level"?: string,"goal"?: string,"height_cm"?: number | null,"preferred_camera"?: string,"program_type"?: string,"public_profile"?: boolean,"session_minutes"?: number,"training_location"?: string,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"recording_consents": {
                  Row: {
                    "granted_at": string,"id": string,"revoked_at": string | null,"scope": string,"text_version": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"id"?: string,"revoked_at"?: string | null,"scope"?: string,"text_version": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"id"?: string,"revoked_at"?: string | null,"scope"?: string,"text_version"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recordings": {
                  Row: {
                    "consent_id": string,"created_at": string,"device": string | null,"exercise_id": string,"id": string,"labels": (string)[],"retention_until": string,"schema_version": number,"storage_path": string,"user_id": string,"view": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_id": string,"created_at"?: string,"device"?: string | null,"exercise_id": string,"id"?: string,"labels"?: (string)[],"retention_until"?: string,"schema_version"?: number,"storage_path": string,"user_id": string,"view": string
                  }
                  Update: {
                    "consent_id"?: string,"created_at"?: string,"device"?: string | null,"exercise_id"?: string,"id"?: string,"labels"?: (string)[],"retention_until"?: string,"schema_version"?: number,"storage_path"?: string,"user_id"?: string,"view"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recordings_consent_id_fkey"
      columns: ["consent_id"]
isOneToOne: true
      referencedRelation: "recording_consents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recordings_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    }
                  ]
                },"set_logs": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "set_logs_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "set_logs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"set_logs_default": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"set_logs_p20260701": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"set_logs_p20260801": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"set_logs_p20260901": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"set_logs_p20261001": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"set_logs_p20261101": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"set_logs_p20261201": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"set_logs_p20270101": {
                  Row: {
                    "duration_ms": number | null,"exercise_id": string,"flag_reasons": (string)[],"flagged": boolean,"id": string,"load_kg": number | null,"method": string,"method_params": NonNullable<Json>,"reps": number | null,"rpe": number | null,"session_id": string,"source": string,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"exercise_id": string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id": string,"source"?: string,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "duration_ms"?: number | null,"exercise_id"?: string,"flag_reasons"?: (string)[],"flagged"?: boolean,"id"?: string,"load_kg"?: number | null,"method"?: string,"method_params"?: NonNullable<Json>,"reps"?: number | null,"rpe"?: number | null,"session_id"?: string,"source"?: string,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workout_sessions": {
                  Row: {
                    "device": string | null,"ended_at": string | null,"id": string,"model_versions": NonNullable<Json>,"routine_day_id": string | null,"started_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "device"?: string | null,"ended_at"?: string | null,"id"?: string,"model_versions"?: NonNullable<Json>,"routine_day_id"?: string | null,"started_at"?: string,"user_id": string
                  }
                  Update: {
                    "device"?: string | null,"ended_at"?: string | null,"id"?: string,"model_versions"?: NonNullable<Json>,"routine_day_id"?: string | null,"started_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "keepalive":
{ Args: Record<PropertyKey, never>; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
