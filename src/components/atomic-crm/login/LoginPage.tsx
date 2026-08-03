import { useEffect, useRef, useState } from "react";
import { Form, required, useLogin, useNotify, useTranslate } from "ra-core";
import type { SubmitHandler, FieldValues } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/admin/text-input";
import { Notification } from "@/components/admin/notification";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext.tsx";
import { ForgotPasswordDialog } from "./ForgotPasswordDialog";

/**
 * Login page displayed when authentication is enabled and the user is not authenticated.
 *
 * Automatically shown when an unauthenticated user tries to access a protected route.
 * Handles login via authProvider.login() and displays error notifications on failure.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/loginpage LoginPage documentation}
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/security Security documentation}
 */
export const LoginPage = (props: { redirectTo?: string }) => {
  const { darkModeLogo, title } = useConfigurationContext();
  const { redirectTo } = props;
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const hasDisplayedRecoveryNotification = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const login = useLogin();
  const notify = useNotify();
  const translate = useTranslate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldNotify = searchParams.get("passwordRecoveryEmailSent") === "1";

    if (!shouldNotify || hasDisplayedRecoveryNotification.current) {
      return;
    }

    hasDisplayedRecoveryNotification.current = true;
    notify("crm.auth.recovery_email_sent", {
      type: "success",
      messageArgs: {
        _: "If you're a registered user, you should receive a password recovery email shortly.",
      },
    });

    searchParams.delete("passwordRecoveryEmailSent");
    const nextSearch = searchParams.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, notify]);

  const handleSubmit: SubmitHandler<FieldValues> = (values) => {
    setLoading(true);
    login(values, redirectTo)
      .then(() => {
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        notify(
          typeof error === "string"
            ? error
            : typeof error === "undefined" || !error.message
              ? "ra.auth.sign_in_error"
              : error.message,
          {
            type: "error",
            messageArgs: {
              _:
                typeof error === "string"
                  ? error
                  : error && error.message
                    ? error.message
                    : undefined,
            },
          },
        );
      });
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
          <div className="relative z-20 mt-auto space-y-6">
            <h2 className="text-3xl font-semibold leading-tight">
              {translate("crm.landing.headline", {
                _: "The simple CRM for growing teams.",
              })}
            </h2>
            <p className="max-w-md text-base text-zinc-300">
              {translate("crm.landing.subheadline", {
                _: "Track contacts, companies and deals, collaborate with your team, and keep every conversation in one place.",
              })}
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li>
                {translate("crm.landing.feature_pipeline", {
                  _: "• Contacts, companies & a visual deal pipeline",
                })}
              </li>
              <li>
                {translate("crm.landing.feature_collab", {
                  _: "• Team notes, tasks & @mentions",
                })}
              </li>
              <li>
                {translate("crm.landing.feature_workspace", {
                  _: "• Your own private organization workspace",
                })}
              </li>
            </ul>
            <p className="text-xs text-zinc-500">
              {translate("crm.landing.built_on", {
                _: "Built on the open-source Atomic CRM stack.",
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-col justify-center w-full p-4 lg:p-8">
          <div className="w-full space-y-6 lg:mx-auto lg:w-[350px]">
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                {translate("ra.auth.sign_in")}
              </h1>
            </div>
            <Form className="space-y-8" onSubmit={handleSubmit}>
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
              <div className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="cursor-pointer"
                  disabled={loading}
                >
                  {translate("ra.auth.sign_in")}
                </Button>
              </div>
            </Form>
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="block w-full text-sm text-center text-muted-foreground hover:underline"
            >
              {translate("crm.auth.forgot_password", {
                _: "Forgot password?",
              })}
            </button>
            <Link
              to="/sign-up"
              className="block w-full text-sm text-center text-muted-foreground hover:underline"
            >
              {translate("crm.auth.create_organization_link", {
                _: "Create an organization",
              })}
            </Link>
          </div>
        </div>
      </div>
      <ForgotPasswordDialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
      <Notification />
    </div>
  );
};
