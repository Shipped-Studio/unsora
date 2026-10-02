"use client";

import { useState } from "react";
import { useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import type { Icon } from "@phosphor-icons/react";
import {
  AppleLogo,
  DiscordLogo,
  FacebookLogo,
  GithubLogo,
  GoogleLogo,
  LinkedinLogo,
  Password,
  Plugs,
  WindowsLogo,
  XLogo,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { PageSection } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { clerkErrorMessage } from "@/lib/clerk-errors";

const PROVIDER_ICONS: Record<string, Icon> = {
  google: GoogleLogo,
  github: GithubLogo,
  apple: AppleLogo,
  microsoft: WindowsLogo,
  discord: DiscordLogo,
  facebook: FacebookLogo,
  linkedin: LinkedinLogo,
  linkedin_oidc: LinkedinLogo,
  x: XLogo,
  twitter: XLogo,
};

interface PasswordParams {
  newPassword: string;
  currentPassword?: string;
  signOutOfOtherSessions?: boolean;
}

export function SignInSection() {
  const { user, isLoaded } = useUser();

  if (!isLoaded || !user) {
    return (
      <PageSection title="Sign-in">
        <Skeleton className="h-32 rounded-xl" />
      </PageSection>
    );
  }

  return (
    <PageSection
      title="Sign-in"
      description="How you get into your account."
    >
      <div className="space-y-3">
        <ItemGroup className="gap-0 rounded-xl bg-muted">
          {user.externalAccounts.map((account) => {
            const ProviderIcon = PROVIDER_ICONS[account.provider] ?? Plugs;
            const verified = account.verification?.status === "verified";
            return (
              <div key={account.id}>
                <Item>
                  <ItemMedia variant="icon">
                    <ProviderIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{account.providerTitle()}</ItemTitle>
                    <ItemDescription>
                      {account.emailAddress || account.username || "Connected"}
                    </ItemDescription>
                  </ItemContent>
                  <Badge variant={verified ? "secondary" : "outline"}>
                    {verified ? "Connected" : "Needs reconnecting"}
                  </Badge>
                </Item>
                <ItemSeparator className="my-0" />
              </div>
            );
          })}
          <Item>
            <ItemMedia variant="icon">
              <Password />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Password</ItemTitle>
              <ItemDescription>
                {user.passwordEnabled
                  ? "Sign in with your email and password."
                  : "Not set. You sign in with an email code or a connected account."}
              </ItemDescription>
            </ItemContent>
            <Badge variant={user.passwordEnabled ? "secondary" : "outline"}>
              {user.passwordEnabled ? "Set" : "Not set"}
            </Badge>
          </Item>
        </ItemGroup>

        <PasswordForm hasPassword={user.passwordEnabled} />
      </div>
    </PageSection>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Clerk can ask for a fresh verification before a password change.
  const updatePassword = useReverification((params: PasswordParams) =>
    user?.updatePassword(params),
  );

  const canSubmit =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    (!hasPassword || currentPassword.length > 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updatePassword(
        hasPassword
          ? {
              currentPassword,
              newPassword,
              signOutOfOtherSessions: signOutOthers,
            }
          : { newPassword },
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(hasPassword ? "Password updated" : "Password set");
    } catch (err) {
      if (!isReverificationCancelledError(err)) {
        setError(clerkErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card size="sm">
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-5">
            <div>
              <p className="text-sm font-medium">
                {hasPassword ? "Change password" : "Set a password"}
              </p>
              {hasPassword ? null : (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Add a password to sign in with your email and password too.
                </p>
              )}
            </div>

            {hasPassword ? (
              <Field>
                <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  aria-invalid={
                    confirmPassword.length > 0 && confirmPassword !== newPassword
                      ? true
                      : undefined
                  }
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
            </div>

            {hasPassword ? (
              <Field orientation="horizontal">
                <Checkbox
                  id="sign-out-others"
                  checked={signOutOthers}
                  onCheckedChange={(checked) => setSignOutOthers(checked === true)}
                />
                <FieldLabel htmlFor="sign-out-others" className="font-normal">
                  Sign out of other devices
                </FieldLabel>
              </Field>
            ) : null}

            {error ? <FieldError>{error}</FieldError> : null}

            <div>
              <Button type="submit" disabled={!canSubmit || saving}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {hasPassword ? "Update password" : "Set password"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
