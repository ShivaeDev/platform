import { Context, type Option } from "effect";
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
	readonly providerAccounts?: readonly ProviderAccountValue[];
	readonly role?: string | null | undefined;
}
export class SessionUser extends Context.Service<SessionUser, SessionUserValue>()("@shivaedev/platform/rpc/SessionUser") {}
