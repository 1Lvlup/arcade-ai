-- Create troubleshooting sessions table
CREATE TABLE IF NOT EXISTS public.troubleshooting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fec_tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT NOT NULL UNIQUE,
  game_id TEXT,
  game_name TEXT,
  location_name TEXT,
  symptom TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'probably_fixed', 'escalated', 'done')),
  tech_skill_level TEXT DEFAULT 'intermediate' CHECK (tech_skill_level IN ('beginner', 'intermediate', 'advanced')),
  steps_tried TEXT[] DEFAULT '{}',
  last_result TEXT,
  escalation_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create troubleshooting steps table
CREATE TABLE IF NOT EXISTS public.troubleshooting_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.troubleshooting_sessions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_label TEXT NOT NULL,
  summary TEXT NOT NULL,
  next_actions TEXT[] NOT NULL,
  questions_for_tech TEXT[],
  status TEXT NOT NULL CHECK (status IN ('continue', 'probably_fixed', 'escalate', 'need_manual', 'done')),
  assumptions TEXT[],
  checks_performed TEXT[],
  results_expected TEXT[],
  branch_logic TEXT,
  tech_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.troubleshooting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troubleshooting_steps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for troubleshooting_sessions
CREATE POLICY "Users can view their own sessions"
  ON public.troubleshooting_sessions FOR SELECT
  USING (auth.uid() = user_id OR fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can insert their own sessions"
  ON public.troubleshooting_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND fec_tenant_id = get_current_user_fec_tenant_id());

CREATE POLICY "Users can update their own sessions"
  ON public.troubleshooting_sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
  ON public.troubleshooting_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage sessions"
  ON public.troubleshooting_sessions FOR ALL
  USING (fec_tenant_id = get_current_tenant_context())
  WITH CHECK (fec_tenant_id = get_current_tenant_context());

-- RLS Policies for troubleshooting_steps
CREATE POLICY "Users can view steps for their sessions"
  ON public.troubleshooting_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.troubleshooting_sessions
    WHERE id = troubleshooting_steps.session_id
    AND (auth.uid() = user_id OR fec_tenant_id = get_current_user_fec_tenant_id())
  ));

CREATE POLICY "Users can insert steps for their sessions"
  ON public.troubleshooting_steps FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.troubleshooting_sessions
    WHERE id = troubleshooting_steps.session_id
    AND auth.uid() = user_id
  ));

CREATE POLICY "Admins can view all steps"
  ON public.troubleshooting_steps FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage steps"
  ON public.troubleshooting_steps FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.troubleshooting_sessions
    WHERE id = troubleshooting_steps.session_id
    AND fec_tenant_id = get_current_tenant_context()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.troubleshooting_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON public.troubleshooting_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.troubleshooting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_steps_session_id ON public.troubleshooting_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_steps_step_number ON public.troubleshooting_steps(step_number);