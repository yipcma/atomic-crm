import { useCallback, useEffect, useState } from "react";
import { useGetIdentity, useNotify, useTranslate } from "ra-core";
import { Navigate } from "react-router";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  apiJson,
  jsonRequest,
} from "@/components/atomic-crm/providers/railway/httpClient";
import type { Identity } from "@/components/atomic-crm/providers/railway/authProvider";

interface AdminOrganization {
  id: number;
  name: string;
  user_count: number;
  disabled: boolean;
  created_at?: string;
}

/** Platform-admin console: list every organization and enable/disable it. */
export const SuperAdminOrganizations = () => {
  const { identity, isPending } = useGetIdentity();
  const translate = useTranslate();
  const notify = useNotify();
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = (identity as Identity | undefined)?.super_admin === true;

  const load = useCallback(async () => {
    try {
      const { json } = await apiJson<AdminOrganization[]>(
        "/api/admin/organizations",
      );
      setOrganizations(json);
    } catch (error: any) {
      notify(error?.message ?? "ra.notification.http_error", { type: "error" });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (isSuperAdmin) {
      load();
    }
  }, [isSuperAdmin, load]);

  const toggleDisabled = async (org: AdminOrganization, disabled: boolean) => {
    // Optimistic update.
    setOrganizations((prev) =>
      prev.map((o) => (o.id === org.id ? { ...o, disabled } : o)),
    );
    try {
      await apiJson(
        `/api/admin/organizations/${org.id}`,
        jsonRequest("PATCH", { disabled }),
      );
    } catch (error: any) {
      // Revert on failure.
      setOrganizations((prev) =>
        prev.map((o) => (o.id === org.id ? { ...o, disabled: !disabled } : o)),
      );
      notify(error?.message ?? "ra.notification.http_error", { type: "error" });
    }
  };

  if (isPending) {
    return null;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-4 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate("crm.superadmin.organizations_title", {
            _: "Organizations",
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("crm.superadmin.organizations_subtitle", {
            _: "Enable or disable organizations across the platform.",
          })}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {translate("crm.superadmin.organization", { _: "Organization" })}
            </TableHead>
            <TableHead className="text-right">
              {translate("crm.superadmin.users", { _: "Users" })}
            </TableHead>
            <TableHead className="text-right">
              {translate("crm.superadmin.active", { _: "Active" })}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">{org.name}</TableCell>
              <TableCell className="text-right">{org.user_count}</TableCell>
              <TableCell className="text-right">
                <Switch
                  checked={!org.disabled}
                  onCheckedChange={(checked) => toggleDisabled(org, !checked)}
                  aria-label={translate("crm.superadmin.toggle_active", {
                    _: "Toggle organization active state",
                  })}
                />
              </TableCell>
            </TableRow>
          ))}
          {!loading && organizations.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-center text-muted-foreground"
              >
                {translate("crm.superadmin.no_organizations", {
                  _: "No organizations found.",
                })}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

SuperAdminOrganizations.path = "/admin/organizations";
