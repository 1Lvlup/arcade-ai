import React, { useMemo, useState } from "react";
import { SharedHeader } from "@/components/SharedHeader";
import { Footer } from "@/components/Footer";
import { useNavigate } from "react-router-dom";

/**
 * Pricing Page
 * - Neon teal ambient; orange (#FF6600) = action/CTA.
 * - Montserrat for headings; Inter for body.
 * - Starter, Pro (featured), and Repair Ticket Handler add-on.
 */
export default function Pricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);

  const themeVars: React.CSSProperties = {
    // @ts-ignore
    "--glow-teal": "#00F5FF",
    "--accent-orange": "#FF6600",
    "--bg-deep": "#0B0E11",
    "--bg-card": "#121418",
    "--text-dim": "#A9B2B7",
  };

  const plans = useMemo(() => {
    const starterMonthly = 299;
    const proMonthly = 499;
    const starterAnnual = 2700; // 3 months free
    const proAnnual = 4500; // 3 months free

    return {
      starter: {
        title: "Starter",
        priceMain: annual ? `$${starterAnnual.toLocaleString()}` : `$${starterMonthly}`,
        cadence: annual ? "/ yr" : "/ mo",
        subNote: annual
          ? "(3 months free)"
          : `(or $${starterAnnual.toLocaleString()}/yr — 3 months free)`,
        features: [
          "1 FEC location included",
          "Up to " + emphasized("40 games"),
          "Unlimited tech accounts",
          "Instant AI troubleshooting access",
          "Email support (24 hr response)",
          strike("Repair Ticket Handler (Add-On)"),
        ],
      },
      pro: {
        title: "Pro (Recommended)",
        priceMain: annual ? `$${proAnnual.toLocaleString()}` : `$${proMonthly}`,
        cadence: annual ? "/ yr" : "/ mo",
        subNote: annual
          ? "(3 months free)"
          : `(or $${proAnnual.toLocaleString()}/yr — 3 months free)`,
        features: [
          "Everything in Starter",
          "Up to " + emphasized("100 games"),
          "Priority email & chat support",
          "Early access to new modules",
          strike("Repair Ticket Handler (Add-On)"),
        ],
      },
      addon: {
        title: "Repair Ticket Handler Add-On",
        priceMain: "$99",
        cadence: "one-time setup",
        subNote: "(optional)",
        bullets: [
          "Create & close tickets in seconds",
          "Auto-link tickets to specific games",
          "Track average fix times",
          "Weekly email summaries",
          "Downloadable CSV",
        ],
      },
    };
  }, [annual]);

  return (
    <div className="min-h-screen mesh-gradient flex flex-col">
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

          {/* Billing Toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#0F1115] px-2 py-2 ring-1 ring-white/10">
            <ToggleButton
              label="Monthly"
              active={!annual}
              onClick={() => setAnnual(false)}
            />
            <ToggleButton
              label="Annual"
              sub="(3 months free)"
              active={annual}
              onClick={() => setAnnual(true)}
            />
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-6 px-6 md:mt-16 md:grid-cols-3">
          {/* Starter */}
          <PlanCard
            title={plans.starter.title}
            priceMain={plans.starter.priceMain}
            cadence={plans.starter.cadence}
            subNote={plans.starter.subNote}
            features={plans.starter.features}
            buttonLabel="Start Starter Plan"
            highlight={false}
          />

          {/* Pro (featured) */}
          <PlanCard
            title={plans.pro.title}
            priceMain={plans.pro.priceMain}
            cadence={plans.pro.cadence}
            subNote={plans.pro.subNote}
            features={plans.pro.features}
            buttonLabel="Upgrade to Pro"
            highlight={true}
          />

          {/* Add-On */}
          <AddOnCard
            title={plans.addon.title}
            priceMain={plans.addon.priceMain}
            cadence={plans.addon.cadence}
            subNote={plans.addon.subNote}
            bullets={plans.addon.bullets}
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
  cadence: string;
  subNote: string;
  features: (string | JSX.Element)[];
  buttonLabel: string;
  highlight?: boolean;
}) {
  const { title, priceMain, cadence, subNote, features, buttonLabel, highlight } = props;
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

      <div className="flex items-baseline gap-1">
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
        className="mt-7 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition
                   hover:shadow-[0_0_28px_rgba(255,102,0,0.45)]
                   focus:outline-none"
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

function AddOnCard(props: {
  title: string;
  priceMain: string;
  cadence: string;
  subNote: string;
  bullets: string[];
}) {
  const { title, priceMain, cadence, subNote, bullets } = props;

  return (
    <div
      className="relative rounded-3xl border border-white/8 bg-[color:var(--bg-card)] p-6 md:p-7 ring-1 ring-white/5"
      style={{ boxShadow: "0 0 24px rgba(0,245,255,0.08)" }}
    >
      <h3
        className="mb-3 text-xl md:text-2xl font-extrabold"
        style={{ color: "white", fontFamily: "Montserrat, ui-sans-serif, system-ui" }}
      >
        {title}
      </h3>

      <div className="flex items-baseline gap-1">
        <span
          className="text-2xl md:text-3xl font-extrabold"
          style={{ color: "var(--accent-orange)", fontFamily: "Inter, ui-sans-serif, system-ui" }}
        >
          {priceMain}
        </span>
        <span className="text-base md:text-lg font-medium text-white/90" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
          {` ${cadence}`}
        </span>
      </div>
      <p className="mt-1 text-sm italic" style={{ color: "var(--text-dim)", fontFamily: "Inter, ui-sans-serif, system-ui" }}>
        {subNote}
      </p>

      <p className="mt-4 text-sm text-white/90" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
        Keep repairs organized — without complex software.
        <strong> Simplified dashboard:</strong> open → in&nbsp;progress → fixed.
      </p>

      <ul className="mt-5 space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <DotIcon />
            <span className="text-sm leading-6 text-white/90" style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}>
              {b}
            </span>
          </li>
        ))}
      </ul>

      <button
        className="mt-7 w-full rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-sm font-semibold text-white
                   transition-colors hover:border-[color:var(--accent-orange)] hover:text-[color:var(--accent-orange)] focus:outline-none"
        style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
      >
        Add the Ticket Handler
      </button>

      <p className="mt-2 text-center text-[13px]" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Inter, ui-sans-serif, system-ui" }}>
        (Available only with active Starter or Pro plan.)
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

function DotIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 10 10" fill="none" className="mt-2 flex-none">
      <circle cx="5" cy="5" r="4" fill="var(--glow-teal)" />
    </svg>
  );
}

function ToggleButton({ label, sub, active, onClick }: { label: string; sub?: string; active: boolean; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-[color:var(--accent-orange)] text-white shadow-[0_0_14px_rgba(255,102,0,0.45)]"
          : "text-white/80 hover:text-white"
      ].join(" ")}
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
    >
      {label} {sub && <span className="ml-1 text-xs italic opacity-80"> {sub}</span>}
    </button>
  );
}

function emphasized(txt: string) {
  return <strong className="font-semibold">{txt}</strong>;
}
function strike(txt: string) {
  return <span className="opacity-70 line-through">{txt}</span>;
}
