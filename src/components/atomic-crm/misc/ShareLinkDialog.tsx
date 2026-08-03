import { useState } from "react";
import { useTranslate } from "ra-core";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  url: string;
}

/** Reusable dialog that presents a shareable link with a copy-to-clipboard button. */
export function ShareLinkDialog({
  open,
  onClose,
  title,
  description,
  url,
}: ShareLinkDialogProps) {
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    // The Clipboard API rejects on a non-secure origin or a denied permission.
    // Unhandled, that was a silent no-op: the button simply never changed and
    // the user had no idea the link had not been copied.
    try {
      await navigator.clipboard.writeText(url);
      setCopyFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copy}
            aria-label={translate("crm.share.copy_link", { _: "Copy link" })}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        {/* The Copy -> Check swap is purely visual, so announce the outcome. */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {copied
            ? translate("crm.share.copied", { _: "Link copied" })
            : copyFailed
              ? translate("crm.share.copy_failed", {
                  _: "Couldn't copy automatically — select the link above and copy it manually.",
                })
              : null}
        </p>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {translate("ra.action.close", { _: "Done" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
