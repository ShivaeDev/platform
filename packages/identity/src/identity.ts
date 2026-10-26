import { Context, type Effect, type Option } from "effect";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
export class RequestId extends Context.Service<RequestId, string>()("@shivaedev/identity/RequestId") {}
export interface IdentityValue {
	readonly id: string;
}
export class Identity extends Context.Service<Identity, IdentityValue>()("@shivaedev/identity/Identity") {}
export class OptionalIdentity extends Context.Service<OptionalIdentity, Option.Option<IdentityValue>>()("@shivaedev/identity/OptionalIdentity") {}
export interface ProviderAccountValue {
	readonly accountId: string;
	readonly providerId: string;
}
export interface SessionUserValue extends IdentityValue {
	readonly email: string;
	readonly name: string;
	readonly permissions?: readonly Permission[];
	readonly role?: string | null | undefined;
}
export class SessionUser extends Context.Service<SessionUser, SessionUserValue>()("@shivaedev/identity/SessionUser") {}
export interface SessionUserWithProviderAccountsValue extends SessionUserValue {
	readonly providerAccounts: Effect.Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>;
}
export class SessionUserWithProviderAccounts extends Context.Service<SessionUserWithProviderAccounts, SessionUserWithProviderAccountsValue>()(
	"@shivaedev/identity/SessionUserWithProviderAccounts",
) {}
