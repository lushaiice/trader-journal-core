import { useRef, useState, type DragEvent } from "react";
import { useFormContext } from "react-hook-form";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { uploadScreenshot, removeScreenshot } from "@/lib/trades/api";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/trades/constants";
import type { TradeFormValues } from "@/lib/trades/schema";

export function ScreenshotField() {
  const { setValue, watch } = useFormContext<TradeFormValues>();
  const url = watch("screenshot_url") as string | null | undefined;
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Use JPG, PNG, or WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max file size is 5MB");
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await uploadScreenshot(file, user.id);
      setValue("screenshot_url", publicUrl, { shouldDirty: true });
      toast.success("Screenshot uploaded");
    } catch (err) {
      toast.error("Upload failed", { description: (err as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const clear = async () => {
    if (url) await removeScreenshot(url).catch(() => null);
    setValue("screenshot_url", null, { shouldDirty: true });
  };

  if (url) {
    return (
      <div className="relative rounded-lg overflow-hidden border border-border group">
        <img src={url} alt="Trade screenshot" className="w-full max-h-80 object-contain bg-black/40" />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={clear}
          className="absolute top-2 right-2"
        >
          <X className="h-3.5 w-3.5 mr-1" /> Remove
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 cursor-pointer transition-colors ${
        drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/20"
      }`}
    >
      {uploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <ImagePlus className="h-5 w-5 text-muted-foreground" />
      )}
      <p className="text-sm text-muted-foreground">
        {uploading ? "Uploading…" : "Drop chart screenshot or click to upload"}
      </p>
      <p className="text-[11px] text-muted-foreground">JPG · PNG · WebP · up to 5MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
