import React, { useMemo, useState } from "react";
import { SharedHeader } from "@/components/SharedHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
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
    <div className="min-h-screen bg-background flex flex-col">
      <SharedHeader title="Pricing" showBackButton={true} backTo="/" />
      
      <section className="relative py-16 md:py-24 flex-1">
        {/* Header */}
        <div className="container mx-auto max-w-5xl px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-tech text-foreground">
            Choose your <span className="text-primary">Level Up</span> plan
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground font-body">
            Built for busy FEC technicians who want less paperwork and faster fixes.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="container mx-auto mt-12 max-w-md px-6 md:mt-16">
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
        <div className="container mx-auto mt-12 max-w-3xl px-6 text-center md:mt-16">
          <h2 className="text-2xl md:text-3xl font-bold font-tech text-foreground">
            Ready to Level Up your maintenance game?
          </h2>
          <p className="mt-3 text-base text-muted-foreground font-body">
            30-day risk-free. No setup fees. Cancel anytime.
          </p>
          <Button
            variant="orange"
            size="lg"
            className="mt-6"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Started'}
          </Button>
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
    <div className={`relative rounded-3xl p-6 md:p-7 border bg-card transition-all duration-300 ${
      highlight 
        ? 'border-primary shadow-[0_0_30px_rgba(255,107,0,0.2)]' 
        : 'border-border'
    }`}>
      {highlight && (
        <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-xs font-semibold bg-primary/20 border border-primary text-foreground">
          Featured
        </span>
      )}

      <h3 className="mb-3 text-xl md:text-2xl font-extrabold font-tech text-foreground uppercase">
        {title}
      </h3>

      <div className="flex items-baseline gap-2 flex-wrap">
        {oldPrice && (
          <span className="text-xl md:text-2xl font-semibold line-through opacity-50 text-muted-foreground font-body">
            {oldPrice}
          </span>
        )}
        <span className="text-3xl md:text-4xl font-extrabold text-primary font-body">
          {priceMain}
        </span>
        <span className="text-base md:text-lg font-medium text-foreground/90 font-body">
          {` ${cadence}`}
        </span>
      </div>

      <p className="mt-1 text-sm italic text-muted-foreground font-body">
        {subNote}
      </p>

      <ul className="mt-6 space-y-3">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckIcon />
            <span className="text-sm leading-6 text-foreground/90 font-body">
              {f}
            </span>
          </li>
        ))}
      </ul>

      <Button
        onClick={onButtonClick}
        disabled={disabled}
        variant="orange"
        className="mt-7 w-full"
      >
        {buttonLabel}
      </Button>

      <p className="mt-2 text-center text-[13px] text-muted-foreground font-body">
        No contracts. Cancel anytime.
      </p>
    </div>
  );
}

/* ---------- tiny helpers ---------- */

function CheckIcon() {
  return (
    <svg
      width="18" 
      height="18" 
      viewBox="0 0 24 24" 
      fill="none"
      className="mt-1 flex-none"
    >
      <circle cx="12" cy="12" r="10" stroke="hsl(24 100% 60%)" strokeWidth="1.5" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke="hsl(24 100% 60%)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
