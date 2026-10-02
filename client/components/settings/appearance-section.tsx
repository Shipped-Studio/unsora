"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { PageSection } from "@/components/layout/page-header";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

/** Scoping the theme class re-resolves every token to that theme's values. */
function WindowPreview({ mode }: { mode: "light" | "dark" }) {
  return (
    <div className={`${mode} flex h-full w-full gap-1.5 bg-background p-2`}>
      <div className="w-1/4 rounded-sm bg-secondary" />
      <div className="flex flex-1 flex-col gap-1.5 rounded-sm border bg-card p-1.5">
        <div className="h-1.5 w-3/5 rounded-full bg-muted-foreground/40" />
        <div className="h-1.5 w-2/5 rounded-full bg-muted-foreground/40" />
        <div className="mt-auto h-2.5 w-1/3 rounded-sm bg-primary" />
      </div>
    </div>
  );
}

function ThemePreview({ value }: { value: (typeof OPTIONS)[number]["value"] }) {
  return (
    <div className="flex h-20 w-full overflow-hidden rounded-md border" aria-hidden>
      {value === "system" ? (
        <>
          <div className="w-1/2 overflow-hidden">
            <WindowPreview mode="light" />
          </div>
          <div className="w-1/2 overflow-hidden">
            <WindowPreview mode="dark" />
          </div>
        </>
      ) : (
        <WindowPreview mode={value} />
      )}
    </div>
  );
}

const noop = () => () => {};

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  // The theme is only known in the browser; render no selection on the server.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  return (
    <PageSection
      title="Appearance"
      description="System follows your device setting."
    >
      <RadioGroup
        value={mounted ? (theme ?? "system") : null}
        onValueChange={(value) => setTheme(String(value))}
        className="grid grid-cols-3 gap-3"
      >
        {OPTIONS.map((option) => (
          <FieldLabel key={option.value} htmlFor={`theme-${option.value}`}>
            <Field className="gap-3">
              <ThemePreview value={option.value} />
              <div className="flex items-center gap-2">
                <RadioGroupItem value={option.value} id={`theme-${option.value}`} />
                <span className="text-sm font-medium">{option.label}</span>
              </div>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </PageSection>
  );
}
