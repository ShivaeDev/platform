import { Effect } from "effect";
import { initializeWorkerRelease } from "./initializeWorkerRelease.ts";
import { registerWorkerRelease } from "./registerWorkerRelease.ts";
import { setWorkerReleaseActive } from "./setWorkerReleaseActive.ts";

export const makeWorkerRelease = Effect.fn("EffectSql.makeWorkerRelease")(function* () {
	const state = yield* initializeWorkerRelease;
	return {
		service: { register: registerWorkerRelease(state) },
		setActive: setWorkerReleaseActive(state),
	};
});
