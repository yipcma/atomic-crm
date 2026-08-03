import { useState } from "react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HttpError } from "../providers/railway/httpClient";
import type { CrmDataProvider } from "../providers/types";

interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Login-page dialog to request a password-reset email. */
export function ForgotPasswordDialog({
  open,
  onClose,
}: ForgotPasswordDialogProps) {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const translate = useTranslate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await dataProvider.forgotPassword(email);
      // Enumeration safety is the SERVER's job: /forgot-password returns 200
      // whether or not the account exists. So a rejection here is a real
      // failure (network, 5xx, rate limit) and must not be reported as
      // success -- the previous code notified from a `finally`, leaving the
      // user waiting for an email that was never sent.
      setEmail("");
      onClose();
      notify("crm.auth.forgot_password_sent", {
        type: "info",
        messageArgs: {
          _: "If that account exists, we've sent a password reset email.",
        },
      });
    } catch (error: unknown) {
      const status =
        error instanceof HttpError
          ? error.status
          : (undefined as number | undefined);
      if (status === 429) {
        notify("crm.auth.forgot_password_rate_limited", {
          type: "warning",
          messageArgs: {
            _: "Too many attempts. Please wait a few minutes and try again.",
          },
        });
      } else {
        notify("crm.auth.forgot_password_failed", {
          type: "error",
          messageArgs: {
            _: "We couldn't send the reset email. Please try again.",
          },
        });
      }
    } finally {
      setLoading(false);
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
          <DialogTitle>
            {translate("crm.auth.forgot_password_title", {
              _: "Reset password",
            })}
          </DialogTitle>
          <DialogDescription>
            {translate("crm.auth.forgot_password_desc", {
              _: "Enter your account email and we'll send you a reset link.",
            })}
          </DialogDescription>
        </DialogHeader>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && email) submit();
          }}
        />
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>
            {translate("ra.action.cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={loading || !email}>
            {translate("crm.auth.forgot_password_submit", {
              _: "Send reset link",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
