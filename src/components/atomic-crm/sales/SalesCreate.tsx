import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useNotify, useRedirect, useTranslate } from "ra-core";
import type { SubmitHandler } from "react-hook-form";
import { SimpleForm } from "@/components/admin/simple-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CrmDataProvider } from "../providers/types";
import type { SalesFormData } from "../types";
import { SalesInputs } from "./SalesInputs";

export function SalesCreate() {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const translate = useTranslate();
  const redirect = useRedirect();

  const { mutate } = useMutation({
    mutationKey: ["signup"],
    mutationFn: async (data: SalesFormData) => {
      return dataProvider.salesCreate(data);
    },
    onSuccess: (sale) => {
      const inviteUrl = (sale as { invite_url?: string }).invite_url;
      notify("resources.sales.create.success", {
        type: "success",
        autoHideDuration: inviteUrl ? 0 : undefined,
        messageArgs: {
          _: inviteUrl
            ? `User created. Share this link so they can set their password: ${inviteUrl}`
            : "User created.",
        },
      });
      redirect("/sales");
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
    </div>
  );
}
