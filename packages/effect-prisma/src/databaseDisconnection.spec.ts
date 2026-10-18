import { expect } from "vitest";
import { disconnectsBeforeBegin, postgresStory } from "#test/postgresStory.ts";

postgresStory.it(
	"preserves the original connection error after transaction acquisition fails",
	[disconnectsBeforeBegin()],
	function* ({ disconnectedBegin }) {
		const result = yield* disconnectedBegin();
		expect(JSON.parse(result.stdout)).toMatchObject({
			begins: 1,
			kind: "PrismaConnectionFailure",
			original: { kind: "sql_connection", message: "Connection terminated unexpectedly" },
		});
	},
);

postgresStory.it(
	"survives a PostgreSQL disconnect before BEGIN without an uncaught pg error",
	[disconnectsBeforeBegin()],
	function* ({ disconnectedBegin }) {
		const result = yield* disconnectedBegin();
		expect(JSON.parse(result.stdout)).toMatchObject({ begins: 1, kind: "PrismaConnectionFailure", original: { kind: "sql_connection" } });
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	},
);
