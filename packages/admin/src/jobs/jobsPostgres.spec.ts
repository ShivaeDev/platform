import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { invalidMailFails, jobsStory, mailFails, privateWaits, signedInAs, signedOut, statisticsRefreshed, syncWaits } from "#test/jobsStory.ts";

const admin = signedInAs("admin");

jobsStory.it("an admin sees mail 42 counted as the one failed mail job", [admin, mailFails(42)], function* ({ counts }) {
	expect(yield* counts("mail")).toEqual({ activeCount: 0, failedCount: 1, queuedCount: 0, totalCount: 1 });
});

jobsStory.it(
	"health lists only the page's queues and leaves the private queue's waiting job out of the totals",
	[admin, mailFails(42), syncWaits, privateWaits, statisticsRefreshed],
	function* ({ health }) {
		expect(yield* health()).toEqual({
			activeTotal: 0,
			deadLetteredTotal: 1,
			failedTotal: 1,
			jobs: [
				{ activeCount: 0, deadLetteredCount: 1, failedCount: 1, name: "mail", queuedCount: 0, readyCount: 0 },
				{ activeCount: 0, deadLetteredCount: 0, failedCount: 0, name: "scheduled", queuedCount: 0, readyCount: 0 },
				{ activeCount: 0, deadLetteredCount: 0, failedCount: 0, name: "sync", queuedCount: 1, readyCount: 1 },
			],
			queuedTotal: 1,
			readyTotal: 1,
		});
	},
);

jobsStory.it(
	"the failed mail list shows mail 42 on its first attempt with its payload and the worker's rejection, as the last page",
	[admin, mailFails(42)],
	function* ({ failedJobs }) {
		expect(yield* failedJobs("mail")).toEqual({
			jobs: [{ attempt: 1, job: "mail 42", output: "the worker rejected 42", payload: { id: 42 }, queue: "mail", state: "failed" }],
			next: "last page",
		});
	},
);

jobsStory.it(
	"mail 42's detail matches its entry in the failed mail list, field for field",
	[admin, mailFails(42)],
	function* ({ detail, failedEntry }) {
		const entry = yield* failedEntry("mail 42");

		expect(yield* detail("mail 42")).toEqual(entry);
		expect(entry.output).toEqual({ _tag: "WorkerRejected", message: "the worker rejected 42: password=<redacted>" });
	},
);

jobsStory.it(
	"the dead-letter copy of mail 42 waits unstarted in mail-dlq with mail 42's payload, naming mail 42 and its rejection",
	[admin, mailFails(42)],
	function* ({ deadLettered }) {
		expect(yield* deadLettered("mail")).toEqual({
			copies: [
				{
					copy: "the dead-letter copy of mail 42",
					payload: { id: 42 },
					queue: "mail-dlq",
					source: "mail 42",
					sourceOutput: "the worker rejected 42",
					started: "not started",
				},
			],
			next: "last page",
		});
	},
);

jobsStory.it("the waiting sync job's detail decodes its sync payload and counts no attempt yet", [admin, syncWaits], function* ({ job }) {
	expect(yield* job("the waiting sync job", "sync")).toEqual({
		attempt: 0,
		job: "the waiting sync job",
		output: "no output",
		payload: { key: "sync-key" },
		queue: "sync",
		state: "created",
	});
});

jobsStory.it(
	"the failed mail list carries mail 42's payload in the mail schema's encoded form on the wire",
	[admin, mailFails(42)],
	function* ({ failedJobs, lastAnswerOnTheWire }) {
		yield* failedJobs("mail");

		expect(yield* lastAnswerOnTheWire()).toContain('"data":{"id":"42"}');
	},
);

jobsStory.it(
	"failed mail jobs come newest first, two to a page: mail 3 and mail 2, then mail 1",
	[admin, mailFails(1, 2, 3)],
	function* ({ failedPages }) {
		expect(yield* failedPages("mail", 2)).toEqual([["mail 3", "mail 2"], ["mail 1"]]);
	},
);

jobsStory.it(
	"paging two at a time through dead-lettered mail jobs shows the copies of mail 1, 2 and 3 once each",
	[admin, mailFails(1, 2, 3)],
	function* ({ deadLetteredPaging }) {
		expect(yield* deadLetteredPaging("mail", 2)).toEqual({ copiesOf: ["mail 1", "mail 2", "mail 3"], pageSizes: [2, 1] });
	},
);

for (const [name, setup] of [
	["an unknown job", []],
	["the waiting sync job", [syncWaits]],
] as const) {
	jobsStory.it(`looking up ${name} as a mail job finds no job`, [admin, ...setup], function* ({ job }) {
		expect(yield* job(name, "mail")).toBe("no job");
	});
}

for (const queue of ["private", "mail-dlq"]) {
	jobsStory.it(
		`every read of ${queue} is refused as an unregistered queue before reading pg-boss`,
		[admin],
		function* ({ counts, deadLettered, failedJobs, job, pgBossReadsSinceRegistration }) {
			const refusal = `${queue} is not a registered queue`;

			yield* outcomes({
				"a job": [job("an unknown job", queue), refusal],
				counts: [counts(queue), refusal],
				"dead-lettered jobs": [deadLettered(queue), refusal],
				"failed jobs": [failedJobs(queue), refusal],
				"pg-boss reads since registration": [pgBossReadsSinceRegistration(), 0],
			});
		},
	);
}

jobsStory.it(
	"registering the Jobs page and serving the users page reads nothing from pg-boss",
	[admin],
	function* ({ pgBossReadsSinceRegistration, profile }) {
		yield* outcomes({
			"pg-boss reads since registration": [pgBossReadsSinceRegistration(), 0],
			profile: [profile(), "admin@example.test"],
		});
	},
);

jobsStory.it(
	"the failed mail list answers that mail holds an invalid payload when the invalid mail job failed",
	[admin, invalidMailFails],
	function* ({ failedJobs }) {
		expect(yield* failedJobs("mail")).toBe("mail holds an invalid payload");
	},
);

jobsStory.it("reading the invalid mail job answers that mail holds an invalid payload", [admin, invalidMailFails], function* ({ job }) {
	expect(yield* job("the invalid mail job", "mail")).toBe("mail holds an invalid payload");
});

jobsStory.it("a failed mail list asked for no jobs answers bad input", [admin], function* ({ failedJobs, pgBossReadsSinceRegistration }) {
	yield* outcomes({ "page input": [failedJobs("mail", { limit: 0 }), "bad input"], "pg-boss reads": [pgBossReadsSinceRegistration(), 0] });
});

jobsStory.it(
	"a dead-lettered mail list given a malformed cursor answers bad input",
	[admin],
	function* ({ deadLettered, pgBossReadsSinceRegistration }) {
		yield* outcomes({
			"page input": [deadLettered("mail", { cursor: "invalid cursor", limit: 1 }), "bad input"],
			"pg-boss reads": [pgBossReadsSinceRegistration(), 0],
		});
	},
);

jobsStory.it(
	"after pg-boss stops, mail counts answer that jobs are unavailable for counts while the profile is still served",
	[admin],
	function* ({ counts, pgBossStops, profile }) {
		yield* pgBossStops();

		yield* outcomes({
			"mail counts": [counts("mail"), "jobs unavailable for counts"],
			profile: [profile(), "admin@example.test"],
		});
	},
);

for (const [caller, session, refusal] of [
	["a signed-out caller", signedOut, "unauthorized"],
	["a user without permissions", signedInAs("user"), "forbidden"],
	["a role assigner without jobs.read", signedInAs("assigner"), "forbidden"],
] as const) {
	jobsStory.it(
		`${caller} is ${refusal} on every Jobs read and on retrying failed mail 42`,
		[session, mailFails(42)],
		function* ({ counts, deadLettered, failedJobs, health, job, retry }) {
			yield* outcomes({
				counts: [counts("mail"), refusal],
				"dead-lettered jobs": [deadLettered("mail"), refusal],
				"failed jobs": [failedJobs("mail"), refusal],
				health: [health(), refusal],
				"mail 42": [job("mail 42", "mail"), refusal],
				"retry of mail 42": [retry("mail 42"), refusal],
			});
		},
	);
}
