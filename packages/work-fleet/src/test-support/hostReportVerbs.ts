import { readdirSync, readFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect, Tracer } from "effect";
import { diagnostics } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { releaseWork } from "#host/releaseWork.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { waitFor } from "#host/wait.ts";
import { until } from "#test/cloudRestart.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { answerReport } from "#test/report.ts";
import { reportAttachmentReadout } from "#test/reportAttachments.ts";
import { reportHistoryVerbs } from "#test/reportHistory.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

export function hostReportVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		...reportHistoryVerbs(engine),
		answerReport: (published: Parameters<typeof answerReport>[1], action: Parameters<typeof answerReport>[2]) => {
			tell(`answer the report decision with ${action}`);
			return answerReport(engine.fixture.host.boardDir, published, action);
		},
		answerWorker: (decision: Parameters<typeof answerWorker>[1]) => {
			tell(`publish an answer to ${decision.id}`);
			return answerWorker(engine.fixture.host.boardDir, decision);
		},
		askWorker: (workId = "one") => {
			tell(`the worker asks a question about ${workId}`);
			return askWorker(engine.observedProvider, workId).pipe(Effect.provideContext(engine.running.context));
		},
		awaitBoardText: (file: string, text: string) =>
			until(() => Effect.sync(() => readFileSync(join(engine.fixture.host.boardDir, file), "utf8").includes(text))),
		boardFiles: (folder: string) => readdirSync(join(engine.fixture.host.boardDir, folder)),
		downloadRequests: () => {
			if (engine.attachmentDownload === undefined) {
				throw new Error("Configure a report download before reading its requests");
			}
			return engine.attachmentDownload.requests;
		},
		fleetItems: () => engine.running.client("daemon.fleetItems", {}),
		health: () => diagnostics.fleetHealth(engine.fixture.host.boardDir),
		publicationRequests: () => engine.publicationRequests,
		release: (ids: readonly string[]) => {
			tell(`release ${ids.join(", ")}`);
			return releaseWork(engine.fixture.host, ids, engine.runningParts ?? engine.fixture.parts);
		},
		renderedStatus: () => engine.running.client("daemon.status", {}).pipe(Effect.map(renderStatus)),
		reportFiles: (report: Parameters<typeof reportAttachmentReadout>[1]) => reportAttachmentReadout(engine.fixture.host.boardDir, report),
		summaries: (ids?: readonly string[]) => readWaitStates(engine.fixture.host, ids).pipe(Effect.provideContext(engine.running.context)),
		touchGuidance: () =>
			Effect.gen(function* () {
				tell("advance the guidance file's modification time");
				const changedAt = new Date((yield* Clock.currentTimeMillis) + 1000);
				utimesSync(join(engine.fixture.host.boardDir, "guidance.txt"), changedAt, changedAt);
			}),
		tracedSummaries: (ids: readonly string[]) =>
			Effect.gen(function* () {
				tell("read lightweight wait summaries while tracing SQL statements");
				const spans: Tracer.NativeSpan[] = [];
				const tracer = Tracer.make({
					span: (options) => {
						const span = new Tracer.NativeSpan(options);
						spans.push(span);
						return span;
					},
				});
				const states = yield* readWaitStates(engine.fixture.host, ids).pipe(Effect.provideContext(engine.running.context), Effect.withTracer(tracer));
				const statements = spans.flatMap((span) => {
					const text = span.attributes.get("db.query.text");
					return typeof text === "string" ? [text] : [];
				});
				return { statements, states };
			}),
		wait: (workId: string, timeoutMs = 1000) => {
			tell(`wait for ${workId}'s outcome`);
			return waitFor({ intervalMs: 1, port: engine.running.port, timeoutMs, workId });
		},
	};
}
