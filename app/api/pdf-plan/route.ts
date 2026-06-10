import { generateText, Output } from "ai";
import { z } from "zod";
import type { FileInfo } from "@/lib/types";

const planSchema = z.object({
  files: z.array(
    z.object({
      index: z.number(),
      pages: z.array(z.number()),
    })
  ),
});

export async function POST(req: Request) {
  const { instruction, files } = (await req.json()) as {
    instruction: string;
    files: FileInfo[];
  };

  const fileList = files
    .map((f, i) => {
      const pages = f.pages
        .map(
          (p) => `  Page ${p.pageNumber}: ${p.text.replace(/\n+/g, " ").trim()}`
        )
        .join("\n");
      return `File ${i} — "${f.name}" (${f.pageCount} pages):\n${pages}`;
    })
    .join("\n\n");

  const { output } = await generateText({
    model: "google/gemini-2.5-flash",
    output: Output.object({ schema: planSchema }),
    system:
      "You are a PDF manipulation assistant. Given a list of PDF files with their page contents and an instruction, return which pages (1-indexed) to include from each file in the merged output. If a file is not mentioned, include all its pages.",
    prompt: `Files:\n${fileList}\n\nInstruction: ${instruction}`,
  });

  return Response.json(output);
}
