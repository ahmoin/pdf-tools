import { MergePDF } from "@/components/merge-pdf";

export default function Page() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex min-w-0 max-w-md flex-col gap-4 text-sm leading-loose">
        <MergePDF />
      </div>
    </div>
  );
}
