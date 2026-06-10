"use client";

import { Download, Loader2 } from "lucide-react";
import type * as MuPDF from "mupdf";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AddPDF } from "@/components/add-pdf";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FileInfo, FilePlan, PageInfo } from "@/lib/types";

async function mergePDFs(
  files: File[],
  plan?: FilePlan[]
): Promise<Uint8Array<ArrayBuffer>> {
  const mupdf = await import("mupdf");
  const output = new mupdf.PDFDocument();

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    const data = new Uint8Array(await file.arrayBuffer());
    const src = mupdf.Document.openDocument(
      data,
      "application/pdf"
    ) as MuPDF.PDFDocument;
    const graftMap = output.newGraftMap();
    const pageCount = src.countPages();

    const filePlan = plan?.find((p) => p.index === fileIndex);
    const pageIndices = filePlan
      ? filePlan.pages.map((p) => p - 1).filter((i) => i >= 0 && i < pageCount)
      : Array.from({ length: pageCount }, (_, i) => i);

    for (const pageIndex of pageIndices) {
      const page = src.findPage(pageIndex);
      output.insertPage(-1, graftMap.graftObject(page));
    }
  }

  const buf = output.saveToBuffer("compress");
  const rawBytes = buf.asUint8Array();
  const copy = new Uint8Array(rawBytes.byteLength);
  copy.set(rawBytes);
  return copy;
}

async function getFilesInfo(files: File[]): Promise<FileInfo[]> {
  const mupdf = await import("mupdf");
  return Promise.all(
    files.map(async (file) => {
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = mupdf.Document.openDocument(data, "application/pdf");
      const pageCount = doc.countPages();
      const pages: PageInfo[] = Array.from({ length: pageCount }, (_, i) => {
        const page = doc.loadPage(i);
        const text = page.toStructuredText().asText().slice(0, 800);
        return { pageNumber: i + 1, text };
      });
      return { name: file.name, pageCount, pages };
    })
  );
}

interface MergePDFProps {
  onMerged: (url: string) => void;
}

export function MergePDF({ onMerged }: MergePDFProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);
  const [instruction, setInstruction] = useState("");

  const onMerge = useCallback(async () => {
    setMerging(true);
    try {
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

      const merged = await mergePDFs(files, plan);
      const blob = new Blob([merged], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      onMerged(url);
      toast.success("PDFs merged successfully");
    } catch (err) {
      toast.error("Failed to merge PDFs", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setMerging(false);
    }
  }, [files, instruction, onMerged]);

  return (
    <div className="flex w-full flex-col gap-4">
      <AddPDF onValueChange={setFiles} value={files} />
      {files.length >= 2 && (
        <>
          <Textarea
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional: describe what you want, e.g. only include page 1 from each PDF"
            value={instruction}
          />
          <Button className="w-full gap-2" disabled={merging} onClick={onMerge}>
            {merging ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {merging ? "Merging…" : `Merge ${files.length} PDFs`}
          </Button>
        </>
      )}
    </div>
  );
}
