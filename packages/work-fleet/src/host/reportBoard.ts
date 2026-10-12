import * as NodeServices from "@effect/platform-node/NodeServices";
import { Context, Effect, Layer } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { BadRequest, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { markdownBoard } from "#board/markdown.ts";
import { reportContent } from "#board/reportContent.ts";
import { reportFiles } from "#board/reportFiles.ts";
import { reportIdentity } from "#board/reportIdentity.ts";
import { reportLinks } from "#board/reportLinks.ts";
import { reportPayload } from "#board/reportPayload.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import { isFleetError } from "#errors.ts";
import type { FleetHost } from "#host/config.ts";
import { MainSource } from "#host/mainSource.ts";
import { reportPublication, reportRepository } from "#host/reportPublication.ts";
import { BoardFailure, BoardGateway, type BoardWork } from "#policy.ts";
import { codexReportAttachments } from "#providers/codexReportAttachments.ts";
import { declaredAttachments, type ReportAttachments } from "#reportAttachments.ts";
import { ReportFileFailure } from "#reportFileFailure.ts";
import { SessionFailure, type SessionObservation } from "#session/schema.ts";

export const PUBLISHED_REPORT = "Report worker published to GitHub";

function attachmentFailure(error: unknown) {
	if (error instanceof BoardFailure) {
		return error;
	}
	const message =
		isFleetError(error) || error instanceof SessionFailure || error instanceof ReportFileFailure
			? error.message
			: "Cloud report attachments could not be downloaded";
	return new BoardFailure({ message });
}

function unavailableAttachments(observation: SessionObservation, error: unknown): ReportAttachments {
	const declared = declaredAttachments(observation.output);
	return {
		files: [],
		unavailable: (declared.length === 0 ? ["Attachment collection"] : declared).map((path) => ({ path, reason: attachmentFailure(error).message })),
	};
}

class ReportInputs extends Context.Service<
	ReportInputs,
	{
		readonly root: string;
		readonly check: (work: BoardWork) => Effect.Effect<boolean, unknown>;
		readonly files: (observation: SessionObservation) => Effect.Effect<ReportAttachments, unknown>;
	}
>()("Fleet/ReportInputs") {}

const ReportBoard = defineService({
	id: "Fleet/ReportBoard",
	initialize: Effect.gen(function* () {
		const board = yield* BoardGateway;
		const { root, check, files } = yield* ReportInputs;
		function inspect(work: BoardWork) {
			return check(work).pipe(
				Effect.mapError(() => new ServiceUnavailable({ message: "Report publication could not be checked on GitHub" })),
				Effect.flatMap((published) =>
					published ? Effect.fail(withFailureContext(new BadRequest({ message: PUBLISHED_REPORT }), { code: "report-published" })) : Effect.void,
				),
			);
		}
		const collect = Effect.fn("Fleet.collect")(function* (work: BoardWork, observation: SessionObservation) {
			const attachments = yield* files(observation).pipe(
				Effect.catch((error) =>
					error instanceof ReportFileFailure ? Effect.fail(error) : Effect.succeed(unavailableAttachments(observation, error)),
				),
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

		return { inspect, report };
	}),
	methods: ({ inspect, report }) => ({ check: inspect, report }),
	requires: [BoardGateway, ReportInputs],
});

export function reportBoard<TCheckServices, TCheckError, TFileServices, TFileError>(
	root: string,
	check: (work: BoardWork) => Effect.Effect<boolean, TCheckError, TCheckServices>,
	files: (observation: SessionObservation) => Effect.Effect<ReportAttachments, TFileError, TFileServices>,
) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const services = yield* Effect.context<TCheckServices | TFileServices>();
			const inputs = Layer.succeed(ReportInputs, {
				check: (work) => check(work).pipe(Effect.provide(services)),
				files: (observation) => files(observation).pipe(Effect.provide(services)),
				root,
			});
			return Layer.unwrap(
				Effect.gen(function* () {
					const board = yield* BoardGateway;
					const reports = yield* ReportBoard;
					return Layer.merge(
						Layer.succeed(ReportInspection)({ check: reports.check }),
						Layer.succeed(BoardGateway)({ ...board, report: reports.report }),
					);
				}),
			).pipe(Layer.provide(ReportBoard.layer.pipe(Layer.provide(inputs))));
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
