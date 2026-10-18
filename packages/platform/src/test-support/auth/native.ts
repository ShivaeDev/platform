import type { BetterAuthOptions } from "better-auth";
import { Effect } from "effect";
import { withTestTransaction } from "@shivaedev/effect-prisma/testing/transaction.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { EffectPrismaAdapterOptions } from "#better-auth/adapter.ts";
import { Database, DatabaseLive, databaseUrl } from "./database.ts";
import { authEngine } from "./engine.ts";
import { filterRows } from "./filterCases.ts";
import { authVerbs } from "./verbs.ts";
export const auth = storyKit({
	around: (effect) =>
		withTestTransaction(
			Database,
			Effect.flatMap(Database, () => effect),
		),
	clock: "live",
	create: authEngine,
	inspect: () => ({ boundary: "Better Auth adapter", isolation: "rollback", storage: "PostgreSQL" }),
	layer: DatabaseLive,
	name: "Better Auth PostgreSQL",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "rows"],
	verbs: (state, story) => authVerbs(state, story.tell),
});
export function configuredAdapter(options: BetterAuthOptions, adapterOptions?: EffectPrismaAdapterOptions) {
	return auth.trait("configured", "the application configures the Better Auth adapter", (state) => {
		state.authDatabase = state.configure(options, adapterOptions);
	});
}
export function usersNamed(...names: string[]) {
	return auth.trait("rows", `PostgreSQL contains users named ${names.join(", ")}`, function* ({ db }) {
		for (const name of names) {
			yield* db.AuthUser.create({ email: `${crypto.randomUUID()}@example.test`, id: crypto.randomUUID(), name });
		}
	});
}
export const filterUsers = auth.trait("rows", "PostgreSQL contains nullable and literal-pattern filter fixtures", function* ({ db }) {
	for (const row of filterRows) {
		yield* db.AuthUser.create({ ...row, email: `${crypto.randomUUID()}@example.test`, id: crypto.randomUUID() });
	}
});
