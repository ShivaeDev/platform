import { Schema } from "effect";
import { Permission } from "@shivaedev/access/permission.ts";

export const PermissionSession = Schema.Struct({
	user: Schema.Struct({ permissions: Schema.optionalKey(Schema.Array(Permission)) }),
});
export type PermissionSession = typeof PermissionSession.Type;
