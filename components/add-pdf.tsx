import { FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Item } from "@/components/ui/item";
import { Label } from "@/components/ui/label";

export function AddPDF() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Label
          className="text-center font-normal text-muted-foreground text-xs uppercase tracking-wider"
          htmlFor="add-pdf"
        >
          Drag or click to start
        </Label>
        <Item className="aspect-square" variant="outline">
          <label
            className="flex size-full cursor-pointer items-center justify-center"
            htmlFor="add-pdf"
          >
            <FileIcon className="size-10 text-muted-foreground/50" />
          </label>
        </Item>
        <input
          accept="application/pdf"
          className="sr-only"
          id="add-pdf"
          type="file"
        />
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button asChild className="w-full" variant="secondary">
          <label className="cursor-pointer" htmlFor="add-pdf">
            Add PDFs
          </label>
        </Button>
      </CardFooter>
    </Card>
  );
}
