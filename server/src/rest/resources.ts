export interface ResourceDef {
  table: string; // write target
  readSource: string; // table or summary view used for reads
}

// Resources exposed under /api/:resource. Reads for contacts/companies use the
// summary views (aggregated counts + FTS columns); writes target the base table.
export const RESOURCES: Record<string, ResourceDef> = {
  companies: { table: "companies", readSource: "companies_summary" },
  contacts: { table: "contacts", readSource: "contacts_summary" },
  contact_notes: { table: "contact_notes", readSource: "contact_notes" },
  deals: { table: "deals", readSource: "deals" },
  deal_notes: { table: "deal_notes", readSource: "deal_notes" },
  tasks: { table: "tasks", readSource: "tasks" },
  sales: { table: "sales", readSource: "sales" },
  tags: { table: "tags", readSource: "tags" },
  activity_log: { table: "activity_log", readSource: "activity_log" },
};

export function getResource(name: string): ResourceDef | undefined {
  return RESOURCES[name];
}

// Tenant isolation in crud.ts appends `organization_id = $n` unconditionally.
// That is only safe if every exposed source actually has the column, so prove
// it at boot: a resource added without it must crash the deploy rather than
// silently serve every tenant's rows.
export function assertTenantScoped(
  hasColumn: (source: string, column: string) => boolean,
): void {
  const missing: string[] = [];
  for (const [name, def] of Object.entries(RESOURCES)) {
    for (const source of new Set([def.table, def.readSource])) {
      if (!hasColumn(source, "organization_id")) {
        missing.push(`${name} -> ${source}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Refusing to start: these resources have no organization_id column, ` +
        `so they cannot be tenant-scoped: ${missing.join(", ")}`,
    );
  }
}
