import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { failedByAnOlderWriter, running, storedTogether } from "#test/postgres/traits.ts";

const Tied = defineQueue({ name: "tied-listing", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });
const tiedFailures = [
	storedTogether(Tied, [
		{ as: "job 1", data: {}, deadLetter: "tied-listing-dlq", id: "00000000-0000-4000-8000-000000000001" },
		{ as: "job 3", data: {}, deadLetter: "tied-listing-dlq", id: "00000000-0000-4000-8000-000000000003" },
		{ as: "job 2", data: {}, deadLetter: "tied-listing-dlq", id: "00000000-0000-4000-8000-000000000002" },
	]),
	running("app", [Tied]),
	...["job 1", "job 3", "job 2"].map((job) => failedByAnOlderWriter(job, { message: "Rejected" })),
];

database.it("failed jobs created together page by descending id without skipping a job", tiedFailures, function* ({ firstPage, remainingPages }) {
	const first = yield* firstPage("app", "failed", Tied, 1);

	const rest = yield* remainingPages();

	expect([first, ...rest]).toEqual([["job 3"], ["job 2"], ["job 1"]]);
});

database.it("dead-letter copies created together appear once across single-job pages", tiedFailures, function* ({ firstPage, remainingPages }) {
	const first = yield* firstPage("app", "dead-lettered", Tied, 1);

	const rest = yield* remainingPages();

	expect([...first, ...rest.flat()].sort((left, right) => left.localeCompare(right))).toEqual(["copy of job 1", "copy of job 2", "copy of job 3"]);
});
