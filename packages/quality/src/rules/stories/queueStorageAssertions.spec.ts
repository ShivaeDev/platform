import { expect } from "@effect/vitest";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { queueReadouts } from "./queueReadouts.ts";

for (const code of [
	"expect(yield* jobsTesting.jobs(queue)).toHaveLength(1);",
	"const jobs = yield* jobsTesting.jobs(queue); expect(jobs[0].state).toBe('completed');",
	"expect(yield* host.jobsTesting.snapshot([queue])).toEqual([]);",
	"expect(yield* host['jobsTesting']['jobs'](queue)).toHaveLength(1);",
	"const testing = jobsTesting; expect(yield* testing.jobs(queue)).toHaveLength(1);",
	"const { jobsTesting: testing } = host; expect(yield* testing.jobs(queue)).toHaveLength(1);",
	"const { snapshot: states } = jobsTesting; expect(yield* states([queue])).toEqual([]);",
	"const read = jobsTesting.jobs; expect(yield* read(queue)).toHaveLength(1);",
	'import { makePgBossTesting as makeTesting } from "@shivaedev/jobs/server/testing.ts"; const testing = makeTesting(); expect(yield* testing.jobs(queue)).toEqual([]);',
	'import * as testingApi from "@shivaedev/jobs/server/testing.ts"; const testing = testingApi.makePgBossTesting(); expect(yield* testing.snapshot([queue])).toEqual([]);',
	'import type { PgBossTesting as Testing } from "@shivaedev/jobs/server/testing.ts"; function* story(testing: Testing) { expect(yield* testing.jobs(queue)).toEqual([]); }',
]) {
	ruleStory.it(
		`tests/queue-readouts rejects application queue evidence: ${code}`,
		[repositoryHas({ content: code, path: "src/orders.spec.ts" })],
		function* ({ check }) {
			const findings = yield* check(queueReadouts);

			expect(findings).toEqual([
				{
					file: "src/orders.spec.ts",
					line: 1,
					message: expect.stringContaining("Assert the application's visible result instead"),
				},
			]);
		},
	);
}

ruleStory.it(
	"tests/queue-readouts reports storage behind an application's job-state readout at its source",
	[
		repositoryHas(
			{
				content: "export const jobStates = () =>\n jobsTesting.snapshot([queue]).pipe(Effect.map(jobs => jobs.map(job => job.state)));",
				path: "src/test-support/jobStates.ts",
			},
			{
				content: 'import { jobStates } from "./test-support/jobStates.ts"; expect(yield* jobStates()).toEqual(["created"]);',
				path: "src/orders.spec.ts",
			},
		),
	],
	function* ({ check, locations }) {
		yield* check(queueReadouts);

		expect(yield* locations()).toEqual(["src/test-support/jobStates.ts:2"]);
	},
);

ruleStory.it(
	"tests/queue-readouts follows an imported controller alias into application support",
	[
		repositoryHas(
			{
				content: 'import { makePgBossTesting } from "@shivaedev/jobs/server/testing.ts"; export const testing = makePgBossTesting();',
				path: "src/test-support/controller.ts",
			},
			{
				content: 'import { testing as controller } from "./controller.ts";\nexport const queued = () => controller.jobs(queue);',
				path: "src/test-support/queued.ts",
			},
		),
	],
	function* ({ check, locations }) {
		yield* check(queueReadouts);

		expect(yield* locations()).toEqual(["src/test-support/queued.ts:2"]);
	},
);

for (const code of [
	"yield* jobsTesting.waitForIdle([queue]); expect(yield* shownWordCount()).toBe(3);",
	"yield* jobsTesting.failNextSend(queue); yield* jobsTesting.dueNow(queue);",
	"const jobs = [{ state: 'completed' }]; expect(jobs[0].state).toBe('completed');",
	"const board = { jobs: () => [], snapshot: () => [] }; expect(board.jobs()).toEqual([]); expect(board.snapshot()).toEqual([]);",
	"const text = 'expect(jobsTesting.jobs(queue)).toHaveLength(1)';",
	'import { makePgBossTesting } from "unrelated"; const testing = makePgBossTesting(); expect(testing.jobs()).toEqual([]);',
]) {
	ruleStory.it(
		`tests/queue-readouts accepts worker controls, visible results and unrelated data: ${code}`,
		[repositoryHas({ content: code, path: "src/orders.spec.ts" })],
		function* ({ check }) {
			expect(yield* check(queueReadouts)).toEqual([]);
		},
	);
}

ruleStory.it(
	"tests/queue-readouts exempts the jobs workspace by manifest name while checking nested apps and a misleading directory name",
	[
		repositoryHas(
			{ content: '{"workspaces":["packages/*", "packages/queue/apps/*"]}', path: "package.json" },
			{ content: '{"name":"@shivaedev/jobs"}', path: "packages/queue/package.json" },
			{ content: '{"name":"app"}', path: "packages/queue/apps/app/package.json" },
			{ content: '{"name":"other"}', path: "packages/jobs/package.json" },
			{ content: "expect(yield* jobsTesting.jobs(queue)).toEqual([]);", path: "packages/queue/src/jobs.spec.ts" },
			{ content: "export const states = () => jobsTesting.snapshot([queue]);", path: "packages/queue/src/test-support/states.ts" },
			{ content: "expect(yield* jobsTesting.jobs(queue)).toEqual([]);", path: "packages/queue/apps/app/src/app.spec.ts" },
			{ content: "expect(yield* jobsTesting.jobs(queue)).toEqual([]);", path: "packages/jobs/src/app.spec.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(queueReadouts);

		expect(yield* locations()).toEqual(["packages/jobs/src/app.spec.ts:1", "packages/queue/apps/app/src/app.spec.ts:1"]);
	},
);

ruleStory.it(
	"tests/queue-readouts exempts the jobs package when it owns the repository root",
	[
		repositoryHas(
			{ content: '{"name":"@shivaedev/jobs"}', path: "package.json" },
			{ content: "expect(yield* jobsTesting.jobs(queue)).toEqual([]);", path: "src/jobs.spec.ts" },
		),
	],
	function* ({ check }) {
		expect(yield* check(queueReadouts)).toEqual([]);
	},
);
