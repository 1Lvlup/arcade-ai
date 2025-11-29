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
      activities: {
        Row: {
          activity_type: string | null
          company_id: string | null
          content: string | null
          fec_tenant_id: string
          id: string
          lead_id: string | null
          timestamp: string | null
        }
        Insert: {
          activity_type?: string | null
          company_id?: string | null
          content?: string | null
          fec_tenant_id?: string
          id?: string
          lead_id?: string | null
          timestamp?: string | null
        }
        Update: {
          activity_type?: string | null
          company_id?: string | null
          content?: string | null
          fec_tenant_id?: string
          id?: string
          lead_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
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
      answer_evaluations: {
        Row: {
          accuracy_score: number
          auto_actions_taken: Json | null
          citation_quality_score: number
          clarity_score: number
          completeness_score: number
          created_at: string
          evaluation_details: string | null
          evaluation_timestamp: string
          evaluator_model: string
          fec_tenant_id: string
          id: string
          improvement_suggestions: Json | null
          issues_found: Json | null
          overall_grade: string
          query_log_id: string
          strengths: Json | null
        }
        Insert: {
          accuracy_score: number
          auto_actions_taken?: Json | null
          citation_quality_score: number
          clarity_score: number
          completeness_score: number
          created_at?: string
          evaluation_details?: string | null
          evaluation_timestamp?: string
          evaluator_model?: string
          fec_tenant_id?: string
          id?: string
          improvement_suggestions?: Json | null
          issues_found?: Json | null
          overall_grade: string
          query_log_id: string
          strengths?: Json | null
        }
        Update: {
          accuracy_score?: number
          auto_actions_taken?: Json | null
          citation_quality_score?: number
          clarity_score?: number
          completeness_score?: number
          created_at?: string
          evaluation_details?: string | null
          evaluation_timestamp?: string
          evaluator_model?: string
          fec_tenant_id?: string
          id?: string
          improvement_suggestions?: Json | null
          issues_found?: Json | null
          overall_grade?: string
          query_log_id?: string
          strengths?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_evaluations_query_log_id_fkey"
            columns: ["query_log_id"]
            isOneToOne: false
            referencedRelation: "query_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          category_id: string | null
          content: string
          content_format: string | null
          created_at: string | null
          excerpt: string | null
          featured_image: string | null
          fec_tenant_id: string
          id: string
          meta_description: string | null
          meta_keywords: string[] | null
          published_at: string | null
          read_time_minutes: number | null
          slug: string
          status: string | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          author_name?: string | null
          category_id?: string | null
          content: string
          content_format?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          fec_tenant_id?: string
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          author_name?: string | null
          category_id?: string | null
          content?: string
          content_format?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image?: string | null
          fec_tenant_id?: string
          id?: string
          meta_description?: string | null
          meta_keywords?: string[] | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cadences: {
        Row: {
          cadence_name: string
          created_at: string | null
          fec_tenant_id: string
          id: string
          steps: Json
          target_persona: string | null
        }
        Insert: {
          cadence_name: string
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          steps: Json
          target_persona?: string | null
        }
        Update: {
          cadence_name?: string
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          steps?: Json
          target_persona?: string | null
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
          chunk_hash: string | null
          chunk_id: string | null
          content: string
          content_hash: string | null
          created_at: string | null
          doc_id: string | null
          doc_version: string | null
          embedding: string | null
          embedding_model: string | null
          end_char: number | null
          entities: Json | null
          fec_tenant_id: string
          human_reviewed: boolean | null
          id: string
          ingest_date: string | null
          manual_id: string
          menu_path: string | null
          metadata: Json | null
          page_end: number | null
          page_start: number | null
          quality_score: number | null
          section_heading: string | null
          semantic_tags: string[] | null
          source_filename: string | null
          start_char: number | null
          text_confidence: number | null
          usage_count: number | null
        }
        Insert: {
          chunk_hash?: string | null
          chunk_id?: string | null
          content: string
          content_hash?: string | null
          created_at?: string | null
          doc_id?: string | null
          doc_version?: string | null
          embedding?: string | null
          embedding_model?: string | null
          end_char?: number | null
          entities?: Json | null
          fec_tenant_id?: string
          human_reviewed?: boolean | null
          id?: string
          ingest_date?: string | null
          manual_id: string
          menu_path?: string | null
          metadata?: Json | null
          page_end?: number | null
          page_start?: number | null
          quality_score?: number | null
          section_heading?: string | null
          semantic_tags?: string[] | null
          source_filename?: string | null
          start_char?: number | null
          text_confidence?: number | null
          usage_count?: number | null
        }
        Update: {
          chunk_hash?: string | null
          chunk_id?: string | null
          content?: string
          content_hash?: string | null
          created_at?: string | null
          doc_id?: string | null
          doc_version?: string | null
          embedding?: string | null
          embedding_model?: string | null
          end_char?: number | null
          entities?: Json | null
          fec_tenant_id?: string
          human_reviewed?: boolean | null
          id?: string
          ingest_date?: string | null
          manual_id?: string
          menu_path?: string | null
          metadata?: Json | null
          page_end?: number | null
          page_start?: number | null
          quality_score?: number | null
          section_heading?: string | null
          semantic_tags?: string[] | null
          source_filename?: string | null
          start_char?: number | null
          text_confidence?: number | null
          usage_count?: number | null
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
      code_assistant_conversations: {
        Row: {
          created_at: string | null
          fec_tenant_id: string
          id: string
          selected_file_ids: Json | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          selected_file_ids?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          selected_file_ids?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      code_assistant_files: {
        Row: {
          conversation_id: string
          created_at: string | null
          file_content: string
          file_path: string
          id: string
          language: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          file_content: string
          file_path: string
          id?: string
          language?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          file_content?: string
          file_path?: string
          id?: string
          language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "code_assistant_files_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "code_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      code_assistant_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_assistant_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "code_assistant_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string | null
          downtime_pain_level: number | null
          estimated_game_count: number | null
          fec_tenant_id: string
          has_bowling: boolean | null
          has_redemption: boolean | null
          has_vr: boolean | null
          id: string
          location: string | null
          name: string
          notes: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          created_at?: string | null
          downtime_pain_level?: number | null
          estimated_game_count?: number | null
          fec_tenant_id?: string
          has_bowling?: boolean | null
          has_redemption?: boolean | null
          has_vr?: boolean | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string | null
          downtime_pain_level?: number | null
          estimated_game_count?: number | null
          fec_tenant_id?: string
          has_bowling?: boolean | null
          has_redemption?: boolean | null
          has_vr?: boolean | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          image_analysis: Json | null
          images: string[] | null
          query_log_id: string | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          image_analysis?: Json | null
          images?: string[] | null
          query_log_id?: string | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_analysis?: Json | null
          images?: string[] | null
          query_log_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_query_log_id_fkey"
            columns: ["query_log_id"]
            isOneToOne: false
            referencedRelation: "query_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          fec_tenant_id: string
          id: string
          last_message_at: string
          manual_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fec_tenant_id?: string
          id?: string
          last_message_at?: string
          manual_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fec_tenant_id?: string
          id?: string
          last_message_at?: string
          manual_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deal_metrics: {
        Row: {
          company_id: string | null
          created_at: string | null
          duration_seconds: number | null
          entered_at: string
          exited_at: string | null
          id: string
          lead_id: string | null
          stage: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          lead_id?: string | null
          stage: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          entered_at?: string
          exited_at?: string | null
          id?: string
          lead_id?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_metrics_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
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
          storage_path: string | null
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
          storage_path?: string | null
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
          storage_path?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      down_games: {
        Row: {
          completed_at: string | null
          down_since: string | null
          id: string
          last_update: string | null
          last_update_note: string | null
          location_zone: string | null
          name: string | null
          parts_changed: string | null
          status: string | null
          things_tried: string | null
        }
        Insert: {
          completed_at?: string | null
          down_since?: string | null
          id?: string
          last_update?: string | null
          last_update_note?: string | null
          location_zone?: string | null
          name?: string | null
          parts_changed?: string | null
          status?: string | null
          things_tried?: string | null
        }
        Update: {
          completed_at?: string | null
          down_since?: string | null
          id?: string
          last_update?: string | null
          last_update_note?: string | null
          location_zone?: string | null
          name?: string | null
          parts_changed?: string | null
          status?: string | null
          things_tried?: string | null
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
      feedback: {
        Row: {
          converted_to_training: boolean
          created_at: string
          fec_tenant_id: string
          id: string
          note: string | null
          query_log_id: string
          rating: string
          user_id: string | null
        }
        Insert: {
          converted_to_training?: boolean
          created_at?: string
          fec_tenant_id?: string
          id?: string
          note?: string | null
          query_log_id: string
          rating: string
          user_id?: string | null
        }
        Update: {
          converted_to_training?: boolean
          created_at?: string
          fec_tenant_id?: string
          id?: string
          note?: string | null
          query_log_id?: string
          rating?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_query_log_id_fkey"
            columns: ["query_log_id"]
            isOneToOne: false
            referencedRelation: "query_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      figures: {
        Row: {
          bbox_pdf_coords: string | null
          callouts_json: Json | null
          caption_text: string | null
          component: string | null
          created_at: string | null
          detected_components: Json | null
          doc_id: string | null
          dropped: boolean | null
          dropped_reason: string | null
          embedding_text: string | null
          entities: Json | null
          fec_tenant_id: string
          figure_id: string | null
          figure_label: string | null
          figure_type: string | null
          file_path: string | null
          id: string
          image_hash: string | null
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
          quality_score: number | null
          raw_image_metadata: Json | null
          semantic_tags: string[] | null
          storage_path: string | null
          storage_url: string | null
          structured_json: Json | null
          thumbnail_url: string | null
          topics: string[] | null
          verified_by_human: string | null
          version: string | null
          vision_metadata: Json | null
          vision_text: string | null
        }
        Insert: {
          bbox_pdf_coords?: string | null
          callouts_json?: Json | null
          caption_text?: string | null
          component?: string | null
          created_at?: string | null
          detected_components?: Json | null
          doc_id?: string | null
          dropped?: boolean | null
          dropped_reason?: string | null
          embedding_text?: string | null
          entities?: Json | null
          fec_tenant_id?: string
          figure_id?: string | null
          figure_label?: string | null
          figure_type?: string | null
          file_path?: string | null
          id?: string
          image_hash?: string | null
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
          quality_score?: number | null
          raw_image_metadata?: Json | null
          semantic_tags?: string[] | null
          storage_path?: string | null
          storage_url?: string | null
          structured_json?: Json | null
          thumbnail_url?: string | null
          topics?: string[] | null
          verified_by_human?: string | null
          version?: string | null
          vision_metadata?: Json | null
          vision_text?: string | null
        }
        Update: {
          bbox_pdf_coords?: string | null
          callouts_json?: Json | null
          caption_text?: string | null
          component?: string | null
          created_at?: string | null
          detected_components?: Json | null
          doc_id?: string | null
          dropped?: boolean | null
          dropped_reason?: string | null
          embedding_text?: string | null
          entities?: Json | null
          fec_tenant_id?: string
          figure_id?: string | null
          figure_label?: string | null
          figure_type?: string | null
          file_path?: string | null
          id?: string
          image_hash?: string | null
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
          quality_score?: number | null
          raw_image_metadata?: Json | null
          semantic_tags?: string[] | null
          storage_path?: string | null
          storage_url?: string | null
          structured_json?: Json | null
          thumbnail_url?: string | null
          topics?: string[] | null
          verified_by_human?: string | null
          version?: string | null
          vision_metadata?: Json | null
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
      forum_comments: {
        Row: {
          content: string
          created_at: string
          downvote_count: number
          fec_tenant_id: string
          id: string
          is_solution: boolean | null
          post_id: string
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          downvote_count?: number
          fec_tenant_id?: string
          id?: string
          is_solution?: boolean | null
          post_id: string
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          downvote_count?: number
          fec_tenant_id?: string
          id?: string
          is_solution?: boolean | null
          post_id?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          content: string
          created_at: string
          downvote_count: number
          fec_tenant_id: string
          game_name: string | null
          id: string
          is_resolved: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
          upvote_count: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          downvote_count?: number
          fec_tenant_id?: string
          game_name?: string | null
          id?: string
          is_resolved?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
          upvote_count?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          downvote_count?: number
          fec_tenant_id?: string
          game_name?: string | null
          id?: string
          is_resolved?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
        }
        Relationships: []
      }
      forum_votes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
          vote_type: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
          vote_type: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_votes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      game_requests: {
        Row: {
          created_at: string
          facility_name: string
          game_names: string[]
          id: string
          notes: string | null
          request_date: string
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          facility_name: string
          game_names: string[]
          id?: string
          notes?: string | null
          request_date: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          facility_name?: string
          game_names?: string[]
          id?: string
          notes?: string | null
          request_date?: string
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      game_submissions: {
        Row: {
          created_at: string
          fec_location_name: string | null
          fec_tenant_id: string
          game_name: string
          id: string
          input_by: string | null
          manufacturer: string | null
          updated_at: string
          user_id: string
          version_model_year: string | null
        }
        Insert: {
          created_at?: string
          fec_location_name?: string | null
          fec_tenant_id?: string
          game_name: string
          id?: string
          input_by?: string | null
          manufacturer?: string | null
          updated_at?: string
          user_id: string
          version_model_year?: string | null
        }
        Update: {
          created_at?: string
          fec_location_name?: string | null
          fec_tenant_id?: string
          game_name?: string
          id?: string
          input_by?: string | null
          manufacturer?: string | null
          updated_at?: string
          user_id?: string
          version_model_year?: string | null
        }
        Relationships: []
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
      guest_usage_limits: {
        Row: {
          created_at: string | null
          id: string
          ip_hash: string
          last_query_at: string | null
          month_start: string | null
          queries_per_month: number
          queries_used_this_month: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_hash: string
          last_query_at?: string | null
          month_start?: string | null
          queries_per_month?: number
          queries_used_this_month?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_hash?: string
          last_query_at?: string | null
          month_start?: string | null
          queries_per_month?: number
          queries_used_this_month?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      indexed_codebase: {
        Row: {
          created_at: string | null
          fec_tenant_id: string
          file_content: string
          file_path: string
          file_type: string | null
          id: string
          language: string | null
          last_modified: string | null
        }
        Insert: {
          created_at?: string | null
          fec_tenant_id?: string
          file_content: string
          file_path: string
          file_type?: string | null
          id?: string
          language?: string | null
          last_modified?: string | null
        }
        Update: {
          created_at?: string | null
          fec_tenant_id?: string
          file_content?: string
          file_path?: string
          file_type?: string | null
          id?: string
          language?: string | null
          last_modified?: string | null
        }
        Relationships: []
      }
      ip_rate_limits: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          last_query_at: string
          queries_count: number
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          last_query_at?: string
          queries_count?: number
          updated_at?: string
          week_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          last_query_at?: string
          queries_count?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string | null
          fec_tenant_id: string
          id: string
          last_contacted: string | null
          lead_score: number | null
          momentum_last_calculated: string | null
          momentum_score: number | null
          momentum_trend: string | null
          name: string
          notes: string | null
          phone: string | null
          priority_tier: string | null
          role: string | null
          source: string | null
          stage: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          fec_tenant_id?: string
          id?: string
          last_contacted?: string | null
          lead_score?: number | null
          momentum_last_calculated?: string | null
          momentum_score?: number | null
          momentum_trend?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          priority_tier?: string | null
          role?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          fec_tenant_id?: string
          id?: string
          last_contacted?: string | null
          lead_score?: number | null
          momentum_last_calculated?: string | null
          momentum_score?: number | null
          momentum_trend?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          priority_tier?: string | null
          role?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      model_feedback: {
        Row: {
          actual_answer: string | null
          context: Json | null
          conversation_id: string | null
          created_at: string | null
          expected_answer: string | null
          fec_tenant_id: string
          feedback_text: string | null
          id: string
          is_converted_to_training: boolean | null
          model_type: string
          query_log_id: string | null
          rating: string
          user_id: string | null
        }
        Insert: {
          actual_answer?: string | null
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          expected_answer?: string | null
          fec_tenant_id?: string
          feedback_text?: string | null
          id?: string
          is_converted_to_training?: boolean | null
          model_type: string
          query_log_id?: string | null
          rating: string
          user_id?: string | null
        }
        Update: {
          actual_answer?: string | null
          context?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          expected_answer?: string | null
          fec_tenant_id?: string
          feedback_text?: string | null
          id?: string
          is_converted_to_training?: boolean | null
          model_type?: string
          query_log_id?: string | null
          rating?: string
          user_id?: string | null
        }
        Relationships: []
      }
      objections: {
        Row: {
          alternative_frames: Json | null
          cluster: string | null
          created_at: string | null
          follow_up_questions: Json | null
          id: string
          objection_text: string
          persona: string | null
          persona_pattern: string | null
          primary_response: string | null
          probability_score: number | null
          root_cause_hypotheses: Json | null
          severity_score: number | null
          stage: string | null
          stage_pattern: string | null
          suggested_next_steps: Json | null
          title: string
        }
        Insert: {
          alternative_frames?: Json | null
          cluster?: string | null
          created_at?: string | null
          follow_up_questions?: Json | null
          id?: string
          objection_text: string
          persona?: string | null
          persona_pattern?: string | null
          primary_response?: string | null
          probability_score?: number | null
          root_cause_hypotheses?: Json | null
          severity_score?: number | null
          stage?: string | null
          stage_pattern?: string | null
          suggested_next_steps?: Json | null
          title: string
        }
        Update: {
          alternative_frames?: Json | null
          cluster?: string | null
          created_at?: string | null
          follow_up_questions?: Json | null
          id?: string
          objection_text?: string
          persona?: string | null
          persona_pattern?: string | null
          primary_response?: string | null
          probability_score?: number | null
          root_cause_hypotheses?: Json | null
          severity_score?: number | null
          stage?: string | null
          stage_pattern?: string | null
          suggested_next_steps?: Json | null
          title?: string
        }
        Relationships: []
      }
      page_label_map: {
        Row: {
          actual_page_label: string
          confidence: number
          created_at: string | null
          detection_method: string | null
          id: string
          manual_id: string
          sequential_page: number
        }
        Insert: {
          actual_page_label: string
          confidence?: number
          created_at?: string | null
          detection_method?: string | null
          id?: string
          manual_id: string
          sequential_page: number
        }
        Update: {
          actual_page_label?: string
          confidence?: number
          created_at?: string | null
          detection_method?: string | null
          id?: string
          manual_id?: string
          sequential_page?: number
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
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string
          facility_name: string | null
          fec_tenant_id: string
          github_auto_sync_enabled: boolean | null
          github_branch: string | null
          github_last_sync: string | null
          github_repository: string | null
          has_ever_subscribed: boolean | null
          id: string
          phone_number: string | null
          position: string | null
          sms_opt_in: boolean | null
          sms_opt_in_date: string | null
          sms_opt_out_date: string | null
          sms_selected_manual_id: string | null
          sms_selected_manual_title: string | null
          total_games: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          facility_name?: string | null
          fec_tenant_id: string
          github_auto_sync_enabled?: boolean | null
          github_branch?: string | null
          github_last_sync?: string | null
          github_repository?: string | null
          has_ever_subscribed?: boolean | null
          id?: string
          phone_number?: string | null
          position?: string | null
          sms_opt_in?: boolean | null
          sms_opt_in_date?: string | null
          sms_opt_out_date?: string | null
          sms_selected_manual_id?: string | null
          sms_selected_manual_title?: string | null
          total_games?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          facility_name?: string | null
          fec_tenant_id?: string
          github_auto_sync_enabled?: boolean | null
          github_branch?: string | null
          github_last_sync?: string | null
          github_repository?: string | null
          has_ever_subscribed?: boolean | null
          id?: string
          phone_number?: string | null
          position?: string | null
          sms_opt_in?: boolean | null
          sms_opt_in_date?: string | null
          sms_opt_out_date?: string | null
          sms_selected_manual_id?: string | null
          sms_selected_manual_title?: string | null
          total_games?: number | null
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
      prospects_google: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          formatted_address: string | null
          google_rating: number | null
          id: string
          imported_to_companies: boolean | null
          latitude: number | null
          longitude: number | null
          name: string
          phone_number: string | null
          place_id: string
          raw_payload: Json | null
          state: string | null
          types: string[] | null
          user_ratings_total: number | null
          website: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          formatted_address?: string | null
          google_rating?: number | null
          id?: string
          imported_to_companies?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name: string
          phone_number?: string | null
          place_id: string
          raw_payload?: Json | null
          state?: string | null
          types?: string[] | null
          user_ratings_total?: number | null
          website?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          formatted_address?: string | null
          google_rating?: number | null
          id?: string
          imported_to_companies?: boolean | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone_number?: string | null
          place_id?: string
          raw_payload?: Json | null
          state?: string | null
          types?: string[] | null
          user_ratings_total?: number | null
          website?: string | null
        }
        Relationships: []
      }
      query_feedback: {
        Row: {
          actual_behavior: string | null
          created_at: string
          description: string
          expected_behavior: string | null
          fec_tenant_id: string
          id: string
          issue_type: string
          manual_id: string | null
          query_log_id: string | null
          query_text: string | null
          reported_by: string | null
          reported_pages: string[] | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_behavior?: string | null
          created_at?: string
          description: string
          expected_behavior?: string | null
          fec_tenant_id: string
          id?: string
          issue_type: string
          manual_id?: string | null
          query_log_id?: string | null
          query_text?: string | null
          reported_by?: string | null
          reported_pages?: string[] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_behavior?: string | null
          created_at?: string
          description?: string
          expected_behavior?: string | null
          fec_tenant_id?: string
          id?: string
          issue_type?: string
          manual_id?: string | null
          query_log_id?: string | null
          query_text?: string | null
          reported_by?: string | null
          reported_pages?: string[] | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "query_feedback_fec_tenant_id_fkey"
            columns: ["fec_tenant_id"]
            isOneToOne: false
            referencedRelation: "fec_tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "query_feedback_query_log_id_fkey"
            columns: ["query_log_id"]
            isOneToOne: false
            referencedRelation: "query_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      query_logs: {
        Row: {
          admin_user: string | null
          citations: Json | null
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
          messages: Json | null
          model_name: string | null
          normalized_query: string | null
          numeric_flags: Json | null
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
          admin_user?: string | null
          citations?: Json | null
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
          messages?: Json | null
          model_name?: string | null
          normalized_query?: string | null
          numeric_flags?: Json | null
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
          admin_user?: string | null
          citations?: Json | null
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
          messages?: Json | null
          model_name?: string | null
          normalized_query?: string | null
          numeric_flags?: Json | null
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
      scripts: {
        Row: {
          content: string
          created_at: string | null
          fec_tenant_id: string
          id: string
          persona: string | null
          phase: string | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          persona?: string | null
          phase?: string | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string | null
          fec_tenant_id?: string
          id?: string
          persona?: string | null
          phase?: string | null
          title?: string
        }
        Relationships: []
      }
      sms_config: {
        Row: {
          auto_send_on_first_message: boolean | null
          created_at: string | null
          example_questions: string[] | null
          fec_tenant_id: string
          id: string
          updated_at: string | null
          welcome_message_enabled: boolean | null
          welcome_message_template: string | null
        }
        Insert: {
          auto_send_on_first_message?: boolean | null
          created_at?: string | null
          example_questions?: string[] | null
          fec_tenant_id: string
          id?: string
          updated_at?: string | null
          welcome_message_enabled?: boolean | null
          welcome_message_template?: string | null
        }
        Update: {
          auto_send_on_first_message?: boolean | null
          created_at?: string | null
          example_questions?: string[] | null
          fec_tenant_id?: string
          id?: string
          updated_at?: string | null
          welcome_message_enabled?: boolean | null
          welcome_message_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_config_fec_tenant_id_fkey"
            columns: ["fec_tenant_id"]
            isOneToOne: false
            referencedRelation: "fec_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          ai_response: string | null
          created_at: string | null
          direction: string
          error_message: string | null
          event_type: string
          facility_name: string | null
          fec_tenant_id: string
          id: string
          manual_id: string | null
          message_body: string | null
          phone_number: string
          question_text: string | null
          response_time_ms: number | null
          topic_category: string | null
          truncated: boolean | null
          twilio_message_sid: string | null
          twilio_status: string | null
          user_id: string | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string | null
          direction: string
          error_message?: string | null
          event_type: string
          facility_name?: string | null
          fec_tenant_id: string
          id?: string
          manual_id?: string | null
          message_body?: string | null
          phone_number: string
          question_text?: string | null
          response_time_ms?: number | null
          topic_category?: string | null
          truncated?: boolean | null
          twilio_message_sid?: string | null
          twilio_status?: string | null
          user_id?: string | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string | null
          direction?: string
          error_message?: string | null
          event_type?: string
          facility_name?: string | null
          fec_tenant_id?: string
          id?: string
          manual_id?: string | null
          message_body?: string | null
          phone_number?: string
          question_text?: string | null
          response_time_ms?: number | null
          topic_category?: string | null
          truncated?: boolean | null
          twilio_message_sid?: string | null
          twilio_status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_fec_tenant_id_fkey"
            columns: ["fec_tenant_id"]
            isOneToOne: false
            referencedRelation: "fec_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          created_at: string
          fec_tenant_id: string
          id: string
          message: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          fec_tenant_id?: string
          id?: string
          message: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          fec_tenant_id?: string
          id?: string
          message?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
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
      training_examples: {
        Row: {
          answer: string | null
          context: string
          created_at: string | null
          difficulty: string | null
          do_instructions: string[] | null
          doc_id: string | null
          dont_instructions: string[] | null
          evidence_spans: Json | null
          expected_answer: string
          fec_tenant_id: string
          id: string
          is_approved: boolean | null
          model_type: string
          question: string
          source_query_id: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          answer?: string | null
          context: string
          created_at?: string | null
          difficulty?: string | null
          do_instructions?: string[] | null
          doc_id?: string | null
          dont_instructions?: string[] | null
          evidence_spans?: Json | null
          expected_answer: string
          fec_tenant_id?: string
          id?: string
          is_approved?: boolean | null
          model_type: string
          question: string
          source_query_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          answer?: string | null
          context?: string
          created_at?: string | null
          difficulty?: string | null
          do_instructions?: string[] | null
          doc_id?: string | null
          dont_instructions?: string[] | null
          evidence_spans?: Json | null
          expected_answer?: string
          fec_tenant_id?: string
          id?: string
          is_approved?: boolean | null
          model_type?: string
          question?: string
          source_query_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_examples_source_query_id_fkey"
            columns: ["source_query_id"]
            isOneToOne: false
            referencedRelation: "query_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_exports: {
        Row: {
          created_at: string | null
          created_by: string | null
          example_count: number
          fec_tenant_id: string
          file_url: string | null
          filters: Json | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          example_count: number
          fec_tenant_id?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          example_count?: number
          fec_tenant_id?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      training_feedback: {
        Row: {
          created_at: string | null
          created_by: string | null
          details: string | null
          feedback_type: string
          id: string
          photo_url: string | null
          query_id: string | null
          reason: string | null
          time_to_fix_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          details?: string | null
          feedback_type: string
          id?: string
          photo_url?: string | null
          query_id?: string | null
          reason?: string | null
          time_to_fix_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          details?: string | null
          feedback_type?: string
          id?: string
          photo_url?: string | null
          query_id?: string | null
          reason?: string | null
          time_to_fix_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_feedback_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "query_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      troubleshooting_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          escalation_info: Json | null
          fec_tenant_id: string
          game_id: string | null
          game_name: string | null
          id: string
          last_result: string | null
          location_name: string | null
          session_id: string
          status: string
          steps_tried: string[] | null
          symptom: string
          tech_skill_level: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          escalation_info?: Json | null
          fec_tenant_id?: string
          game_id?: string | null
          game_name?: string | null
          id?: string
          last_result?: string | null
          location_name?: string | null
          session_id: string
          status?: string
          steps_tried?: string[] | null
          symptom: string
          tech_skill_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          escalation_info?: Json | null
          fec_tenant_id?: string
          game_id?: string | null
          game_name?: string | null
          id?: string
          last_result?: string | null
          location_name?: string | null
          session_id?: string
          status?: string
          steps_tried?: string[] | null
          symptom?: string
          tech_skill_level?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      troubleshooting_steps: {
        Row: {
          assumptions: string[] | null
          branch_logic: string | null
          checks_performed: string[] | null
          created_at: string
          id: string
          next_actions: string[]
          questions_for_tech: string[] | null
          results_expected: string[] | null
          session_id: string
          status: string
          step_label: string
          step_number: number
          summary: string
          tech_response: string | null
        }
        Insert: {
          assumptions?: string[] | null
          branch_logic?: string | null
          checks_performed?: string[] | null
          created_at?: string
          id?: string
          next_actions: string[]
          questions_for_tech?: string[] | null
          results_expected?: string[] | null
          session_id: string
          status: string
          step_label: string
          step_number: number
          summary: string
          tech_response?: string | null
        }
        Update: {
          assumptions?: string[] | null
          branch_logic?: string | null
          checks_performed?: string[] | null
          created_at?: string
          id?: string
          next_actions?: string[]
          questions_for_tech?: string[] | null
          results_expected?: string[] | null
          session_id?: string
          status?: string
          step_label?: string
          step_number?: number
          summary?: string
          tech_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "troubleshooting_steps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "troubleshooting_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_limits: {
        Row: {
          created_at: string
          fec_tenant_id: string
          id: string
          last_reset_date: string
          manual_override: boolean | null
          override_reason: string | null
          override_set_at: string | null
          override_set_by: string | null
          queries_per_month: number
          queries_per_week: number
          queries_used_this_month: number
          queries_used_this_week: number
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          fec_tenant_id: string
          id?: string
          last_reset_date?: string
          manual_override?: boolean | null
          override_reason?: string | null
          override_set_at?: string | null
          override_set_by?: string | null
          queries_per_month?: number
          queries_per_week?: number
          queries_used_this_month?: number
          queries_used_this_week?: number
          updated_at?: string
          week_start?: string
        }
        Update: {
          created_at?: string
          fec_tenant_id?: string
          id?: string
          last_reset_date?: string
          manual_override?: boolean | null
          override_reason?: string | null
          override_set_at?: string | null
          override_set_by?: string | null
          queries_per_month?: number
          queries_per_week?: number
          queries_used_this_month?: number
          queries_used_this_week?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          fec_tenant_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          fec_tenant_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          fec_tenant_id?: string | null
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
      calculate_quality_metrics: {
        Args: {
          p_query_id: string
          p_response_text: string
          p_top_chunks: Json
        }
        Returns: Json
      }
      check_my_admin_status: {
        Args: never
        Returns: {
          all_roles: string[]
          has_admin_role: boolean
          user_email: string
        }[]
      }
      fn_backfill_for_manual: { Args: { p_manual_id: string }; Returns: number }
      fn_backfill_for_manual_any: {
        Args: { p_manual_id: string }
        Returns: Json
      }
      get_current_tenant_context: { Args: never; Returns: string }
      get_current_user_fec_tenant_id: { Args: never; Returns: string }
      get_manuals_for_dropdown: {
        Args: never
        Returns: {
          canonical_slug: string
          canonical_title: string
          doc_type: string
          manual_id: string
          platform: string
        }[]
      }
      grant_me_admin: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_guest_query_count: {
        Args: { p_ip_hash: string }
        Returns: Json
      }
      increment_ip_query_count: {
        Args: { p_ip_address: string }
        Returns: Json
      }
      increment_user_query_count: {
        Args: { p_tenant_id: string }
        Returns: Json
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
          figure_type: string
          id: string
          manual_id: string
          menu_path: string
          page_end: number
          page_start: number
          score: number
          storage_url: string
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
      match_docs:
        | {
            Args: {
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
        | {
            Args: {
              manual?: string
              match_count?: number
              query_embedding: string
            }
            Returns: {
              content: string
              game_title: string
              id: number
              similarity: number
            }[]
          }
      normalize_name: { Args: { input_text: string }; Returns: string }
      reset_weekly_usage: { Args: never; Returns: undefined }
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
      set_tenant_context:
        | { Args: { p_tenant_id: string }; Returns: undefined }
        | { Args: { tenant_id: string }; Returns: undefined }
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
      slugify: { Args: { input_text: string }; Returns: string }
      trigger_reindex: { Args: { p_manual_id: string }; Returns: Json }
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
