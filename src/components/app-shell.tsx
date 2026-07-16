import { useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  PlusCircle,
  History,
  BarChart3,
  PieChart,
  Settings,
  LogOut,
  TrendingUp,
  Sun,
  CalendarRange,
  Clock,
  Wallet,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/today", label: "Today", icon: Sun },
  { to: "/add-trade", label: "Add Trade", icon: PlusCircle },
  { to: "/trades", label: "Trades", icon: History },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/portfolio", label: "Portfolio", icon: PieChart },

  { to: "/journal-timeline", label: "Timeline", icon: Clock },
  { to: "/weekly-review", label: "Weekly Review", icon: CalendarRange },
  { to: "/capital", label: "Capital", icon: Wallet },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_NAV = NAV.filter((n) =>
  ["/today", "/add-trade", "/trades", "/analytics", "/weekly-review"].includes(n.to),
);

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-sidebar-border">
          <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">Traders' OS</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => {
            const active = path === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs">
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate">{user?.email}</p>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-7 w-7">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="md:hidden h-14 px-4 flex items-center justify-between border-b"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight">Traders' OS</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto md:pb-0"
          style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 md:py-10">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 bg-sidebar border-t border-sidebar-border z-50"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <ul className="grid grid-cols-5">
            {MOBILE_NAV.map((item) => {
              const active = path === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px]",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate max-w-full px-1">{item.label.split(" ")[0]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <FloatingFeedbackButton />
      </div>
    </div>
  );
}

function FloatingFeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className="fixed right-6 z-50 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
      >
        <FeedbackTriggerButton onClick={() => setOpen(true)} />
      </div>
      <div className="hidden md:block fixed bottom-6 right-6 z-50">
        <FeedbackTriggerButton onClick={() => setOpen(true)} />
      </div>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function FeedbackTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Send feedback"
            onClick={onClick}
            className="rounded-full h-10 w-10 shadow-md"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Send feedback</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
