import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsScreen, jobsViewOpen } from "#test/jobsScreen.tsx";
import { mailFails, signedInAs } from "#test/jobsStory.ts";

expectNoReactWarnings();

const ids = Array.from({ length: 12 }, (_, index) => index + 1);

for (const list of ["Failed", "Dead-lettered"] as const) {
	jobsScreen.it(
		`${list} paging returns to the same first page, clears detail and stops at both ends`,
		[signedInAs("operator"), mailFails(...ids), jobsViewOpen],
		function* ({ selectList, shownJobs, pagination, openJob, shownDetail, nextPage, previousPage }) {
			yield* selectList(list);
			const first = (yield* shownJobs()).map(({ job }) => job);
			yield* outcomes([
				["first page size", () => Effect.succeed(first.length), 10],
				["first page controls", () => pagination(), { nextDisabled: false, page: "Page 1", previousDisabled: true }],
			]);
			if (list === "Failed") {
				expect(first).toEqual(["mail 12", "mail 11", "mail 10", "mail 9", "mail 8", "mail 7", "mail 6", "mail 5", "mail 4", "mail 3"]);
			}
			yield* openJob(first[0] ?? "missing first job");
			expect(yield* shownDetail()).toBeDefined();

			yield* nextPage();

			const second = (yield* shownJobs()).map(({ job }) => job);
			yield* outcomes([
				["last page size", () => Effect.succeed(second.length), 2],
				["last page controls", () => pagination(), { nextDisabled: true, page: "Page 2", previousDisabled: false }],
				["detail after paging forward", () => shownDetail(), undefined],
			]);
			expect([...first, ...second].toSorted((left, right) => left.localeCompare(right))).toEqual(
				ids
					.map((id) => (list === "Failed" ? `mail ${id}` : `the dead-letter copy of mail ${id}`))
					.toSorted((left, right) => left.localeCompare(right)),
			);
			yield* openJob(second[0] ?? "missing second job");
			expect(yield* shownDetail()).toBeDefined();

			yield* previousPage();

			yield* outcomes([
				["first page jobs", () => Effect.map(shownJobs(), (jobs) => jobs.map(({ job }) => job)), first],
				["first page controls", () => pagination(), { nextDisabled: false, page: "Page 1", previousDisabled: true }],
				["detail after paging back", () => shownDetail(), undefined],
			]);
			yield* nextPage();
			expect((yield* shownJobs()).map(({ job }) => job)).toEqual(second);
		},
	);
}

jobsScreen.it(
	"changing list or queue starts at page one with no detail from the previous selection",
	[signedInAs("operator"), mailFails(...ids), jobsViewOpen],
	function* ({ chooseQueue, selectList, nextPage, openJob, shownJobs, shownDetail, pagination, queueHeading }) {
		yield* nextPage();
		yield* openJob("mail 1");
		expect(yield* shownDetail()).toBeDefined();

		yield* selectList("Dead-lettered");

		yield* outcomes([
			["first page controls", () => pagination(), { nextDisabled: false, page: "Page 1", previousDisabled: true }],
			["detail after changing lists", () => shownDetail(), undefined],
		]);
		yield* nextPage();
		const copies = yield* shownJobs();
		yield* openJob(copies[0]?.job ?? "missing copy");
		expect(yield* shownDetail()).toBeDefined();

		yield* chooseQueue("sync");

		yield* outcomes([
			["queue heading", () => queueHeading(), "sync"],
			["empty queue", () => shownJobs(), []],
			["empty page controls", () => pagination(), { nextDisabled: true, page: "Page 1", previousDisabled: true }],
			["detail after changing queues", () => shownDetail(), undefined],
		]);
		yield* chooseQueue("mail");
		yield* outcomes([
			["returned queue controls", () => pagination(), { nextDisabled: false, page: "Page 1", previousDisabled: true }],
			["failed jobs", () => Effect.map(shownJobs(), (jobs) => jobs.map(({ state }) => state)), Array.from({ length: 10 }, () => "failed")],
		]);
	},
);
