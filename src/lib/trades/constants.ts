export const ASSET_TYPES = [
  { value: "equity", label: "Equity" },
  { value: "futures", label: "Futures" },
  { value: "options", label: "Options" },
] as const;

export const DIRECTIONS = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
] as const;

export const PREDEFINED_TAGS = [
  "Breakout",
  "Pullback",
  "Momentum",
  "Reversal",
  "Range Break",
  "Gap Up",
  "Gap Down",
  "Trend Following",
  "Mean Reversion",
  "Option Scalping",
  "Swing Trade",
  "News Based",
] as const;

export const DISCIPLINE_RULES = [
  { key: "Followed plan", positive: true },
  { key: "Respected stop loss", positive: true },
  { key: "Overtraded", positive: false },
  { key: "Emotional trade", positive: false },
  { key: "Proper position sizing", positive: true },
] as const;

export const EMOTIONAL_QUESTIONS = [
  { key: "confidence", label: "How confident were you?" },
  { key: "emotion_level", label: "How emotional did you feel?" },
  { key: "recovery_urge", label: "How strong was your urge to recover losses?" },
  { key: "discipline_feel", label: "How disciplined did you feel?" },
  { key: "setup_match", label: "How closely did this trade match your setup?" },
] as const;

export const SCREENSHOT_BUCKET = "trade-screenshots";
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
