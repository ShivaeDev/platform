import { Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import type { Identity, OptionalIdentity, RequestId, SessionUser, SessionUserWithProviderAccounts } from "./identity.ts";
export class RequestTracing extends RpcMiddleware.Service<
	RequestTracing,
	{
		provides: RequestId;
	}
>()("@shivaedev/platform/rpc/RequestTracing") {}
export class Authenticated extends RpcMiddleware.Service<
	Authenticated,
	{
		provides: Identity;
	}
>()("@shivaedev/platform/rpc/Authenticated", {
	error: Schema.Union([Unauthorized, AuthUnavailable, Forbidden]),
}) {}
export class MaybeAuthenticated extends RpcMiddleware.Service<
	MaybeAuthenticated,
	{
		provides: OptionalIdentity;
	}
>()("@shivaedev/platform/rpc/MaybeAuthenticated", { error: Schema.Union([AuthUnavailable, Forbidden]) }) {}
export class AuthenticatedUser extends RpcMiddleware.Service<
	AuthenticatedUser,
	{
		provides: Identity | SessionUser;
	}
>()("@shivaedev/platform/rpc/AuthenticatedUser", {
	error: Schema.Union([Unauthorized, AuthUnavailable, Forbidden]),
}) {}
export class AuthenticatedUserWithProviderAccounts extends RpcMiddleware.Service<
	AuthenticatedUserWithProviderAccounts,
	{ provides: Identity | SessionUser | SessionUserWithProviderAccounts }
>()("@shivaedev/platform/rpc/AuthenticatedUserWithProviderAccounts", {
	error: Schema.Union([Unauthorized, AuthUnavailable, Forbidden]),
}) {}
