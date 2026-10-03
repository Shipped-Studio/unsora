"use client";

import { useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { PageSection } from "@/components/layout/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { clerkErrorMessage } from "@/lib/clerk-errors";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Visible compact header so the description has a title to sit under.
const SECTION_TITLE = "Profile";
const SECTION_DESCRIPTION = "Your name and photo across Unsora.";

export function ProfileSection() {
  const { user, isLoaded } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoAction, setPhotoAction] = useState<"upload" | "remove" | null>(
    null,
  );
  // null = untouched, so the fields follow the Clerk user until edited.
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  if (!isLoaded || !user) {
    return (
      <PageSection title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
        <Card size="sm">
          <CardContent className="gap-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
          </CardContent>
        </Card>
      </PageSection>
    );
  }

  const first = firstName ?? user.firstName ?? "";
  const last = lastName ?? user.lastName ?? "";
  const nameDirty =
    first.trim() !== (user.firstName ?? "") ||
    last.trim() !== (user.lastName ?? "");

  const email = user.primaryEmailAddress;
  const emailVerified = email?.verification?.status === "verified";
  const initials =
    ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
    email?.emailAddress[0]?.toUpperCase() ||
    "U";

  const setPhoto = async (file: File | null) => {
    setPhotoAction(file ? "upload" : "remove");
    try {
      await user.setProfileImage({ file });
      await user.reload();
      toast.success(file ? "Photo updated" : "Photo removed");
    } catch (error) {
      toast.error(
        file ? "Couldn't update your photo" : "Couldn't remove your photo",
        { description: clerkErrorMessage(error) },
      );
    } finally {
      setPhotoAction(null);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Couldn't use that file", {
        description: "Pick a JPG, PNG, GIF or WebP image.",
      });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("That image is too large", {
        description: "Pick an image under 10 MB.",
      });
      return;
    }
    void setPhoto(file);
  };

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingName(true);
    try {
      await user.update({ firstName: first.trim(), lastName: last.trim() });
      setFirstName(null);
      setLastName(null);
      toast.success("Name updated");
    } catch (error) {
      toast.error("Couldn't update your name", {
        description: clerkErrorMessage(error),
      });
    } finally {
      setSavingName(false);
    }
  };

  return (
    <PageSection title={SECTION_TITLE} description={SECTION_DESCRIPTION}>
      <Card size="sm">
        <CardContent className="gap-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-16">
              <AvatarImage src={user.imageUrl} alt="" />
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={photoAction !== null}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoAction === "upload" ? (
                    <Spinner data-icon="inline-start" />
                  ) : null}
                  Change photo
                </Button>
                {user.hasImage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={photoAction !== null}
                    onClick={() => void setPhoto(null)}
                  >
                    {photoAction === "remove" ? (
                      <Spinner data-icon="inline-start" />
                    ) : null}
                    Remove photo
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, GIF or WebP, up to 10 MB.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(event) => {
                handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>

          <Separator />

          <form onSubmit={saveName}>
            <FieldGroup className="gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="first-name">First name</FieldLabel>
                  <Input
                    id="first-name"
                    autoComplete="given-name"
                    value={first}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                  <Input
                    id="last-name"
                    autoComplete="family-name"
                    value={last}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldTitle>Email</FieldTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">
                    {email?.emailAddress ?? "No email address"}
                  </span>
                  {email ? (
                    <Badge variant={emailVerified ? "secondary" : "outline"}>
                      {emailVerified ? "Verified" : "Not verified"}
                    </Badge>
                  ) : null}
                </div>
                <FieldDescription>
                  Used to sign in and for account emails.
                </FieldDescription>
              </Field>

              <div>
                <Button type="submit" disabled={!nameDirty || savingName}>
                  {savingName ? <Spinner data-icon="inline-start" /> : null}
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
