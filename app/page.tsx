import { AddPDF } from "@/components/add-pdf";

export default function Page() {
  return (
    <div className="flex min-h-svh p-6">
      <div className="flex min-w-0 max-w-md flex-col gap-4 text-sm leading-loose">
        <AddPDF />
      </div>
    </div>
  );
}
