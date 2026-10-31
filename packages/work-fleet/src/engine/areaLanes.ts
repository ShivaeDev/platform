import { Effect } from "effect";
import { missingBoardItem } from "#engine/missingBoardWork.ts";
import { qualifyAreaWaiter } from "#engine/qualifyAreaWaiter.ts";
import { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";
import { BoardGateway, FleetPolicy } from "#policy.ts";
import { areaQueueOrder, areaWaiter, blocksMergeChain } from "#scheduling/areaQueue.ts";
import { areasOverlap, DEFAULT_AREA_MERGE_WAIT_MS, holdsAreas } from "#scheduling/areas.ts";
import { fleetStage } from "#stage.ts";

function task(record: FleetRecord) {
	return { prUrl: record.result?.kind === "change" ? record.result.pr : null, stage: fleetStage(record), workId: record.workId };
}

export const areaLanes = Effect.gen(function* () {
	const store = yield* FleetRepository;
	const board = yield* BoardGateway;
	const configuration = yield* FleetPolicy;
	return Effect.fn("Fleet.areaLanes")(function* (names: readonly string[]) {
		const policy = yield* configuration.current ?? Effect.succeed(configuration);
		const now = policy.now();
		const records = (yield* store.list()).map(({ value }) => value);
		const external = yield* store.foreignReservations();
		const holders = records.filter((record) => holdsAreas(record, now, policy.areaMergeWaitMs ?? DEFAULT_AREA_MERGE_WAIT_MS));
		const waiting = yield* Effect.forEach(
			records.filter((record) => !holders.includes(record) && areaWaiter(record, now) && record.areas?.length),
			(record) =>
				board.get(record.workId).pipe(
					Effect.flatMap((work) =>
						qualifyAreaWaiter(work, records, board.get).pipe(
							Effect.map((eligible) => (eligible ? [{ ...record, queuePriority: work.priority }] : [])),
						),
					),
					Effect.catchTag("BoardFailure", (error) => (missingBoardItem(error) ? Effect.succeed([]) : Effect.fail(error))),
				),
		);
		const queue = waiting.flat().sort(
			(left, right) =>
				((left.queuePriority ?? "normal") === (right.queuePriority ?? "normal")
					? Number(left.step === "queued" && blocksMergeChain(right, records)) - Number(right.step === "queued" && blocksMergeChain(left, records))
					: 0)
				|| areaQueueOrder(
					left,
					right,
					records.findIndex((record) => record.workId === left.workId),
					records.findIndex((record) => record.workId === right.workId),
				),
		);
		const areas = new Set([
			...names,
			...holders.flatMap((record) => record.areas ?? []),
			...queue.flatMap((record) => record.areas ?? []),
			...external.flatMap((reservation) => reservation.areas),
		]);
		return [...areas]
			.sort((left, right) => left.localeCompare(right))
			.map((area) => ({
				area,
				holders: [
					...external
						.filter((reservation) => reservation.areas.some((name) => areasOverlap(area, name)))
						.map((reservation) => ({
							prUrl: reservation.owner.startsWith("https://github.com/") ? reservation.owner : null,
							stage: "external",
							workId: reservation.owner,
						})),
					...holders.filter((record) => record.areas?.some((name) => areasOverlap(area, name))).map(task),
				],
				queue: queue.filter((record) => record.areas?.some((name) => areasOverlap(area, name))).map(task),
			}));
	});
});
