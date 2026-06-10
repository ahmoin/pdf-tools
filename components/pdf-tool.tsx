"use client";

import {
  ArrowLeft,
  Copy,
  FileMinus2,
  Image,
  Layers,
  Loader2,
  RotateCw,
  Scissors,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AddPDF } from "@/components/add-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Textarea } from "@/components/ui/textarea";
import {
  getFilesInfo,
  keepPages,
  mergePDFs,
  parsePageNumbers,
  pdfToImages,
  rotatePages,
  splitPDF,
} from "@/lib/pdf-operations";
import type { FilePlan } from "@/lib/types";

type ToolId =
  | "merge"
  | "split"
  | "rotate"
  | "remove-pages"
  | "extract-pages"
  | "pdf-to-images";

const TOOLS: Array<{
  id: ToolId;
  label: string;
  description: string;
  icon: React.ElementType;
  multiple: boolean;
}> = [
  {
    id: "merge",
    label: "Merge PDFs",
    description: "Combine multiple PDFs into one",
    icon: Layers,
    multiple: true,
  },
  {
    id: "split",
    label: "Split PDF",
    description: "Split into individual pages",
    icon: Scissors,
    multiple: false,
  },
  {
    id: "rotate",
    label: "Rotate Pages",
    description: "Rotate all or specific pages",
    icon: RotateCw,
    multiple: false,
  },
  {
    id: "remove-pages",
    label: "Remove Pages",
    description: "Delete specific pages",
    icon: FileMinus2,
    multiple: false,
  },
  {
    id: "extract-pages",
    label: "Extract Pages",
    description: "Save specific pages as a new PDF",
    icon: Copy,
    multiple: false,
  },
  {
    id: "pdf-to-images",
    label: "PDF to Images",
    description: "Export each page as a PNG",
    icon: Image,
    multiple: false,
  },
];

const BUTTON_LABELS: Record<ToolId, (n: number) => string> = {
  merge: (n) => `Merge ${n} PDFs`,
  split: () => "Split PDF",
  rotate: () => "Rotate Pages",
  "remove-pages": () => "Remove Pages",
  "extract-pages": () => "Extract Pages",
  "pdf-to-images": () => "Convert to Images",
};

const PDF_EXTENSION = /\.pdf$/i;

async function downloadZip(
  parts: Array<{ name: string; data: Uint8Array<ArrayBuffer> }>,
  zipName: string
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const { name, data } of parts) {
    zip.file(name, data);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}

interface PDFToolProps {
  onPreview: (url: string) => void;
}

export function PDFTool({ onPreview }: PDFToolProps) {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState("");
  const [pages, setPages] = useState("");
  const [rotateDegrees, setRotateDegrees] = useState<90 | 180 | 270>(90);
  const [processing, setProcessing] = useState(false);

  const tool = TOOLS.find((t) => t.id === activeTool);
  const file = files[0] ?? null;
  const minFiles = activeTool === "merge" ? 2 : 1;
  const ready = files.length >= minFiles;

  const selectTool = useCallback((id: ToolId) => {
    setActiveTool(id);
    setFiles([]);
    setInstruction("");
    setPages("");
    setRotateDegrees(90);
  }, []);

  const previewPDF = useCallback(
    (data: Uint8Array<ArrayBuffer>) => {
      const blob = new Blob([data], { type: "application/pdf" });
      onPreview(URL.createObjectURL(blob));
    },
    [onPreview]
  );

  const onProcess = useCallback(async () => {
    if (!(activeTool && ready)) {
      return;
    }
    setProcessing(true);
    try {
      switch (activeTool) {
        case "merge": {
          let plan: FilePlan[] | undefined;
          if (instruction.trim()) {
            const filesInfo = await getFilesInfo(files);
            const res = await fetch("/api/pdf-plan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instruction: instruction.trim(),
                files: filesInfo,
              }),
            });
            if (!res.ok) {
              throw new Error("Failed to get merge plan from AI");
            }
            const data = (await res.json()) as { files: FilePlan[] };
            plan = data.files;
          }
          previewPDF(await mergePDFs(files, plan));
          break;
        }
        case "split": {
          const parts = await splitPDF(file);
          await downloadZip(
            parts,
            `${file.name.replace(PDF_EXTENSION, "")}_split.zip`
          );
          toast.success(`Split into ${parts.length} files`);
          break;
        }

        case "rotate": {
          previewPDF(
            await rotatePages(
              file,
              rotateDegrees,
              pages.trim()
                ? parsePageNumbers(pages, Number.POSITIVE_INFINITY)
                : undefined
            )
          );
          break;
        }
        case "remove-pages": {
          const mupdf = await import("mupdf");
          const buf = new Uint8Array(await file.arrayBuffer());
          const doc = mupdf.Document.openDocument(buf, "application/pdf");
          const pageCount = doc.countPages();
          const toRemove = new Set(parsePageNumbers(pages, pageCount));
          const keep = Array.from(
            { length: pageCount },
            (_, i) => i + 1
          ).filter((p) => !toRemove.has(p));
          if (keep.length === 0) {
            throw new Error("Cannot remove all pages");
          }
          previewPDF(await keepPages(file, keep));
          break;
        }
        case "extract-pages": {
          const mupdf = await import("mupdf");
          const buf = new Uint8Array(await file.arrayBuffer());
          const doc = mupdf.Document.openDocument(buf, "application/pdf");
          const pageCount = doc.countPages();
          const keep = parsePageNumbers(pages, pageCount);
          if (keep.length === 0) {
            throw new Error("No valid pages specified");
          }
          previewPDF(await keepPages(file, keep));
          break;
        }
        case "pdf-to-images": {
          const images = await pdfToImages(file);
          await downloadZip(
            images,
            `${file.name.replace(PDF_EXTENSION, "")}_images.zip`
          );
          toast.success(`Exported ${images.length} images`);
          break;
        }
        default:
          break;
      }
      if (activeTool !== "split" && activeTool !== "pdf-to-images") {
        toast.success("Done");
      }
    } catch (err) {
      toast.error("Failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setProcessing(false);
    }
  }, [
    activeTool,
    files,
    file,
    instruction,
    pages,
    rotateDegrees,
    ready,
    previewPDF,
  ]);

  if (!activeTool) {
    return (
      <ItemGroup>
        {TOOLS.map(({ id, label, description, icon: Icon }) => (
          <Item asChild key={id} variant="outline">
            <Button
              className="h-auto w-full cursor-pointer justify-start whitespace-normal"
              onClick={() => selectTool(id)}
              variant="ghost"
            >
              <ItemMedia variant="icon">
                <Icon className="size-5 text-muted-foreground" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{label}</ItemTitle>
                <ItemDescription>{description}</ItemDescription>
              </ItemContent>
            </Button>
          </Item>
        ))}
      </ItemGroup>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <button
        className="flex w-fit items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground"
        onClick={() => setActiveTool(null)}
        type="button"
      >
        <ArrowLeft className="size-4" />
        {tool?.label}
      </button>

      <AddPDF
        multiple={tool?.multiple}
        onValueChange={setFiles}
        value={files}
      />

      {activeTool === "merge" && files.length >= 2 && (
        <Textarea
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Optional: describe what you want, e.g. only include page 1 from each PDF"
          value={instruction}
        />
      )}

      {activeTool === "rotate" && file && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {([90, 180, 270] as const).map((d) => (
              <Button
                key={d}
                onClick={() => setRotateDegrees(d)}
                size="sm"
                variant={rotateDegrees === d ? "default" : "outline"}
              >
                {d}°
              </Button>
            ))}
          </div>
          <Input
            onChange={(e) => setPages(e.target.value)}
            placeholder="Pages to rotate, e.g. 1, 3, 5-7 (leave blank for all)"
            value={pages}
          />
        </div>
      )}

      {(activeTool === "remove-pages" || activeTool === "extract-pages") &&
        file && (
          <Input
            onChange={(e) => setPages(e.target.value)}
            placeholder={
              activeTool === "remove-pages"
                ? "Pages to remove, e.g. 1, 3, 5-7"
                : "Pages to extract, e.g. 1, 3, 5-7"
            }
            value={pages}
          />
        )}

      {ready && (
        <Button
          className="w-full gap-2"
          disabled={processing}
          onClick={onProcess}
        >
          {processing ? <Loader2 className="size-4 animate-spin" /> : null}
          {processing ? "Processing…" : BUTTON_LABELS[activeTool](files.length)}
        </Button>
      )}
    </div>
  );
}
