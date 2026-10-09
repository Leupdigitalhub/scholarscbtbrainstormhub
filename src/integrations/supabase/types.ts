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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          attempt_id: string | null
          body: string
          created_at: string
          emailed: boolean
          id: string
          is_read: boolean
          kind: string
          title: string
        }
        Insert: {
          attempt_id?: string | null
          body?: string
          created_at?: string
          emailed?: boolean
          id?: string
          is_read?: boolean
          kind: string
          title: string
        }
        Update: {
          attempt_id?: string | null
          body?: string
          created_at?: string
          emailed?: boolean
          id?: string
          is_read?: boolean
          kind?: string
          title?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          target_class: string
          target_student: string | null
          title: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          target_class?: string
          target_student?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          target_class?: string
          target_student?: string | null
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          admin_last_seen: string | null
          grade_scale: Json
          id: number
          last_email_at: string | null
          lesson_name: string
          notify_email: string
          show_rankings: boolean
        }
        Insert: {
          admin_last_seen?: string | null
          grade_scale?: Json
          id?: number
          last_email_at?: string | null
          lesson_name?: string
          notify_email?: string
          show_rankings?: boolean
        }
        Update: {
          admin_last_seen?: string | null
          grade_scale?: Json
          id?: number
          last_email_at?: string | null
          lesson_name?: string
          notify_email?: string
          show_rankings?: boolean
        }
        Relationships: []
      }
      attempts: {
        Row: {
          answers: Json
          chosen_subjects: string[]
          correct_count: number
          deadline: string
          delivery: Json
          id: string
          manual_marks: Json
          pending_grading: boolean
          score: number
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          test_id: string
          total: number
          unanswered_count: number
          wrong_count: number
        }
        Insert: {
          answers?: Json
          chosen_subjects?: string[]
          correct_count?: number
          deadline: string
          delivery?: Json
          id?: string
          manual_marks?: Json
          pending_grading?: boolean
          score?: number
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          test_id: string
          total?: number
          unanswered_count?: number
          wrong_count?: number
        }
        Update: {
          answers?: Json
          chosen_subjects?: string[]
          correct_count?: number
          deadline?: string
          delivery?: Json
          id?: string
          manual_marks?: Json
          pending_grading?: boolean
          score?: number
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          test_id?: string
          total?: number
          unanswered_count?: number
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_questions: {
        Row: {
          correct_answer: string
          created_at: string
          explanation: string
          id: string
          marks: number
          options: Json
          subject: string
          text: string
          type: string
        }
        Insert: {
          correct_answer?: string
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          options?: Json
          subject: string
          text: string
          type?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          options?: Json
          subject?: string
          text?: string
          type?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      proctor_events: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          kind: string
          photo_path: string | null
          student_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          kind: string
          photo_path?: string | null
          student_id?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          kind?: string
          photo_path?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctor_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          class: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          student_id: string
        }
        Insert: {
          class?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          student_id?: string
        }
        Update: {
          class?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          student_id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_answer: string
          created_at: string
          explanation: string
          id: string
          marks: number
          options: Json
          position: number
          subject: string
          test_id: string
          text: string
          type: string
        }
        Insert: {
          correct_answer?: string
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          options?: Json
          position?: number
          subject?: string
          test_id: string
          text: string
          type: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          options?: Json
          position?: number
          subject?: string
          test_id?: string
          text?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      student_topic_progress: {
        Row: {
          created_at: string
          student_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          student_id?: string
          topic_id: string
        }
        Update: {
          created_at?: string
          student_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_topic_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_topics: {
        Row: {
          class_name: string
          created_at: string
          id: string
          subject_name: string
          term: string
          title: string
          topic_order: number
        }
        Insert: {
          class_name: string
          created_at?: string
          id?: string
          subject_name: string
          term: string
          title: string
          topic_order?: number
        }
        Update: {
          class_name?: string
          created_at?: string
          id?: string
          subject_name?: string
          term?: string
          title?: string
          topic_order?: number
        }
        Relationships: []
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      tests: {
        Row: {
          attempts_allowed: number
          class: string
          compulsory_subjects: string[]
          created_at: string
          draw_count: number | null
          duration_minutes: number
          elective_subjects: string[]
          electives_to_pick: number
          end_at: string | null
          gift_enabled: boolean
          gift_message: string
          id: string
          instructions: string
          multi_subject: boolean
          pass_percentage: number
          per_subject_count: number
          show_corrections: boolean
          show_results: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          start_at: string | null
          status: string
          subject: string
          title: string
        }
        Insert: {
          attempts_allowed?: number
          class?: string
          compulsory_subjects?: string[]
          created_at?: string
          draw_count?: number | null
          duration_minutes?: number
          elective_subjects?: string[]
          electives_to_pick?: number
          end_at?: string | null
          gift_enabled?: boolean
          gift_message?: string
          id?: string
          instructions?: string
          multi_subject?: boolean
          pass_percentage?: number
          per_subject_count?: number
          show_corrections?: boolean
          show_results?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_at?: string | null
          status?: string
          subject?: string
          title: string
        }
        Update: {
          attempts_allowed?: number
          class?: string
          compulsory_subjects?: string[]
          created_at?: string
          draw_count?: number | null
          duration_minutes?: number
          elective_subjects?: string[]
          electives_to_pick?: number
          end_at?: string | null
          gift_enabled?: boolean
          gift_message?: string
          id?: string
          instructions?: string
          multi_subject?: boolean
          pass_percentage?: number
          per_subject_count?: number
          show_corrections?: boolean
          show_results?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_at?: string | null
          status?: string
          subject?: string
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_exists: { Args: never; Returns: boolean }
      admin_heartbeat: { Args: never; Returns: undefined }
      admin_live_attempts: {
        Args: never
        Returns: {
          answered: number
          attempt_id: string
          camera_off: number
          class: string
          deadline: string
          full_name: string
          last_photo: string
          last_photo_at: string
          photos: number
          started_at: string
          student_id: string
          tab_switches: number
          test_title: string
          total_questions: number
        }[]
      }
      admin_reset_attempt: { Args: { _attempt_id: string }; Returns: undefined }
      attempt_gift_message: { Args: { _attempt_id: string }; Returns: string }
      build_delivery: { Args: { _attempt_id: string }; Returns: Json }
      claim_admin: { Args: never; Returns: boolean }
      email_for_student_id: { Args: { _sid: string }; Returns: string }
      finalize_if_expired: { Args: { _attempt_id: string }; Returns: undefined }
      get_attempt: { Args: { _attempt_id: string }; Returns: Json }
      grade_written: {
        Args: { _attempt_id: string; _marks: number; _question_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leaderboard: {
        Args: { _test_id?: string }
        Returns: {
          class: string
          full_name: string
          is_me: boolean
          percent: number
          student_id: string
          tests_taken: number
          total_marks: number
          total_score: number
        }[]
      }
      log_student_login: { Args: never; Returns: undefined }
      my_corrections: { Args: { _attempt_id: string }; Returns: Json }
      my_results: {
        Args: never
        Returns: {
          attempt_id: string
          correct_count: number
          pass_percentage: number
          pending_grading: boolean
          score: number
          show_results: boolean
          status: string
          subject: string
          submitted_at: string
          test_id: string
          test_title: string
          total: number
          unanswered_count: number
          wrong_count: number
        }[]
      }
      recalc_attempt: { Args: { _attempt_id: string }; Returns: undefined }
      save_answers: {
        Args: { _answers: Json; _attempt_id: string }
        Returns: boolean
      }
      start_attempt: { Args: { _test_id: string }; Returns: string }
      start_attempt_subjects: {
        Args: { _subjects: string[]; _test_id: string }
        Returns: string
      }
      student_tests: {
        Args: never
        Returns: {
          attempts_allowed: number
          attempts_used: number
          class: string
          duration_minutes: number
          end_at: string
          id: string
          instructions: string
          pass_percentage: number
          question_count: number
          start_at: string
          subject: string
          title: string
          total_marks: number
        }[]
      }
      submit_attempt: {
        Args: { _answers: Json; _attempt_id: string }
        Returns: boolean
      }
      test_subject_config: { Args: { _test_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "student"],
    },
  },
} as const
