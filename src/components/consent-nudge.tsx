import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeIndianMobile, useConsentStatus, useSaveConsentMutation } from "@/lib/consent/api";

const ONBOARDING_STORAGE_KEY = "trader-os.onboarding.wizard.v1";

/**
 * On-brand consent nudge. Shows once (per user, backed by Supabase) after
 * onboarding is complete, then never again — whether they accept or decline.
 */
export function ConsentNudge() {
  const { data: consent, isLoading } = useConsentStatus();
  const save = useSaveConsentMutation();

  const [open, setOpen] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Only after onboarding is dismissed AND the consent row is absent.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoading || consent) return;
    const onboardingSeen = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!onboardingSeen) return; // onboarding wizard still first-run
    const t = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(t);
  }, [isLoading, consent]);

  const handleAccept = async () => {
    let normalizedPhone: string | null = null;
    if (smsOptIn) {
      normalizedPhone = normalizeIndianMobile(phone);
      if (!normalizedPhone) {
        setPhoneError("Enter a valid Indian mobile (10 digits, or with +91).");
        return;
      }
    }
    try {
      await save.mutateAsync({
        decision: "accepted",
        email_opt_in: true,
        sms_opt_in: smsOptIn,
        phone_number: normalizedPhone,
      });
      toast.success("Preferences saved");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save preferences");
    }
  };

  const handleDecline = async () => {
    try {
      await save.mutateAsync({
        decision: "declined",
        email_opt_in: false,
        sms_opt_in: false,
        phone_number: null,
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save preferences");
    }
  };

  // Never render if we already have a decision — belt & braces.
  if (consent) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && setOpen(o)}>
      <DialogContent className="sm:max-w-md">
        <div className="space-y-2">
          <DialogTitle className="text-lg font-medium tracking-tight">Stay in the loop</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Get product updates, new features, and the occasional newsletter — by email. No spam, no
            tips, unsubscribe anytime.
          </DialogDescription>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={smsOptIn}
              onCheckedChange={(v) => {
                const next = v === true;
                setSmsOptIn(next);
                if (!next) {
                  setPhone("");
                  setPhoneError(null);
                }
              }}
            />
            <span>Also text me updates (SMS)</span>
          </label>

          {smsOptIn && (
            <div className="space-y-1.5">
              <Label htmlFor="consent-phone" className="text-xs text-muted-foreground">
                Mobile number
              </Label>
              <Input
                id="consent-phone"
                type="tel"
                inputMode="tel"
                placeholder="10-digit mobile or +91XXXXXXXXXX"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
              />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <Button className="w-full" onClick={handleAccept} disabled={save.isPending}>
            Yes, keep me posted
          </Button>
          <button
            type="button"
            onClick={handleDecline}
            disabled={save.isPending}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 disabled:opacity-50"
          >
            No thanks
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
