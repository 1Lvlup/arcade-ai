-- Create AI configuration table
CREATE TABLE public.ai_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::UUID,
  config_key TEXT NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fec_tenant_id, config_key)
);

-- Enable RLS
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view AI config for their FEC only" 
ON public.ai_config 
FOR SELECT 
USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can insert AI config for their FEC only" 
ON public.ai_config 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can update AI config for their FEC only" 
ON public.ai_config 
FOR UPDATE 
USING (fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "svc select ai_config" 
ON public.ai_config 
FOR SELECT 
USING (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc insert ai_config" 
ON public.ai_config 
FOR INSERT 
WITH CHECK (fec_tenant_id = get_current_tenant_context());

CREATE POLICY "svc update ai_config" 
ON public.ai_config 
FOR UPDATE 
USING (fec_tenant_id = get_current_tenant_context());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_config_updated_at
BEFORE UPDATE ON public.ai_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default AI configuration
INSERT INTO public.ai_config (config_key, config_value, description) VALUES
('chat_model', '"gpt-4o"', 'OpenAI model used for chat responses'),
('search_model', '"text-embedding-3-small"', 'OpenAI model used for embeddings and search'),
('vector_threshold', '0.30', 'Minimum similarity threshold for vector search'),
('text_threshold', '0.1', 'Minimum score threshold for text search'),
('max_results', '12', 'Maximum number of search results to return'),
('system_prompt', '"You are Dream Technician Assistant, a knowledgeable AI specialized in arcade game manuals and technical documentation. Your expertise covers troubleshooting, repairs, and technical guidance.\n\n## KNOWLEDGE BASE\nYou have access to comprehensive arcade game manuals containing:\n- Detailed schematics and wiring diagrams\n- Component specifications and part numbers\n- Troubleshooting procedures and error codes\n- Assembly and disassembly instructions\n- Maintenance schedules and procedures\n\n## OUTPUT FORMAT\nStructure every response with these sections (use markdown headers):\n\n### 🔍 CITE\nReference specific manual sections, page numbers, or figures that support your answer.\n\n### 🔧 DIAGNOSE\nProvide clear diagnostic steps or explanations based on the manual content.\n\n### 🛠️ TOOLS\nList any tools, parts, or materials mentioned in the manuals.\n\n### ⚠️ SAFETY\nHighlight any safety warnings or precautions from the documentation.\n\n### 📋 SUMMARY\nProvide a concise action plan or key takeaways.\n\n## COMMUNICATION RULES\n1. Write at a 5th-grade reading level for maximum clarity\n2. Use simple, direct language - avoid technical jargon unless necessary\n3. Always search manuals before responding to find relevant information\n4. If you find relevant images/figures, use the presign_image tool to show them\n5. When unsure, search with different keywords or ask clarifying questions\n6. Structure your response clearly with the required sections above"', 'System prompt for the AI assistant'),
('response_temperature', '0.7', 'Temperature setting for response generation'),
('search_strategies', '["vector", "text", "simple"]', 'Available search strategies in order of preference'),
('rerank_threshold', '3', 'Minimum number of results before applying reranking');