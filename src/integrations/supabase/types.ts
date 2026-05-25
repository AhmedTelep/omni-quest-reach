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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installment_payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by_name: string | null
          created_at: string
          created_by: string | null
          id: string
          installment_id: string
          paid_at: string | null
          paid_by_name: string | null
          payment_status: string
          receipt_url: string | null
          rejection_reason: string | null
          serial: string
          updated_at: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installment_id: string
          paid_at?: string | null
          paid_by_name?: string | null
          payment_status?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          serial: string
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          installment_id?: string
          paid_at?: string | null
          paid_by_name?: string | null
          payment_status?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          serial?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_schedules: {
        Row: {
          count: number
          created_at: string
          created_by: string | null
          description: string | null
          frequency: string
          id: string
          project_id: string
          resident_id: string
          start_date: string
          total_amount: number
        }
        Insert: {
          count: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          project_id: string
          resident_id: string
          start_date: string
          total_amount: number
        }
        Update: {
          count?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          frequency?: string
          id?: string
          project_id?: string
          resident_id?: string
          start_date?: string
          total_amount?: number
        }
        Relationships: []
      }
      installments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by_name: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          installment_index: number | null
          installments_total: number | null
          paid_amount: number
          paid_at: string | null
          paid_by_name: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          project_id: string
          receipt_url: string | null
          rejection_reason: string | null
          resident_id: string
          schedule_id: string | null
          serial: string
          updated_at: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          installment_index?: number | null
          installments_total?: number | null
          paid_amount?: number
          paid_at?: string | null
          paid_by_name?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          project_id: string
          receipt_url?: string | null
          rejection_reason?: string | null
          resident_id: string
          schedule_id?: string | null
          serial: string
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          installment_index?: number | null
          installments_total?: number | null
          paid_amount?: number
          paid_at?: string | null
          paid_by_name?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          project_id?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          resident_id?: string
          schedule_id?: string | null
          serial?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          image_url: string | null
          notes: string | null
          preferred_date: string | null
          project_id: string | null
          resident_id: string
          service_id: string | null
          service_type: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          preferred_date?: string | null
          project_id?: string | null
          resident_id: string
          service_id?: string | null
          service_type: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          notes?: string | null
          preferred_date?: string | null
          project_id?: string | null
          resident_id?: string
          service_id?: string | null
          service_type?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dedup: {
        Row: {
          created_at: string
          dedup_key: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          city: string | null
          color: string
          created_at: string
          description: string | null
          id: string
          images: string[]
          latitude: number | null
          logo: string | null
          longitude: number | null
          name_ar: string
          name_en: string
          project_link: string | null
          spaces: Json
          total_units: number
          updated_at: string
        }
        Insert: {
          city?: string | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          latitude?: number | null
          logo?: string | null
          longitude?: number | null
          name_ar: string
          name_en: string
          project_link?: string | null
          spaces?: Json
          total_units?: number
          updated_at?: string
        }
        Update: {
          city?: string | null
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          latitude?: number | null
          logo?: string | null
          longitude?: number | null
          name_ar?: string
          name_en?: string
          project_link?: string | null
          spaces?: Json
          total_units?: number
          updated_at?: string
        }
        Relationships: []
      }
      residents: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          project_id: string | null
          unit_link: string | null
          unit_number: string
          unit_price: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          project_id?: string | null
          unit_link?: string | null
          unit_number: string
          unit_price?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          project_id?: string | null
          unit_link?: string | null
          unit_number?: string
          unit_price?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          bg_color: string
          color: string
          created_at: string
          icon: string
          id: string
          name_ar: string
          name_en: string
          slug: string
        }
        Insert: {
          bg_color?: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name_ar: string
          name_en: string
          slug: string
        }
        Update: {
          bg_color?: string
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name_ar?: string
          name_en?: string
          slug?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          area: number | null
          created_at: string
          floor: string | null
          id: string
          notes: string | null
          price: number | null
          project_id: string
          status: string
          unit_number: string
          updated_at: string
        }
        Insert: {
          area?: number | null
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          project_id: string
          status?: string
          unit_number: string
          updated_at?: string
        }
        Update: {
          area?: number | null
          created_at?: string
          floor?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          project_id?: string
          status?: string
          unit_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_notification_dedup: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      notify_user: {
        Args: {
          _body: string
          _link: string
          _metadata?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      recompute_installment_totals: {
        Args: { _installment_id: string }
        Returns: undefined
      }
      run_installment_reminders: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "sales_manager"
        | "sales"
        | "accountant"
        | "resident"
      payment_status:
        | "pending_confirmation"
        | "confirmed"
        | "rejected"
        | "partial"
      request_status: "open" | "in_progress" | "completed"
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
        "admin",
        "manager",
        "sales_manager",
        "sales",
        "accountant",
        "resident",
      ],
      payment_status: [
        "pending_confirmation",
        "confirmed",
        "rejected",
        "partial",
      ],
      request_status: ["open", "in_progress", "completed"],
    },
  },
} as const
