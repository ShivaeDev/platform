import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Result from "effect/Result";
import { screenAct } from "#server/adapters/screenAct.ts";
import { screenMutations } from "#server/adapters/screenMutations.ts";
import type { ScreenDriverOptions } from "#server/screenDriver.ts";
import { observeScreen } from "./observeScreen.ts";

type WaitOptions = Required<Pick<ScreenDriverOptions, "act">> & {
	readonly activity?: ScreenDriverOptions["activity"];
	readonly pending?: ScreenDriverOptions["pending"];
	readonly transport?: ScreenDriverOptions["transport"];
	readonly root: () => HTMLElement;
};

export const waitForScreen = Effect.fnUntraced(function* <A, E>(options: WaitOptions, read: Effect.Effect<A, E>) {
	const { act, root } = options;
	const supplied = options.pending !== undefined || options.activity !== undefined || options.transport !== undefined;
	const changes = yield* Queue.sliding<void>(1);
	yield* screenMutations(root(), () => Queue.offerUnsafe(changes, undefined));
	const isBusy = yield* observeScreen(options, changes);
	do {
		if (supplied) {
			yield* screenAct(act, Effect.void);
		}
		if (!(yield* isBusy)) {
			const result = yield* Effect.result(read);
			if (Result.isSuccess(result)) {
				return result.success;
			}
		}
		yield* supplied ? screenAct(act, Queue.take(changes)) : Queue.take(changes);
	} while (true);
}, Effect.scoped);
