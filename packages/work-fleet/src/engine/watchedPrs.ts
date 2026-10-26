import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import type { FleetRecord } from "#model.ts";

export const publishedPr = Effect.fn("Fleet.publishedPr")(function* (state: EngineState, record: FleetRecord) {
	if (record.result?.kind === "change") {
		return record.result.pr;
	}
	if (record.attempts.length === 0 || state.integrations.publication === undefined || record.deliverable === "report") {
		return undefined;
	}
	const publication = yield* state.integrations.publication(yield* state.board.get(record.workId));
	return publication.pullRequest;
});

export const watchedPrs = Effect.fn("Fleet.watchedPrs")(function* (state: EngineState) {
	const records = yield* state.store.list();
	const known = records.flatMap(({ value }) =>
		[value, ...(value.history ?? [])].flatMap((cycle) =>
			cycle.result?.kind === "change" && cycle.step !== "done" && cycle.mergedDelivery === undefined ? [cycle.result.pr] : [],
		),
	);
	const pending = records.filter(({ value }) => value.result === undefined && !["done", "released"].includes(value.step));
	// Another item's unreadable publication is that item's own wait; it must not fail this item's prediction.
	const published = yield* Effect.forEach(pending, ({ value }) => publishedPr(state, value).pipe(Effect.orElseSucceed(() => undefined)));
	const foreign = (yield* state.store.foreignReservations()).map((entry) => entry.owner).filter((owner) => owner.startsWith("https://github.com/"));
	return [...known, ...published.filter((pr) => pr !== undefined), ...foreign];
});
