import { Context, type Effect, type Schema } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { AuthUnavailable, BadRequest, PreconditionFailed } from "@shivaedev/errors/taxonomy.ts";
import type { SessionUser } from "#identity.ts";

// The account module's port, so the module stays free of the provider that implements the deletion.
export class AccountDeletion extends Context.Service<
	AccountDeletion,
	{
		readonly delete: (
			password: string,
		) => Effect.Effect<
			void,
			AuthUnavailable | BadRequest | PreconditionFailed | Schema.SchemaError | SqlError,
			SessionUser | SqlClient.SqlClient | Reactivity.Reactivity
		>;
	}
>()("@shivaedev/identity/AccountDeletion") {}
