import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { PUBLISHED_REPORT } from "#host/reportBoard.ts";
import { dispatchWork } from "#test/dispatchWork.ts";
import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { attachmentBoard, attachmentItems, expectReportAttachments, turnDownload } from "#test/reportAttachments.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\ndelivers: report\n---\n# Research\n";
const OUTPUT = "The report stays private to Board.";

describe("Report attachments", () => {
	const test = postgresTests("live");
	for (const attachments of [true, false]) {
		test(`completes a report ${attachments ? "with downloaded text and encoded binary files beside the result" : "without attachments"}`, function* () {
			const download = yield* turnDownload(attachments ? attachmentItems() : []);
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
					expect(result.value.step).toBe("done");
					expect(fixture.provider.archived).toEqual([observation.receipt.sessionId]);
					const report = result.value.report;
					if (report === undefined) {
						return yield* Effect.die(new Error(result.value.decision?.reason ?? "No report result"));
					}
					expectReportAttachments(fixture.host.boardDir, report, attachments, OUTPUT);
					expect(download.requests.filter((request) => request.method === "thread/items/list").map((request) => request.params)).toEqual([
						{ cursor: null, limit: 100, sortDirection: "asc", threadId: observation.receipt.sessionId, turnId: observation.receipt.turnId },
					]);
					expect(collector.requests).toHaveLength(4);
					expect((yield* complete).value.report).toEqual(report);
					expect(fixture.provider.launched).toHaveLength(1);
					expect(fixture.provider.settings).toHaveLength(2);
					expect(readFileSync(join(fixture.host.boardDir, "research.md"), "utf8")).toBe(
						SOURCE.replace("delivers: report\n", 'delivers: report\nstatus: done\nnext_action: "Done; report recorded."\n'),
					);
				}),
			);
		});
	}
	for (const published of ["branch", "pr"] as const) {
		for (const output of [OUTPUT, "FLEET_QUESTION: Which approach?"]) {
			test(`rejects a published ${published} after a report turn${output === OUTPUT ? "" : " with a question and changed context"}`, function* () {
				const download = yield* turnDownload(attachmentItems());
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
							fixture.write("research.md", SOURCE.replace("delivers: report\n", ""));
						}
						const result = yield* Effect.gen(function* () {
							return yield* (yield* Fleet).reconcile("research");
						}).pipe(Effect.provide(hostLayer(fixture.host, parts)));
						expect(result.value.step).toBe("waiting");
						expect(result.value.decision?.reason).toBe(PUBLISHED_REPORT);
						expect(result.value.decision?.worker).toBeUndefined();
						expect(result.value.report).toBeUndefined();
						expect(fixture.provider.archived).toEqual([]);
						expect(download.requests).toEqual([]);
						expect(collector.requests).toHaveLength(2);
						expect(readdirSync(join(fixture.host.boardDir, "responses")).some((file) => file.startsWith("fleet-report."))).toBe(false);
					}),
				);
			});
		}
	}
});
