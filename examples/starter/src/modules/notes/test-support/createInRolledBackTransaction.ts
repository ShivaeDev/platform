import { Effect } from "effect";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { NotesService } from "#modules/notes/server/Service.ts";
import type { RunningHost } from "#test-support/host.ts";

export const createInRolledBackTransaction = Effect.fn("AppStory.createInRolledBackTransaction")(function* (
	host: RunningHost,
	tell: (line: string) => void,
	title: string,
	ownerId: string,
) {
	tell(`create ${JSON.stringify(title)} inside an outer transaction and roll back`);
	return yield* Effect.gen(function* () {
		const service = yield* NotesService;
		yield* service.create({ title }, ownerId);
		return yield* Effect.fail("rollback");
	}).pipe(transact({ onSqlError: (error) => error }), Effect.provide(host.context), Effect.result);
});
