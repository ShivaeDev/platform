import { Effect } from "effect";
import type { Indexing } from "#rpc/Indexing.ts";

const PROGRESS_STEPS = 100;

export function fileCounter(total: number, report: (progress: Indexing) => Effect.Effect<void>) {
	const step = Math.max(1, Math.ceil(total / PROGRESS_STEPS));
	let read = 0;
	return Effect.suspend(() => {
		read += 1;
		return read % step === 0 || read === total ? report({ _tag: "Indexing", read, total }) : Effect.void;
	});
}
