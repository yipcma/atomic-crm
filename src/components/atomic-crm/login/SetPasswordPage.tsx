import { useState } from "react";
import { Form, required, useNotify, useTranslate } from "ra-core";
import type { SubmitHandler, FieldValues } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/admin/text-input";
import { Notification } from "@/components/admin/notification";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  apiJson,
  jsonRequest,
} from "@/components/atomic-crm/providers/railway/httpClient";
import {
  establishSession,
  type LoginResult,
} from "@/components/atomic-crm/providers/railway/authProvider";

interface SetPasswordFormData {
  password: string;
  confirmPassword: string;
}

function readToken(searchToken: string | null): string {
  if (searchToken) return searchToken;
  // Not transitional: invite links are hash URLs (#/set-password?token=...)
  // because ra-core mounts a HashRouter. useSearchParams normally reads the
  // hash's query, but this keeps the token readable if the page is ever
  // rendered outside that router context.
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(hashQuery).get("token") ?? "";
}

/**
 * Email-free onboarding: a user opens the invite link an admin shared, chooses a
 * password, and is logged straight in.
 */
export const SetPasswordPage = () => {
  const { darkModeLogo, title } = useConfigurationContext();
  const [searchParams] = useSearchParams();
  const token = readToken(searchParams.get("token"));
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const notify = useNotify();
  const translate = useTranslate();

  const validate = (values: SetPasswordFormData) => {
    if (values.password !== values.confirmPassword) {
      return {
        password: "crm.auth.password_mismatch",
        confirmPassword: "crm.auth.password_mismatch",
      };
    }
    return {};
  };

  const handleSubmit: SubmitHandler<FieldValues> = async (values) => {
    if (!token) {
      notify("crm.auth.invalid_invite", {
        type: "error",
        messageArgs: { _: "This link is invalid or has expired." },
      });
      return;
    }
    setLoading(true);
    try {
      const { json } = await apiJson<LoginResult>(
        "/api/auth/set-password",
        jsonRequest("POST", { token, password: values.password }),
      );
      establishSession(json);
      // SPA navigation, not a reload: a reload throws away the query cache
      // establishSession just warmed and re-downloads the whole bundle, which
      // is a couple of seconds of white screen right at the end of onboarding.
      navigate("/", { replace: true });
    } catch (error: unknown) {
      setLoading(false);
      notify(errorMessage(error, "ra.auth.sign_in_error"), { type: "error" });
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="relative grid w-full lg:grid-cols-2">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
          <div className="absolute inset-0 bg-zinc-900" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <img className="h-6 mr-2" src={darkModeLogo} alt={title} />
            {title}
          </div>
        </div>
        <div className="flex flex-col justify-center w-full p-4 lg:p-8">
          <div className="w-full space-y-6 lg:mx-auto lg:w-[350px]">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                {translate("crm.auth.choose_password", {
                  _: "Choose your password",
                })}
              </h1>
            </div>
            {token ? (
              <Form
                className="space-y-8"
                onSubmit={handleSubmit}
                validate={validate as any}
              >
                <TextInput
                  label="ra.auth.password"
                  source="password"
                  type="password"
                  validate={required()}
                />
                <TextInput
                  label={translate("crm.auth.confirm_password", {
                    _: "Confirm password",
                  })}
                  source="confirmPassword"
                  type="password"
                  validate={required()}
                />
                <Button
                  type="submit"
                  className="w-full cursor-pointer"
                  disabled={loading}
                >
                  {translate("crm.auth.set_password", {
                    _: "Set password and sign in",
                  })}
                </Button>
              </Form>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {translate("crm.auth.invalid_invite", {
                  _: "This link is invalid or has expired.",
                })}
              </p>
            )}
          </div>
        </div>
      </div>
      <Notification />
    </div>
  );
};

SetPasswordPage.path = "/set-password";
