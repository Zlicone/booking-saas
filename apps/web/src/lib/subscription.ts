import type { Business } from "@/types";

// Ima li biznis pristup adminu?
// Demo račun uvijek; aktivna pretplata uvijek; trial dok ne istekne.
export function hasAccess(b: Business): boolean {
  if (b.is_demo) return true;
  if (b.subscription_status === "active") return true;
  if (
    b.subscription_status === "trial" &&
    b.trial_ends_at &&
    new Date(b.trial_ends_at) > new Date()
  ) {
    return true;
  }
  return false;
}

// Koliko dana triala ostaje (0 ako je isteklo / nije trial).
export function trialDaysLeft(b: Business): number {
  if (b.subscription_status !== "trial" || !b.trial_ends_at) return 0;
  const ms = new Date(b.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
