import { Schema } from "effect";
import { permission } from "#permission.ts";

export const AssignRoles = permission("roles.assign");
export class LastRoleAssigner extends Schema.TaggedError<LastRoleAssigner>()("LastRoleAssigner", { userId: Schema.String }) {}
