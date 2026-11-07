import { Effect } from "effect";
import { PostgresTestDatabase, type PostgresTestTemplate } from "#server/database.ts";

export const storyDatabase = Effect.fn("PostgresTest.storyDatabase")(function* (options?: { readonly template?: PostgresTestTemplate }) {
	const database = yield* PostgresTestDatabase;
	let template = options?.template ?? "migrated";
	return {
		acquire: Effect.suspend(() => database.clone(template)),
		select: (selected: PostgresTestTemplate) => {
			template = selected;
		},
	};
});
