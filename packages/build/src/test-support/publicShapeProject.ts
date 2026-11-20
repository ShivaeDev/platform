// The same stored row behind an operation that returns its public fields, and a sign-in whose payload carries a password.
export const PUBLIC_SHAPE_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/credentials/credentials.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { credentialsWire } from "#generated/modules/credentials/credentials.ts";
import { Holder, SignIn } from "#modules/credentials/operations.ts";

export const Credentials = defineModule({
	name: "credentials",
	operations: [Holder, SignIn],
	wire: credentialsWire,
});
`,
	"src/modules/credentials/operations.ts": `import { Schema } from "effect";
import { command, query } from "@shivaedev/contract/operation.ts";
import { credentials } from "#modules/credentials/model.ts";
import { CredentialStore } from "#modules/credentials/store.ts";

export const Holder = query("holder", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [credentials.item(id)],
	*run({ id }) {
		const row = yield* (yield* CredentialStore).find(id);
		return { id: row.id, owner: row.owner };
	},
});

export const SignIn = command("signIn", {
	payload: { owner: Schema.String, password: Schema.RedactedFromValue(Schema.String) },
	*run({ owner, password }) {
		yield* (yield* CredentialStore).check(owner, password);
	},
});
`,
	"src/modules/credentials/store.ts": `import { Context, type Effect, type Redacted } from "effect";
import type { Credential } from "#modules/credentials/model.ts";

export class CredentialStore extends Context.Service<
	CredentialStore,
	{
		readonly check: (owner: string, password: Redacted.Redacted<string>) => Effect.Effect<void>;
		readonly find: (id: number) => Effect.Effect<Credential>;
	}
>()("fixture/CredentialStore") {}
`,
};
