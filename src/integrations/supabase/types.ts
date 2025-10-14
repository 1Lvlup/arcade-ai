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
      chunk_repage_log: {
        Row: {
          chunk_id: string
          created_at: string
          id: string
          manual_id: string
          new_page_start: number | null
          old_page_start: string | null
        }
        Insert: {
          chunk_id: string
          created_at?: string
          id?: string
          manual_id: string
          new_page_start?: number | null
          old_page_start?: string | null
        }
        Update: {
          chunk_id?: string
          created_at?: string
          id?: string
          manual_id?: string
          new_page_start?: number | null
          old_page_start?: string | null
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
          metadata: Json | null
          page_end: number | null
          page_start: number | null
          text_confidence: number | null
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
          metadata?: Json | null
          page_end?: number | null
          page_start?: number | null
          text_confidence?: number | null
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
          metadata?: Json | null
          page_end?: number | null
          page_start?: number | null
          text_confidence?: number | null
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
          dropped: boolean | null
          dropped_reason: string | null
          embedding_text: string | null
          fec_tenant_id: string
          figure_id: string | null
          id: string
          image_name: string | null
          is_visible: boolean | null
          job_id: string | null
          keywords: string[] | null
          kind: string | null
          llama_asset_name: string | null
          manual_id: string
          ocr_confidence: number | null
          ocr_error: string | null
          ocr_status: string | null
          ocr_text: string | null
          ocr_updated_at: string | null
          page: number | null
          page_number: number | null
          raw_image_metadata: Json | null
          storage_path: string | null
          storage_url: string | null
          structured_json: Json | null
          version: string | null
          vision_text: string | null
        }
        Insert: {
          bbox_pdf_coords?: string | null
          callouts_json?: Json | null
          caption_text?: string | null
          created_at?: string | null
          dropped?: boolean | null
          dropped_reason?: string | null
          embedding_text?: string | null
          fec_tenant_id?: string
          figure_id?: string | null
          id?: string
          image_name?: string | null
          is_visible?: boolean | null
          job_id?: string | null
          keywords?: string[] | null
          kind?: string | null
          llama_asset_name?: string | null
          manual_id: string
          ocr_confidence?: number | null
          ocr_error?: string | null
          ocr_status?: string | null
          ocr_text?: string | null
          ocr_updated_at?: string | null
          page?: number | null
          page_number?: number | null
          raw_image_metadata?: Json | null
          storage_path?: string | null
          storage_url?: string | null
          structured_json?: Json | null
          version?: string | null
          vision_text?: string | null
        }
        Update: {
          bbox_pdf_coords?: string | null
          callouts_json?: Json | null
          caption_text?: string | null
          created_at?: string | null
          dropped?: boolean | null
          dropped_reason?: string | null
          embedding_text?: string | null
          fec_tenant_id?: string
          figure_id?: string | null
          id?: string
          image_name?: string | null
          is_visible?: boolean | null
          job_id?: string | null
          keywords?: string[] | null
          kind?: string | null
          llama_asset_name?: string | null
          manual_id?: string
          ocr_confidence?: number | null
          ocr_error?: string | null
          ocr_status?: string | null
          ocr_text?: string | null
          ocr_updated_at?: string | null
          page?: number | null
          page_number?: number | null
          raw_image_metadata?: Json | null
          storage_path?: string | null
          storage_url?: string | null
          structured_json?: Json | null
          version?: string | null
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
      golden_questions: {
        Row: {
          category: string
          created_at: string
          expected_keywords: string[] | null
          explanation: string | null
          fec_tenant_id: string
          filters: Json | null
          id: string
          importance: string
          manual_id: string
          question: string
          question_type: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          expected_keywords?: string[] | null
          explanation?: string | null
          fec_tenant_id?: string
          filters?: Json | null
          id?: string
          importance: string
          manual_id: string
          question: string
          question_type: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          expected_keywords?: string[] | null
          explanation?: string | null
          fec_tenant_id?: string
          filters?: Json | null
          id?: string
          importance?: string
          manual_id?: string
          question?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_metadata: {
        Row: {
          aliases: string[] | null
          aliases_slugs: string[] | null
          canonical_slug: string
          canonical_title: string
          checksum: string | null
          created_at: string | null
          doc_type: string | null
          family: string | null
          ingest_status: string | null
          language: string | null
          manual_id: string
          manufacturer: string | null
          model_number: string | null
          notes: string | null
          page_count: number | null
          platform: string | null
          quality_score: number | null
          requires_reindex: boolean | null
          source_path: string | null
          tags: string[] | null
          updated_at: string | null
          upload_date: string | null
          uploaded_by: string | null
          version: string | null
        }
        Insert: {
          aliases?: string[] | null
          aliases_slugs?: string[] | null
          canonical_slug: string
          canonical_title: string
          checksum?: string | null
          created_at?: string | null
          doc_type?: string | null
          family?: string | null
          ingest_status?: string | null
          language?: string | null
          manual_id: string
          manufacturer?: string | null
          model_number?: string | null
          notes?: string | null
          page_count?: number | null
          platform?: string | null
          quality_score?: number | null
          requires_reindex?: boolean | null
          source_path?: string | null
          tags?: string[] | null
          updated_at?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Update: {
          aliases?: string[] | null
          aliases_slugs?: string[] | null
          canonical_slug?: string
          canonical_title?: string
          checksum?: string | null
          created_at?: string | null
          doc_type?: string | null
          family?: string | null
          ingest_status?: string | null
          language?: string | null
          manual_id?: string
          manufacturer?: string | null
          model_number?: string | null
          notes?: string | null
          page_count?: number | null
          platform?: string | null
          quality_score?: number | null
          requires_reindex?: boolean | null
          source_path?: string | null
          tags?: string[] | null
          updated_at?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
          version?: string | null
        }
        Relationships: []
      }
      manual_page_map: {
        Row: {
          confidence: number
          created_at: string
          id: string
          manual_id: string
          new_page: number
          old_page_hint: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          manual_id: string
          new_page: number
          old_page_hint?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          manual_id?: string
          new_page?: number
          old_page_hint?: string | null
        }
        Relationships: []
      }
      manual_pages: {
        Row: {
          canonical_page_id: string | null
          headings: string[] | null
          manual_id: string
          page: number
          section_path: string[] | null
          updated_at: string | null
          version: string
        }
        Insert: {
          canonical_page_id?: string | null
          headings?: string[] | null
          manual_id: string
          page: number
          section_path?: string[] | null
          updated_at?: string | null
          version: string
        }
        Update: {
          canonical_page_id?: string | null
          headings?: string[] | null
          manual_id?: string
          page?: number
          section_path?: string[] | null
          updated_at?: string | null
          version?: string
        }
        Relationships: []
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
          raw_payload: Json | null
          stage: string | null
          status: string
          total_chunks: number | null
          total_figures: number | null
          updated_at: string
          webhook_headers: Json | null
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
          raw_payload?: Json | null
          stage?: string | null
          status?: string
          total_chunks?: number | null
          total_figures?: number | null
          updated_at?: string
          webhook_headers?: Json | null
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
          raw_payload?: Json | null
          stage?: string | null
          status?: string
          total_chunks?: number | null
          total_figures?: number | null
          updated_at?: string
          webhook_headers?: Json | null
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
      query_logs: {
        Row: {
          claim_coverage: number | null
          created_at: string
          fec_tenant_id: string
          grounding_sources: string[] | null
          human_correction: string | null
          human_label: string | null
          id: string
          image_ocr_match_ratio: number | null
          keyword_match_ratio: number | null
          manual_id: string | null
          model_name: string | null
          normalized_query: string | null
          photo_url: string | null
          quality_score: number | null
          quality_tier: string | null
          query_text: string
          rerank_mean: number | null
          response_text: string | null
          retrieval_method: string | null
          success_after_fix: boolean | null
          top_doc_ids: string[] | null
          top_doc_pages: string[] | null
          top_doc_scores: number[] | null
          unique_docs_matched: number | null
          updated_at: string
          user_id: string | null
          vector_mean: number | null
        }
        Insert: {
          claim_coverage?: number | null
          created_at?: string
          fec_tenant_id?: string
          grounding_sources?: string[] | null
          human_correction?: string | null
          human_label?: string | null
          id?: string
          image_ocr_match_ratio?: number | null
          keyword_match_ratio?: number | null
          manual_id?: string | null
          model_name?: string | null
          normalized_query?: string | null
          photo_url?: string | null
          quality_score?: number | null
          quality_tier?: string | null
          query_text: string
          rerank_mean?: number | null
          response_text?: string | null
          retrieval_method?: string | null
          success_after_fix?: boolean | null
          top_doc_ids?: string[] | null
          top_doc_pages?: string[] | null
          top_doc_scores?: number[] | null
          unique_docs_matched?: number | null
          updated_at?: string
          user_id?: string | null
          vector_mean?: number | null
        }
        Update: {
          claim_coverage?: number | null
          created_at?: string
          fec_tenant_id?: string
          grounding_sources?: string[] | null
          human_correction?: string | null
          human_label?: string | null
          id?: string
          image_ocr_match_ratio?: number | null
          keyword_match_ratio?: number | null
          manual_id?: string | null
          model_name?: string | null
          normalized_query?: string | null
          photo_url?: string | null
          quality_score?: number | null
          quality_tier?: string | null
          query_text?: string
          rerank_mean?: number | null
          response_text?: string | null
          retrieval_method?: string | null
          success_after_fix?: boolean | null
          top_doc_ids?: string[] | null
          top_doc_pages?: string[] | null
          top_doc_scores?: number[] | null
          unique_docs_matched?: number | null
          updated_at?: string
          user_id?: string | null
          vector_mean?: number | null
        }
        Relationships: []
      }
      question_evaluations: {
        Row: {
          answer: string
          answer_json: Json | null
          answer_model: string | null
          citations: Json | null
          created_at: string
          evidence_pages: number[] | null
          fec_tenant_id: string
          grade_breakdown: Json | null
          grade_overall: string
          grader_model: string | null
          id: string
          manual_id: string
          missing_keywords: string[] | null
          question_id: string
          rationale: string | null
          retrieval_debug: Json | null
        }
        Insert: {
          answer: string
          answer_json?: Json | null
          answer_model?: string | null
          citations?: Json | null
          created_at?: string
          evidence_pages?: number[] | null
          fec_tenant_id?: string
          grade_breakdown?: Json | null
          grade_overall: string
          grader_model?: string | null
          id?: string
          manual_id: string
          missing_keywords?: string[] | null
          question_id: string
          rationale?: string | null
          retrieval_debug?: Json | null
        }
        Update: {
          answer?: string
          answer_json?: Json | null
          answer_model?: string | null
          citations?: Json | null
          created_at?: string
          evidence_pages?: number[] | null
          fec_tenant_id?: string
          grade_breakdown?: Json | null
          grade_overall?: string
          grader_model?: string | null
          id?: string
          manual_id?: string
          missing_keywords?: string[] | null
          question_id?: string
          rationale?: string | null
          retrieval_debug?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "question_evaluations_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "golden_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_chunks: {
        Row: {
          chunk_id: string
          content: string
          embedding: string
          features: Json | null
          fec_tenant_id: string
          id: string
          manual_id: string | null
          metadata: Json
          page_end: number | null
          page_start: number | null
          section_path: string[] | null
          version: string | null
        }
        Insert: {
          chunk_id: string
          content: string
          embedding: string
          features?: Json | null
          fec_tenant_id?: string
          id?: string
          manual_id?: string | null
          metadata: Json
          page_end?: number | null
          page_start?: number | null
          section_path?: string[] | null
          version?: string | null
        }
        Update: {
          chunk_id?: string
          content?: string
          embedding?: string
          features?: Json | null
          fec_tenant_id?: string
          id?: string
          manual_id?: string | null
          metadata?: Json
          page_end?: number | null
          page_start?: number | null
          section_path?: string[] | null
          version?: string | null
        }
        Relationships: []
      }
      rpc_audit: {
        Row: {
          created_at: string
          error: string | null
          fec_tenant_id: string | null
          id: string
          payload: Json | null
          result: Json | null
          rpc_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          fec_tenant_id?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          rpc_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          fec_tenant_id?: string | null
          id?: string
          payload?: Json | null
          result?: Json | null
          rpc_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tenant_manual_access: {
        Row: {
          fec_tenant_id: string
          granted_at: string | null
          granted_by: string | null
          id: string
          manual_id: string
        }
        Insert: {
          fec_tenant_id: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          manual_id: string
        }
        Update: {
          fec_tenant_id?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          manual_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_manual_access_fec_tenant_id_fkey"
            columns: ["fec_tenant_id"]
            isOneToOne: false
            referencedRelation: "fec_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          fec_tenant_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fec_tenant_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_fec_tenant_id_fkey"
            columns: ["fec_tenant_id"]
            isOneToOne: false
            referencedRelation: "fec_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_backfill_manual: {
        Args: { p_dry_run?: boolean; p_manual_id: string }
        Returns: Json
      }
      admin_upsert_manual_metadata: {
        Args: { p_metadata: Json }
        Returns: {
          out_canonical_slug: string
          out_manual_id: string
          out_status: string
        }[]
      }
      fn_backfill_for_manual: {
        Args: { p_manual_id: string }
        Returns: number
      }
      fn_backfill_for_manual_any: {
        Args: { p_manual_id: string }
        Returns: Json
      }
      get_current_tenant_context: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_fec_tenant_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_manuals_for_dropdown: {
        Args: Record<PropertyKey, never>
        Returns: {
          canonical_slug: string
          canonical_title: string
          doc_type: string
          manual_id: string
          platform: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
          manual_section: string
          similarity: number
          source_file: string
          subsection: string
        }[]
      }
      normalize_name: {
        Args: { input_text: string }
        Returns: string
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
        Args: { p_tenant_id: string } | { tenant_id: string }
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
      slugify: {
        Args: { input_text: string }
        Returns: string
      }
      trigger_reindex: {
        Args: { p_manual_id: string }
        Returns: Json
      }
      upsert_manual_metadata: {
        Args: { p_metadata: Json }
        Returns: {
          out_canonical_slug: string
          out_manual_id: string
          out_status: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "viewer"
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
      app_role: ["admin", "user", "viewer"],
    },
  },
} as const
