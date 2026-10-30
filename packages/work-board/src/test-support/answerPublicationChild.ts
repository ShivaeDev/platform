import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { serveBoard } from "#server/serve.ts";

const [root, phase] = process.argv.slice(2);
if (root === undefined) {
	throw new Error("A Board root is required");
}

const originalOpen = fs.open;
fs.open = async (...args: Parameters<typeof fs.open>) => {
	const file = await originalOpen(...args);
	const write = file.writeFile.bind(file);
	const sync = file.sync.bind(file);
	let answer = false;
	file.writeFile = (...input: Parameters<typeof file.writeFile>) => {
		answer = String(input[0]).includes("id: response.restart\n");
		return write(...input);
	};
	file.sync = async () => {
		await sync();
		if (phase === "temporary" && answer) {
			process.send?.({ phase });
			await new Promise<void>(() => undefined);
		}
	};
	return file;
};
const originalLink = fs.link;
fs.link = async (...args: Parameters<typeof fs.link>) => {
	await originalLink(...args);
	if (phase === "published" && String(args[1]).endsWith("/response.restart.md")) {
		process.send?.({ phase });
		await new Promise<void>(() => undefined);
	}
};
syncBuiltinESMExports();

await Effect.runPromise(
	Effect.gen(function* () {
		const context = yield* Layer.build(serveBoard({ port: 0, responses: true, root }));
		const { address } = Context.get(context, HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(address)) {
			return yield* Effect.die("Expected TCP Board listener");
		}
		process.send?.({ phase: "ready", url: `http://127.0.0.1:${address.port}` });
		yield* Effect.never;
	}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
