"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import { GoogleIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";

export const TERMS_URL = "https://tryunsora.com/terms";
export const PRIVACY_URL = "https://tryunsora.com/privacy";

/** Auth forms use one control height: inputs, password field and buttons. */
export const AUTH_CONTROL = "h-10";

/** Text link inside auth copy ("Create an account", "Forgot password?"). */
export const AUTH_LINK =
  "rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function AuthHeader({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground">
        {title}
      </h1>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <WarningCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function GoogleButton({
  onClick,
  pending,
  disabled,
}: {
  onClick: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full"
      onClick={onClick}
      disabled={disabled || pending}
    >
      {pending ? <Spinner /> : <GoogleIcon className="size-4" />}
      Continue with Google
    </Button>
  );
}

/**
 * Sign in / Sign up switch, for the pages a connector (ChatGPT, Claude) sends
 * people to, where the two lead different ways. Links, so each is its own URL.
 */
export function AuthSwitch({
  current,
  signInHref,
  signUpHref,
  onSignIn,
}: {
  current: "sign-in" | "sign-up";
  signInHref: string;
  signUpHref: string;
  onSignIn?: (event: React.MouseEvent) => void;
}) {
  const items = [
    { id: "sign-in", label: "Sign in", href: signInHref },
    { id: "sign-up", label: "Sign up", href: signUpHref },
  ] as const;
  return (
    <nav aria-label="Sign in or sign up" className="grid grid-cols-2 gap-1 rounded-xl bg-foreground/6 p-1">
      {items.map((item) =>
        item.id === current ? (
          <span
            key={item.id}
            aria-current="page"
            className="flex h-9 items-center justify-center rounded-lg bg-card text-sm font-medium text-foreground shadow-xs ring-1 ring-border"
          >
            {item.label}
          </span>
        ) : (
          <Link
            key={item.id}
            href={item.href}
            replace
            onClick={item.id === "sign-in" ? onSignIn : undefined}
            className="flex h-9 items-center justify-center rounded-lg text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}

/** Clickwrap line under the main auth button. */
export function LegalNotice({ action }: { action: string }) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      By {action}, you agree to Unsora&apos;s{" "}
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className={AUTH_LINK}>
        Terms of Service
      </a>{" "}
      and{" "}
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={AUTH_LINK}>
        Privacy Policy
      </a>
      .
    </p>
  );
}

export function PasswordInput({
  id,
  name,
  autoComplete,
  autoFocus,
  invalid,
  value,
  onChange,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  invalid?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup className={AUTH_CONTROL}>
      <InputGroupInput
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeSlash /> : <Eye />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** Six-digit code entry. Submits as soon as the last digit is typed. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label="Verification code"
      containerClassName="justify-center"
    >
      <InputOTPGroup>
        {Array.from({ length: 6 }).map((_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            aria-invalid={invalid || undefined}
            className="size-11 text-base"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** "Resend code" with a cooldown so people don't hammer it. */
export function ResendButton({ onResend }: { onResend: () => Promise<void> }) {
  const [cooldown, setCooldown] = useState(0);
  const [pending, setPending] = useState(false);

  const start = () => {
    setCooldown(30);
    const timer = window.setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };

  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-muted-foreground"
      disabled={pending || cooldown > 0}
      onClick={async () => {
        setPending(true);
        try {
          await onResend();
          start();
        } finally {
          setPending(false);
        }
      }}
    >
      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
    </Button>
  );
}
