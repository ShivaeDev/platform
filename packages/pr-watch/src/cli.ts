#!/usr/bin/env node
import process from "node:process";
import { NodeFileSystem } from "@effect/platform-node";
import { Config, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { GitHub } from "./GitHub.ts";
import { GitHubHttp } from "./GitHubHttp.ts";
import { WatchError } from "./model.ts";
import { program } from "./program.ts";
import { StateFile } from "./StateFile.ts";
import { Watcher } from "./Watcher.ts";

const services = Watcher.layer.pipe(
	Layer.provide(Layer.mergeAll(StateFile.layer, GitHub.layer.pipe(Layer.provide(GitHubHttp.layer)))),
	Layer.provide(
		Layer.mergeAll(
			NodeFileSystem.layer,
			FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" }))),
		),
	),
);
function write(stream: NodeJS.WriteStream) {
	return (line: string) =>
		Effect.tryPromise({
			catch: () => new WatchError({ message: "Output stream failed" }),
			try: () => new Promise<void>((resolve, reject) => stream.write(`${line}\n`, (error) => (error ? reject(error) : resolve()))),
		});
}
const abort = new AbortController();
process.once("SIGINT", () => abort.abort());
process.once("SIGTERM", () => abort.abort());
try {
	await Effect.runPromise(
		Effect.gen(function* () {
			const token = yield* Config.string("GH_TOKEN").pipe(
				Config.orElse(() => Config.string("GITHUB_TOKEN")),
				Config.withDefault(""),
			);
			yield* program(process.argv.slice(2), token, write(process.stdout), write(process.stderr));
		}).pipe(Effect.provide(services)),
		{ signal: abort.signal },
	);
} catch (cause) {
	if (!abort.signal.aborted) {
		process.stderr.write(`${cause instanceof Error ? cause.message : "Watcher failed"}\n`);
		process.exitCode = 1;
	}
}
