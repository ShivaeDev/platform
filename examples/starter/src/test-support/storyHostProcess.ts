import { findPackageJSON, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { parentPort, workerData } from "node:worker_threads";

registerHooks({
	resolve(specifier, context, nextResolve) {
		const manifest = specifier.startsWith("@shivaedev/")
			? findPackageJSON(`${specifier.split("/").slice(0, 2).join("/")}/package.json`, context.parentURL)
			: undefined;
		const location = manifest === undefined ? (context.parentURL ?? "") : pathToFileURL(manifest).href;
		return nextResolve(
			specifier,
			location.includes("/node_modules/") ? { ...context, conditions: context.conditions.filter((condition) => condition !== "source") } : context,
		);
	},
});
const { Effect, Layer, Redacted } = await import("effect");
const { HttpServer } = await import("effect/http");
const NetAddress = await import("effect/net/NetAddress");
const { starterHost } = await import("#server/starterHost.ts");

if (typeof workerData !== "string" || parentPort === null) {
	throw new Error("The story host needs a database URL and a parent port");
}
const databaseUrl = Redacted.make(workerData);
const port = parentPort;
await Effect.runPromise(
	Effect.scoped(
		Effect.gen(function* () {
			const context = yield* Layer.build(
				starterHost({ databaseUrl, port: 0, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }),
			);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected a TCP server");
			}
			port.postMessage(`http://127.0.0.1:${server.address.port}`);
			yield* Effect.promise(() => new Promise<void>((resolve) => port.once("message", () => resolve())));
		}),
	),
);
port.close();
