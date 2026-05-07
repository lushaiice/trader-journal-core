import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { LineChart, PlusCircle, Notebook, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const STATS = [
  { label: "Trades this month", value: "—", hint: "No trades yet" },
  { label: "Win rate", value: "—", hint: "Awaiting data" },
  { label: "Discipline score", value: "—", hint: "Log to begin" },
  { label: "Journals written", value: "—", hint: "Build the habit" },
];

function Dashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your calm overview. Journal your trades and reflections — the numbers will follow."
        action={
          <Button asChild>
            <Link to="/add-trade">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Trade
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {STATS.map((s) => (
          <div key={s.label} className="surface-card p-4 md:p-5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-semibold mt-1.5">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="surface-card p-5 lg:col-span-2">
          <h3 className="text-sm font-medium mb-1">Recent activity</h3>
          <p className="text-xs text-muted-foreground mb-5">A timeline of your trades and reflections will appear here.</p>
          <EmptyState
            icon={LineChart}
            title="No activity yet"
            description="Start by logging your first trade or writing today's journal entry."
            action={
              <div className="flex gap-2">
                <Button asChild size="sm">
                  <Link to="/add-trade">Add trade</Link>
                </Button>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/journal">Write journal</Link>
                </Button>
              </div>
            }
          />
        </div>

        <div className="space-y-4">
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Notebook className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Today's journal</h3>
            </div>
            <p className="text-xs text-muted-foreground">Capture mood, focus, and market view.</p>
            <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
              <Link to="/journal">Open journal</Link>
            </Button>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium">Discipline check-in</h3>
            </div>
            <p className="text-xs text-muted-foreground">Did you follow your rules today?</p>
            <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
              <Link to="/settings">Set up rules</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
