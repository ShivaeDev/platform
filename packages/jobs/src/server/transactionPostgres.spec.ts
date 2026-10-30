import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running } from "#test/postgres/traits.ts";

const Transactional = defineQueue({ name: "transactional", schema: Schema.Struct({ id: Schema.Number }) });
const producing = running("app", [Transactional]);

database.it(
	"a job enqueued inside a SQL transaction is stored only once the transaction commits",
	[producing],
	function* ({ enqueueInTransaction, job, seenBeforeCommit }) {
		yield* enqueueInTransaction("app", Transactional, { id: 42 }, { as: "job 42" }, "commits");

		yield* outcomes({
			"job 42": [job("job 42"), expect.objectContaining({ data: { id: 42 }, state: "created" })],
			"job 42 before the commit": [seenBeforeCommit(), "missing"],
		});
	},
);

database.it(
	"a job enqueued inside a SQL transaction that rolls back is never stored",
	[producing],
	function* ({ answered, enqueueInTransaction, storedJobs }) {
		yield* enqueueInTransaction("app", Transactional, { id: 42 }, { as: "job 42" }, "rolls back");

		yield* outcomes({
			"enqueue answer": [answered(), "job 42"],
			"stored jobs": [storedJobs("transactional"), []],
		});
	},
);
