"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { clerkErrorMessage, globalErrorMessage } from "@/lib/clerk-errors";
import {
  AuthHeader,
  CodeInput,
  FormError,
  GoogleButton,
  PasswordInput,
  ResendButton,
} from "../../_components/auth-parts";

const TERMS_URL = "https://tryunsora.com/terms";
const PRIVACY_URL = "https://tryunsora.com/privacy";
const AFTER_SIGN_UP = "/onboarding";

function LegalConsent({
  checked,
  onCheckedChange,
  invalid,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  invalid: boolean;
}) {
  return (
    <Field orientation="horizontal" data-invalid={invalid || undefined}>
      <Checkbox
        id="legal"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-invalid={invalid || undefined}
      />
      <FieldLabel htmlFor="legal" className="text-sm font-normal text-muted-foreground">
        <span>
          I agree to the{" "}
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Privacy Policy
          </a>
        </span>
      </FieldLabel>
    </Field>
  );
}

export function SignUpForm() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isContinue = pathname.endsWith("/continue");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  const busy = fetchStatus === "fetching";
  const error = formError ?? globalErrorMessage(errors);

  const requireConsent = () => {
    if (accepted) return true;
    setConsentMissing(true);
    return false;
  };

  const finish = async () => {
    const { error: finalizeError } = await signUp.finalize({
      navigate: async ({ decorateUrl }) => {
        const url = decorateUrl(AFTER_SIGN_UP);
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
    if (finalizeError) setFormError(clerkErrorMessage(finalizeError));
  };

  const settle = async () => {
    if (signUp.status === "complete") return finish();
    if (signUp.missingFields.includes("legal_accepted")) {
      const { error: updateError } = await signUp.update({ legalAccepted: true });
      if (updateError) return;
      // The resource updates in place; TypeScript still has the old narrowing.
      if ((signUp.status as string) === "complete") return finish();
    }
    if (signUp.unverifiedFields.includes("email_address")) {
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) return;
      setCode("");
      setVerifying(true);
      return;
    }
    setFormError("We couldn't finish creating your account. Try again or contact support.");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!requireConsent()) return;
    const { error: passwordError } = await signUp.password({
      emailAddress: email.trim(),
      password,
      legalAccepted: true,
    });
    if (passwordError) return;
    await settle();
  };

  const verify = async (value = code) => {
    setFormError(null);
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({
      code: value,
    });
    if (verifyError) return;
    await settle();
  };

  const signUpWithGoogle = async () => {
    setFormError(null);
    if (!requireConsent()) return;
    setGooglePending(true);
    const { error: ssoError } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: AFTER_SIGN_UP,
      redirectCallbackUrl: "/sso-callback",
      legalAccepted: true,
    });
    if (ssoError) {
      setGooglePending(false);
      setFormError(clerkErrorMessage(ssoError));
    }
  };

  const captcha = <div id="clerk-captcha" className="empty:hidden" />;

  // Reached from the SSO callback when Google sign-up still needs consent.
  if (isContinue && !verifying) {
    return (
      <div className="space-y-6">
        <AuthHeader
          title="Finish creating your account"
          description="One more step before you can start scheduling."
        />
        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setFormError(null);
            if (!requireConsent()) return;
            await settle();
          }}
        >
          <LegalConsent
            checked={accepted}
            onCheckedChange={(value) => {
              setAccepted(value);
              if (value) setConsentMissing(false);
            }}
            invalid={consentMissing}
          />
          {consentMissing ? (
            <FieldError>Accept the terms to continue.</FieldError>
          ) : null}
          <FormError message={error} />
          {captcha}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            Create account
          </Button>
        </form>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="space-y-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2.5 text-muted-foreground"
          onClick={() => {
            setVerifying(false);
            setCode("");
            setFormError(null);
          }}
        >
          <ArrowLeft />
          Back
        </Button>
        <AuthHeader
          title="Verify your email"
          description={
            <>
              Enter the 6-digit code we sent to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          }
        />
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
        >
          <Field>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={(value) => void verify(value)}
              invalid={Boolean(errors.fields.code)}
              disabled={busy}
            />
            <FieldError className="text-center">
              {errors.fields.code?.longMessage ?? errors.fields.code?.message}
            </FieldError>
          </Field>
          <FormError message={error} />
          <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
            {busy ? <Spinner /> : null}
            Verify email
          </Button>
        </form>
        <div className="text-center">
          <ResendButton
            onResend={async () => {
              await signUp.verifications.sendEmailCode();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AuthHeader
        title="Create your Unsora account"
        description={
          <>
            Already have one?{" "}
            <Link
              href={`/sign-in${searchParams.toString() ? `?${searchParams}` : ""}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        }
      />

      <GoogleButton onClick={signUpWithGoogle} pending={googlePending} disabled={busy} />

      <FieldSeparator className="my-1">or</FieldSeparator>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <FieldGroup className="gap-4">
          <Field data-invalid={Boolean(errors.fields.emailAddress) || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.fields.emailAddress) || undefined}
            />
            <FieldError>
              {errors.fields.emailAddress?.longMessage ?? errors.fields.emailAddress?.message}
            </FieldError>
          </Field>

          <Field data-invalid={Boolean(errors.fields.password) || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              invalid={Boolean(errors.fields.password)}
            />
            {errors.fields.password ? (
              <FieldError>
                {errors.fields.password.longMessage ?? errors.fields.password.message}
              </FieldError>
            ) : (
              <FieldDescription>At least 8 characters.</FieldDescription>
            )}
          </Field>

          <LegalConsent
            checked={accepted}
            onCheckedChange={(value) => {
              setAccepted(value);
              if (value) setConsentMissing(false);
            }}
            invalid={consentMissing || Boolean(errors.fields.legalAccepted)}
          />
          {consentMissing ? (
            <FieldError>Accept the terms to create an account.</FieldError>
          ) : null}
        </FieldGroup>

        <FormError message={error} />
        {captcha}

        <Button type="submit" className="w-full" disabled={busy || !email || !password}>
          {busy ? <Spinner /> : null}
          Create account
        </Button>
      </form>
    </div>
  );
}
