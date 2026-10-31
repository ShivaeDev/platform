import { expect } from "vitest";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";

const invalid = task("broken", "approved").replace("kind: task", "kind: task\nnext_action: Inspect: evidence");
const NAMED_PROBLEM = "Board metadata is invalid: broken.md (frontmatter: line 4: Nested mappings are not allowed in compact mappings";

host.it(
	"invalid metadata in one brief is named and does not block admitting the others",
	[boardWork({ "broken.md": invalid, "one.md": task("one", "approved") }, {})],
	function* (daemon) {
		const failures = yield* daemon.admit();

		expect({ failures, work: (yield* daemon.list()).map(({ value }) => value.workId) }).toEqual({
			failures: [expect.stringContaining(NAMED_PROBLEM)],
			work: ["one"],
		});
	},
);

host.it(
	"a later pass admits and launches a repaired brief once",
	[boardWork({ "broken.md": invalid, "one.md": task("one", "approved") }, {})],
	function* (daemon) {
		expect(yield* daemon.admit()).toEqual([expect.stringContaining(NAMED_PROBLEM)]);
		yield* daemon.schedule();
		daemon.writeBoard("broken.md", task("broken", "approved"));

		const failures = yield* daemon.admit();
		yield* daemon.schedule();

		const records = (yield* daemon.list()).map(({ value }) => value);
		expect({
			failures,
			launches: daemon.providerLaunches(),
			steps: records.map(({ step, workId }) => `${workId} ${step}`).toSorted(),
		}).toEqual({
			failures: [],
			launches: records.flatMap(({ attempts }) => attempts.map(({ operationId }) => operationId)),
			steps: ["broken working", "one working"],
		});
	},
);

host.it(
	"an unrelated invalid brief is logged and leaves running work on its attempt",
	[boardWork({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, {})],
	function* (daemon) {
		yield* daemon.admit();
		yield* daemon.schedule();
		const before = (yield* daemon.storedRecord("one")).value;
		expect(before.step).toBe("working");

		daemon.writeBoard("broken.md", invalid);
		yield* daemon.admit();
		yield* daemon.schedule();

		const records = (yield* daemon.list()).map(({ value }) => value);
		expect({
			attempts: records.find(({ workId }) => workId === "one")?.attempts.map(({ operationId, receipt }) => ({ operationId, receipt })),
			logs: JSON.stringify(daemon.logs()),
			work: records.map(({ decision, step, workId }) => `${workId} ${step} ${decision?.code ?? "without decision"}`).toSorted(),
		}).toEqual({
			attempts: before.attempts.map(({ operationId, receipt }) => ({ operationId, receipt })),
			logs: expect.stringContaining(NAMED_PROBLEM),
			work: ["one working without decision", "two working without decision"],
		});
	},
);

for (const [kind, source, diagnostic] of [
	["malformed YAML", invalid.replace("id: broken", "id: one"), NAMED_PROBLEM.replace("broken.md", "one.md")],
	[
		"invalid field",
		task("one", "approved").replace("kind: task", "kind: task\nunexpected: value"),
		"Board metadata is invalid: one.md (unexpected: line 4: Unknown field unexpected; kept in the original frontmatter.)",
	],
] as const) {
	host.it(
		`a running brief's own ${kind} stops it with a published decision named in status and logs while other work keeps running`,
		[boardWork({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, {})],
		function* (daemon) {
			yield* daemon.admit();
			yield* daemon.schedule();
			expect((yield* daemon.storedRecord("one")).value.step).toBe("working");

			daemon.writeBoard("one.md", source);
			yield* daemon.admit();
			yield* daemon.schedule();

			const records = (yield* daemon.list()).map(({ value }) => value);
			const one = records.find(({ workId }) => workId === "one");
			expect({
				board: daemon.readBoard(one?.decision?.published?.sourcePath ?? "one.md"),
				logs: JSON.stringify(daemon.logs()),
				one: { published: one?.decisionPublished, reason: one?.decision?.reason, step: one?.step },
				status: renderStatus(views(records)),
				statusMarkdown: statusMarkdown(records),
				two: records.find(({ workId }) => workId === "two")?.step,
			}).toEqual({
				board: expect.stringContaining(diagnostic),
				logs: expect.stringContaining(diagnostic),
				one: { published: true, reason: expect.stringContaining(diagnostic), step: "waiting" },
				status: expect.stringContaining(diagnostic),
				statusMarkdown: expect.stringContaining(diagnostic),
				two: "working",
			});
		},
	);
}
