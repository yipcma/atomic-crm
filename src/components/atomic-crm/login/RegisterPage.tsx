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
import { CheckYourEmail } from "./CheckYourEmail";

interface RegisterFormData {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirmPassword: string;
}

/** Self-registration from a generic invite link shared by an administrator. */
export const RegisterPage = () => {
  const { darkModeLogo, title } = useConfigurationContext();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const notify = useNotify();
  const translate = useTranslate();

  const validate = (values: RegisterFormData) => {
    if (values.password !== values.confirmPassword) {
      return {
        password: "crm.auth.password_mismatch",
        confirmPassword: "crm.auth.password_mismatch",
      };
    }
    return {};
  };

  const handleSubmit: SubmitHandler<FieldValues> = async (values) => {
    setLoading(true);
    try {
      const { json } = await apiJson<LoginResult & { verify?: boolean }>(
        "/api/auth/register",
        jsonRequest("POST", {
          token,
          email: values.email,
          first_name: values.first_name,
          last_name: values.last_name,
          password: values.password,
        }),
      );
      if (json.verify) {
        setVerifyEmail(values.email);
        return;
      }
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

  if (verifyEmail) {
    return <CheckYourEmail email={verifyEmail} />;
  }

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
                {translate("crm.auth.create_account", {
                  _: "Create your account",
                })}
              </h1>
            </div>
            {token ? (
              <Form
                className="space-y-6"
                onSubmit={handleSubmit}
                validate={validate as any}
              >
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    label={translate("crm.auth.first_name", {
                      _: "First name",
                    })}
                    source="first_name"
                    validate={required()}
                  />
                  <TextInput
                    label={translate("crm.auth.last_name", {
                      _: "Last name",
                    })}
                    source="last_name"
                    validate={required()}
                  />
                </div>
                <TextInput
                  label="ra.auth.email"
                  source="email"
                  type="email"
                  validate={required()}
                />
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
                  {translate("crm.auth.create_account", {
                    _: "Create account",
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

RegisterPage.path = "/register";
