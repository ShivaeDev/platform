import process from "node:process";
import { Cause, Effect, Exit, Scope } from "effect";
import { type FileSystemWrapper, startBoard } from "#test/board.ts";

const [root, phase] = process.argv.slice(2);
if (!root) {
	throw new Error("A board directory is required.");
}
process.umask(0o002);

function command(expected: string) {
	return new Promise<void>((resolve) => {
		function receive(message: unknown) {
			if (message === expected) {
				process.off("message", receive);
				resolve();
			}
		}
		process.on("message", receive);
	});
}

let paused = false;
const wrap: FileSystemWrapper = (fs) => ({
	...fs,
	chmod: (path, mode) =>
		Effect.gen(function* () {
			if (phase === "permissions" && !paused) {
				paused = true;
				const continued = command("continue");
				process.send?.({ path, phase: "permissions" });
				yield* Effect.promise(() => continued);
			}
			yield* fs.chmod(path, mode);
		}),
	remove: (path, options) =>
		Effect.gen(function* () {
			if (phase === "reclaim" && path === `${root}/board.sock` && !paused) {
				paused = true;
				const continued = command("continue");
				process.send?.({ phase: "reclaim" });
				yield* Effect.promise(() => continued);
			}
			yield* fs.remove(path, options);
		}),
});

const scope = Scope.makeUnsafe();
const result = await Effect.runPromise(startBoard(root, undefined, wrap).pipe(Scope.provide(scope), Effect.exit));
const closing = command("close");
if (Exit.isSuccess(result)) {
	process.send?.({ phase: "ready", url: result.value.url });
} else {
	process.send?.({ error: Cause.pretty(result.cause), phase: "rejected" });
}
await closing;
await Effect.runPromise(Scope.close(scope, Exit.void));
process.send?.({ phase: "closed" });
process.disconnect?.();
