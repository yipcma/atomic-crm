import { useDataProvider, useNotify, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";

/** Post-registration screen prompting the user to confirm their email. */
export function CheckYourEmail({ email }: { email: string }) {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const translate = useTranslate();
  // Light logo: this page renders on the default (light) background,
  // unlike the dark split panel used by RegisterPage/SetPasswordPage.
  const { lightModeLogo, title } = useConfigurationContext();

  const resend = async () => {
    try {
      await dataProvider.resendVerification(email);
    } catch {
      // Never reveal whether the account exists.
    }
    notify("crm.auth.verification_resent", {
      type: "info",
      messageArgs: { _: "Verification email sent." },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img className="h-8 mx-auto" src={lightModeLogo} alt={title} />
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate("crm.auth.check_email_title", { _: "Check your email" })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("crm.auth.check_email_body", {
            _: `We've sent a verification link to ${email}. Click it to activate your account and sign in.`,
            email,
          })}
        </p>
        <Button variant="outline" type="button" onClick={resend}>
          {translate("crm.auth.resend_verification", {
            _: "Resend verification email",
          })}
        </Button>
      </div>
    </div>
  );
}
