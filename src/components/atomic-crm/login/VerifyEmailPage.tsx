import { useEffect, useState } from "react";
import { useTranslate } from "ra-core";
import { useSearchParams } from "react-router";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  apiJson,
  jsonRequest,
} from "@/components/atomic-crm/providers/railway/httpClient";
import {
  establishSession,
  type LoginResult,
} from "@/components/atomic-crm/providers/railway/authProvider";

/** Confirms an email address from the verification link, then signs the user in. */
export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState(false);
  const translate = useTranslate();
  const { darkModeLogo, title } = useConfigurationContext();

  useEffect(() => {
    if (!token) {
      setError(true);
      return;
    }
    (async () => {
      try {
        const { json } = await apiJson<LoginResult>(
          "/api/auth/verify-email",
          jsonRequest("POST", { token }),
        );
        establishSession(json);
        window.location.href = "/";
      } catch {
        setError(true);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img className="h-8 mx-auto" src={darkModeLogo} alt={title} />
        <p className="text-sm text-muted-foreground">
          {error
            ? translate("crm.auth.invalid_invite", {
                _: "This link is invalid or has expired.",
              })
            : translate("crm.auth.verifying_email", {
                _: "Verifying your email…",
              })}
        </p>
      </div>
    </div>
  );
};

VerifyEmailPage.path = "/verify-email";
