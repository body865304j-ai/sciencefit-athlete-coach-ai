export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      athlete_requests: {
        Row: {
          athlete_id: string
          clinical_flag: boolean
          created_at: string
          deleted_at: string | null
          equipment: string[]
          experience_level: string
          goal: string
          id: string
          injury_notes: string | null
          session_minutes: number
          state: Database["public"]["Enums"]["request_state"]
          training_days: number
          updated_at: string
          validation_notes: Json | null
        }
        Insert: {
          athlete_id: string
          clinical_flag?: boolean
          created_at?: string
          deleted_at?: string | null
          equipment?: string[]
          experience_level: string
          goal: string
          id?: string
          injury_notes?: string | null
          session_minutes: number
          state?: Database["public"]["Enums"]["request_state"]
          training_days: number
          updated_at?: string
          validation_notes?: Json | null
        }
        Update: {
          athlete_id?: string
          clinical_flag?: boolean
          created_at?: string
          deleted_at?: string | null
          equipment?: string[]
          experience_level?: string
          goal?: string
          id?: string
          injury_notes?: string | null
          session_minutes?: number
          state?: Database["public"]["Enums"]["request_state"]
          training_days?: number
          updated_at?: string
          validation_notes?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_requests_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          state: Database["public"]["Enums"]["athlete_state"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          state?: Database["public"]["Enums"]["athlete_state"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          state?: Database["public"]["Enums"]["athlete_state"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          id: string
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          actor_id?: string | null
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          actor_id?: string | null
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      audit_logs_default: {
        Row: {
          actor_id: string | null
          id: string
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          operation: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          actor_id?: string | null
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          actor_id?: string | null
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      challenge_coach_matches: {
        Row: {
          challenge_id: string
          coach_id: string
          created_at: string
          id: string
          invited_at: string
          responded_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
        }
        Insert: {
          challenge_id: string
          coach_id: string
          created_at?: string
          id?: string
          invited_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          invited_at?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_coach_matches_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_coach_matches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          anonymity_salt: string
          athlete_id: string
          completed_at: string | null
          created_at: string
          criteria_version_id: string
          deadline_at: string
          deleted_at: string | null
          id: string
          locked_at: string | null
          opened_at: string | null
          request_id: string
          state: Database["public"]["Enums"]["challenge_state"]
          updated_at: string
        }
        Insert: {
          anonymity_salt?: string
          athlete_id: string
          completed_at?: string | null
          created_at?: string
          criteria_version_id: string
          deadline_at: string
          deleted_at?: string | null
          id?: string
          locked_at?: string | null
          opened_at?: string | null
          request_id: string
          state?: Database["public"]["Enums"]["challenge_state"]
          updated_at?: string
        }
        Update: {
          anonymity_salt?: string
          athlete_id?: string
          completed_at?: string | null
          created_at?: string
          criteria_version_id?: string
          deadline_at?: string
          deleted_at?: string | null
          id?: string
          locked_at?: string | null
          opened_at?: string | null
          request_id?: string
          state?: Database["public"]["Enums"]["challenge_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_criteria_version_id_fkey"
            columns: ["criteria_version_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "athlete_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_performance_scores: {
        Row: {
          base_score: number
          coach_id: string
          computation_snapshot: Json
          consistency_bonus: number
          created_at: string
          criteria_version_id: string | null
          evaluation_id: string | null
          id: string
          performance_score: number
          previous_score: number | null
          submissions_counted: number
          trend_bonus: number
          volume_penalty: number
        }
        Insert: {
          base_score: number
          coach_id: string
          computation_snapshot: Json
          consistency_bonus: number
          created_at?: string
          criteria_version_id?: string | null
          evaluation_id?: string | null
          id?: string
          performance_score: number
          previous_score?: number | null
          submissions_counted: number
          trend_bonus: number
          volume_penalty: number
        }
        Update: {
          base_score?: number
          coach_id?: string
          computation_snapshot?: Json
          consistency_bonus?: number
          created_at?: string
          criteria_version_id?: string | null
          evaluation_id?: string | null
          id?: string
          performance_score?: number
          previous_score?: number | null
          submissions_counted?: number
          trend_bonus?: number
          volume_penalty?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_performance_scores_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_performance_scores_criteria_version_id_fkey"
            columns: ["criteria_version_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_performance_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          marketplace_enabled: boolean
          performance_score: number | null
          specializations: string[]
          state: Database["public"]["Enums"]["coach_state"]
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          marketplace_enabled?: boolean
          performance_score?: number | null
          specializations?: string[]
          state?: Database["public"]["Enums"]["coach_state"]
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          marketplace_enabled?: boolean
          performance_score?: number | null
          specializations?: string[]
          state?: Database["public"]["Enums"]["coach_state"]
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      evaluation_criteria_versions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          version: string
          weights: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          version: string
          weights: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          version?: string
          weights?: Json
        }
        Relationships: []
      }
      evaluation_results: {
        Row: {
          confidence: number
          created_at: string
          dimension: Database["public"]["Enums"]["evaluation_dimension"]
          evaluation_id: string
          id: string
          reasoning: Json
          score: number
          weight: number
        }
        Insert: {
          confidence: number
          created_at?: string
          dimension: Database["public"]["Enums"]["evaluation_dimension"]
          evaluation_id: string
          id?: string
          reasoning?: Json
          score: number
          weight: number
        }
        Update: {
          confidence?: number
          created_at?: string
          dimension?: Database["public"]["Enums"]["evaluation_dimension"]
          evaluation_id?: string
          id?: string
          reasoning?: Json
          score?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_results_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          anonymous_hash: string
          challenge_id: string
          completed_at: string | null
          created_at: string
          criteria_version_id: string
          escalation_due_at: string | null
          escalation_level: Database["public"]["Enums"]["escalation_level"]
          id: string
          overall_score: number | null
          program_id: string
          queued_at: string
          rank: number | null
          status: Database["public"]["Enums"]["evaluation_status"]
          updated_at: string
        }
        Insert: {
          anonymous_hash: string
          challenge_id: string
          completed_at?: string | null
          created_at?: string
          criteria_version_id: string
          escalation_due_at?: string | null
          escalation_level?: Database["public"]["Enums"]["escalation_level"]
          id?: string
          overall_score?: number | null
          program_id: string
          queued_at?: string
          rank?: number | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          updated_at?: string
        }
        Update: {
          anonymous_hash?: string
          challenge_id?: string
          completed_at?: string | null
          created_at?: string
          criteria_version_id?: string
          escalation_due_at?: string | null
          escalation_level?: Database["public"]["Enums"]["escalation_level"]
          id?: string
          overall_score?: number | null
          program_id?: string
          queued_at?: string
          rank?: number | null
          status?: Database["public"]["Enums"]["evaluation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_criteria_version_id_fkey"
            columns: ["criteria_version_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_id: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          actor_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          actor_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: []
      }
      events_default: {
        Row: {
          actor_id: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json
          subject_id: string | null
          subject_type: string | null
        }
        Insert: {
          actor_id?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
        }
        Update: {
          actor_id?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json
          subject_id?: string | null
          subject_type?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          muted_categories: string[]
          push_enabled: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          muted_categories?: string[]
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          muted_categories?: string[]
          push_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          category: string
          channel: string
          created_at: string
          delivered_at: string | null
          id: string
          link_path: string | null
          metadata: Json
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          category: string
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          link_path?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          link_path?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_days: {
        Row: {
          created_at: string
          day_number: number
          id: string
          notes: string | null
          title: string
          updated_at: string
          week_id: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          week_id: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          notes?: string | null
          title?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_days_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "program_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      program_exercises: {
        Row: {
          coaching_cue: string | null
          created_at: string
          day_id: string
          id: string
          load_note: string | null
          name: string
          position: number
          reps: string | null
          rest_note: string | null
          sets: number | null
          updated_at: string
        }
        Insert: {
          coaching_cue?: string | null
          created_at?: string
          day_id: string
          id?: string
          load_note?: string | null
          name: string
          position?: number
          reps?: string | null
          rest_note?: string | null
          sets?: number | null
          updated_at?: string
        }
        Update: {
          coaching_cue?: string | null
          created_at?: string
          day_id?: string
          id?: string
          load_note?: string | null
          name?: string
          position?: number
          reps?: string | null
          rest_note?: string | null
          sets?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_exercises_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
        ]
      }
      program_weeks: {
        Row: {
          created_at: string
          focus: string
          id: string
          program_id: string
          updated_at: string
          week_number: number
        }
        Insert: {
          created_at?: string
          focus?: string
          id?: string
          program_id: string
          updated_at?: string
          week_number: number
        }
        Update: {
          created_at?: string
          focus?: string
          id?: string
          program_id?: string
          updated_at?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_weeks_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          anonymous_hash: string | null
          challenge_id: string
          coach_id: string
          created_at: string
          deleted_at: string | null
          id: string
          locked_at: string | null
          submitted_at: string | null
          summary: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          anonymous_hash?: string | null
          challenge_id: string
          coach_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          locked_at?: string | null
          submitted_at?: string | null
          summary?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          anonymous_hash?: string | null
          challenge_id?: string
          coach_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          locked_at?: string | null
          submitted_at?: string | null
          summary?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "programs_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          device_tier_preference: string | null
          id: string
          locale: string
          reduced_motion: boolean
          timezone: string
          units: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_tier_preference?: string | null
          id?: string
          locale?: string
          reduced_motion?: boolean
          timezone?: string
          units?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_tier_preference?: string | null
          id?: string
          locale?: string
          reduced_motion?: boolean
          timezone?: string
          units?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          athlete_id: string
          athlete_notes: string | null
          client_generated_id: string | null
          completed: boolean
          created_at: string
          duration_minutes: number | null
          id: string
          perceived_exertion: number | null
          program_id: string | null
          session_date: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          athlete_notes?: string | null
          client_generated_id?: string | null
          completed?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          perceived_exertion?: number | null
          program_id?: string | null
          session_date: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          athlete_notes?: string | null
          client_generated_id?: string | null
          completed?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          perceived_exertion?: number | null
          program_id?: string | null
          session_date?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs_default: {
        Row: {
          athlete_id: string
          athlete_notes: string | null
          client_generated_id: string | null
          completed: boolean
          created_at: string
          duration_minutes: number | null
          id: string
          perceived_exertion: number | null
          program_id: string | null
          session_date: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          athlete_notes?: string | null
          client_generated_id?: string | null
          completed?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          perceived_exertion?: number | null
          program_id?: string | null
          session_date: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          athlete_notes?: string | null
          client_generated_id?: string | null
          completed?: boolean
          created_at?: string
          duration_minutes?: number | null
          id?: string
          perceived_exertion?: number | null
          program_id?: string | null
          session_date?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "athlete"
        | "coach"
        | "admin"
        | "organization"
        | "medical_reviewer"
      athlete_state:
        | "UNREGISTERED"
        | "REGISTERED"
        | "ACTIVE"
        | "REQUEST_PENDING"
        | "VALID"
        | "CHALLENGE_ACTIVE"
        | "PROGRAM_DELIVERED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "PRIVATE_CLIENT"
      challenge_state:
        | "DRAFT"
        | "PUBLISHED"
        | "ACTIVE"
        | "LOCKED"
        | "EVALUATING"
        | "COMPLETED"
        | "ARCHIVED"
      coach_state:
        | "UNREGISTERED"
        | "PENDING_VERIFICATION"
        | "VERIFIED"
        | "QUALIFIED"
        | "ACTIVE"
        | "PROGRAMMING"
        | "SUBMITTED"
        | "EVALUATION_PENDING"
        | "RESULTS_RECEIVED"
        | "MARKETPLACE_ELIGIBLE"
        | "PRIVATE_CLIENT_ACTIVE"
      escalation_level: "NONE" | "L1" | "L2" | "L3" | "L4" | "L5"
      evaluation_dimension:
        | "SAFETY"
        | "GOAL_ALIGNMENT"
        | "PERSONALIZATION"
        | "PROGRAMMING_QUALITY"
        | "SCIENTIFIC_CONSISTENCY"
        | "PRACTICALITY"
        | "COMMUNICATION_QUALITY"
      evaluation_status:
        | "QUEUED"
        | "ANONYMIZING"
        | "RUNNING"
        | "ESCALATED"
        | "COMPLETED"
        | "AUTO_REJECTED"
        | "FAILED"
      match_status:
        | "INVITED"
        | "ACCEPTED"
        | "DECLINED"
        | "SUBMITTED"
        | "WITHDRAWN"
      request_state: "DRAFT" | "AI_VALIDATING" | "VALID" | "REJECTED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "athlete",
        "coach",
        "admin",
        "organization",
        "medical_reviewer",
      ],
      athlete_state: [
        "UNREGISTERED",
        "REGISTERED",
        "ACTIVE",
        "REQUEST_PENDING",
        "VALID",
        "CHALLENGE_ACTIVE",
        "PROGRAM_DELIVERED",
        "IN_PROGRESS",
        "COMPLETED",
        "PRIVATE_CLIENT",
      ],
      challenge_state: [
        "DRAFT",
        "PUBLISHED",
        "ACTIVE",
        "LOCKED",
        "EVALUATING",
        "COMPLETED",
        "ARCHIVED",
      ],
      coach_state: [
        "UNREGISTERED",
        "PENDING_VERIFICATION",
        "VERIFIED",
        "QUALIFIED",
        "ACTIVE",
        "PROGRAMMING",
        "SUBMITTED",
        "EVALUATION_PENDING",
        "RESULTS_RECEIVED",
        "MARKETPLACE_ELIGIBLE",
        "PRIVATE_CLIENT_ACTIVE",
      ],
      escalation_level: ["NONE", "L1", "L2", "L3", "L4", "L5"],
      evaluation_dimension: [
        "SAFETY",
        "GOAL_ALIGNMENT",
        "PERSONALIZATION",
        "PROGRAMMING_QUALITY",
        "SCIENTIFIC_CONSISTENCY",
        "PRACTICALITY",
        "COMMUNICATION_QUALITY",
      ],
      evaluation_status: [
        "QUEUED",
        "ANONYMIZING",
        "RUNNING",
        "ESCALATED",
        "COMPLETED",
        "AUTO_REJECTED",
        "FAILED",
      ],
      match_status: [
        "INVITED",
        "ACCEPTED",
        "DECLINED",
        "SUBMITTED",
        "WITHDRAWN",
      ],
      request_state: ["DRAFT", "AI_VALIDATING", "VALID", "REJECTED"],
    },
  },
} as const
