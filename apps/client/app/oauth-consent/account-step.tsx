"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { clerkErrorMessage } from "@/lib/clerk-errors";
import {
  AUTH_CONTROL,
  AUTH_LINK,
  CodeInput,
  FormError,
  GoogleButton,
  PasswordInput,
  ResendButton,
} from "@/app/(auth)/_components/auth-parts";

/*
 * One door for new and returning users: Google, or an email and a code. A
 * known email signs in; an unknown one becomes a new account straight away,
 * with no extra screen (continuing is agreeing to the terms, noted under the
 * button; a password is asked for only if the Clerk instance requires one).
 * Anything unusual, like a second factor, hands over to the full /sign-in page.
 */
type Step = "email" | "code" | "password" | "new-code";

const TERMS = "https://tryunsora.com/terms";
const PRIVACY = "https://tryunsora.com/privacy";

function errorCode(error: unknown): string | null {
  const e = error as { errors?: { code?: string }[]; code?: string } | null;
  return e?.errors?.[0]?.code ?? e?.code ?? null;
}

/**
 * Unsora's own front door, the same for everyone whichever app sent them:
 * nothing here is about the connecting client. The setup steps after it are.
 */
export function AccountStep() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const here = () => `${window.location.pathname}${window.location.search}`;

  /** Sessions start on this same URL, so the flow carries on to channels. */
  const navigate = async ({ decorateUrl }: { decorateUrl: (url: string) => string }) => {
    const url = decorateUrl(here());
    if (url.startsWith("http")) window.location.href = url;
    else router.replace(url);
  };

  const run = async (work: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setError(null);
    setGooglePending(true);
    const { error: ssoError } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: here(),
      redirectCallbackUrl: "/sso-callback",
    });
    if (ssoError) {
      setGooglePending(false);
      setError(clerkErrorMessage(ssoError));
    }
  };

  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const { error: sendError } = await signIn.emailCode.sendCode({
        emailAddress: email.trim(),
      });
      if (!sendError) {
        setCode("");
        setStep("code");
        return;
      }
      if (errorCode(sendError) !== "form_identifier_not_found") {
        return setError(clerkErrorMessage(sendError));
      }
      // New to Unsora: create the account now, then the same code step.
      await signIn.reset();
      const { error: createError } = await signUp.create({
        emailAddress: email.trim(),
        legalAccepted: true,
      });
      if (createError) return setError(clerkErrorMessage(createError));
      if (signUp.missingFields.includes("password")) return setStep("password");
      await sendSignUpCode();
    });
  };

  const sendSignUpCode = async () => {
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) return setError(clerkErrorMessage(sendError));
    setCode("");
    setStep("new-code");
  };

  const verifySignIn = (value: string) =>
    run(async () => {
      const { error: verifyError } = await signIn.emailCode.verifyCode({ code: value });
      if (verifyError) return setError(clerkErrorMessage(verifyError));
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({ navigate });
        if (finalizeError) setError(clerkErrorMessage(finalizeError));
        return;
      }
      // Second factor, new password and the like: the full page handles them.
      router.push(`/sign-in?redirect_url=${encodeURIComponent(here())}`);
    });

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const { error: passwordError } = await signUp.password({
        emailAddress: email.trim(),
        password,
        legalAccepted: true,
      });
      if (passwordError) return setError(clerkErrorMessage(passwordError));
      await sendSignUpCode();
    });
  };

  const verifySignUp = (value: string) =>
    run(async () => {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: value });
      if (verifyError) return setError(clerkErrorMessage(verifyError));
      if (signUp.status !== "complete") {
        return setError("We couldn't finish creating your account. Try again.");
      }
      const { error: finalizeError } = await signUp.finalize({ navigate });
      if (finalizeError) setError(clerkErrorMessage(finalizeError));
    });

  const startOver = async () => {
    await Promise.allSettled([signIn.reset(), signUp.reset()]);
    setStep("email");
    setCode("");
    setPassword("");
    setError(null);
  };

  return (
    <section className="w-full">

      {step === "email" ? (
        <div className="space-y-6">
          <Heading title="Welcome to Unsora" lead="Sign in or create your account." />
          <GoogleButton onClick={continueWithGoogle} pending={googlePending} disabled={busy} />
          <FieldSeparator className="my-1">or</FieldSeparator>
          <form onSubmit={submitEmail} className="space-y-3" noValidate>
            <Field>
              <FieldLabel htmlFor="connector-email" className="sr-only">
                Email
              </FieldLabel>
              <Input
                id="connector-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
                className={AUTH_CONTROL}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <FormError message={error} />
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email.trim()}>
              {busy ? <Spinner /> : null}
              Continue with email
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to the{" "}
            <a href={TERMS} target="_blank" rel="noreferrer" className={AUTH_LINK}>
              Terms
            </a>{" "}
            and{" "}
            <a href={PRIVACY} target="_blank" rel="noreferrer" className={AUTH_LINK}>
              Privacy Policy
            </a>
            .
          </p>
        </div>
      ) : null}

      {step === "code" || step === "new-code" ? (
        <div className="space-y-6">
          <Heading title="Check your email" lead={<>Enter the code sent to <b className="font-medium text-foreground">{email}</b></>} />
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (step === "code" ? verifySignIn(code) : verifySignUp(code));
            }}
          >
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={(value) => void (step === "code" ? verifySignIn(value) : verifySignUp(value))}
              disabled={busy}
            />
            <FormError message={error} />
            <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>
              {busy ? <Spinner /> : null}
              Continue
            </Button>
          </form>
          <div className="flex items-center gap-4">
            <DifferentEmail onClick={startOver} />
            <ResendButton
              onResend={async () => {
                if (step === "code") await signIn.emailCode.sendCode({ emailAddress: email.trim() });
                else await signUp.verifications.sendEmailCode();
              }}
            />
          </div>
        </div>
      ) : null}

      {step === "password" ? (
        <div className="space-y-6">
          <Heading title="Choose a password" lead={<>For your new account, <b className="font-medium text-foreground">{email}</b></>} />
          <form onSubmit={submitPassword} className="space-y-4" noValidate>
            <Field>
              <FieldLabel htmlFor="connector-password" className="sr-only">
                Password
              </FieldLabel>
              <PasswordInput
                id="connector-password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={setPassword}
              />
            </Field>
            <FormError message={error} />
            <Button type="submit" size="lg" className="w-full" disabled={busy || !password}>
              {busy ? <Spinner /> : null}
              Continue
            </Button>
          </form>
          <DifferentEmail onClick={startOver} />
        </div>
      ) : null}

      {/* Clerk's bot check mounts here when it needs to. */}
      <div id="clerk-captcha" className="empty:hidden" />
    </section>
  );
}

function Heading({ title, lead }: { title: string; lead: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h1
        tabIndex={-1}
        className="font-display text-3xl leading-[1.1] font-bold tracking-[-0.035em] text-balance text-foreground outline-none"
      >
        {title}
      </h1>
      <p className="text-muted-foreground">{lead}</p>
    </div>
  );
}

function DifferentEmail({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="link" size="sm" className="px-0 text-muted-foreground" onClick={onClick}>
      Use a different email
    </Button>
  );
}
