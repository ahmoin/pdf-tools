"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { MobileNav } from "@/components/mobile-nav";
import { ModeSwitcher } from "@/components/mode-switcher";
import { Button } from "@/components/ui/button";
import { useScroll } from "@/hooks/use-scroll";
import { siteConfig } from "@/lib/config";
import { cn } from "@/lib/utils";

export function Header() {
  const scrolled = useScroll(10);

  return (
    <header
      className={cn("sticky top-0 z-50 w-full border-transparent border-b", {
        "border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50":
          scrolled,
      })}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link
          className="rounded-md p-2 hover:bg-muted dark:hover:bg-muted/50"
          href={siteConfig.url}
        >
          <Icons.logoFull className="h-4" />
        </Link>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild size="icon" variant="outline">
            <Link
              href={siteConfig.links.twitter}
              rel="noreferrer"
              target="_blank"
            >
              <Icons.twitter />
            </Link>
          </Button>
          <Button asChild size="icon" variant="outline">
            <Link
              href={siteConfig.links.gitHub}
              rel="noreferrer"
              target="_blank"
            >
              <Icons.gitHub />
            </Link>
          </Button>
          <ModeSwitcher className="ml-2" variant="outline" />
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
