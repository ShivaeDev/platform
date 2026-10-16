import { once } from "node:events";
import { fileURLToPath, URL as NodeUrl } from "node:url";
import { Worker } from "node:worker_threads";
import { Effect, Redacted } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";

export const storyHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const worker = yield* Effect.acquireRelease(
		Effect.sync(
			() =>
				new Worker(fileURLToPath(new NodeUrl("./storyHostProcess.ts", import.meta.url)), {
					execArgv: [],
					workerData: Redacted.value(database.url),
				}),
		),
		(host) =>
			Effect.promise(async () => {
				if (host.threadId === -1) {
					return;
				}
				const exited = once(host, "exit");
				host.postMessage("close");
				await exited;
			}),
	);
	return yield* Effect.promise(async () => {
		const [url] = await once(worker, "message");
		if (typeof url !== "string") {
			throw new Error("The story host did not return its URL");
		}
		return url;
	});
});
