import { db } from "./index";

// Run a SELECT and return all rows as plain objects
export function query(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Return just the first row, or null
export function queryOne(sql: string, params: any[] = []): any | null {
  return query(sql, params)[0] ?? null;
}
