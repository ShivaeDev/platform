import { Context, type Effect, type Option } from "effect";
import type { AuthUnavailable, Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
export class RequestId extends Context.Service<RequestId, string>()("@shivaedev/platform/rpc/RequestId") {}
export interface IdentityValue {
	readonly id: string;
}
export class Identity extends Context.Service<Identity, IdentityValue>()("@shivaedev/platform/rpc/Identity") {}
export class OptionalIdentity extends Context.Service<OptionalIdentity, Option.Option<IdentityValue>>()("@shivaedev/platform/rpc/OptionalIdentity") {}
export interface ProviderAccountValue {
	readonly accountId: string;
	readonly providerId: string;
}
export interface SessionUserValue extends IdentityValue {
	readonly email: string;
	readonly name: string;
	readonly role?: string | null | undefined;
}
export class SessionUser extends Context.Service<SessionUser, SessionUserValue>()("@shivaedev/platform/rpc/SessionUser") {}
export interface SessionUserWithProviderAccountsValue extends SessionUserValue {
	readonly providerAccounts: Effect.Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>;
}
export class SessionUserWithProviderAccounts extends Context.Service<SessionUserWithProviderAccounts, SessionUserWithProviderAccountsValue>()(
	"@shivaedev/platform/rpc/SessionUserWithProviderAccounts",
) {}
