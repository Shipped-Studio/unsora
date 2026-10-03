"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Field,
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
  PasswordInput,
  ResendButton,
  AUTH_CONTROL,
  AUTH_LINK,
} from "../../_components/auth-parts";

type Step = "start" | "email-code" | "second-factor";
type SecondFactor = "email_code" | "phone_code" | "totp" | "backup_code";

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

export function SignInForm() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect_url"));

  const [step, setStep] = useState<Step>("start");
  const [method, setMethod] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secondFactor, setSecondFactor] = useState<SecondFactor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  const busy = fetchStatus === "fetching";
  const error = formError ?? globalErrorMessage(errors);

  const finish = async () => {
    const { error: finalizeError } = await signIn.finalize({
      navigate: async ({ decorateUrl }) => {
        const url = decorateUrl(redirectTo);
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
    if (finalizeError) setFormError(clerkErrorMessage(finalizeError));
  };

  const continueAfterFirstFactor = async () => {
    if (signIn.status === "complete") return finish();

    if (
      signIn.status === "needs_second_factor" ||
      signIn.status === "needs_client_trust"
    ) {
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

  const sendEmailCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    const { error: sendError } = await signIn.emailCode.sendCode({
      emailAddress: email.trim(),
    });
    if (sendError) return;
    setCode("");
    setStep("email-code");
  };

  const verifyEmailCode = async (value = code) => {
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
    if (signIn.status === "complete") await finish();
    else setFormError("That code worked, but we couldn't finish signing you in. Try again.");
  };

  const signInWithGoogle = async () => {
    setFormError(null);
    setGooglePending(true);
    const { error: ssoError } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: redirectTo,
      redirectCallbackUrl: "/sso-callback",
    });
    if (ssoError) {
      setGooglePending(false);
      setFormError(clerkErrorMessage(ssoError));
    }
  };

  const startOver = async () => {
    await signIn.reset();
    setStep("start");
    setCode("");
    setSecondFactor(null);
    setFormError(null);
  };

  if (step === "email-code" || step === "second-factor") {
    const copy =
      step === "email-code"
        ? {
            title: "Check your email",
            description: (
              <>
                Enter the 6-digit code we sent to{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </>
            ),
          }
        : SECOND_FACTOR_COPY[secondFactor ?? "email_code"];
    const onComplete = step === "email-code" ? verifyEmailCode : verifySecondFactor;
    const canResend =
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
          onClick={startOver}
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
            Continue
          </Button>
        </form>
        {canResend ? (
          <div className="text-center">
            <ResendButton
              onResend={async () => {
                if (step === "email-code") {
                  await signIn.emailCode.sendCode({ emailAddress: email.trim() });
                } else if (secondFactor === "email_code") {
                  await signIn.mfa.sendEmailCode();
                } else {
                  await signIn.mfa.sendPhoneCode();
                }
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Sign in to Unsora"
        description={
          <>
            New here?{" "}
            <Link
              href={`/sign-up${searchParams.toString() ? `?${searchParams}` : ""}`}
              className={AUTH_LINK}
            >
              Create an account
            </Link>
          </>
        }
      />

      <GoogleButton onClick={signInWithGoogle} pending={googlePending} disabled={busy} />

      <FieldSeparator className="my-1">or</FieldSeparator>

      <form
        onSubmit={method === "password" ? submitPassword : sendEmailCode}
        className="space-y-5"
        noValidate
      >
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(errors.fields.identifier) || undefined}>
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
              aria-invalid={Boolean(errors.fields.identifier) || undefined}
            />
            <FieldError>
              {errors.fields.identifier?.longMessage ?? errors.fields.identifier?.message}
            </FieldError>
          </Field>

          {method === "password" ? (
            <Field data-invalid={Boolean(errors.fields.password) || undefined}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
                  className="rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                invalid={Boolean(errors.fields.password)}
              />
              <FieldError>
                {errors.fields.password?.longMessage ?? errors.fields.password?.message}
              </FieldError>
            </Field>
          ) : null}
        </FieldGroup>

        <FormError message={error} />

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          {method === "password" ? "Sign in" : "Email me a code"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          onClick={() => {
            setFormError(null);
            setMethod(method === "password" ? "code" : "password");
          }}
        >
          {method === "password"
            ? "Sign in with an email code instead"
            : "Sign in with a password instead"}
        </button>
      </p>
    </div>
  );
}
