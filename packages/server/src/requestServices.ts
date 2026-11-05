import type { Schema } from "effect";
import type { Rpc, RpcMiddleware } from "effect/rpc";
import type { Identity, OptionalIdentity, SessionUser, SessionUserWithProviderAccounts } from "@shivaedev/identity/identity.ts";
import type { Subject } from "@shivaedev/identity/subject.ts";

export type RequestContext = Identity | OptionalIdentity | SessionUser | SessionUserWithProviderAccounts | Subject;
export type RequestRequirements<TRpcs extends Rpc.Any, TRequirements> = TRpcs extends unknown
	? Exclude<TRequirements, Rpc.ExtractProvides<TRpcs, TRpcs["_tag"]>>
	: never;
export type GlobalServices<TRequirements, TRequestServices = never> = [Extract<TRequirements, RequestContext | TRequestServices>] extends [never]
	? unknown
	: { readonly "Register caller-dependent services in requestServices": never };

export interface RequestServices<TServices, TRequirements> extends RpcMiddleware.AnyId {
	readonly [RpcMiddleware.TypeId]: {
		readonly provides: TServices;
		readonly requires: TRequirements;
		readonly error: typeof Schema.Never;
		readonly clientError: never;
	};
}
