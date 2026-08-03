import { query } from "./db.js";

export interface ColumnMeta {
  name: string;
  dataType: string; // e.g. "ARRAY", "jsonb", "bigint"
  udtName: string; // e.g. "_int8", "jsonb", "_jsonb"
  isArray: boolean;
  isJson: boolean;
  isJsonArray: boolean;
  isBigintArray: boolean;
}

// source (table or view) -> column name -> metadata
const columnsBySource = new Map<string, Map<string, ColumnMeta>>();

export async function loadColumns(): Promise<void> {
  const { rows } = await query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
  }>(
    `select table_name, column_name, data_type, udt_name
     from information_schema.columns
     where table_schema = 'public'`,
  );

  columnsBySource.clear();
  for (const row of rows) {
    let map = columnsBySource.get(row.table_name);
    if (!map) {
      map = new Map();
      columnsBySource.set(row.table_name, map);
    }
    const isArray = row.data_type === "ARRAY";
    map.set(row.column_name, {
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isArray,
      isJson: row.udt_name === "jsonb" || row.udt_name === "json",
      isJsonArray: row.udt_name === "_jsonb" || row.udt_name === "_json",
      isBigintArray: row.udt_name === "_int8",
    });
  }
}

export function getColumns(source: string): Map<string, ColumnMeta> {
  return columnsBySource.get(source) ?? new Map();
}

export function hasColumn(source: string, column: string): boolean {
  return columnsBySource.get(source)?.has(column) ?? false;
}

export function getColumn(
  source: string,
  column: string,
): ColumnMeta | undefined {
  return columnsBySource.get(source)?.get(column);
}
