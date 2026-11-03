import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import type { ScreenSignal } from "#server/screenSignal.ts";
import { SignalNotReceived } from "#server/until.ts";

export const nextScreenHint = Effect.fnUntraced(function* (signal: ScreenSignal) {
	const before = (yield* signal.current).hints;
	const hint = yield* signal.pipe(
		Stream.filter((state) => state.hints > before),
		Stream.runHead,
	);
	if (Option.isNone(hint)) {
		return yield* Effect.fail(
			new SignalNotReceived({
				message:
					'Signal "next live hint" never arrived: the client activity stream ended.\nhelp: Keep the client activity stream open until the action delivers a live hint.',
			}),
		);
	}
});
