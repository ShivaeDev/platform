import { Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { Identity, OptionalIdentity, RequestId, SessionUser, SessionUserWithProviderAccounts } from "./identity.ts";
export const IdentityFailures = Schema.Union([Unauthorized, AuthUnavailable, Forbidden, MissingReadPolicy, QueryReadDenied]);
export type IdentityFailures = typeof IdentityFailures.Type;

export class RequestTracing extends RpcMiddleware.Service<
	RequestTracing,
	{
		provides: RequestId;
	}
>()("@shivaedev/identity/RequestTracing") {}
export class Authenticated extends RpcMiddleware.Service<
	Authenticated,
	{
		provides: Identity;
	}
>()("@shivaedev/identity/Authenticated", {
	error: IdentityFailures,
}) {}
export class MaybeAuthenticated extends RpcMiddleware.Service<
	MaybeAuthenticated,
	{
		provides: OptionalIdentity;
	}
>()("@shivaedev/identity/MaybeAuthenticated", {
	error: IdentityFailures,
}) {}
export class AuthenticatedUser extends RpcMiddleware.Service<
	AuthenticatedUser,
	{
		provides: Identity | SessionUser;
	}
>()("@shivaedev/identity/AuthenticatedUser", {
	error: IdentityFailures,
}) {}
export class AuthenticatedUserWithProviderAccounts extends RpcMiddleware.Service<
	AuthenticatedUserWithProviderAccounts,
	{ provides: Identity | SessionUser | SessionUserWithProviderAccounts }
>()("@shivaedev/identity/AuthenticatedUserWithProviderAccounts", {
	error: IdentityFailures,
}) {}
