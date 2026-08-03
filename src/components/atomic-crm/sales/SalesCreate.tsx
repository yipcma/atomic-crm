import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify, useRedirect, useTranslate } from "ra-core";
import type { SubmitHandler } from "react-hook-form";
import { SimpleForm } from "@/components/admin/simple-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CrmDataProvider } from "../providers/types";
import type { SalesFormData } from "../types";
import { ShareLinkDialog } from "../misc/ShareLinkDialog";
import { SalesInputs } from "./SalesInputs";

export function SalesCreate() {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const translate = useTranslate();
  const redirect = useRedirect();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      return dataProvider.salesCreate(data);
    },
    onSuccess: (sale) => {
      const url = (sale as { invite_url?: string }).invite_url;
      if (url) {
        setInviteUrl(url);
      } else {
        notify("resources.sales.create.success", {
          type: "success",
          messageArgs: { _: "User created." },
        });
        redirect("/sales");
      }
    },
    onError: (error) => {
      notify(
        error.message ||
          translate("resources.sales.create.error", {
            _: "An error occurred while creating the user.",
          }),
        {
          type: "error",
        },
      );
    },
  });
  const onSubmit: SubmitHandler<SalesFormData> = async (data) => {
    mutate(data);
  };

  return (
    <div className="max-w-lg w-full mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>
            {translate("resources.sales.create.title", {
              _: "Create a new user",
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleForm onSubmit={onSubmit as SubmitHandler<any>}>
            <SalesInputs />
          </SimpleForm>
        </CardContent>
      </Card>
      <ShareLinkDialog
        open={inviteUrl != null}
        onClose={() => {
          setInviteUrl(null);
          redirect("/sales");
        }}
        title={translate("resources.sales.create.invite_title", {
          _: "User created",
        })}
        description={translate("resources.sales.create.invite_description", {
          _: "Share this link with the new user so they can set their password and sign in.",
        })}
        url={inviteUrl ?? ""}
      />
    </div>
  );
}
