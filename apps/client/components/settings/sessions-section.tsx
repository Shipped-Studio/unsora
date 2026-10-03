"use client";

import { useState } from "react";
import { useClerk, useReverification, useSession, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { toast } from "sonner";
import { PageSection } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { clerkErrorMessage } from "@/lib/clerk-errors";

export function SessionsSection() {
  const { user } = useUser();
  const { session } = useSession();
  const { signOut } = useClerk();
  const [revoking, setRevoking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Revoking sessions can require a fresh verification.
  const revokeOthers = useReverification(async () => {
    if (!user || !session) return 0;
    const sessions = await user.getSessions();
    const others = sessions.filter((s) => s.id !== session.id);
    await Promise.all(others.map((s) => s.revoke()));
    return others.length;
  });

  const handleRevokeOthers = async () => {
    setRevoking(true);
    try {
      const count = await revokeOthers();
      toast.success(
        count === 0
          ? "No other devices were signed in"
          : `Signed out of ${count} other ${count === 1 ? "device" : "devices"}`,
      );
    } catch (error) {
      if (!isReverificationCancelledError(error)) {
        toast.error("Couldn't sign out other devices", {
          description: clerkErrorMessage(error),
        });
      }
    } finally {
      setRevoking(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch (error) {
      setSigningOut(false);
      toast.error("Couldn't sign out", { description: clerkErrorMessage(error) });
    }
  };

  return (
    <PageSection
      title="Sessions"
      description="Devices signed in to your account."
    >
      <ItemGroup className="gap-0 rounded-xl bg-muted">
        <Item>
          <ItemContent>
            <ItemTitle>Sign out of other devices</ItemTitle>
            <ItemDescription>
              Ends every session except the one you&apos;re using now.
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="outline"
              size="sm"
              disabled={revoking || !user || !session}
              onClick={() => void handleRevokeOthers()}
            >
              {revoking ? <Spinner data-icon="inline-start" /> : null}
              Sign out others
            </Button>
          </ItemActions>
        </Item>
        <ItemSeparator className="my-0" />
        <Item>
          <ItemContent>
            <ItemTitle>Sign out</ItemTitle>
            <ItemDescription>Sign out of Unsora on this device.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="outline"
              size="sm"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? <Spinner data-icon="inline-start" /> : null}
              Sign out
            </Button>
          </ItemActions>
        </Item>
      </ItemGroup>
    </PageSection>
  );
}
