import { useEffect, useState } from "react";
import { useDataProvider, useTranslate } from "ra-core";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  apiJson,
  jsonRequest,
} from "@/components/atomic-crm/providers/railway/httpClient";
import {
  establishSession,
  type LoginResult,
} from "@/components/atomic-crm/providers/railway/authProvider";
import type { CrmDataProvider } from "../providers/types";

type Status = "verifying" | "error" | "resent";

/** Confirms an email address from the verification link, then signs the user in. */
export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>("verifying");
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const translate = useTranslate();
  const navigate = useNavigate();
  const dataProvider = useDataProvider<CrmDataProvider>();
  // Light logo: this page renders on the default (light) background, unlike the
  // dark split panel used by RegisterPage and SetPasswordPage.
  const { lightModeLogo, title } = useConfigurationContext();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    (async () => {
      try {
        const { json } = await apiJson<LoginResult>(
          "/api/auth/verify-email",
          jsonRequest("POST", { token }),
        );
        establishSession(json);
        // SPA navigation rather than a full reload: a reload would discard the
        // query cache establishSession just warmed and re-download the bundle.
        navigate("/", { replace: true });
      } catch {
        setStatus("error");
      }
    })();
  }, [token, navigate]);

  const resend = async () => {
    setResending(true);
    try {
      await dataProvider.resendVerification(email);
      setStatus("resent");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img className="h-8 mx-auto" src={lightModeLogo} alt={title} />

        {/* Announced to screen readers: without a live region the transition
            from "Verifying…" to the error state is silent. */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {status === "verifying" &&
            translate("crm.auth.verifying_email", {
              _: "Verifying your email…",
            })}
          {status === "error" &&
            translate("crm.auth.invalid_invite", {
              _: "This link is invalid or has expired.",
            })}
          {status === "resent" &&
            translate("crm.auth.verification_resent", {
              _: "If that account needs verifying, we've sent a new link.",
            })}
        </p>

        {/* An expired link used to be a dead end: the resend affordance lived
            only on CheckYourEmail, which is unreachable once you navigate away,
            so the user was locked out with no self-service path. */}
        {status === "error" && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void resend();
            }}
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={translate("crm.auth.email", { _: "Email" })}
              aria-label={translate("crm.auth.email", { _: "Email" })}
            />
            <Button type="submit" className="w-full" disabled={resending}>
              {translate("crm.auth.resend_verification", {
                _: "Resend verification email",
              })}
            </Button>
          </form>
        )}

        {status !== "verifying" && (
          <Link
            to="/login"
            className="block text-sm text-muted-foreground hover:underline"
          >
            {translate("crm.auth.back_to_sign_in", { _: "Back to sign in" })}
          </Link>
        )}
      </div>
    </div>
  );
};

VerifyEmailPage.path = "/verify-email";
