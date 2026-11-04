import { createConnection } from "node:net";
import { Effect } from "effect";

export function socketState(path: string) {
	return Effect.callback<"live" | "missing" | "stale", Error>((resume) => {
		const socket = createConnection(path);
		socket.once("connect", () => {
			socket.destroy();
			resume(Effect.succeed("live"));
		});
		socket.once("error", (cause: NodeJS.ErrnoException) => {
			if (cause.code === "ENOENT") {
				resume(Effect.succeed("missing"));
			} else if (cause.code === "ECONNREFUSED") {
				resume(Effect.succeed("stale"));
			} else {
				resume(Effect.fail(cause));
			}
		});
		return Effect.sync(() => socket.destroy());
	});
}
