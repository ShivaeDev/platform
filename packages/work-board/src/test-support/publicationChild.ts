import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { Effect } from "effect";

const [root, phase] = process.argv.slice(2);
if (!root || (phase !== "temporary" && phase !== "published")) {
	throw new Error("A root and publication phase are required.");
}
const originalOpen = fs.open;
fs.open = async (...args: Parameters<typeof fs.open>) => {
	const handle = await originalOpen(...args);
	const originalSync = handle.sync.bind(handle);
	handle.sync = async () => {
		await originalSync();
		const info = await handle.stat();
		if ((phase === "temporary" && info.isFile()) || (phase === "published" && info.isDirectory() && String(args[0]).endsWith("/responses"))) {
			process.send?.(phase);
			await new Promise<void>(() => undefined);
		}
	};
	return handle;
};
syncBuiltinESMExports();
const { publish } = await import("#responses/publish.ts");
await Effect.runPromise(publish(root, root, "response.interrupted", "Retained feedback"));
