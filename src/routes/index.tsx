import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">Traders' OS</span>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            For Indian retail traders
          </span>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-balance">
            A calm trading journal for disciplined traders.
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto text-balance">
            Journal trades, track discipline, and understand your psychology — without the noise of
            calls, signals, or copy-trading.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link to="/login">
                Get started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
        Traders' OS does not provide buy/sell calls, recommendations, or trading signals.
      </footer>
    </div>
  );
}
