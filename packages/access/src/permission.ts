import { Schema } from "effect";

export const Permission = Schema.Struct({ name: Schema.String, strength: Schema.Literals(["own", "any"]) });
export type Permission = typeof Permission.Type;

export interface OwnPermission extends Permission {
	readonly any: Permission;
	readonly strength: "own";
}

export function permission<const TName extends `${string}.${string}`>(name: TName) {
	return { any: { name, strength: "any" }, name, strength: "own" } as const;
}

export function hasPermission(grants: readonly Permission[] | undefined, required: Permission): boolean {
	return grants?.some((grant) => grant.name === required.name && (grant.strength === "any" || grant.strength === required.strength)) ?? false;
}
