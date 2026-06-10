"use client";

import { Upload, X } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";

interface AddPDFProps {
  onValueChange: (files: File[]) => void;
  value: File[];
}

export function AddPDF({ value, onValueChange }: AddPDFProps) {
  const onFileValidate = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Only PDF files are allowed";
    }
    return null;
  }, []);

  const onFileReject = useCallback((file: File, message: string) => {
    toast.error(message, {
      description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
    });
  }, []);

  return (
    <FileUpload
      accept="application/pdf"
      className="w-full max-w-md"
      multiple
      onFileReject={onFileReject}
      onFileValidate={onFileValidate}
      onValueChange={onValueChange}
      value={value}
    >
      <FileUploadDropzone>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center rounded-full border p-2.5">
            <Upload className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-sm">Drag & drop files here</p>
          <p className="text-muted-foreground text-xs">Or click to browse</p>
        </div>
        <FileUploadTrigger asChild>
          <Button className="mt-2 w-fit" size="sm" variant="outline">
            Browse files
          </Button>
        </FileUploadTrigger>
      </FileUploadDropzone>
      <FileUploadList>
        {value.map((file) => (
          <FileUploadItem key={file.name} value={file}>
            <FileUploadItemPreview />
            <FileUploadItemMetadata />
            <FileUploadItemDelete asChild>
              <Button className="size-7" size="icon" variant="ghost">
                <X />
              </Button>
            </FileUploadItemDelete>
          </FileUploadItem>
        ))}
      </FileUploadList>
    </FileUpload>
  );
}
