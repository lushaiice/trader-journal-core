import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageSquare, Wallet, Sun, Moon, Monitor } from "lucide-react";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useWorkspacePreferences } from "@/lib/preferences";
import { useTheme, type Theme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { prefs, update } = useWorkspacePreferences();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile, preferences, and discipline rules."
      />

      <div className="space-y-4">
        <section className="surface-card p-6">
          <h3 className="text-sm font-medium mb-1">Account</h3>
          <p className="text-xs text-muted-foreground mb-4">Signed in as</p>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm">{user?.email}</p>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </section>

        <AppearanceSection />

        <section className="surface-card p-6 space-y-5">
          <div>
            <h3 className="text-sm font-medium mb-1">Workspace preferences</h3>
            <p className="text-xs text-muted-foreground">
              Tune how the daily workspace fits your routine.
            </p>
          </div>

          <PrefRow
            label="Show end-of-day reflection by default"
            description="Always include the reflection block on Today."
          >
            <Switch
              checked={prefs.defaultReflectionVisible}
              onCheckedChange={(v) => update({ defaultReflectionVisible: v })}
            />
          </PrefRow>

          <PrefRow
            label="Track emotional state"
            description="Capture confidence, mood, and discipline per trade."
          >
            <Switch
              checked={prefs.trackEmotional}
              onCheckedChange={(v) => update({ trackEmotional: v })}
            />
          </PrefRow>

          <PrefRow
            label="Track discipline rules"
            description="Log rule adherence after each session."
          >
            <Switch
              checked={prefs.trackDiscipline}
              onCheckedChange={(v) => update({ trackDiscipline: v })}
            />
          </PrefRow>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preferred daily flow</Label>
            <Select
              value={prefs.preferredFlow}
              onValueChange={(v) =>
                update({ preferredFlow: v as typeof prefs.preferredFlow })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checklist-first">Checklist first</SelectItem>
                <SelectItem value="journal-first">Journal first</SelectItem>
                <SelectItem value="free">Free order</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Timezone</Label>
            <p className="text-sm">{prefs.timezone}</p>
            <p className="text-[11px] text-muted-foreground">
              Detected from your device. Used for daily date boundaries.
            </p>
          </div>
        </section>

        <section className="surface-card p-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Portfolio capital
            </h3>
            <p className="text-xs text-muted-foreground">
              Track deposits, withdrawals, and your equity baseline.
            </p>
          </div>
          <Button asChild size="sm" variant="secondary">
            <Link to="/capital">Manage</Link>
          </Button>
        </section>

        <section className="surface-card p-6">
          <h3 className="text-sm font-medium mb-1">Discipline rules</h3>
          <p className="text-xs text-muted-foreground">
            Define the rules you want to track each day.
          </p>
        </section>

        <section className="surface-card p-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-medium mb-1">Feedback</h3>
            <p className="text-xs text-muted-foreground">
              Help us improve Traders' OS during the beta.
            </p>
          </div>
          <FeedbackDialog
            trigger={
              <Button variant="outline" size="sm">
                <MessageSquare className="h-4 w-4 mr-2" />
                Send feedback
              </Button>
            }
          />
        </section>
      </div>
    </>
  );
}

function PrefRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <section className="surface-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-1">Appearance</h3>
        <p className="text-xs text-muted-foreground">
          Choose how Traders' OS looks on this device.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const Icon = o.icon;
          const active = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setTheme(o.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-md border px-3 py-3 text-xs transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/30",
              )}
            >
              <Icon className="h-4 w-4" />
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
