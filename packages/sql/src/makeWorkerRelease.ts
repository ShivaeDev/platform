import { Context, Effect, Layer } from "effect";
import { WorkerRelease } from "#worker-release/service.ts";

export const makeWorkerRelease = Effect.fn("EffectSql.makeWorkerRelease")(function* () {
	const context = yield* Layer.build(WorkerRelease.layer);
	const service = Context.get(context, WorkerRelease);
	return { service, setActive: service.setActive };
});
