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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          fec_tenant_id: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string
          description?: string | null
          fec_tenant_id?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          fec_tenant_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      chunks_text: {
        Row: {
          content: string
          content_hash: string | null
          created_at: string | null
          embedding: string | null
          fec_tenant_id: string
          id: string
          manual_id: string
          menu_path: string | null
          page_end: number | null
          page_start: number | null
        }
        Insert: {
          content: string
          content_hash?: string | null
          created_at?: string | null
          embedding?: string | null
          fec_tenant_id?: string
          id?: string
          manual_id: string
          menu_path?: string | null
          page_end?: number | null
          page_start?: number | null
        }
        Update: {
          content?: string
          content_hash?: string | null
          created_at?: string | null
          embedding?: string | null
          fec_tenant_id?: string
          id?: string
          manual_id?: string
          menu_path?: string | null
          page_end?: number | null
          page_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chunks_text_manual_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["manual_id"]
          },
        ]
      }
      docs: {
        Row: {
          content: string
          created_at: string | null
          embedding: string | null
          fec_tenant_id: string | null
          game_title: string | null
          id: number
          manual_section: string | null
          page_ranges: number[] | null
          source_file: string
          subsection: string | null
          tokens: number | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding?: string | null
          fec_tenant_id?: string | null
          game_title?: string | null
          id?: number
          manual_section?: string | null
          page_ranges?: number[] | null
          source_file: string
          subsection?: string | null
          tokens?: number | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string | null
          fec_tenant_id?: string | null
          game_title?: string | null
          id?: number
          manual_section?: string | null
          page_ranges?: number[] | null
          source_file?: string
          subsection?: string | null
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "docs_fec_tenant_id_fkey"
            columns: ["fec_tenant_id"]
            isOneToOne: false
            referencedRelation: "fec_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string | null
          fec_tenant_id: string
          id: string
          job_id: string | null
          manual_id: string
          source_filename: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          job_id?: string | null
          manual_id: string
          source_filename?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          job_id?: string | null
          manual_id?: string
          source_filename?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      fec_tenants: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      figures: {
        Row: {
          bbox_pdf_coords: string | null
          callouts_json: Json | null
          caption_text: string | null
          created_at: string | null
          embedding_text: string | null
          fec_tenant_id: string
          figure_id: string | null
          id: string
          image_url: string
          keywords: string[] | null
          manual_id: string
          ocr_text: string | null
          page_number: number | null
          vision_text: string | null
        }
        Insert: {
          bbox_pdf_coords?: string | null
          callouts_json?: Json | null
          caption_text?: string | null
          created_at?: string | null
          embedding_text?: string | null
          fec_tenant_id?: string
          figure_id?: string | null
          id?: string
          image_url: string
          keywords?: string[] | null
          manual_id: string
          ocr_text?: string | null
          page_number?: number | null
          vision_text?: string | null
        }
        Update: {
          bbox_pdf_coords?: string | null
          callouts_json?: Json | null
          caption_text?: string | null
          created_at?: string | null
          embedding_text?: string | null
          fec_tenant_id?: string
          figure_id?: string | null
          id?: string
          image_url?: string
          keywords?: string[] | null
          manual_id?: string
          ocr_text?: string | null
          page_number?: number | null
          vision_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "figures_manual_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["manual_id"]
          },
        ]
      }
      processing_status: {
        Row: {
          chunks_processed: number | null
          created_at: string
          current_task: string | null
          error_message: string | null
          fec_tenant_id: string
          figures_processed: number | null
          id: string
          job_id: string
          manual_id: string
          progress_percent: number | null
          stage: string | null
          status: string
          total_chunks: number | null
          total_figures: number | null
          updated_at: string
        }
        Insert: {
          chunks_processed?: number | null
          created_at?: string
          current_task?: string | null
          error_message?: string | null
          fec_tenant_id?: string
          figures_processed?: number | null
          id?: string
          job_id: string
          manual_id: string
          progress_percent?: number | null
          stage?: string | null
          status?: string
          total_chunks?: number | null
          total_figures?: number | null
          updated_at?: string
        }
        Update: {
          chunks_processed?: number | null
          created_at?: string
          current_task?: string | null
          error_message?: string | null
          fec_tenant_id?: string
          figures_processed?: number | null
          id?: string
          job_id?: string
          manual_id?: string
          progress_percent?: number | null
          stage?: string | null
          status?: string
          total_chunks?: number | null
          total_figures?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          fec_tenant_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          fec_tenant_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          fec_tenant_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_fec_tenant_id_fkey"
            columns: ["fec_tenant_id"]
            isOneToOne: false
            referencedRelation: "fec_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_chunks: {
        Row: {
          chunk_id: string
          content: string
          embedding: string
          fec_tenant_id: string
          id: string
          metadata: Json
        }
        Insert: {
          chunk_id: string
          content: string
          embedding: string
          fec_tenant_id?: string
          id?: string
          metadata: Json
        }
        Update: {
          chunk_id?: string
          content?: string
          embedding?: string
          fec_tenant_id?: string
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_tenant_context: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_fec_tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      match_chunks: {
        Args: {
          game?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_chunks_improved: {
        Args: {
          manual?: string
          min_score?: number
          query_embedding: string
          tenant_id?: string
          top_k?: number
        }
        Returns: {
          content: string
          content_type: string
          id: string
          manual_id: string
          menu_path: string
          page_end: number
          page_start: number
          score: number
        }[]
      }
      match_chunks_text: {
        Args: {
          manual?: string
          query_text: string
          tenant_id?: string
          top_k?: number
        }
        Returns: {
          content: string
          content_type: string
          id: string
          manual_id: string
          menu_path: string
          page_end: number
          page_start: number
          score: number
        }[]
      }
      match_docs: {
        Args:
          | { manual?: string; match_count?: number; query_embedding: string }
          | {
              match_count: number
              query_embedding: string
              similarity_threshold: number
            }
        Returns: {
          content: string
          game_title: string
          id: number
          similarity: number
        }[]
      }
      search_manual_content: {
        Args: {
          match_count?: number
          query_embedding: string
          search_manual_id?: string
          similarity_threshold?: number
        }
        Returns: {
          content: string
          content_type: string
          id: string
          manual_id: string
          menu_path: string
          page_end: number
          page_start: number
          similarity: number
        }[]
      }
      set_tenant_context: {
        Args: { tenant_id: string }
        Returns: undefined
      }
      simple_search: {
        Args: {
          search_limit?: number
          search_manual?: string
          search_query: string
          search_tenant?: string
        }
        Returns: {
          content: string
          id: string
          manual_id: string
          menu_path: string
          page_end: number
          page_start: number
        }[]
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
    Enums: {},
  },
} as const
