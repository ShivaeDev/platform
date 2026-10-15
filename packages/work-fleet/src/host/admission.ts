import { Effect, FileSystem, Schema } from "effect";
import { BadRequest, Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { boardDocuments, boardSnapshot } from "#board/documents.ts";
import { fleetApproved, fleetLaunch } from "#board/fleetField.ts";
import { inBoardReadPass, workMetadata } from "#board/readPass.ts";
import { briefChanged } from "#engine/boardBrief.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { type MainSnapshot, MainSource } from "#host/mainSource.ts";
import { workerCwd } from "#host/providers.ts";
import type { FleetRecord } from "#model.ts";
import { BoardGateway, type BoardWork } from "#policy.ts";
import type { Preparation } from "#preparation/schema.ts";
import { workerPrompt } from "#prompt/worker.ts";
import { LaunchSettings } from "#session/schema.ts";

// Workers start from current main, so the whole repository is their scope and preparation pins only the base.
function preparation(main: MainSnapshot): Preparation {
	return {
		baselinePaths: [],
		baseRevision: main.revision,
		configuration: [],
		contextComplete: false,
		dependencyPaths: [],
		observedAt: main.observedAt,
		ownedPaths: ["."],
		qualityPaths: [],
		setupPaths: [],
		sourcePaths: [],
		validation: [],
	};
}

function launchPrompt(host: FleetHost, work: BoardWork): string {
	return host.provider === "cloud" && host.worker !== undefined
		? workerPrompt({
				branch: `${host.worker.branchPrefix}${work.workId}`,
				deliverable: work.deliverable,
				sharedEnvironment: host.worker.sharedEnvironment,
				task: work.context,
				workId: work.workId,
			})
		: work.context;
}

const taskLaunch = Effect.fn("FleetHost.taskLaunch")(function* (work: BoardWork) {
	const override = fleetLaunch(yield* workMetadata(work));
	return yield* override === undefined
		? Effect.succeed(undefined)
		: Schema.decodeUnknownEffect(LaunchSettings)(override).pipe(
				Effect.mapError(() => new BadRequest({ message: `${work.workId} has an invalid fleet-launch; use model, effort and serviceTier strings` })),
			);
});

function unlaunched(record: FleetRecord) {
	return record.stage === "prepared" && record.attempts.length === 0;
}

function stalePreparation(record: FleetRecord, work: BoardWork, main: MainSnapshot) {
	return unlaunched(record) && (briefChanged(record, work) || record.preparation.baseRevision !== main.revision);
}

export type Approval = "board" | "explicit";

export const prepareApproved = Effect.fn("FleetHost.prepareApproved")(function* (
	host: FleetHost,
	work: BoardWork,
	record: FleetRecord | undefined,
	approval: Approval,
) {
	if (record?.stage === "prepared" && record.launchRetry !== undefined) {
		return;
	}
	const fleet = yield* Fleet;
	const main = yield* MainSource;
	const snapshot = yield* main.current;
	const reapproved = record !== undefined && approval === "explicit" && (record.stage === "released" || briefChanged(record, work));
	if (record !== undefined && !reapproved && !stalePreparation(record, work, snapshot)) {
		return;
	}
	yield* fleet.prepare({
		cwd: workerCwd(host, main.repositoryRoot),
		launch: yield* taskLaunch(work),
		preparation: preparation(snapshot),
		prompt: launchPrompt(host, work),
		workId: work.workId,
	});
});

export const approvedWorkIds = Effect.fn("FleetHost.approvedWorkIds")(function* (host: FleetHost) {
	const fs = yield* FileSystem.FileSystem;
	const documents = yield* boardDocuments(host.boardDir, yield* fs.realPath(host.boardDir));
	return documents.flatMap((document) =>
		document.parsed.fields.id !== undefined && fleetApproved(document.parsed) ? [document.parsed.fields.id] : [],
	);
});

export const admitApproved = Effect.fn("FleetHost.admitApproved")(function* (host: FleetHost) {
	const fleet = yield* Fleet;
	const board = yield* BoardGateway;
	yield* (yield* MainSource).refresh;
	const records = new Map((yield* fleet.list()).map(({ value }) => [value.workId, value]));
	const fs = yield* FileSystem.FileSystem;
	const snapshot = yield* boardSnapshot(host.boardDir, yield* fs.realPath(host.boardDir));
	const failures = Array.from(snapshot.problems.values(), (problem) => problem.message);
	for (const workId of yield* approvedWorkIds(host)) {
		const admitted = yield* board.get(workId).pipe(
			Effect.flatMap((work) => prepareApproved(host, work, records.get(workId), "board")),
			Effect.result,
		);
		if (admitted._tag === "Failure") {
			failures.push(`${workId}: ${admitted.failure.message}`);
		}
	}
	return failures;
}, inBoardReadPass);

export const dispatchApproved = Effect.fn("FleetHost.dispatchApproved")(function* (host: FleetHost, workId: string) {
	const fleet = yield* Fleet;
	const work = yield* (yield* BoardGateway).get(workId);
	if (!work.approved) {
		return yield* Effect.fail(new Forbidden({ message: `${workId} needs "fleet: approved" in its Board frontmatter` }));
	}
	yield* (yield* MainSource).refresh;
	const existing = (yield* fleet.list()).find(({ value }) => value.workId === workId)?.value;
	if (existing === undefined || ["completed", "released"].includes(existing.stage) || unlaunched(existing) || !briefChanged(existing, work)) {
		yield* prepareApproved(host, work, existing, "explicit");
	}
	return yield* fleet.dispatch(workId, launchPrompt(host, work));
}, inBoardReadPass);
