import type * as MuPDF from "mupdf";
import type { FileInfo, FilePlan, PageInfo } from "@/lib/types";

const PDF_EXTENSION = /\.pdf$/i;
const PAGE_RANGE_PATTERN = /^(\d+)\s*-\s*(\d+)$/;

function copyBuffer(src: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(src.byteLength);
  copy.set(src);
  return copy;
}

export function parsePageNumbers(input: string, pageCount: number): number[] {
  const result = new Set<number>();
  for (const part of input.split(",")) {
    const trimmed = part.trim();
    const range = trimmed.match(PAGE_RANGE_PATTERN);
    if (range) {
      const from = Number.parseInt(range[1], 10);
      const to = Number.parseInt(range[2], 10);
      for (let i = from; i <= to; i++) {
        if (i >= 1 && i <= pageCount) {
          result.add(i);
        }
      }
    } else {
      const n = Number.parseInt(trimmed, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= pageCount) {
        result.add(n);
      }
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

export async function getFilesInfo(files: File[]): Promise<FileInfo[]> {
  const mupdf = await import("mupdf");
  return Promise.all(
    files.map(async (file) => {
      const data = new Uint8Array(await file.arrayBuffer());
      const doc = mupdf.Document.openDocument(data, "application/pdf");
      const pageCount = doc.countPages();
      const pages: PageInfo[] = Array.from({ length: pageCount }, (_, i) => {
        const page = doc.loadPage(i);
        return {
          pageNumber: i + 1,
          text: page.toStructuredText().asText().slice(0, 800),
        };
      });
      return { name: file.name, pageCount, pages };
    })
  );
}

export async function mergePDFs(
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
      output.insertPage(-1, graftMap.graftObject(src.findPage(pageIndex)));
    }
  }

  return copyBuffer(output.saveToBuffer("compress").asUint8Array());
}

export async function splitPDF(
  file: File
): Promise<Array<{ name: string; data: Uint8Array<ArrayBuffer> }>> {
  const mupdf = await import("mupdf");
  const data = new Uint8Array(await file.arrayBuffer());
  const src = mupdf.Document.openDocument(
    data,
    "application/pdf"
  ) as MuPDF.PDFDocument;
  const pageCount = src.countPages();
  const baseName = file.name.replace(PDF_EXTENSION, "");

  return Array.from({ length: pageCount }, (_, i) => {
    const output = new mupdf.PDFDocument();
    const graftMap = output.newGraftMap();
    output.insertPage(-1, graftMap.graftObject(src.findPage(i)));
    return {
      name: `${baseName}_page${i + 1}.pdf`,
      data: copyBuffer(output.saveToBuffer("compress").asUint8Array()),
    };
  });
}

export async function rotatePages(
  file: File,
  degrees: 90 | 180 | 270,
  pageNumbers?: number[]
): Promise<Uint8Array<ArrayBuffer>> {
  const mupdf = await import("mupdf");
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = mupdf.Document.openDocument(
    data,
    "application/pdf"
  ) as MuPDF.PDFDocument;
  const pageCount = doc.countPages();
  const targets =
    pageNumbers ?? Array.from({ length: pageCount }, (_, i) => i + 1);

  for (const pageNumber of targets) {
    const i = pageNumber - 1;
    if (i < 0 || i >= pageCount) {
      continue;
    }
    const page = doc.loadPage(i) as MuPDF.PDFPage;
    page.getObject().put("Rotate", doc.newInteger(degrees));
  }

  return copyBuffer(doc.saveToBuffer("compress").asUint8Array());
}

export async function keepPages(
  file: File,
  pageNumbers: number[]
): Promise<Uint8Array<ArrayBuffer>> {
  const mupdf = await import("mupdf");
  const data = new Uint8Array(await file.arrayBuffer());
  const src = mupdf.Document.openDocument(
    data,
    "application/pdf"
  ) as MuPDF.PDFDocument;
  const pageCount = src.countPages();
  const output = new mupdf.PDFDocument();
  const graftMap = output.newGraftMap();

  for (const pageNumber of pageNumbers) {
    const i = pageNumber - 1;
    if (i >= 0 && i < pageCount) {
      output.insertPage(-1, graftMap.graftObject(src.findPage(i)));
    }
  }

  return copyBuffer(output.saveToBuffer("compress").asUint8Array());
}

export async function pdfToImages(
  file: File,
  scale = 2
): Promise<Array<{ name: string; data: Uint8Array<ArrayBuffer> }>> {
  const mupdf = await import("mupdf");
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = mupdf.Document.openDocument(data, "application/pdf");
  const pageCount = doc.countPages();
  const matrix = mupdf.Matrix.scale(scale, scale);
  const baseName = file.name.replace(PDF_EXTENSION, "");

  return Array.from({ length: pageCount }, (_, i) => {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false);
    const png = pixmap.asPNG();
    const copy = new Uint8Array(png.byteLength);
    copy.set(png);
    return {
      name: `${baseName}_page${i + 1}.png`,
      data: copy as Uint8Array<ArrayBuffer>,
    };
  });
}
