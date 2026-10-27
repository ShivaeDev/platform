import { Effect, FileSystem, Schema } from "effect";
import { BadRequest, Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { boardDocuments, boardSnapshot } from "#board/documents.ts";
import { fleetApproved, fleetLaunch } from "#board/fleetField.ts";
import { inBoardReadPass, workMetadata } from "#board/readPass.ts";
import { briefChanged } from "#engine/boardBrief.ts";
import { STOP_REASON } from "#engine/stopCommand.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { refreshForeignReservations } from "#host/foreignReservations.ts";
import { type MainSnapshot, MainSource } from "#host/mainSource.ts";
import { workerCwd } from "#host/providers.ts";
import { launchPrompt } from "#host/workerBrief.ts";
import type { DispatchNow, FleetRecord } from "#model.ts";
import { BoardGateway, type BoardWork } from "#policy.ts";
import { coversRepository, preparationStop } from "#preparation/compatibility.ts";
import type { Preparation } from "#preparation/schema.ts";
import { sweepMerged } from "#scheduling/sweeps.ts";
import { LaunchSettings } from "#session/schema.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";

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

const taskLaunch = Effect.fn("FleetHost.taskLaunch")(function* (work: BoardWork) {
	const override = fleetLaunch(yield* workMetadata(work));
	return yield* override === undefined
		? Effect.succeed(undefined)
		: Schema.decodeUnknownEffect(LaunchSettings)(override).pipe(
				Effect.mapError(() => new BadRequest({ message: `${work.workId} has an invalid fleet-launch; use model, effort and serviceTier strings` })),
			);
});

function unlaunched(record: FleetRecord) {
	return record.step === "queued" && record.attempts.length === 0;
}

function stalePreparation(record: FleetRecord, work: BoardWork, main: MainSnapshot) {
	const changed = briefChanged(record, work);
	return record.step === "queued" && (unlaunched(record) || !changed) && (changed || record.preparation.baseRevision !== main.revision);
}

function stoppedBehindMain(record: FleetRecord) {
	const decision = record.decision;
	return (
		record.step === "waiting"
		&& record.attempts.length === 0
		&& decision !== undefined
		&& decision.worker === undefined
		&& preparationStop(decision)
		&& coversRepository(record.preparation)
	);
}

export type Approval = "board" | "explicit";

export const prepareApproved = Effect.fn("FleetHost.prepareApproved")(function* (
	host: FleetHost,
	work: BoardWork,
	input: FleetRecord | undefined,
	approval: Approval,
) {
	if (!work.approved || ["done", "superseded", "deferred", "dropped"].includes(work.status ?? "")) {
		return;
	}
	const fleet = yield* Fleet;
	const record = input?.step === "released" && input.result?.kind === "change" ? (yield* fleet.reconcile(work.workId)).value : input;
	if (record !== undefined && sweepMerged(record) && !(approval === "explicit" && briefChanged(record, work))) {
		return;
	}
	if (record?.step === "queued" && record.launchRetry !== undefined) {
		return;
	}
	const main = yield* MainSource;
	const snapshot = yield* main.current;
	const reapproved = record !== undefined && approval === "explicit" && (record.step === "released" || briefChanged(record, work));
	const released =
		record?.step === "released" && record.result?.kind !== "change" && !record.releaseReason?.startsWith(STOP_REASON) && !sweepMerged(record);
	if (record !== undefined && !released && !reapproved && !stalePreparation(record, work, snapshot) && !stoppedBehindMain(record)) {
		return;
	}
	yield* fleet.prepare({
		cwd: workerCwd(host, main.repositoryRoot),
		launch: yield* taskLaunch(work),
		preparation: preparation(snapshot),
		prompt: yield* launchPrompt(host, work),
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
	const failures = [...Array.from(snapshot.problems.values(), (problem) => problem.message), ...(yield* refreshForeignReservations())];
	const dispatches = yield* (yield* dispatchStore(host.namespace)).list();
	const cancelled = new Set(dispatches.filter((request) => request.status === "cancelled").map((request) => request.workId));
	for (const workId of (yield* approvedWorkIds(host)).filter((id) => !cancelled.has(id))) {
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

export const dispatchApproved = Effect.fn("FleetHost.dispatchApproved")(function* (host: FleetHost, workId: string, now?: DispatchNow) {
	const fleet = yield* Fleet;
	const work = yield* (yield* BoardGateway).get(workId);
	if (!work.approved) {
		return yield* Effect.fail(new Forbidden({ message: `${workId} needs "fleet: approved" in its Board frontmatter` }));
	}
	yield* (yield* MainSource).refresh;
	const existing = (yield* fleet.list()).find(({ value }) => value.workId === workId)?.value;
	if (existing === undefined || ["done", "released"].includes(existing.step) || unlaunched(existing) || !briefChanged(existing, work)) {
		yield* prepareApproved(host, work, existing, "explicit");
	}
	return yield* fleet.dispatch(workId, yield* launchPrompt(host, work), now);
}, inBoardReadPass);
