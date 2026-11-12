import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form.tsx";

const schema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(60, "Keep it under 60 characters"),
});
type Values = z.infer<typeof schema>;

/** Asks a share-link viewer for their name before their first reaction or comment. */
export default function NamePrompt({
  open,
  studyTitle,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  studyTitle: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "" } });
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) form.reset({ name: "" });
  }, [open, form]);

  const submit = async (v: Values) => {
    setBusy(true);
    try {
      await onSubmit(v.name);
    } catch (err) {
      form.setError("name", { message: err instanceof Error ? err.message : "Couldn't save your name" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
        <DialogHeader>
          <span className="mb-2 grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
            <MessageCircle className="size-5" />
          </span>
          <DialogTitle className="text-2xl">What should we call you?</DialogTitle>
          <DialogDescription>
            The team behind <span className="font-medium text-foreground">{studyTitle}</span> will see your name next to your reactions and comments. No account needed.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      ref={(el) => {
                        field.ref(el);
                        inputRef.current = el;
                      }}
                      placeholder="Jane Smith"
                      autoComplete="name"
                      maxLength={60}
                      className="h-11"
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" className="h-11" onClick={onCancel} disabled={busy}>
                Just watching
              </Button>
              <Button type="submit" className="h-11 font-semibold" disabled={busy}>
                {busy && <Spinner />} Continue
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
