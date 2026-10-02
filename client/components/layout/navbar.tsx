"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Bell } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { usePricing } from "@/contexts/pricing-context";

interface NavbarProps {
  title: string;
  subtitle?: string;
  icon?: ComponentType<IconProps>;
}

export function Navbar({ title, subtitle, icon: Icon }: NavbarProps) {
  const router = useRouter();
  const { openPricing } = usePricing();

  return (
    <header className="sticky top-0 h-16 z-40 flex items-center justify-between border-b bg-card backdrop-blur-sm px-5 py-2.5">
      <div className="flex items-center gap-2.5">
        {/* <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-[18px]" />
        </Button> */}

        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon className="size-5" weight="fill" />
            </div>
          )}
          <div>
            <h1 className="font-semibold leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* <div className="flex items-center gap-2">
        <Button onClick={openPricing}>Upgrade</Button>
      </div> */}
    </header>
  );
}
