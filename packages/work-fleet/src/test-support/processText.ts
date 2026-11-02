import type { ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";
import { Effect } from "effect";

export function processText(child: ChildProcess, stream: Readable, output: () => string, text: string, offset: number, closed: () => boolean) {
	return Effect.callback<void>((resume) => {
		function check() {
			const observed = output();
			if (observed.slice(offset).includes(text)) {
				resume(Effect.void);
			} else if (closed()) {
				resume(Effect.die(new Error(`Follower exited before printing ${text}; got ${observed}`)));
			}
		}
		stream.on("data", check);
		child.on("close", check);
		check();
		return Effect.sync(() => {
			stream.off("data", check);
			child.off("close", check);
		});
	});
}
