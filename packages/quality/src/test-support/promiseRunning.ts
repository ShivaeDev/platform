import { Deferred, Effect } from "effect";
import { runRules } from "#engine/runRules.ts";
import { defineRule, type Findings } from "#rule.ts";
import { inputsOf } from "./inputs.ts";
import { qualityLifecycle } from "./qualityLifecycle.ts";

export const promiseRunning = qualityLifecycle.trait(
	"running",
	"quality runs a rule whose Promise check waits until its abort signal fires",
	function* (engine) {
		const rule = defineRule({
			check: ({ signal }) =>
				new Promise<Findings>((resolve) => {
					engine.promiseSignal = signal;
					signal?.addEventListener("abort", () => resolve([]), { once: true });
					Effect.runSync(Deferred.succeed(engine.promiseReady, undefined));
				}),
			description: "Waits for cancellation.",
			id: "local/wait",
		});
		const configured = yield* Effect.promise(() => rule.configure(undefined));
		if (configured._tag !== "Ready") {
			return yield* Effect.die(new Error("The Promise rule cannot be configured"));
		}
		engine.fiber = yield* runRules([{ ...rule, check: configured.check, family: false, level: "error" }], inputsOf({})).pipe(Effect.forkScoped);
		yield* Deferred.await(engine.promiseReady);
	},
);
