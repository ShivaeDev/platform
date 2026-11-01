import { Cause, Effect, type Exit } from "effect";
import { WatchError } from "#model.ts";
import { requestFailure } from "#requestFailure.ts";
import { healthOf } from "./readouts.ts";

function describeExit(exit: Exit.Exit<unknown, unknown>) {
	if (exit._tag === "Success") {
		return ["completed"];
	}
	return exit.cause.reasons.map((reason) => {
		if (Cause.isFailReason(reason)) {
			const error = reason.error;
			return `${error instanceof Error ? error.name : "UnknownFailure"}: ${requestFailure(error).message}`;
		}
		return Cause.isDieReason(reason) ? `defect: ${String(reason.defect)}` : "interrupted";
	});
}

export function makeOutput(lines: string[], changed: () => void) {
	const state: { blockNext: boolean; callback: string; failStop: boolean; outcome: string[] } = {
		blockNext: false,
		callback: "idle",
		failStop: false,
		outcome: [],
	};
	const interrupted = Effect.sync(() => {
		state.callback = "interrupted";
		changed();
	});
	return {
		emit: (line: string) =>
			Effect.gen(function* () {
				if (state.blockNext) {
					state.blockNext = false;
					state.callback = "pending";
					changed();
					yield* Effect.never.pipe(Effect.onInterrupt(() => interrupted));
				}
				if (state.failStop && healthOf([line], "stopped").length > 0) {
					return yield* Effect.fail(new WatchError({ message: "Output stream failed", reason: "output" }));
				}
				lines.push(line);
			}),
		recordExit: (exit: Exit.Exit<unknown, unknown>) => {
			state.outcome = describeExit(exit);
		},
		state,
	};
}
