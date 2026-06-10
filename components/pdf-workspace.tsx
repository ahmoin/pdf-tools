"use client";

import { Download } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MergePDF } from "@/components/merge-pdf";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";

export function PDFWorkspace() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const prevUrlRef = useRef<string | null>(null);

  const onMerged = useCallback((url: string) => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
    }
    prevUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  const onDownload = useCallback(() => {
    if (!previewUrl) {
      return;
    }
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = "merged.pdf";
    a.click();
  }, [previewUrl]);

  return (
    <div className="flex h-svh p-4">
      <ResizablePanelGroup
        className="rounded-lg border"
        orientation={isMobile ? "vertical" : "horizontal"}
      >
        <ResizablePanel defaultSize={isMobile ? 50 : 40} minSize={25}>
          <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
            <MergePDF onMerged={onMerged} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={60} minSize={25}>
          {previewUrl ? (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-end border-b px-4 py-2">
                <Button
                  className="gap-2"
                  onClick={onDownload}
                  size="sm"
                  variant="outline"
                >
                  <Download className="size-4" />
                  Download
                </Button>
              </div>
              <iframe
                className="h-full w-full"
                src={previewUrl}
                title="Merged PDF preview"
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Merge PDFs to see a preview here
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
