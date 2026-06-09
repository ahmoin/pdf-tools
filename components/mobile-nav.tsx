import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { ModeSwitcher } from "@/components/mode-switcher";
import { Portal, PortalBackdrop } from "@/components/portal";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="md:hidden">
      <Button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label="Toggle menu"
        className="md:hidden"
        onClick={() => setOpen(!open)}
        size="icon"
        variant="outline"
      >
        {open ? (
          <XIcon className="size-4.5" />
        ) : (
          <MenuIcon className="size-4.5" />
        )}
      </Button>
      {open && (
        <Portal className="top-14" id="mobile-menu">
          <PortalBackdrop />
          <div
            className={cn(
              "data-[slot=open]:zoom-in-97 ease-out data-[slot=open]:animate-in",
              "size-full p-4"
            )}
            data-slot={open ? "open" : "closed"}
          >
            <div className="grid gap-y-2">
              <Button asChild className="justify-start" variant="ghost">
                <Link
                  href={siteConfig.links.gitHub}
                  rel="noreferrer"
                  target="_blank"
                >
                  GitHub
                </Link>
              </Button>
              <Button asChild className="justify-start" variant="ghost">
                <Link
                  href={siteConfig.links.twitter}
                  rel="noreferrer"
                  target="_blank"
                >
                  Twitter
                </Link>
              </Button>
            </div>
            <div className="mt-12 flex flex-col gap-2">
              <ModeSwitcher variant="outline" />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
