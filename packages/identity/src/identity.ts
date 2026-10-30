import { Context, type Effect, type Option, Schema } from "effect";
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
export const SessionUserSchema = Schema.Struct({
	email: Schema.String,
	id: Schema.String,
	name: Schema.String,
	permissions: Schema.optionalKey(Schema.Array(Schema.Struct({ name: Schema.String, strength: Schema.Literals(["own", "any"]) }))),
	role: Schema.optional(Schema.NullOr(Schema.String)),
});
export type SessionUserValue = typeof SessionUserSchema.Type;
export class SessionUser extends Context.Service<SessionUser, SessionUserValue>()("@shivaedev/identity/SessionUser") {}
export interface SessionUserWithProviderAccountsValue extends SessionUserValue {
	readonly providerAccounts: Effect.Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>;
}
export class SessionUserWithProviderAccounts extends Context.Service<SessionUserWithProviderAccounts, SessionUserWithProviderAccountsValue>()(
	"@shivaedev/identity/SessionUserWithProviderAccounts",
) {}
