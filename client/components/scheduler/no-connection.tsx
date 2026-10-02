import { WarningCircle as CircleAlert } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export function NoConnection({ variant = "default" }) {
  if (variant === "minimal")
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CircleAlert />
          <h3>Connect your social media accounts</h3>
        </div>
        <Button>
          <Link href="/scheduler/connections">Connect Accounts</Link>
        </Button>
      </div>
    );

  return (
    <Card className="bg-muted/50 border-dashed">
      <div className="p-8 text-center space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No accounts connected
          </h3>
          <p className="text-sm text-muted-foreground">
            Connect your social media accounts to start creating posts
          </p>
        </div>
        <Button>
          <Link href="/scheduler/connections">Connect Accounts</Link>
        </Button>
      </div>
    </Card>
  );
}
