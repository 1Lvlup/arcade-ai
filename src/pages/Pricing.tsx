import React, { useMemo, useState } from "react";
import { SharedHeader } from "@/components/SharedHeader";
import { Footer } from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SUBSCRIPTION_TIERS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Pricing Page
 * - Neon teal ambient; orange (#FF6600) = action/CTA.
 * - Montserrat for headings; Inter for body.
 * - Starter, Pro (featured), and Repair Ticket Handler add-on.
 */
export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to subscribe',
        variant: 'destructive',
      });
      navigate('/auth');
      return;
    }

    const priceId = SUBSCRIPTION_TIERS.basic_monthly.price_id;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start checkout',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const themeVars: React.CSSProperties = {
    // @ts-ignore
    "--glow-teal": "#00F5FF",
    "--accent-orange": "#FF6600",
    "--bg-deep": "#0B0E11",
    "--bg-card": "#121418",
    "--text-dim": "#A9B2B7",
  };

  const plan = {
    title: "Basic Plan",
    priceMain: "$99",
    cadence: "/ mo",
    subNote: "Cancel anytime",
    features: [
      "Access to Level Up AI troubleshooting assistant",
      "Unlimited queries",
      "Game manual knowledge base",
      "Email support (24 hr response)",
      "SMS support for quick questions",
    ],
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <SharedHeader title="Pricing" showBackButton={true} backTo="/" />
      
      <section
        className="relative py-16 md:py-24 flex-1"
        style={themeVars as React.CSSProperties}
      >
        {/* subtle radial ambience */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0"
               style={{
                 background:
                   "radial-gradient(1200px 600px at 50% -10%, rgba(0,245,255,0.18), rgba(0,0,0,0) 70%)",
               }}
          />
        </div>

        {/* Header */}
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h1
            className="text-4xl md:text-5xl font-extrabold tracking-tight"
            style={{ fontFamily: "Montserrat, ui-sans-serif, system-ui", color: "white" }}
          >
            Choose your <span style={{ color: "var(--glow-teal)" }}>Level Up</span> plan
          </h1>
          <p
            className="mt-4 text-base md:text-lg"
            style={{ color: "var(--text-dim)", fontFamily: "Inter, ui-sans-serif, system-ui" }}
          >
            Built for busy FEC technicians who want less paperwork and faster fixes.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="mx-auto mt-12 max-w-md px-6 md:mt-16">
          <PlanCard
            title={plan.title}
            priceMain={plan.priceMain}
            cadence={plan.cadence}
            subNote={plan.subNote}
            features={plan.features}
            buttonLabel={loading ? 'Loading...' : 'Subscribe Now'}
            highlight={true}
            onButtonClick={handleCheckout}
            disabled={loading}
          />
        </div>

        {/* Bottom CTA */}
        <div className="mx-auto mt-12 max-w-3xl px-6 text-center md:mt-16">
          <h2
            className="text-2xl md:text-3xl font-bold"
            style={{ fontFamily: "Montserrat, ui-sans-serif, system-ui", color: "white" }}
          >
            Ready to Level Up your maintenance game?
          </h2>
          <p
            className="mt-3 text-base"
            style={{ color: "var(--text-dim)", fontFamily: "Inter, ui-sans-serif, system-ui" }}
          >
            30-day risk-free. No setup fees. Cancel anytime.
          </p>
          <button
            className="mt-6 inline-flex items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold text-white transition
                       shadow-[0_0_24px_rgba(255,102,0,0.35)]
                       hover:shadow-[0_0_32px_rgba(255,102,0,0.5)]
                       focus:outline-none"
            style={{
              backgroundColor: "var(--accent-orange)",
            }}
            onClick={() => navigate('/')}
          >
            Get Started
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ---------- subcomponents ---------- */

function PlanCard(props: {
  title: string;
  priceMain: string;
  oldPrice?: string;
  cadence: string;
  subNote: string;
  features: (string | JSX.Element)[];
  buttonLabel: string;
  highlight?: boolean;
  onButtonClick?: () => void;
  disabled?: boolean;
}) {
  const { title, priceMain, oldPrice, cadence, subNote, features, buttonLabel, highlight, onButtonClick, disabled } = props;
  return (
    <div
      className={[
        "relative rounded-3xl p-6 md:p-7",
        "border border-white/8 bg-[color:var(--bg-card)]",
        "shadow-[0_0_24px_rgba(0,245,255,0.08)]",
        highlight ? "ring-2 ring-[color:var(--accent-orange)]" : "ring-1 ring-white/5",
      ].join(" ")}
    >
      {highlight && (
        <span
          className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: "linear-gradient(90deg, rgba(255,102,0,0.2), rgba(255,102,0,0.05))",
            border: "1px solid rgba(255,102,0,0.45)",
            color: "white",
            fontFamily: "Inter, ui-sans-serif, system-ui",
          }}
        >
          Featured
        </span>
      )}

      <h3
        className="mb-3 text-xl md:text-2xl font-extrabold"
        style={{ color: "white", fontFamily: "Montserrat, ui-sans-serif, system-ui" }}
      >
        {title}
      </h3>

      <div className="flex items-baseline gap-2 flex-wrap">
        {oldPrice && (
          <span
            className="text-xl md:text-2xl font-semibold line-through opacity-50"
            style={{ color: "var(--text-dim)", fontFamily: "Inter, ui-sans-serif, system-ui" }}
          >
            {oldPrice}
          </span>
        )}
        <span
          className="text-3xl md:text-4xl font-extrabold"
          style={{ color: "var(--accent-orange)", fontFamily: "Inter, ui-sans-serif, system-ui" }}
        >
          {priceMain}
        </span>
        <span
          className="text-base md:text-lg font-medium text-white/90"
          style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
        >
          {` ${cadence}`}
        </span>
      </div>

      <p
        className="mt-1 text-sm italic"
        style={{ color: "var(--text-dim)", fontFamily: "Inter, ui-sans-serif, system-ui" }}
      >
        {subNote}
      </p>

      <ul className="mt-6 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckIcon />
            <span className="text-sm leading-6 text-white/90" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
              {f}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={onButtonClick}
        disabled={disabled}
        className="mt-7 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition
                   hover:shadow-[0_0_28px_rgba(255,102,0,0.45)]
                   focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--accent-orange)",
          boxShadow: "0 0 22px rgba(255,102,0,0.35)",
          fontFamily: "Inter, ui-sans-serif, system-ui",
        }}
      >
        {buttonLabel}
      </button>

      <p
        className="mt-2 text-center text-[13px]"
        style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter, ui-sans-serif, system-ui" }}
      >
        No contracts. Cancel anytime.
      </p>
    </div>
  );
}

/* ---------- tiny helpers ---------- */

function CheckIcon() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      className="mt-1 flex-none"
      style={{ filter: "drop-shadow(0 0 8px rgba(0,245,255,0.35))" }}
    >
      <circle cx="12" cy="12" r="10" stroke="var(--glow-teal)" strokeWidth="1.5" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke="var(--glow-teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
