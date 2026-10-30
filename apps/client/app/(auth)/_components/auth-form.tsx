"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  clerkErrorMessage,
  globalErrorMessage,
  safeRedirect,
} from "@/lib/clerk-errors";
import {
  AuthHeader,
  CodeInput,
  FormError,
  GoogleButton,
  LegalNotice,
  PasswordInput,
  ResendButton,
  AUTH_CONTROL,
  AUTH_LINK,
} from "./auth-parts";

/**
 * One entry point for signing in and signing up. People type their email
 * (or use Google) and we work out which it is: an existing account goes on
 * to its password, a new email goes on to "create a password". Most people
 * arriving from the ChatGPT connector are new, so nothing here makes them
 * pick "sign up" first.
 *
 * Password is required at sign-up on this Clerk instance, so a brand-new
 * account still sets one. Without a `redirect_url` everyone goes to
 * /onboarding, which sends existing users on to the app.
 */

type Step =
  | "start"
  | "password"
  | "email-code"
  | "second-factor"
  | "create"
  | "verify";
type SecondFactor = "email_code" | "phone_code" | "totp" | "backup_code";

const AFTER_AUTH = "/onboarding";

const SECOND_FACTOR_COPY: Record<SecondFactor, { title: string; description: string }> = {
  email_code: {
    title: "Check your email",
    description: "We sent a 6-digit code to confirm it's you on this device.",
  },
  phone_code: {
    title: "Check your phone",
    description: "Enter the 6-digit code we sent by text message.",
  },
  totp: {
    title: "Two-step verification",
    description: "Enter the 6-digit code from your authenticator app.",
  },
  backup_code: {
    title: "Use a backup code",
    description: "Enter one of the backup codes you saved when you set up two-step verification.",
  },
};

/**
 * Whether Clerk said there's no account for this email. Checked by shape:
 * the sign-in hook returns its own error type, which Clerk's
 * isClerkAPIResponseError guard throws on.
 */
function isNotFound(error: unknown) {
  const e = error as { code?: string; errors?: { code?: string }[] } | null;
  const code = "form_identifier_not_found";
  return e?.code === code || Boolean(e?.errors?.some((item) => item.code === code));
}

export function AuthForm() {
  const { signIn, errors: signInErrors, fetchStatus: signInStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpStatus } = useSignUp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect_url"), AFTER_AUTH);
  const { isSignedIn } = useAuth();

  // Already signed in (another tab, or the back button): carry on to where
  // they were going instead of showing a form Clerk would refuse.
  useEffect(() => {
    if (!isSignedIn) return;
    if (redirectTo.startsWith("http")) window.location.replace(redirectTo);
    else router.replace(redirectTo);
  }, [isSignedIn, redirectTo, router]);

  const [step, setStep] = useState<Step>("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secondFactor, setSecondFactor] = useState<SecondFactor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const creating = step === "create" || step === "verify";
  const errors = creating ? signUpErrors : signInErrors;
  const busy = checking || signInStatus === "fetching" || signUpStatus === "fetching";
  const error = formError ?? globalErrorMessage(errors);

  const navigate = async ({ decorateUrl }: { decorateUrl: (url: string) => string }) => {
    const url = decorateUrl(redirectTo);
    if (url.startsWith("http")) window.location.href = url;
    else router.push(url);
  };

  const startOver = async () => {
    await Promise.allSettled([signIn.reset(), signUp.reset()]);
    setStep("start");
    setPassword("");
    setCode("");
    setSecondFactor(null);
    setFormError(null);
  };

  // ── Start: which account is this? ────────────────────────────────────────

  const continueWithEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const identifier = email.trim();
    if (!identifier) return setFormError("Enter your email address.");
    setChecking(true);
    const { error: lookupError } = await signIn.create({ identifier });
    setChecking(false);
    if (isNotFound(lookupError)) {
      await signIn.reset();
      setStep("create");
      return;
    }
    if (lookupError) return;
    setStep("password");
  };

  const continueWithGoogle = async () => {
    setFormError(null);
    setGooglePending(true);
    // Started as a sign-up with the terms accepted (the notice below the
    // form), so a new Google user isn't stopped at /sign-up/continue and
    // keeps their redirect. An existing account is moved over to a sign-in
    // by /sso-callback.
    const { error: ssoError } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: redirectTo,
      redirectCallbackUrl: "/sso-callback",
      legalAccepted: true,
    });
    if (ssoError) {
      setGooglePending(false);
      setFormError(clerkErrorMessage(ssoError));
    }
  };

  // ── Existing account ─────────────────────────────────────────────────────

  const finishSignIn = async () => {
    const { error: finalizeError } = await signIn.finalize({ navigate });
    if (finalizeError) setFormError(clerkErrorMessage(finalizeError));
  };

  const continueAfterFirstFactor = async () => {
    if (signIn.status === "complete") return finishSignIn();

    if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      const strategies = signIn.supportedSecondFactors.map((f) => f.strategy);
      let next: SecondFactor | null = null;
      if (strategies.includes("email_code")) {
        await signIn.mfa.sendEmailCode();
        next = "email_code";
      } else if (strategies.includes("totp")) {
        next = "totp";
      } else if (strategies.includes("phone_code")) {
        await signIn.mfa.sendPhoneCode();
        next = "phone_code";
      } else if (strategies.includes("backup_code")) {
        next = "backup_code";
      }
      if (!next) {
        setFormError("Your account needs a verification method we don't support here yet.");
        return;
      }
      setSecondFactor(next);
      setCode("");
      setStep("second-factor");
      return;
    }

    if (signIn.status === "needs_new_password") {
      router.push(`/forgot-password?email=${encodeURIComponent(email)}`);
      return;
    }

    setFormError("We couldn't finish signing you in. Try again.");
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const { error: passwordError } = await signIn.password({
      emailAddress: email.trim(),
      password,
    });
    if (passwordError) return;
    await continueAfterFirstFactor();
  };

  const sendSignInCode = async () => {
    setFormError(null);
    const { error: sendError } = await signIn.emailCode.sendCode({
      emailAddress: email.trim(),
    });
    if (sendError) return;
    setCode("");
    setStep("email-code");
  };

  const verifySignInCode = async (value = code) => {
    setFormError(null);
    const { error: verifyError } = await signIn.emailCode.verifyCode({ code: value });
    if (verifyError) return;
    await continueAfterFirstFactor();
  };

  const verifySecondFactor = async (value = code) => {
    if (!secondFactor) return;
    setFormError(null);
    const verify = {
      email_code: () => signIn.mfa.verifyEmailCode({ code: value }),
      phone_code: () => signIn.mfa.verifyPhoneCode({ code: value }),
      totp: () => signIn.mfa.verifyTOTP({ code: value }),
      backup_code: () => signIn.mfa.verifyBackupCode({ code: value }),
    }[secondFactor];
    const { error: verifyError } = await verify();
    if (verifyError) return;
    if (signIn.status === "complete") await finishSignIn();
    else setFormError("That code worked, but we couldn't finish signing you in. Try again.");
  };

  // ── New account ──────────────────────────────────────────────────────────

  const finishSignUp = async () => {
    const { error: finalizeError } = await signUp.finalize({ navigate });
    if (finalizeError) setFormError(clerkErrorMessage(finalizeError));
  };

  const settleSignUp = async () => {
    if (signUp.status === "complete") return finishSignUp();
    if (signUp.unverifiedFields.includes("email_address")) {
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) return;
      setCode("");
      setStep("verify");
      return;
    }
    setFormError("We couldn't finish creating your account. Try again or contact support.");
  };

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const { error: passwordError } = await signUp.password({
      emailAddress: email.trim(),
      password,
      legalAccepted: true,
    });
    if (passwordError) return;
    await settleSignUp();
  };

  const verifyEmail = async (value = code) => {
    setFormError(null);
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: value });
    if (verifyError) return;
    await settleSignUp();
  };

  // ── Screens ──────────────────────────────────────────────────────────────

  const emailLine = (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-medium text-foreground">{email.trim()}</span>
      <button type="button" className={AUTH_LINK} onClick={() => void startOver()}>
        Change
      </button>
    </span>
  );
  const captcha = <div id="clerk-captcha" className="empty:hidden" />;

  if (step === "email-code" || step === "second-factor" || step === "verify") {
    const copy =
      step === "verify"
        ? {
            title: "Verify your email",
            description: (
              <>
                Enter the 6-digit code we sent to{" "}
                <span className="font-medium text-foreground">{email.trim()}</span>.
              </>
            ),
          }
        : step === "email-code"
          ? {
              title: "Check your email",
              description: (
                <>
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-medium text-foreground">{email.trim()}</span>.
                </>
              ),
            }
          : SECOND_FACTOR_COPY[secondFactor ?? "email_code"];
    const onComplete =
      step === "verify" ? verifyEmail : step === "email-code" ? verifySignInCode : verifySecondFactor;
    const canResend =
      step === "verify" ||
      step === "email-code" ||
      secondFactor === "email_code" ||
      secondFactor === "phone_code";

    return (
      <div className="space-y-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2.5 text-muted-foreground"
          onClick={() => {
            setCode("");
            setFormError(null);
            if (step === "verify") setStep("create");
            else if (step === "email-code") setStep("password");
            else void startOver();
          }}
        >
          <ArrowLeft />
          Back
        </Button>
        <AuthHeader title={copy.title} description={copy.description} />
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void onComplete(code);
          }}
        >
          <Field>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={(value) => void onComplete(value)}
              invalid={Boolean(errors.fields.code)}
              disabled={busy}
            />
            <FieldError className="text-center">
              {errors.fields.code?.longMessage ?? errors.fields.code?.message}
            </FieldError>
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : null}
            {step === "verify" ? "Verify email" : "Continue"}
          </Button>
        </form>
        {canResend ? (
          <div className="text-center">
            <ResendButton
              onResend={async () => {
                if (step === "verify") await signUp.verifications.sendEmailCode();
                else if (step === "email-code") {
                  await signIn.emailCode.sendCode({ emailAddress: email.trim() });
                } else if (secondFactor === "email_code") await signIn.mfa.sendEmailCode();
                else await signIn.mfa.sendPhoneCode();
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (step === "password") {
    return (
      <div className="space-y-6">
        <AuthHeader title="Welcome back" description={emailLine} />
        <form onSubmit={submitPassword} className="space-y-5" noValidate>
          <Field data-invalid={Boolean(signInErrors.fields.password) || undefined}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <a
                href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}
                className="rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Forgot password?
              </a>
            </div>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={setPassword}
              invalid={Boolean(signInErrors.fields.password)}
            />
            <FieldError>
              {signInErrors.fields.password?.longMessage ?? signInErrors.fields.password?.message}
            </FieldError>
          </Field>
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            Sign in
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          <button
            type="button"
            className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => void sendSignInCode()}
            disabled={busy}
          >
            Email me a sign-in code instead
          </button>
        </p>
      </div>
    );
  }

  if (step === "create") {
    return (
      <div className="space-y-6">
        <AuthHeader title="Create your account" description={emailLine} />
        <form onSubmit={createAccount} className="space-y-5" noValidate>
          <Field data-invalid={Boolean(signUpErrors.fields.password) || undefined}>
            <FieldLabel htmlFor="password">Choose a password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={setPassword}
              invalid={Boolean(signUpErrors.fields.password)}
            />
            {signUpErrors.fields.password ? (
              <FieldError>
                {signUpErrors.fields.password.longMessage ?? signUpErrors.fields.password.message}
              </FieldError>
            ) : (
              <FieldDescription>At least 8 characters.</FieldDescription>
            )}
          </Field>
          <FormError message={error} />
          {captcha}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            Create account
          </Button>
          <LegalNotice action="creating an account" />
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Get started with Unsora"
        description="Sign in or create a free account. Just enter your email."
      />

      <GoogleButton onClick={continueWithGoogle} pending={googlePending} disabled={busy} />

      <FieldSeparator className="my-1">or</FieldSeparator>

      <form onSubmit={continueWithEmail} className="space-y-5" noValidate>
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(signInErrors.fields.identifier) || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              className={AUTH_CONTROL}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(signInErrors.fields.identifier) || undefined}
            />
            <FieldError>
              {signInErrors.fields.identifier?.longMessage ?? signInErrors.fields.identifier?.message}
            </FieldError>
          </Field>
        </FieldGroup>

        <FormError message={error} />
        {captcha}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Continue with email
        </Button>
      </form>

      <LegalNotice action="continuing" />
    </div>
  );
}
