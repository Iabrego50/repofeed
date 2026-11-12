import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";

/** A sign-up link that records where on the page it was clicked. */
export function CtaLink({ location, variant, children, className, secondary = false, to = "/signin" }: { location: string; variant: string; children: ReactNode; className?: string; secondary?: boolean; to?: string }) {
  return (
    <Button asChild size="lg" variant={secondary ? "outline" : "default"} className={cn("h-11 px-5 text-[0.9375rem] font-semibold", className)}>
      <Link to={to} onClick={() => track("cta_click", { location, variant: variant || "home", target: to })}>
        {children}
      </Link>
    </Button>
  );
}

/**
 * Email box in the hero. One field and one button: we send the sign-in link
 * straight away rather than making people click through to another page first.
 */
export function HeroSignup({ variant, id = "hero-email", location = "hero" }: { variant: string; id?: string; location?: string }) {
  const { user, signInWithOtp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");

  if (user) {
    return (
      <CtaLink location={location} variant={variant} to="/feed">
        Go to the feed <ArrowRight className="size-4" />
      </CtaLink>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value || state === "busy") return;
    setState("busy");
    track("cta_click", { location, variant: variant || "home", target: "email" });
    try {
      await signInWithOtp(value);
      setState("sent");
    } catch {
      // Fall back to the full sign-in page, which explains what went wrong.
      navigate("/signin");
    }
  };

  if (state === "sent") {
    return (
      <p role="status" className="flex max-w-md items-start gap-3 rounded-lg border border-border bg-card p-4 text-[0.9375rem]">
        <MailCheck className="mt-0.5 size-5 shrink-0 text-success" />
        <span>
          We sent a sign-in link to <strong className="font-semibold">{email.trim()}</strong>. Open it on this device and you’re in. No password to set.
        </span>
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="flex max-w-md flex-col gap-2 sm:flex-row">
      <label htmlFor={id} className="sr-only">Work email</label>
      <Input
        id={id}
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="h-11 flex-1 bg-card text-[0.9375rem]"
      />
      <Button type="submit" size="lg" disabled={state === "busy"} className="h-11 px-5 text-[0.9375rem] font-semibold">
        {state === "busy" ? "Sending…" : "Start free"} <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
