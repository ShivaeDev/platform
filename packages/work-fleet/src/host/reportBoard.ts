import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { reportFiles } from "#board/reportFiles.ts";
import { reportIdentity } from "#board/reportIdentity.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import type { FleetHost } from "#host/config.ts";
import { MainSource } from "#host/mainSource.ts";
import { type ReportFile, reportDiffFiles } from "#host/reportDiff.ts";
import { reportPublication, reportRepository } from "#host/reportPublication.ts";
import { BoardFailure, BoardGateway, type BoardWork, FleetFailure } from "#policy.ts";
import { codexTaskDiff } from "#providers/codexTaskDiff.ts";
import { SessionFailure, type SessionObservation, type SessionReceipt } from "#session/schema.ts";

export const PUBLISHED_REPORT = "Report worker published to GitHub";

function attachmentFailure(error: unknown) {
	if (error instanceof BoardFailure) {
		return error;
	}
	const message =
		error instanceof FleetFailure || error instanceof SessionFailure ? error.message : "Cloud report attachments could not be downloaded";
	return new BoardFailure({ message });
}

export function reportBoard<TCheckServices, TCheckError, TFileServices, TFileError>(
	root: string,
	check: (work: BoardWork) => Effect.Effect<boolean, TCheckError, TCheckServices>,
	files: (receipt: SessionReceipt) => Effect.Effect<readonly ReportFile[], TFileError, TFileServices>,
) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const services = yield* Effect.context<TCheckServices | TFileServices>();
			const board = yield* BoardGateway;
			function inspect(work: BoardWork) {
				return check(work).pipe(
					Effect.provide(services),
					Effect.mapError(() => new FleetFailure({ message: "Report publication could not be checked on GitHub", reason: "integration" })),
					Effect.flatMap((published) => (published ? Effect.fail(new FleetFailure({ message: PUBLISHED_REPORT, reason: "invalid" })) : Effect.void)),
				);
			}
			const report = Effect.fn("Fleet.report")(function* (work: BoardWork, observation: SessionObservation) {
				const attachments = yield* files(observation.receipt).pipe(Effect.provide(services));
				const suffix = yield* reportFiles(root, reportIdentity(work, observation.receipt).itemId, attachments);
				return yield* board.report(work, { ...observation, output: observation.output + suffix });
			}, Effect.mapError(attachmentFailure));
			return Layer.merge(Layer.succeed(ReportInspection)({ check: inspect }), Layer.succeed(BoardGateway)({ ...board, report }));
		}),
	);
}

export function hostReportBoard(host: FleetHost) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const main = yield* MainSource;
			function check(work: BoardWork) {
				return Effect.gen(function* () {
					if (host.worker === undefined) {
						return yield* Effect.fail(new BoardFailure({ message: "Report publication checks need worker.branchPrefix" }));
					}
					return yield* reportPublication(
						yield* reportRepository(main.repositoryRoot, host.repository.remote),
						`${host.worker.branchPrefix}${work.workId}`,
					);
				});
			}
			function files(receipt: SessionReceipt) {
				return host.provider === "cloud" && host.cloud !== undefined
					? Effect.scoped(codexTaskDiff(host.cloud, host.cloud.requestTimeoutMs ?? 60_000)(receipt).pipe(Effect.flatMap(reportDiffFiles)))
					: Effect.succeed([]);
			}
			return reportBoard(host.boardDir, check, files).pipe(Layer.provide(markdownBoard(host.boardDir)));
		}),
	).pipe(Layer.provide(NodeServices.layer));
}
