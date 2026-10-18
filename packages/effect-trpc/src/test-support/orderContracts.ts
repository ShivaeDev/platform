import { Effect, Layer } from "effect";
import { rejectWith } from "#rejection.ts";
import { adapterHost } from "./adapterHost.ts";
import { Forget, OrderNotFound, Place } from "./orderSchemas.ts";
import type { RouterEngine } from "./routerEngine.ts";
import { selectRouter } from "./routerSetup.ts";
import { trpc } from "./routerStory.ts";

function place({ name, quantity }: typeof Place.payload.Type): Effect.Effect<string, typeof Place.error.Type> {
	if (name === "missing") {
		return Place.reject.OrderNotFound();
	}
	if (quantity < 0) {
		return Place.reject.Invalid({ field: "quantity", message: "Quantity cannot be negative" });
	}
	return Effect.succeed(`placed:${name}`);
}

function* build(engine: RouterEngine) {
	const { adapter, procedure, t } = yield* adapterHost(engine, Layer.empty);
	const router = t.router({
		forget: procedure.mutation(function* () {
			return yield* Effect.fail(new OrderNotFound()).pipe(rejectWith(Forget.error));
		}),
		place: procedure.input(Place.payload).mutation(function* (draft) {
			return yield* place(draft).pipe(rejectWith(Place.error));
		}),
	});
	return { router, runWithServices: adapter.runWithServices };
}
export function orderContracts() {
	return trpc.trait("router", "orders use contract payloads and rejection schemas", (engine) => {
		selectRouter(engine, "orderContracts", (state) => Effect.gen(() => build(state)));
	});
}
