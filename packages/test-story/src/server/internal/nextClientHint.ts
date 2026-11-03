import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import type { ClientActivity } from "@shivaedev/contract/clientActivity.ts";
import { SignalNotReceived } from "#server/until.ts";

export const nextClientHint = Effect.fnUntraced(function* (activity: ClientActivity) {
	const before = (yield* activity.current).liveHints;
	const hint = yield* activity.pipe(
		Stream.filter((state) => state.liveHints > before),
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
