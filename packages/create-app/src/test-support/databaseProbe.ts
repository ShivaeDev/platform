export function databaseProbe() {
	return `
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { postgres } from "./test-support/postgres.ts";
it("uses the app test database even when the shell has a repository database override", async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    expect(yield* sql\`select 1 as value\`).toEqual([{ value: 1 }]);
  }).pipe(Effect.provide(postgres))));
});
`;
}
