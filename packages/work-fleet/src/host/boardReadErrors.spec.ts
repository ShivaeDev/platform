import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { expect } from "vitest";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved } from "#host/admission.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { fleetHostLayer } from "#host/runtime.ts";
import { captureLogs } from "#test/captureLogs.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");
const invalid = task("broken", "approved").replace("kind: task", "kind: task\nnext_action: Inspect: evidence");
const NAMED_PROBLEM = "Board metadata is invalid: broken.md (frontmatter: line 4: Nested mappings are not allowed in compact mappings";

test("invalid unrelated metadata does not block admission and a later pass admits its repaired source", () =>
	withHost({ "broken.md": invalid, "one.md": task("one", "approved") }, {}, (fixture) =>
		Effect.gen(function* () {
			const failures = yield* admitApproved(fixture.host);
			expect(failures).toHaveLength(1);
			expect(failures[0]).toContain(NAMED_PROBLEM);
			yield* cycle;
			const fleet = yield* Fleet;
			expect((yield* fleet.get("one")).value.step).toBe("working");
			expect((yield* fleet.list()).map(({ value }) => value.workId)).toEqual(["one"]);
			fixture.write("broken.md", task("broken", "approved"));
			expect(yield* admitApproved(fixture.host)).toEqual([]);
			yield* cycle;
			expect((yield* fleet.get("broken")).value.step).toBe("working");
			expect((yield* fleet.get("one")).value.step).toBe("working");
			expect(fixture.provider.launched).toHaveLength(2);
		}).pipe(Effect.provide(fleetHostLayer(fixture.host, fixture.parts)), Effect.provide(NodeServices.layer)),
	));

for (const [kind, source, diagnostic] of [
	["malformed YAML", invalid.replace("id: broken", "id: one"), NAMED_PROBLEM.replace("broken.md", "one.md")],
	[
		"invalid field",
		task("one", "approved").replace("kind: task", "kind: task\nunexpected: value"),
		"Board metadata is invalid: one.md (unexpected: line 4: Unknown field unexpected; kept in the original frontmatter.)",
	],
] as const) {
	test(`unrelated errors preserve running work and its own ${kind} reaches status, logs and the published decision`, () => {
		const logs = captureLogs();
		return withHost({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, {}, (fixture) =>
			Effect.gen(function* () {
				yield* admitApproved(fixture.host);
				yield* cycle;
				const fleet = yield* Fleet;
				const before = (yield* fleet.get("one")).value;
				fixture.write("broken.md", invalid);
				yield* admitApproved(fixture.host);
				yield* cycle;
				for (const id of ["one", "two"]) {
					const running = (yield* fleet.get(id)).value;
					expect(running.step).toBe("working");
					expect(running.decision).toBeUndefined();
				}
				const after = (yield* fleet.get("one")).value;
				expect(after.attempts).toHaveLength(before.attempts.length);
				expect(after.attempts.at(-1)?.receipt).toEqual(before.attempts.at(-1)?.receipt);
				expect(after.attempts.at(-1)?.status).toBe("running");
				fixture.write("one.md", source);
				yield* cycle;
				const stopped = (yield* fleet.get("one")).value;
				expect(stopped.step).toBe("waiting");
				expect(stopped.decision?.reason).toContain(diagnostic);
				expect(stopped.decisionPublished).toBe(true);
				expect((yield* fleet.get("two")).value.step).toBe("working");
				const records = (yield* fleet.list()).map(({ value }) => value);
				for (const status of [renderStatus(views(records)), statusMarkdown(records)]) {
					expect(status).toContain(diagnostic);
				}
				const publication = stopped.decision?.published;
				expect(publication).toBeDefined();
				if (publication !== undefined) {
					expect(readFileSync(join(fixture.host.boardDir, publication.sourcePath), "utf8")).toContain(diagnostic);
				}
				expect(JSON.stringify(logs.entries)).toContain(diagnostic);
				expect(JSON.stringify(logs.entries)).toContain(NAMED_PROBLEM);
				expect(fixture.provider.launched).toHaveLength(2);
			}).pipe(Effect.provide(fleetHostLayer(fixture.host, fixture.parts)), Effect.provide(NodeServices.layer), Effect.provide(logs.layer)),
		);
	});
}
