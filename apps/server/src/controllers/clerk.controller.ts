import prisma from "../lib/db";
import { Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { clerkClient } from "@clerk/express";
import { onNewSignup } from "../emails";
import { isBlockedSignupEmail } from "../lib/signup-policy";
import { createUserOnSignup } from "../lib/signup";

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

        // The user's first API request may already have created the row
        // (auth middleware); whichever call creates it grants the welcome
        // credits. Otherwise just store the real email, as that path may
        // have used a placeholder.
        const email = evt.data.email_addresses[0].email_address;
        const { user: row, created } = await createUserOnSignup(id as string, email);
        const user = created || row.email === email
          ? row
          : await prisma.user.update({
              where: { id: row.id },
              data: { email },
              select: { id: true, email: true },
            });

        await clerkClient.users.updateUserMetadata(id as string, {
          unsafeMetadata: {
            plan: "free",
            onboardingCompleted: false,
          },
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
