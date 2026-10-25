import { expect } from "vitest";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { views } from "#engine/views.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";

const invalid = task("broken", "approved").replace("kind: task", "kind: task\nnext_action: Inspect: evidence");
const NAMED_PROBLEM = "Board metadata is invalid: broken.md (frontmatter: line 4: Nested mappings are not allowed in compact mappings";

host.it(
	"invalid unrelated metadata does not block admission and a later pass admits its repaired source",
	[boardWork({ "broken.md": invalid, "one.md": task("one", "approved") }, {})],
	function* (daemon) {
		const failures = yield* daemon.admit();
		expect(failures).toEqual([expect.stringContaining(NAMED_PROBLEM)]);
		yield* daemon.schedule();
		expect((yield* daemon.storedRecord("one")).value.step).toBe("working");
		expect((yield* daemon.list()).map(({ value }) => value.workId)).toEqual(["one"]);
		daemon.writeBoard("broken.md", task("broken", "approved"));
		expect(yield* daemon.admit()).toEqual([]);
		yield* daemon.schedule();
		expect((yield* daemon.storedRecord("broken")).value.step).toBe("working");
		expect((yield* daemon.storedRecord("one")).value.step).toBe("working");
		expect(daemon.providerLaunches()).toEqual((yield* daemon.list()).flatMap(({ value }) => value.attempts.map(({ operationId }) => operationId)));
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
		`unrelated errors preserve running work and its own ${kind} reaches status, logs and the published decision`,
		[boardWork({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, {})],
		function* (daemon) {
			yield* daemon.admit();
			yield* daemon.schedule();
			const before = (yield* daemon.storedRecord("one")).value;
			daemon.writeBoard("broken.md", invalid);
			yield* daemon.admit();
			yield* daemon.schedule();
			for (const id of ["one", "two"]) {
				const running = (yield* daemon.storedRecord(id)).value;
				expect(running.step).toBe("working");
				expect(running.decision).toBeUndefined();
			}
			const after = (yield* daemon.storedRecord("one")).value;
			expect(after.attempts).toHaveLength(before.attempts.length);
			expect(after.attempts.at(-1)?.receipt).toEqual(before.attempts.at(-1)?.receipt);
			expect(after.attempts.at(-1)?.status).toBe("running");
			daemon.writeBoard("one.md", source);
			yield* daemon.schedule();
			const stopped = (yield* daemon.storedRecord("one")).value;
			expect(stopped.step).toBe("waiting");
			expect(stopped.decision?.reason).toContain(diagnostic);
			expect(stopped.decisionPublished).toBe(true);
			expect((yield* daemon.storedRecord("two")).value.step).toBe("working");
			const records = (yield* daemon.list()).map(({ value }) => value);
			for (const status of [renderStatus(views(records)), statusMarkdown(records)]) {
				expect(status).toContain(diagnostic);
			}
			const publication = stopped.decision?.published;
			expect(publication).toBeDefined();
			if (publication !== undefined) {
				expect(daemon.readBoard(publication.sourcePath)).toContain(diagnostic);
			}
			expect(JSON.stringify(daemon.logs())).toContain(diagnostic);
			expect(JSON.stringify(daemon.logs())).toContain(NAMED_PROBLEM);
			expect(daemon.providerLaunches()).toEqual((yield* daemon.list()).flatMap(({ value }) => value.attempts.map(({ operationId }) => operationId)));
		},
	);
}
