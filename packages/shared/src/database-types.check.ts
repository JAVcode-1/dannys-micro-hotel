import type { Tables, TablesInsert, TablesUpdate } from "./database.types.js";

type Category = Tables<{ schema: "staytrack" }, "room_categories">;
type NewPackage = TablesInsert<{ schema: "staytrack" }, "packages">;
type PackageUpdate = TablesUpdate<{ schema: "staytrack" }, "packages">;

const categoryCode: Category["code"] = "double_standard";
const duration: NewPackage["duration_minutes"] = 180;
const active: PackageUpdate["active"] = true;
void [categoryCode, duration, active];
