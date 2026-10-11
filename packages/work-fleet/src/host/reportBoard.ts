import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { reportContent } from "#board/reportContent.ts";
import { reportFiles } from "#board/reportFiles.ts";
import { reportIdentity } from "#board/reportIdentity.ts";
import { reportLinks } from "#board/reportLinks.ts";
import { reportPayload } from "#board/reportPayload.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import type { FleetHost } from "#host/config.ts";
import { MainSource } from "#host/mainSource.ts";
import { reportPublication, reportRepository } from "#host/reportPublication.ts";
import { BoardFailure, BoardGateway, type BoardWork, FleetFailure } from "#policy.ts";
import { codexReportAttachments } from "#providers/codexReportAttachments.ts";
import { declaredAttachments, type ReportAttachments } from "#reportAttachments.ts";
import { SessionFailure, type SessionObservation } from "#session/schema.ts";

export const PUBLISHED_REPORT = "Report worker published to GitHub";

function attachmentFailure(error: unknown) {
	if (error instanceof BoardFailure) {
		return error;
	}
	const message =
		error instanceof FleetFailure || error instanceof SessionFailure ? error.message : "Cloud report attachments could not be downloaded";
	return new BoardFailure({ message });
}

function unavailableAttachments(observation: SessionObservation, error: unknown): ReportAttachments {
	const declared = declaredAttachments(observation.output);
	return {
		files: [],
		unavailable: (declared.length === 0 ? ["Attachment collection"] : declared).map((path) => ({ path, reason: attachmentFailure(error).message })),
	};
}

export function reportBoard<TCheckServices, TCheckError, TFileServices, TFileError>(
	root: string,
	check: (work: BoardWork) => Effect.Effect<boolean, TCheckError, TCheckServices>,
	files: (observation: SessionObservation) => Effect.Effect<ReportAttachments, TFileError, TFileServices>,
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
			const collect = Effect.fn("Fleet.collect")(function* (work: BoardWork, observation: SessionObservation) {
				const attachments = yield* files(observation).pipe(
					Effect.provide(services),
					Effect.catch((error) => Effect.succeed(unavailableAttachments(observation, error))),
				);
				const { itemId } = reportIdentity(work, observation.receipt);
				const output = observation.output + reportLinks(itemId, attachments.files, attachments.unavailable);
				yield* reportContent(work, { ...observation, output });
				return yield* reportPayload(root, work, observation).save({ files: attachments.files, output });
			});
			const report = Effect.fn("Fleet.report")(function* (work: BoardWork, observation: SessionObservation) {
				const { itemId } = reportIdentity(work, observation.receipt);
				const existing = yield* reportPayload(root, work, observation).read;
				const payload = existing ?? (yield* collect(work, observation));
				const reportObservation = { ...observation, output: payload.output };
				yield* reportContent(work, reportObservation);
				yield* reportFiles(root, itemId, payload.files);
				return yield* board.report(work, reportObservation);
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
			function files(observation: SessionObservation) {
				return host.provider === "cloud" && host.cloud !== undefined
					? codexReportAttachments(host.cloud, host.cloud.requestTimeoutMs ?? 60_000)(observation)
					: Effect.succeed({ files: [], unavailable: [] });
			}
			return reportBoard(host.boardDir, check, files).pipe(Layer.provide(markdownBoard(host.boardDir)));
		}),
	).pipe(Layer.provide(NodeServices.layer));
}
