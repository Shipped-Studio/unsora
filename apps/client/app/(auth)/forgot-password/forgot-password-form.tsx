"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { clerkErrorMessage, globalErrorMessage } from "@/lib/clerk-errors";
import {
  AuthHeader,
  CodeInput,
  FormError,
  PasswordInput,
  ResendButton,
  AUTH_CONTROL,
} from "../_components/auth-parts";

type Step = "email" | "code" | "password";

export function ForgotPasswordForm() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const busy = fetchStatus === "fetching";
  const error = formError ?? globalErrorMessage(errors);

  const sendCode = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setFormError(null);
    const { error: createError } = await signIn.create({ identifier: email.trim() });
    if (createError) return;
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) return;
    setCode("");
    setStep("code");
  };

  const verifyCode = async (value = code) => {
    setFormError(null);
    const { error: verifyError } = await signIn.resetPasswordEmailCode.verifyCode({
      code: value,
    });
    if (verifyError) return;
    setStep("password");
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const { error: submitError } = await signIn.resetPasswordEmailCode.submitPassword({
      password,
      signOutOfOtherSessions: true,
    });
    if (submitError) return;

    if (signIn.status !== "complete") {
      setFormError("Your password was changed. Sign in with it to continue.");
      router.push("/sign-in");
      return;
    }

    const { error: finalizeError } = await signIn.finalize({
      navigate: async ({ decorateUrl }) => {
        const url = decorateUrl("/");
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
    if (finalizeError) setFormError(clerkErrorMessage(finalizeError));
  };

  const back = (
    <Link
      href="/sign-in"
      className={buttonVariants({
        variant: "ghost",
        size: "sm",
        className: "-ml-2.5 text-muted-foreground",
      })}
    >
      <ArrowLeft />
      Back to sign in
    </Link>
  );

  if (step === "code") {
    return (
      <div className="space-y-6">
        {back}
        <AuthHeader
          title="Check your email"
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
            void verifyCode();
          }}
        >
          <Field>
            <CodeInput
              value={code}
              onChange={setCode}
              onComplete={(value) => void verifyCode(value)}
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
        <div className="text-center">
          <ResendButton
            onResend={async () => {
              await signIn.resetPasswordEmailCode.sendCode();
            }}
          />
        </div>
      </div>
    );
  }

  if (step === "password") {
    return (
      <div className="space-y-6">
        {back}
        <AuthHeader
          title="Choose a new password"
          description="You'll be signed out on your other devices."
        />
        <form onSubmit={savePassword} className="space-y-5" noValidate>
          <Field data-invalid={Boolean(errors.fields.password) || undefined}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
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
          <FormError message={error} />
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            Save password and sign in
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <AuthHeader
        title="Reset your password"
        description="Enter the email you sign in with and we'll send you a code."
      />
      <form onSubmit={sendCode} className="space-y-5" noValidate>
        <FieldGroup>
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
        </FieldGroup>
        <FormError message={error} />
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : null}
          Send code
        </Button>
      </form>
    </div>
  );
}
