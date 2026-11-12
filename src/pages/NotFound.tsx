import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import Logo from "@/components/logo.tsx";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background px-5">
      <header className="relative mx-auto w-full max-w-5xl py-5">
        <Link to="/" className="cursor-pointer" aria-label="repofeed.ai home">
          <Logo />
        </Link>
      </header>
      <main className="relative m-auto w-full max-w-md pb-24">
        <meta name="robots" content="noindex" />
        <p className="text-sm font-medium text-muted-foreground">Error 404</p>
        <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          This scene doesn't exist.
        </h1>
        <p className="mt-4 text-muted-foreground">
          The link may be old or mistyped, or the study was removed. Head back and keep scrolling.
        </p>
        <Button asChild className="mt-8 h-11 font-semibold">
          <Link to="/">
            <ArrowLeft className="size-4" /> Back to repofeed.ai
          </Link>
        </Button>
      </main>
    </div>
  );
}
