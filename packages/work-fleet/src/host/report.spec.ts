import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { readOnlySql } from "#host/readOnlySql.ts";
import { fleetStatus, renderStatus } from "#host/status.ts";
import { WAIT_EXIT, waitFor } from "#host/wait.ts";
import { type HostFixture, withHost } from "#test/fleetHost.ts";
import { answerReport } from "#test/report.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n";
const OUTPUT = "  # Findings\n\nWhole report, including whitespace.\n";

const complete = Effect.fn("ReportTest.complete")(function* (fixture: HostFixture, body: string) {
	yield* dispatchWork(fixture.host, "research", fixture.parts);
	const [observation] = fixture.provider.observations.values();
	expect(observation?.output).toContain("Change nothing, commit nothing, push nothing, and open no PR");
	for (const [id, current] of fixture.provider.observations) {
		fixture.provider.observations.set(id, { ...current, execution: "completed", output: body });
	}
	const completed = yield* Effect.gen(function* () {
		return yield* (yield* Fleet).reconcile("research");
	}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
	expect(completed.value.result).toBeUndefined();
	expect(completed.value.review).toBeUndefined();
	expect(completed.value.checks).toBeUndefined();
	expect(fixture.provider.launched).toHaveLength(1);
	return { observation, value: completed.value };
});

const terminalViews = Effect.fn("ReportTest.terminalViews")(function* (fixture: HostFixture, code: number, section: string) {
	const outcome = yield* waitFor({
		databaseUrl: fixture.host.databaseUrl,
		intervalMs: 10,
		namespace: fixture.host.namespace,
		timeoutMs: 1000,
		workId: "research",
	});
	expect(outcome.code).toBe(code);
	const status = renderStatus(yield* fleetStatus(fixture.host).pipe(Effect.provide(readOnlySql(fixture.host))));
	expect(status).toContain(section);
	expect(status).toContain("Active (0)");
});

describe("Fleet report host", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);
	test("records the whole result and finishes without PR integrations", function* () {
		yield* withHost({ "research.md": SOURCE }, {}, (fixture) =>
			Effect.gen(function* () {
				const { value, observation } = yield* complete(fixture, OUTPUT);
				expect(value.stage).toBe("completed");
				const report = value.report;
				if (report === undefined) {
					return yield* Effect.die(new Error("Completed report needs a publication receipt"));
				}
				expect(report.receipt).toEqual(observation?.receipt);
				const content = readFileSync(join(fixture.host.boardDir, report.sourcePath), "utf8");
				const parsed = metadataParse(content);
				expect(parsed.diagnostics).toEqual([]);
				expect(parsed.fields.kind).toBe("result");
				expect(parsed.fields.relationships).toEqual([{ kind: "informs", target: "research" }]);
				expect(content.endsWith(OUTPUT)).toBe(true);
				expect(content).toContain(JSON.stringify({ ...observation?.receipt, workRevision: value.boardRevision }));
				expect(readdirSync(join(fixture.host.boardDir, "responses"))).toHaveLength(1);
				expect(readFileSync(join(fixture.host.boardDir, "research.md"), "utf8")).toBe(SOURCE);
				yield* terminalViews(fixture, WAIT_EXIT.completed, "Completed (1)");
			}),
		);
	}, 30_000);
	test("empty output needs a human and creates no result", function* () {
		yield* withHost({ "research.md": SOURCE }, {}, (fixture) =>
			Effect.gen(function* () {
				const { value } = yield* complete(fixture, " \n\t");
				expect(value.stage).toBe("needs-human");
				expect(value.decision?.reason).toBe("Report worker returned empty output");
				expect(value.report).toBeUndefined();
				expect(readdirSync(join(fixture.host.boardDir, "responses")).some((file) => file.startsWith("fleet-report."))).toBe(false);
				yield* terminalViews(fixture, WAIT_EXIT.needsHuman, "Needs human (1)");
				const decision = value.decision?.published;
				if (decision === undefined) {
					return yield* Effect.die(new Error("An empty report needs a Board decision"));
				}
				answerReport(fixture.host.boardDir, decision, "retry");
				const retried = yield* Effect.gen(function* () {
					return yield* (yield* Fleet).reconcile("research");
				}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
				expect(retried.value.stage).toBe("prepared");
				yield* dispatchWork(fixture.host, "research", fixture.parts);
				expect(fixture.provider.launched).toHaveLength(2);
			}),
		);
	}, 30_000);
});
