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
  configuration: { table: "configuration", readSource: "configuration" },
  activity_log: { table: "activity_log", readSource: "activity_log" },
};

export function getResource(name: string): ResourceDef | undefined {
  return RESOURCES[name];
}
