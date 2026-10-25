#!/usr/bin/env node
import process from "node:process";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { GitHub as GitHubClient } from "@shivaedev/effect-github/GitHub.ts";
import { GitHubToken } from "@shivaedev/effect-github/GitHubToken.ts";
import { GitHub } from "./GitHub.ts";
import { GitHubHttp } from "./GitHubHttp.ts";
import { WatchError } from "./model.ts";
import { program } from "./program.ts";
import { StateFile } from "./StateFile.ts";
import { Watcher } from "./Watcher.ts";

const services = Watcher.layer.pipe(
	Layer.provide(
		Layer.mergeAll(
			StateFile.layer,
			GitHub.layer.pipe(Layer.provide(GitHubHttp.layer.pipe(Layer.provide(GitHubClient.layer), Layer.provide(GitHubToken.fromEnv)))),
		),
	),
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
	await Effect.runPromise(program(process.argv.slice(2), write(process.stdout), write(process.stderr)).pipe(Effect.provide(services)), {
		signal: abort.signal,
	});
} catch (cause) {
	if (!abort.signal.aborted) {
		process.stderr.write(`${cause instanceof Error ? cause.message : "Watcher failed"}\n`);
		process.exitCode = 1;
	}
}
