import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { UserPlus } from "lucide-react";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SearchInput } from "@/components/admin/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { TopToolbar } from "../layout/TopToolbar";
import { ShareLinkDialog } from "../misc/ShareLinkDialog";
import type { CrmDataProvider } from "../providers/types";

const InviteLinkButton = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const translate = useTranslate();
  const [url, setUrl] = useState<string | null>(null);

  const generate = async () => {
    try {
      setUrl(await dataProvider.genericInvite());
    } catch {
      notify("resources.sales.invite.error", {
        type: "error",
        messageArgs: { _: "Could not generate an invite link." },
      });
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={generate}>
        <UserPlus />
        {translate("resources.sales.action.invite_link", {
          _: "Invite link",
        })}
      </Button>
      <ShareLinkDialog
        open={url != null}
        onClose={() => setUrl(null)}
        title={translate("resources.sales.invite.title", {
          _: "Share invite link",
        })}
        description={translate("resources.sales.invite.description", {
          _: "Anyone with this link can create their own (non-admin) account until it expires.",
        })}
        url={url ?? ""}
      />
    </>
  );
};

const SalesListActions = () => (
  <TopToolbar>
    <InviteLinkButton />
    <ExportButton />
    <CreateButton label="resources.sales.action.new" />
  </TopToolbar>
);

const filters = [<SearchInput source="q" alwaysOn />];

const OptionsField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext();
  const translate = useTranslate();
  if (!record) return null;
  return (
    <div className="flex flex-row gap-1">
      {record.administrator && (
        <Badge
          variant="outline"
          className="border-blue-300 dark:border-blue-700"
        >
          {translate("resources.sales.fields.administrator")}
        </Badge>
      )}
      {record.disabled && (
        <Badge
          variant="outline"
          className="border-orange-300 dark:border-orange-700"
        >
          {translate("resources.sales.fields.disabled")}
        </Badge>
      )}
    </div>
  );
};

export function SalesList() {
  return (
    <List
      filters={filters}
      actions={<SalesListActions />}
      sort={{ field: "first_name", order: "ASC" }}
    >
      <DataTable>
        <DataTable.Col source="first_name" />
        <DataTable.Col source="last_name" />
        <DataTable.Col source="email" />
        <DataTable.Col label={false}>
          <OptionsField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}
