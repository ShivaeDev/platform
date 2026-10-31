import type { Effect, Option } from "effect";
import type { QueryReadPolicy, Viewer } from "#readPolicy.ts";

const PermissionReadPolicyId = Symbol.for("@shivaedev/contract/PermissionReadPolicy");

export interface PermissionReadPolicy<TPayload, E = never, R = never> extends QueryReadPolicy<TPayload, E, R> {
	readonly [PermissionReadPolicyId]: true;
}

export function permissionReadPolicy<TPermission extends { readonly name: string }, E, R>(
	permission: TPermission,
	check: (permission: TPermission, viewer: Option.Option<Viewer>) => Effect.Effect<boolean, E, R>,
): PermissionReadPolicy<unknown, E, R> {
	return Object.assign((_payload: unknown, viewer: Option.Option<Viewer>) => check(permission, viewer), {
		[PermissionReadPolicyId]: true as const,
	});
}

export type CollectionReads<TPayload, E, R> =
	| { readonly readsCollections?: never; readonly readPolicy: QueryReadPolicy<TPayload, E, R> }
	| {
			readonly readsCollections: readonly { readonly name: string }[];
			readonly readPolicy: PermissionReadPolicy<TPayload, E, R>;
	  };
