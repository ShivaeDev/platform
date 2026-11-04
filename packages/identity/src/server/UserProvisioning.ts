import { Context, type Effect, type Redacted } from "effect";
import type { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { SessionUserValue } from "#identity.ts";

export interface PasswordUser {
	readonly email: string;
	readonly name: string;
	readonly password: Redacted.Redacted<string>;
}

export class UserProvisioning extends Context.Service<
	UserProvisioning,
	{
		readonly findOrCreateUser: (user: PasswordUser) => Effect.Effect<Pick<SessionUserValue, "id" | "email" | "name">, AuthUnavailable>;
	}
>()("@shivaedev/identity/UserProvisioning") {}
