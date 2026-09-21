"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Braces,
  Check,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { FILE_KIND_META, type AiFile, type AiFileKind } from "./ai-data";

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function FileGlyph({ kind, className }: { kind: AiFileKind; className?: string }) {
  switch (kind) {
    case "log":
      return <FileText className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "code":
      return <Braces className={className} />;
    default:
      return <File className={className} />;
  }
}

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "text/plain", ".log", ".txt", ".ts", ".tsx", ".js", ".jsx", ".json", ".yml", ".yaml"];

function kindOfFile(name: string, type: string): AiFileKind {
  if (type.startsWith("image/")) return "image";
  if (/\.(log|txt)$/i.test(name)) return "log";
  if (/\.(ts|tsx|js|jsx|json|yml|yaml)$/i.test(name)) return "code";
  return "text";
}

export function FileUploadZone({
  files,
  onAdd,
  disabled,
}: {
  files: AiFile[];
  onAdd: (files: AiFile[]) => void;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | File[]) => {
    const next: AiFile[] = Array.from(list)
      .filter((f) => ACCEPTED.some((a) => (a.startsWith(".") ? f.name.endsWith(a) : f.type === a)))
      .map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        kind: kindOfFile(f.name, f.type),
        url: kindOfFile(f.name, f.type) === "image" && f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
        progress: 0,
        status: "uploading" as const,
      }));
    if (next.length) onAdd(next);
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative w-full rounded-2xl border-2 border-dashed px-5 py-7 text-center transition-all duration-200",
          dragOver
            ? "border-primary/70 bg-primary/5"
            : "border-border/70 bg-muted/10 hover:border-primary/40 hover:bg-muted/20",
          disabled && "opacity-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ACCEPTED.join(",")}
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <span
          className={cn(
            "mx-auto grid size-11 place-items-center rounded-xl border transition-colors",
            dragOver ? "border-primary/50 bg-primary/10 text-primary" : "border-border/70 bg-card text-muted-foreground group-hover:text-primary"
          )}
        >
          <UploadCloud className="size-5" />
        </span>
        <p className="mt-2.5 text-sm font-medium text-foreground">
          {dragOver ? "Drop files to add them" : "Drag & drop files, or click to browse"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Logs · screenshots · traces · configs — PNG, JPG, TXT, LOG, TS/JS, JSON up to 5 MB
        </p>
      </button>

      <UploadedFileList files={files} onRemove={(id) => onAdd(files.filter((f) => f.id !== id))} />
    </div>
  );
}

export function UploadedFileList({ files, onRemove }: { files: AiFile[]; onRemove: (id: string) => void }) {
  return (
    <AnimatePresence initial={false}>
      <div className="grid gap-1.5">
        {files.map((file) => {
          const meta = FILE_KIND_META[file.kind];
          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-2">
                {file.kind === "image" && file.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.url} alt="" className="size-8 shrink-0 rounded-md border border-border/60 object-cover" />
                ) : (
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-md border border-border/60 bg-muted/30", meta.tone)}>
                    <FileGlyph kind={file.kind} className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{file.name}</p>
                    <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[9px] text-muted-foreground">
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{sizeLabel(file.size)}</p>
                </div>
                {file.status === "uploading" ? (
                  <span className="flex items-center gap-2 text-[10px] text-primary">
                    <Loader2 className="size-3 animate-spin" />
                    {file.progress}%
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-success">
                    <Check className="size-3" /> Ready
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Remove ${file.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {file.status === "uploading" && (
                <div className="mx-1 mt-1 h-0.5 overflow-hidden rounded-full bg-border">
                  <motion.div
                    className="h-full bg-linear-to-r from-violet-500 to-cyan-400"
                    initial={{ width: "4%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.4, ease: "easeInOut" }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </AnimatePresence>
  );
}