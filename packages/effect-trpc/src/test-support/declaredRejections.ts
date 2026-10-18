import { Effect, Layer, Schema } from "effect";
import { notFound } from "#errors.ts";
import { rejectWith } from "#rejection.ts";
import { adapterHost } from "./adapterHost.ts";
import { Rejection, rename, Throttled } from "./rejectionSchemas.ts";
import type { RouterEngine } from "./routerEngine.ts";
import { trpc } from "./routerStory.ts";

function* build(engine: RouterEngine) {
	const { adapter, procedure, t } = yield* adapterHost(engine, Layer.empty);
	const privateDetail = "postgres://app:hunter2@db.internal/app";
	const router = t.router({
		defect: procedure.query(function* () {
			return yield* Effect.die(new Error(privateDetail));
		}),
		explicit: procedure.query(function* () {
			return yield* notFound("Explicitly missing");
		}),
		rename: procedure.input(Schema.Struct({ name: Schema.String })).mutation(function* ({ name }) {
			return yield* rename(name).pipe(rejectWith(Rejection));
		}),
		throttle: procedure.mutation(function* () {
			return yield* rename("throttled").pipe(rejectWith(Throttled, { code: () => "TOO_MANY_REQUESTS" }));
		}),
	});
	return { router, runWithServices: adapter.runWithServices };
}
export function declaredRejections() {
	return trpc.trait("router", "rename declares its public rejection schema", (engine) => {
		engine.build = (state) => Effect.gen(() => build(state));
	});
}
