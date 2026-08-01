import {
  withLifecycleCallbacks,
  type DataProvider,
  type Identifier,
  type ResourceCallbacks,
} from "ra-core";
import type {
  ContactNote,
  Deal,
  DealNote,
  RAFile,
  Sale,
  SalesFormData,
  SignUpData,
} from "../../types";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { apiJson, jsonRequest, setTokens } from "./httpClient";
import { getIsInitialized } from "./authProvider";

// Full-text search: mirror the Supabase provider by turning `q` into an OR of
// ILIKE conditions over the resource's searchable columns.
const SEARCH_COLUMNS: Record<string, string[]> = {
  contacts: [
    "first_name",
    "last_name",
    "company_name",
    "title",
    "email",
    "phone",
    "background",
  ],
  companies: [
    "name",
    "phone_number",
    "website",
    "zipcode",
    "city",
    "state_abbr",
  ],
  deals: ["name", "category", "description"],
};

function applyFullTextSearch(
  resource: string,
  filter: Record<string, any> | undefined,
): Record<string, any> {
  const columns = SEARCH_COLUMNS[resource];
  if (!columns || !filter?.q) {
    return filter ?? {};
  }
  const { q, ...rest } = filter;
  return {
    ...rest,
    "@or": columns.reduce((acc: Record<string, any>, column) => {
      const key =
        column === "email"
          ? "email_fts@ilike"
          : column === "phone"
            ? "phone_fts@ilike"
            : `${column}@ilike`;
      return { ...acc, [key]: q };
    }, {}),
  };
}

function remapActivity(row: any) {
  return {
    ...row,
    contactNote: row.contact_note ?? undefined,
    dealNote: row.deal_note ?? undefined,
    contact_note: undefined,
    deal_note: undefined,
  };
}

// Turn an invite token into a shareable set-password URL (email-free onboarding).
// Path-based: ra-core mounts a BrowserRouter, so these are real routes.
function inviteUrl(token: string): string {
  return `${window.location.origin}/set-password?token=${encodeURIComponent(token)}`;
}

// Turn a generic invite token into a shareable self-registration URL.
function registerUrl(token: string): string {
  return `${window.location.origin}/register?token=${encodeURIComponent(token)}`;
}

function parseTotal(headers: Headers, fallback: number): number {
  const range = headers.get("Content-Range");
  const total = range?.split("/")[1];
  return total ? Number(total) : fallback;
}

async function uploadToBucket(fi: RAFile): Promise<RAFile> {
  // Already stored on our backend: nothing to do.
  if (
    fi.path &&
    fi.src &&
    !fi.src.startsWith("blob:") &&
    !fi.src.startsWith("data:")
  ) {
    return fi;
  }

  let file: File | null = fi.rawFile instanceof File ? fi.rawFile : null;

  if (!file && fi.src) {
    const blob = await fetch(fi.src)
      .then((res) => (res.ok ? res.blob() : null))
      .catch(() => null);
    if (!blob) return fi;
    file = new File([blob], fi.title || "file", { type: blob.type });
  }

  if (!file) return fi;

  const form = new FormData();
  form.append("file", file);
  const { json } = await apiJson<{ path: string; src: string; type: string }>(
    "/storage/upload",
    { method: "POST", body: form },
  );

  fi.path = json.path;
  fi.src = json.src;
  fi.type = json.type;
  return fi;
}

const baseDataProvider: DataProvider = {
  async getList(resource, params) {
    const { page = 1, perPage = 25 } = params.pagination ?? {};
    const { field = "id", order = "ASC" } = params.sort ?? {};
    const filter = applyFullTextSearch(resource, params.filter);
    const query = new URLSearchParams({
      filter: JSON.stringify(filter),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      sort: JSON.stringify([field, order]),
    });
    const { json, headers } = await apiJson<any[]>(
      `/api/${resource}?${query.toString()}`,
    );
    return { data: json, total: parseTotal(headers, json.length) };
  },

  async getOne(resource, params) {
    const { json } = await apiJson(`/api/${resource}/${params.id}`);
    return { data: json };
  },

  async getMany(resource, params) {
    const query = new URLSearchParams({
      filter: JSON.stringify({ id: params.ids }),
      range: JSON.stringify([0, 10000]),
    });
    const { json } = await apiJson<any[]>(
      `/api/${resource}?${query.toString()}`,
    );
    return { data: json };
  },

  async getManyReference(resource, params) {
    const { page = 1, perPage = 25 } = params.pagination ?? {};
    const { field = "id", order = "ASC" } = params.sort ?? {};
    const filter = {
      ...applyFullTextSearch(resource, params.filter),
      [params.target]: params.id,
    };
    const query = new URLSearchParams({
      filter: JSON.stringify(filter),
      range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      sort: JSON.stringify([field, order]),
    });
    const { json, headers } = await apiJson<any[]>(
      `/api/${resource}?${query.toString()}`,
    );
    return { data: json, total: parseTotal(headers, json.length) };
  },

  async create(resource, params) {
    const { json } = await apiJson(
      `/api/${resource}`,
      jsonRequest("POST", params.data),
    );
    return { data: json };
  },

  async update(resource, params) {
    const { json } = await apiJson(
      `/api/${resource}/${params.id}`,
      jsonRequest("PUT", params.data),
    );
    return { data: json };
  },

  async updateMany(resource, params) {
    await Promise.all(
      params.ids.map((id) =>
        apiJson(`/api/${resource}/${id}`, jsonRequest("PUT", params.data)),
      ),
    );
    return { data: params.ids };
  },

  async delete(resource, params) {
    const { json } = await apiJson(`/api/${resource}/${params.id}`, {
      method: "DELETE",
    });
    return { data: json };
  },

  async deleteMany(resource, params) {
    await Promise.all(
      params.ids.map((id) =>
        apiJson(`/api/${resource}/${id}`, { method: "DELETE" }),
      ),
    );
    return { data: params.ids };
  },
};

const getDataProviderWithCustomMethods = () => ({
  ...baseDataProvider,

  async getList(resource: string, params: any) {
    if (resource === "activity_log") {
      const { data, total } = await baseDataProvider.getList(
        "activity_log",
        params,
      );
      return { data: data.map(remapActivity), total };
    }
    return baseDataProvider.getList(resource, params);
  },

  // Deleting a sale removes its auth user too, via the dedicated users endpoint.
  async delete(resource: string, params: any) {
    if (resource === "sales") {
      const { json } = await apiJson(`/api/users/${params.id}`, {
        method: "DELETE",
      });
      return { data: json?.data ?? { id: params.id } };
    }
    return baseDataProvider.delete(resource, params);
  },

  async deleteMany(resource: string, params: any) {
    if (resource === "sales") {
      await Promise.all(
        params.ids.map((id: Identifier) =>
          apiJson(`/api/users/${id}`, { method: "DELETE" }),
        ),
      );
      return { data: params.ids };
    }
    return baseDataProvider.deleteMany(resource, params);
  },

  // Generate a generic, shareable link that lets anyone self-register.
  async genericInvite(): Promise<string> {
    const { json } = await apiJson<{ invite_token: string }>(
      "/api/users/generic-invite",
      jsonRequest("POST", {}),
    );
    return registerUrl(json.invite_token);
  },

  async signUp({
    email,
    password,
    first_name,
    last_name,
    organization_name,
  }: SignUpData) {
    const { json } = await apiJson<{
      verify?: boolean;
      access_token?: string;
      refresh_token?: string;
    }>(
      "/api/auth/signup",
      jsonRequest("POST", {
        email,
        password,
        first_name,
        last_name,
        organization_name,
      }),
    );
    if (json.verify) {
      return { verify: true };
    }
    setTokens(json.access_token as string, json.refresh_token as string);
    return { verify: false };
  },

  // Public request to (re)send an account verification email.
  async resendVerification(email: string): Promise<void> {
    await apiJson(
      "/api/auth/resend-verification",
      jsonRequest("POST", { email }),
    );
  },

  async salesCreate(body: SalesFormData) {
    const { json } = await apiJson<{ data: Sale; invite_token: string }>(
      "/api/users",
      jsonRequest("POST", body),
    );
    return {
      ...json.data,
      invite_url: inviteUrl(json.invite_token),
    } as Sale;
  },

  async salesUpdate(
    id: Identifier,
    data: Partial<Omit<SalesFormData, "password">>,
  ) {
    const { email, first_name, last_name, administrator, avatar, disabled } =
      data;
    const { json } = await apiJson<{ data: Sale }>(
      "/api/users",
      jsonRequest("PATCH", {
        sales_id: id,
        email,
        first_name,
        last_name,
        administrator,
        disabled,
        avatar,
      }),
    );
    return json.data;
  },

  // Reset a password: emails a link when configured, else returns a copy link.
  async updatePassword(id: Identifier) {
    const { json } = await apiJson<{
      data: boolean;
      emailed: boolean;
      invite_token?: string;
    }>("/api/update_password", jsonRequest("PATCH", { sales_id: id }));
    return {
      emailed: json.emailed,
      url: json.invite_token ? inviteUrl(json.invite_token) : undefined,
    };
  },

  // Public request to email a password-reset link (used by the login page).
  async forgotPassword(email: string): Promise<void> {
    await apiJson("/api/auth/forgot-password", jsonRequest("POST", { email }));
  },

  async unarchiveDeal(deal: Deal) {
    const { data: deals } = await baseDataProvider.getList<Deal>("deals", {
      filter: { stage: deal.stage },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "index", order: "ASC" },
    });

    const updatedDeals = deals.map((d, index) => ({
      ...d,
      index: d.id === deal.id ? 0 : index + 1,
      archived_at: d.id === deal.id ? null : d.archived_at,
    }));

    return Promise.all(
      updatedDeals.map((updatedDeal) =>
        baseDataProvider.update("deals", {
          id: updatedDeal.id,
          data: updatedDeal,
          previousData: deals.find((d) => d.id === updatedDeal.id),
        }),
      ),
    );
  },

  async isInitialized() {
    return getIsInitialized();
  },

  async mergeContacts(sourceId: Identifier, targetId: Identifier) {
    const { json } = await apiJson(
      "/api/merge_contacts",
      jsonRequest("POST", { loserId: sourceId, winnerId: targetId }),
    );
    return json;
  },

  async getConfiguration(): Promise<ConfigurationContextValue> {
    const { json } = await apiJson<{ config: ConfigurationContextValue }>(
      "/api/configuration/1",
    );
    return json?.config ?? ({} as ConfigurationContextValue);
  },

  async updateConfiguration(
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue> {
    const { json } = await apiJson<{ config: ConfigurationContextValue }>(
      "/api/configuration/1",
      jsonRequest("PUT", { config }),
    );
    return json.config;
  },
});

export type CrmDataProvider = ReturnType<
  typeof getDataProviderWithCustomMethods
>;

const processConfigLogo = async (logo: any): Promise<string> => {
  if (typeof logo === "string") return logo;
  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
    return logo.src;
  }
  return logo?.src ?? "";
};

const processCompanyLogo = async (params: any) => {
  const logo = params.data.logo;
  if (logo?.rawFile instanceof File) {
    await uploadToBucket(logo);
  }
  return { ...params, data: { ...params.data, logo } };
};

const lifeCycleCallbacks: ResourceCallbacks[] = [
  {
    resource: "configuration",
    beforeUpdate: async (params) => {
      const config = params.data.config;
      if (config) {
        config.lightModeLogo = await processConfigLogo(config.lightModeLogo);
        config.darkModeLogo = await processConfigLogo(config.darkModeLogo);
      }
      return params;
    },
  },
  {
    resource: "contact_notes",
    beforeSave: async (data: ContactNote) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "deal_notes",
    beforeSave: async (data: DealNote) => {
      if (data.attachments) {
        data.attachments = await Promise.all(
          data.attachments.map((fi) => uploadToBucket(fi)),
        );
      }
      return data;
    },
  },
  {
    resource: "sales",
    beforeSave: async (data: Sale) => {
      if (data.avatar) {
        await uploadToBucket(data.avatar);
      }
      return data;
    },
  },
  {
    resource: "contacts",
    beforeSave: async (data: any) => {
      // Only upload a freshly picked image; leave enrichment URLs untouched.
      if (data.avatar?.rawFile instanceof File) {
        await uploadToBucket(data.avatar);
      }
      return data;
    },
  },
  {
    resource: "companies",
    beforeCreate: async (params) => {
      const createParams = await processCompanyLogo(params);
      return {
        ...createParams,
        data: {
          created_at: new Date().toISOString(),
          ...createParams.data,
        },
      };
    },
    beforeUpdate: async (params) => processCompanyLogo(params),
  },
];

export const getDataProvider = (): CrmDataProvider =>
  withLifecycleCallbacks(
    getDataProviderWithCustomMethods(),
    lifeCycleCallbacks,
  ) as CrmDataProvider;
