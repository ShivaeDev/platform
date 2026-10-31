import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueuedEarlier, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Notes = defineQueue({ name: "handler-context", schema: Schema.Struct({}) });

database.it(
	"a job handler writes through the application service provided to its Layer",
	[enqueuedEarlier(Notes, {}, { as: "note" }), running("app", [worker(Notes, "notes its job in the application log")])],
	function* ({ applicationLoggedJob, untilJob }) {
		yield* untilJob("note", "completed");

		expect(yield* applicationLoggedJob("note")).toBe(true);
	},
);
