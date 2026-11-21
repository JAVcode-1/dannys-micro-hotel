import { readFileSync } from "node:fs";
import { format } from "prettier";

// Local catalog introspection: no Supabase remote CLI or hosted credentials.
export async function generateIsolatedTypes(db) {
  const tables = (
    await db.query(
      `select c.relname name,c.relkind kind from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='staytrack' and c.relkind in ('r','v','m','p') order by c.relname`,
    )
  ).rows;
  const columns = (
    await db.query(
      `select table_name,column_name,is_nullable,column_default,is_identity,identity_generation,is_generated,udt_name from information_schema.columns where table_schema='staytrack' order by table_name,ordinal_position`,
    )
  ).rows;
  const fks = (
    await db.query(`select t.relname as table_name,k.conname,
    array(select a.attname from unnest(k.conkey) with ordinality x(attnum,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.attnum order by x.ord) as columns,
    rt.relname as referenced_relation,
    array(select a.attname from unnest(k.confkey) with ordinality x(attnum,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.attnum order by x.ord) as referenced_columns,
    exists(select 1 from pg_constraint u where u.conrelid=k.conrelid and u.contype in ('p','u') and u.conkey=k.conkey) as one_to_one
    from pg_constraint k join pg_class t on t.oid=k.conrelid join pg_namespace n on n.oid=t.relnamespace join pg_class rt on rt.oid=k.confrelid where n.nspname='staytrack' and k.contype='f' order by t.relname,k.conname`)
  ).rows;
  function type(column) {
    const name = column.udt_name;
    if (name.startsWith("_"))
      return (
        "(" +
        type({ ...column, udt_name: name.slice(1), is_nullable: "NO" }) +
        ")[]" +
        (column.is_nullable === "YES" ? " | null" : "")
      );
    const mapped = {
      int2: "number",
      int4: "number",
      int8: "number",
      numeric: "number",
      float4: "number",
      float8: "number",
      bool: "boolean",
      json: "Json",
      jsonb: "Json",
      uuid: "string",
      text: "string",
      varchar: "string",
      bpchar: "string",
      timestamptz: "string",
      timestamp: "string",
      date: "string",
      time: "string",
      timetz: "string",
      interval: "string",
      bytea: "string",
      tstzrange: "string",
      int8range: "string",
    }[name];
    if (!mapped) throw new Error("Unmapped PostgreSQL type: " + name);
    return mapped + (column.is_nullable === "YES" ? " | null" : "");
  }
  function relation(table, view = false) {
    const fields = columns.filter((c) => c.table_name === table.name);
    const row =
      "{" +
      fields
        .map((c) => JSON.stringify(c.column_name) + ":" + type(c))
        .join(";") +
      "}";
    const write = (mode) =>
      "{" +
      fields
        .map(
          (c) =>
            JSON.stringify(c.column_name) +
            (mode === "Update" ||
            c.column_default !== null ||
            c.is_nullable === "YES" ||
            c.is_identity === "YES" ||
            c.is_generated !== "NEVER"
              ? "?"
              : "") +
            ":" +
            (c.identity_generation === "ALWAYS" || c.is_generated !== "NEVER"
              ? "never"
              : type(c)),
        )
        .join(";") +
      "}";
    const relationships = fks
      .filter((f) => f.table_name === table.name)
      .map(
        (f) =>
          `{foreignKeyName:${JSON.stringify(f.conname)};columns:${JSON.stringify(f.columns)};isOneToOne:${f.one_to_one};referencedRelation:${JSON.stringify(f.referenced_relation)};referencedColumns:${JSON.stringify(f.referenced_columns)}}`,
      )
      .join(",");
    return (
      JSON.stringify(table.name) +
      ":{Row:" +
      row +
      (view
        ? ""
        : ";Insert:" + write("Insert") + ";Update:" + write("Update")) +
      ";Relationships:[" +
      relationships +
      "]}"
    );
  }
  const old = readFileSync(
    new URL("../packages/shared/src/database.types.ts", import.meta.url),
    "utf8",
  );
  const helpers = old.slice(old.indexOf("type DatabaseWithoutInternals"));
  return format(
    `// Generated from the fully migrated disposable PostgreSQL schema. Regenerate with scripts/generate-isolated-types.mjs through the isolated suite.
  export type Json=string|number|boolean|null|{[key:string]:Json|undefined}|Json[];
  export type Database={public:{Tables:{[_ in never]:never};Views:{[_ in never]:never};Functions:{[_ in never]:never};Enums:{[_ in never]:never};CompositeTypes:{[_ in never]:never}};staytrack:{Tables:{${tables
    .filter((t) => ["r", "p"].includes(t.kind))
    .map((t) => relation(t))
    .join(";")}};Views:{${tables
    .filter((t) => ["v", "m"].includes(t.kind))
    .map((t) => relation(t, true))
    .join(
      ";",
    )}};Functions:{[_ in never]:never};Enums:{[_ in never]:never};CompositeTypes:{[_ in never]:never}}};
  ${helpers}`,
    { parser: "typescript" },
  );
}
