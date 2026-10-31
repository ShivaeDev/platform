import { Deferred, Effect, PubSub } from "effect";
import { vi } from "vitest";
import { boardStory } from "./boardStory.ts";
import { indexDeliveryBoundary } from "./indexDeliveryBoundary.ts";
import { liveState } from "./liveState.ts";

export const interruptedDelivery = boardStory.trait("project", "the server's live delivery can lose one change", function* (engine) {
	const isIndex = yield* indexDeliveryBoundary;
	const { dropped } = liveState(engine);
	const state: NonNullable<typeof engine.changeDelivery> = { dropped: false, loseNext: false };
	engine.changeDelivery = state;
	const publish = PubSub.publish;
	const spy = vi.spyOn(PubSub, "publish").mockImplementation((...args: Parameters<typeof publish>) => {
		if (!isIndex(args[0])) {
			return publish(...args);
		}
		const event = args[1];
		if (state.loseNext && typeof event === "object" && event !== null && "_tag" in event && event._tag === "Changed" && "sequence" in event) {
			state.loseNext = false;
			state.dropped = true;
			Deferred.doneUnsafe(dropped, Effect.void);
			return Effect.succeed(true);
		}
		if (
			state.omitPath
			&& typeof event === "object"
			&& event !== null
			&& "_tag" in event
			&& event._tag === "Changed"
			&& "paths" in event
			&& Array.isArray(event.paths)
			&& event.paths.includes(state.omitPath)
		) {
			const paths = event.paths.filter((path) => path !== state.omitPath);
			delete state.omitPath;
			return publish(args[0], { ...event, paths });
		}
		return publish(...args);
	});
	yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
});
