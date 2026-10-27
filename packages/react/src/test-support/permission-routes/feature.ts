import { Schema } from "effect";
import { permission } from "@shivaedev/access/permission.ts";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";

export const ReadNotes = permission("notes.read");
export const Roles = roleSet(role("reader", [ReadNotes]), role("guest", []), role("supervisor", [ReadNotes.any]));
export type Role = typeof Roles.Role.Type;
export class ReadPermission extends permissionMiddleware<ReadPermission>()("test/ReadNotes", ReadNotes) {}
const Get = query("get", { payload: { id: Schema.String }, reads: () => [], rejections: { ServiceUnavailable }, success: Schema.String });
export const Notes = contract("permissionNotes", { queries: [Get] }).middleware(ReadPermission);
