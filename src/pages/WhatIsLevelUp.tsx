import { SharedHeader } from "@/components/SharedHeader";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function WhatIsLevelUp() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SharedHeader />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="container mx-auto max-w-4xl relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              What Is Level Up?
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-semibold">
              AI-powered troubleshooting and knowledge for arcades, FECs, and bowling centers.
            </p>
          </div>
        </section>

        {/* Content Sections */}
        <section className="py-12 px-4">
          <div className="container mx-auto max-w-4xl space-y-16">
            
            {/* One Sentence */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Level Up in one sentence</h2>
              <p className="text-lg text-foreground font-semibold">
                Level Up is an AI assistant built specifically for arcade and bowling technicians, GMs, and owners.
              </p>
              <p className="text-muted-foreground">
                It turns your game manuals, wiring diagrams, and real-world fixes into a searchable "senior tech in your pocket" that:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>walks techs through step-by-step troubleshooting,</li>
                <li>captures every fix as reusable knowledge, and</li>
                <li>gives leadership visibility into downtime and maintenance performance.</li>
              </ul>
              <p className="text-muted-foreground italic">
                Not a generic chatbot. Not another ticketing system. A focused operations brain for your games and attractions.
              </p>
            </div>

            {/* Who It's For */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Who Level Up is for</h2>
              <ul className="space-y-3">
                <li className="text-muted-foreground">
                  <strong className="text-foreground">Technicians</strong> – tired of guessing, hunting through PDFs, and being blamed for downtime.
                </li>
                <li className="text-muted-foreground">
                  <strong className="text-foreground">GMs and operations leaders</strong> – who need fewer surprises and clearer visibility into down games.
                </li>
                <li className="text-muted-foreground">
                  <strong className="text-foreground">Owners and investors</strong> – who want to protect game investments, reduce downtime, and see a clean ROI story for maintenance.
                </li>
              </ul>
            </div>

            {/* The Problem */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">The problem today</h2>
              <p className="text-muted-foreground">In most arcades and FECs:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Manuals are hard to search, buried in folders, or lost.</li>
                <li>Tribal knowledge lives in one or two "hero techs" who can't be everywhere.</li>
                <li>New techs take months to become productive.</li>
                <li>GMs and owners only see "up" or "down" – not what's really going on.</li>
                <li>Every shift feels reactive: radios, upset guests, and high-pressure fixes.</li>
              </ul>
              <p className="text-muted-foreground mt-4">Everyone feels the pain:</p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Techs feel like they're set up to fail.</li>
                <li>Managers feel blind and stuck in firefighting mode.</li>
                <li>Owners quietly lose revenue and don't have clean numbers on why.</li>
              </ul>
            </div>

            {/* What Level Up Does */}
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-foreground">What Level Up does</h2>
              
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-foreground">1. Answers tech questions in plain language</h3>
                <p className="text-muted-foreground">Techs can type or text questions like:</p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>"Lane 13 not scoring on 10th frame, where do I start?"</li>
                  <li>"Lower opto on Down the Clown not reading – what should I test?"</li>
                </ul>
                <p className="text-muted-foreground mt-4">Level Up responds with:</p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>grounded steps based on your manuals and known fixes,</li>
                  <li>clear "check this first, then this" logic,</li>
                  <li>references to boards, connectors, sensors, and part numbers when available.</li>
                </ul>
                <p className="text-muted-foreground italic mt-2">No guessing. No generic AI advice. It stays inside your data.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-foreground">2. Turns every fix into permanent knowledge</h3>
                <p className="text-muted-foreground">Each time a tech solves an issue, Level Up can capture:</p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>game / attraction,</li>
                  <li>symptom,</li>
                  <li>root cause,</li>
                  <li>what fixed it,</li>
                  <li>parts used (if any).</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  Over time, your location builds a private "brain" of what really goes wrong and how it was fixed – not just what the manual says should happen.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-foreground">3. Gives leadership real visibility into downtime</h3>
                <p className="text-muted-foreground">Level Up can support reporting like:</p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li>Which games are down and for how long</li>
                  <li>Common recurring issues</li>
                  <li>Average time-to-fix</li>
                  <li>Where training or process gaps are showing up</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  Instead of "we're waiting on a part," leadership sees what's broken, what's been tried, what's working, and where the operation is improving.
                </p>
              </div>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">How Level Up works</h2>
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground ml-4">
                <li>
                  <strong className="text-foreground">We load your manuals and documentation</strong> – game manuals, wiring diagrams, attraction docs, and existing notes.
                </li>
                <li>
                  <strong className="text-foreground">Level Up organizes and understands them</strong> – parses PDFs, breaks them into logical pieces, tags content by game/system/topic.
                </li>
                <li>
                  <strong className="text-foreground">Your team uses it on shift</strong> – techs ask questions, follow guided diagnostics, and log fixes so the system gets smarter.
                </li>
              </ol>
            </div>

            {/* Example */}
            <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
              <h2 className="text-3xl font-bold text-foreground">Example: a real shift problem</h2>
              <p className="text-muted-foreground">
                A key redemption game is down on a Saturday. The display is on, but it's not reading cards, and guests are starting to line up.
              </p>
              <div className="space-y-3 mt-4">
                <div>
                  <p className="text-foreground font-semibold">Without Level Up:</p>
                  <p className="text-muted-foreground">
                    tech digs for the manual, scrolls around, tries a reset, and hopes it works. If it doesn't, they start swapping parts or calling someone who "might remember." The game might be down for hours.
                  </p>
                </div>
                <div>
                  <p className="text-foreground font-semibold">With Level Up:</p>
                  <p className="text-muted-foreground">
                    tech opens Level Up and types: "Game X – card reader isn't responding, display is on, what should I check?" Level Up responds with power checks, connector to verify, board test points, known failure patterns, and likely part numbers. Once resolved, the tech logs what fixed it in one step.
                  </p>
                </div>
              </div>
            </div>

            {/* Why Operators Care */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Why operators and owners care</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                <li>Reduce downtime on your highest-earning games.</li>
                <li>Onboard new techs faster with a consistent troubleshooting system.</li>
                <li>Lower reliance on one or two hero techs.</li>
                <li>Protect game investments by catching and fixing issues correctly.</li>
                <li>Tell a real story about ROI instead of guessing.</li>
              </ul>
            </div>

            {/* Where Level Up Is Today */}
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-foreground">Where Level Up is today</h2>
              <p className="text-muted-foreground">
                Level Up is currently being built and tested inside a live FEC/arcade environment by <strong className="text-foreground">Jordan Dupre – Chief Engineer at Kingpinz (Fargo, ND)</strong>.
              </p>
              <p className="text-muted-foreground">
                Every new feature is driven by real technician problems, real game failures, and real operational pressure. If it doesn't help in the building, it doesn't ship.
              </p>
            </div>

            {/* CTA */}
            <div className="space-y-6 bg-primary/5 p-8 rounded-lg border border-primary/20">
              <h2 className="text-3xl font-bold text-foreground">Interested in Level Up?</h2>
              <p className="text-muted-foreground">
                If you'd like to walk through a real troubleshooting example, talk about your game mix and pain points, or see where this could fit in your operation, reach out and we'll schedule a conversation.
              </p>
              <Link to="/support">
                <Button size="lg" className="mt-4">
                  Get in Touch
                </Button>
              </Link>
            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
