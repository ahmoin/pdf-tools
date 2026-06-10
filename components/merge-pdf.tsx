"use client";

import { Download, Loader2 } from "lucide-react";
import type * as MuPDF from "mupdf";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AddPDF } from "@/components/add-pdf";
import { Button } from "@/components/ui/button";

async function mergePDFs(files: File[]): Promise<Uint8Array<ArrayBuffer>> {
  const mupdf = await import("mupdf");
  const output = new mupdf.PDFDocument();

  for (const file of files) {
    const data = new Uint8Array(await file.arrayBuffer());
    const src = mupdf.Document.openDocument(
      data,
      "application/pdf"
    ) as MuPDF.PDFDocument;
    const graftMap = output.newGraftMap();
    const pageCount = src.countPages();

    for (let i = 0; i < pageCount; i++) {
      const page = src.findPage(i);
      output.insertPage(-1, graftMap.graftObject(page));
    }
  }

  const buf = output.saveToBuffer("compress");
  const src = buf.asUint8Array();
  const copy = new Uint8Array(src.byteLength);
  copy.set(src);
  return copy;
}

export function MergePDF() {
  const [files, setFiles] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);

  const onMerge = useCallback(async () => {
    setMerging(true);
    try {
      const merged = await mergePDFs(files);
      const blob = new Blob([merged], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDFs merged successfully");
    } catch (err) {
      toast.error("Failed to merge PDFs", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setMerging(false);
    }
  }, [files]);

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <AddPDF onValueChange={setFiles} value={files} />
      {files.length >= 2 && (
        <Button className="w-full gap-2" disabled={merging} onClick={onMerge}>
          {merging ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {merging ? "Merging…" : `Merge ${files.length} PDFs`}
        </Button>
      )}
    </div>
  );
}
