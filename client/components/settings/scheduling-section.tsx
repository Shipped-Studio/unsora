"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageSection } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useUserUsage } from "@/hooks/use-user-usage";
import { TimezoneCombobox } from "@/components/scheduler/timezone-combobox";
import { getBrowserTimezone as browserTimeZone } from "@/lib/timezone";
import { useUpdatePreferences } from "@/hooks/use-schedule";

const WEEK_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
] as const;

export function SchedulingSection() {
  const { usage, loading, error, refetch } = useUserUsage();
  const updatePreferences = useUpdatePreferences();
  const detectedZone = useMemo(() => browserTimeZone(), []);

  // null = untouched, so the form follows the saved values until edited.
  const [timezone, setTimezone] = useState<string | null>(null);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1 | null>(null);

  const title = "Scheduling";
  const description = "The time zone and calendar layout used when you plan posts.";

  if (!usage) {
    return (
      <PageSection title={title} description={description}>
        {error && !loading ? (
          <ErrorState
            title="Couldn't load your preferences"
            description={error}
            onRetry={() => void refetch()}
          />
        ) : (
          <Skeleton className="h-52 rounded-xl" />
        )}
      </PageSection>
    );
  }

  const savedZone = usage.preferences?.timezone ?? null;
  const savedWeek: 0 | 1 = usage.preferences?.weekStartsOn === 1 ? 1 : 0;
  const zone = timezone ?? savedZone ?? detectedZone;
  const week = weekStartsOn ?? savedWeek;
  const dirty = zone !== savedZone || week !== savedWeek;

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    updatePreferences.mutate(
      { timezone: zone, weekStartsOn: week },
      {
        onSuccess: () => {
          setTimezone(null);
          setWeekStartsOn(null);
          toast.success("Preferences saved");
        },
        onError: (err) =>
          toast.error("Couldn't save your preferences", {
            description: err.message,
          }),
      },
    );
  };

  return (
    <PageSection title={title} description={description}>
      <Card size="sm">
        <CardContent>
          <form onSubmit={save}>
            <FieldGroup className="gap-5">
              <Field>
                <FieldLabel>Time zone</FieldLabel>
                <TimezoneCombobox value={zone} onChange={setTimezone} className="w-full" />
                <FieldDescription>
                  {savedZone
                    ? "Used for the calendar and for scheduled post times."
                    : "Detected from your browser. Save to use it for scheduling."}
                </FieldDescription>
              </Field>

              <FieldSet>
                <FieldLegend variant="label">Week starts on</FieldLegend>
                <RadioGroup
                  value={String(week)}
                  onValueChange={(value) =>
                    setWeekStartsOn(value === "1" ? 1 : 0)
                  }
                  className="flex gap-6"
                >
                  {WEEK_DAYS.map((day) => (
                    <Field
                      key={day.value}
                      orientation="horizontal"
                      className="w-auto"
                    >
                      <RadioGroupItem
                        value={String(day.value)}
                        id={`week-${day.value}`}
                      />
                      <FieldLabel htmlFor={`week-${day.value}`} className="font-normal">
                        {day.label}
                      </FieldLabel>
                    </Field>
                  ))}
                </RadioGroup>
              </FieldSet>

              <div>
                <Button
                  type="submit"
                  disabled={!dirty || updatePreferences.isPending}
                >
                  {updatePreferences.isPending ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Save
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </PageSection>
  );
}
