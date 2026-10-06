import prisma from "../lib/db";
import { Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { clerkClient } from "@clerk/express";
import { onNewSignup } from "../emails";
import { isBlockedSignupEmail } from "../lib/signup-policy";

export class ClerkController {
  async webhooks(req: Request, res: Response) {
    try {
      const evt = await verifyWebhook(req);
      const { id } = evt.data;
      const eventType = evt.type;

      if (eventType === "user.created") {
        // Validate required fields
        if (
          !evt.data.email_addresses ||
          evt.data.email_addresses.length === 0
        ) {
          console.error("No email addresses found in user.created event");
          return res.status(400).send("Invalid webhook payload");
        }

        if (isBlockedSignupEmail(evt.data.email_addresses[0].email_address)) {
          console.error(
            "Email addresses from rejected domains are not allowed",
          );
          return res
            .status(400)
            .send("Email addresses from rejected domains are not allowed");
        }

        // Use transaction to ensure consistency
        const user = await prisma.$transaction(async (tx) => {
          // Upsert: the user's first API request may already have created
          // the row (auth middleware). A plain create would fail here and
          // Clerk would retry forever without sending the welcome email.
          const email = evt.data.email_addresses[0].email_address;
          const created = await tx.user.upsert({
            where: { clerkId: id as string },
            update: { email },
            create: { clerkId: id as string, email },
          });

          await clerkClient.users.updateUserMetadata(id as string, {
            unsafeMetadata: {
              plan: "free",
              onboardingCompleted: false,
            },
          });

          return created;
        });

        void onNewSignup({
          userId: user.id,
          clerkId: id as string,
          email: user.email,
          firstName: evt.data.first_name ?? null,
          lastName: evt.data.last_name ?? null,
          username: evt.data.username ?? null,
          providers: (evt.data.external_accounts ?? []).map((a) => a.provider),
        });
      }

      if (eventType === "user.deleted") {
        // Use deleteMany to avoid errors if user doesn't exist
        await prisma.user.deleteMany({
          where: { clerkId: id as string },
        });
      }

      return res.status(200).send("Webhook received");
    } catch (err) {
      console.error("Error processing webhook:", err);
      return res.status(400).send("Error processing webhook");
    }
  }
}
