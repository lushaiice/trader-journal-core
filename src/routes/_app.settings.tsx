import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile, preferences, and discipline rules." />

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

        <section className="surface-card p-6">
          <h3 className="text-sm font-medium mb-1">Profile</h3>
          <p className="text-xs text-muted-foreground">Display name, trading style, timezone — coming soon.</p>
        </section>

        <section className="surface-card p-6">
          <h3 className="text-sm font-medium mb-1">Discipline rules</h3>
          <p className="text-xs text-muted-foreground">Define the rules you want to track each day.</p>
        </section>
      </div>
    </>
  );
}
