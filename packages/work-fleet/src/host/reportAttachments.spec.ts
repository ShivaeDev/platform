import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { PUBLISHED_REPORT } from "#host/reportBoard.ts";
import { withHost } from "#test/fleetHost.ts";
import { attachmentBoard, attachmentDiff, expectReportAttachments, taskDownload } from "#test/reportAttachments.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n";
const OUTPUT = "The report stays private to Board.";

describe("Report attachments", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);
	for (const attachments of [true, false]) {
		test(`completes a report ${attachments ? "with downloaded text and binary files beside the result" : "without attachments"}`, function* () {
			const download = yield* taskDownload(attachments ? attachmentDiff() : "");
			yield* withHost({ "research.md": SOURCE }, {}, (fixture) =>
				Effect.gen(function* () {
					const collector = attachmentBoard(fixture.host.boardDir, download);
					const parts = { ...fixture.parts, board: collector.board };
					yield* dispatchWork(fixture.host, "research", parts);
					const observation = [...fixture.provider.observations.values()][0];
					if (observation === undefined) {
						return yield* Effect.die(new Error("No report worker"));
					}
					fixture.provider.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output: OUTPUT });
					const complete = Effect.gen(function* () {
						return yield* (yield* Fleet).reconcile("research");
					}).pipe(Effect.provide(hostLayer(fixture.host, parts)));
					const result = yield* complete;
					expect(result.value.stage).toBe("completed");
					const report = result.value.report;
					if (report === undefined) {
						return yield* Effect.die(new Error(result.value.decision?.reason ?? "No report result"));
					}
					expectReportAttachments(fixture.host.boardDir, report, attachments, OUTPUT);
					expect(download.requests).toEqual([
						{ accountSelected: true, authenticated: true, path: `/backend-api/wham/tasks/${encodeURIComponent(observation.receipt.sessionId)}` },
					]);
					expect(collector.requests).toHaveLength(4);
					expect((yield* complete).value.report).toEqual(report);
					expect(fixture.provider.launched).toHaveLength(1);
					expect(fixture.provider.settings).toHaveLength(2);
					expect(readFileSync(join(fixture.host.boardDir, "research.md"), "utf8")).toBe(SOURCE);
				}),
			);
		}, 30_000);
	}
	for (const published of ["branch", "pr"] as const) {
		for (const output of [OUTPUT, "FLEET_QUESTION: Which approach?"]) {
			test(`rejects a published ${published} after a report turn${output === OUTPUT ? "" : " with a question and changed context"}`, function* () {
				const download = yield* taskDownload(attachmentDiff());
				yield* withHost({ "research.md": SOURCE }, {}, (fixture) =>
					Effect.gen(function* () {
						const collector = attachmentBoard(fixture.host.boardDir, download, published);
						const parts = { ...fixture.parts, board: collector.board };
						yield* dispatchWork(fixture.host, "research", parts);
						const observation = [...fixture.provider.observations.values()][0];
						if (observation === undefined) {
							return yield* Effect.die(new Error("No report worker"));
						}
						fixture.provider.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output });
						if (output !== OUTPUT) {
							fixture.write("research.md", SOURCE.replace("fleet-deliverable: report\n", ""));
						}
						const result = yield* Effect.gen(function* () {
							return yield* (yield* Fleet).reconcile("research");
						}).pipe(Effect.provide(hostLayer(fixture.host, parts)));
						expect(result.value.stage).toBe("needs-human");
						expect(result.value.decision?.reason).toBe(PUBLISHED_REPORT);
						expect(result.value.decision?.worker).toBeUndefined();
						expect(result.value.report).toBeUndefined();
						expect(download.requests).toEqual([]);
						expect(collector.requests).toHaveLength(2);
						expect(readdirSync(join(fixture.host.boardDir, "responses")).some((file) => file.startsWith("fleet-report."))).toBe(false);
					}),
				);
			}, 30_000);
		}
	}
});
