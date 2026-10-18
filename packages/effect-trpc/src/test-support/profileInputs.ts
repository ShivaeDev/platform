import { Effect, Layer } from "effect";
import { RejectionError, rejectWith } from "#rejection.ts";
import { adapterHost } from "./adapterHost.ts";
import { BadRequest, Mark, Profile, Range, rejectSpoofed, Spoofed } from "./inputSchemas.ts";
import type { RouterEngine } from "./routerEngine.ts";
import { selectRouter } from "./routerSetup.ts";
import { trpc } from "./routerStory.ts";

function* build(engine: RouterEngine) {
	const { adapter, procedure, t } = yield* adapterHost(engine, Layer.empty);
	const router = t.router({
		constructed: procedure.mutation(function* () {
			return yield* Effect.fail(new RejectionError({ _tag: "BadRequest", invalidInput: true, message: "Declared" }));
		}),
		declared: procedure.input(Mark).mutation(function* ({ mark }) {
			return yield* Effect.fail(new Spoofed({ invalidInput: mark, message: "Declared" })).pipe(rejectSpoofed);
		}),

		range: procedure.input(Range).query(function* ({ from, to }) {
			yield* Effect.void;
			return to - from;
		}),
		save: procedure.input(Profile).mutation(function* ({ name }) {
			if (name === "taken") {
				return yield* Effect.fail(new BadRequest({ field: "name", message: "Name is taken" })).pipe(rejectWith(BadRequest));
			}
			return name;
		}),
	});
	return { router, runWithServices: adapter.runWithServices };
}
export function profileInputs() {
	return trpc.trait("router", "profile inputs validate fields and distinguish declared rejections", (engine) => {
		selectRouter(engine, "profileInputs", (state) => Effect.gen(() => build(state)));
	});
}
