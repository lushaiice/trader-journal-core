import { useEffect, useState } from "react";
import { getScreenshotSignedUrl } from "@/lib/trades/api";

/** Resolve a stored screenshot reference (path or legacy URL) to a short-lived signed URL. */
export function useScreenshotUrl(stored: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!stored) {
      setUrl(null);
      return;
    }
    void getScreenshotSignedUrl(stored).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => {
      cancelled = true;
    };
  }, [stored]);
  return url;
}
