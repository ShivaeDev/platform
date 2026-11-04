import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	existingForeignSession,
	externallyCreatedSchema,
	foreignMigrations,
	missingForeignColumn,
	missingForeignTable,
} from "#test/better-auth/foreignMigrations.ts";

foreignMigrations.it(
	"the mount reads alice's existing session from externally migrated auth tables",
	[externallyCreatedSchema, existingForeignSession],
	function* ({ session, start }) {
		yield* start();

		expect(yield* session("alice")).toEqual({ status: 200, user: { email: "alice@foreign.test", name: "alice" } });
	},
);

foreignMigrations.it("startup leaves the externally managed schema unchanged", [externallyCreatedSchema], function* ({ start, storedSchema }) {
	const before = yield* storedSchema();

	const startup = yield* start();

	yield* outcomes([
		["startup", () => Effect.succeed(startup), "started"],
		["stored schema", () => storedSchema(), before],
	]);
});

foreignMigrations.it(
	"the startup guard refuses a missing required column with typed schema drift naming it",
	[externallyCreatedSchema, existingForeignSession, missingForeignColumn],
	function* ({ start }) {
		const startup = yield* start();

		expect(startup).toEqual({ missing: ["column User.emailVerified"], reason: "Auth schema needs a new migration:\ncolumn User.emailVerified" });
	},
);

foreignMigrations.it(
	"the startup guard refuses a missing auth table with typed schema drift naming it",
	[externallyCreatedSchema, missingForeignTable],
	function* ({ start }) {
		const startup = yield* start();

		expect(startup).toMatchObject({ missing: [expect.stringMatching(/^table Verification \(/u)] });
	},
);
