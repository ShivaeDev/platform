#!/usr/bin/env node
import process from "node:process";
import { Effect, Logger } from "effect";
import { WatchError } from "#model.ts";
import { program } from "#program.ts";
import { watcherLayer } from "#watcherLayer.ts";

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
		program(process.argv.slice(2), write(process.stdout), write(process.stderr)).pipe(Effect.provide(watcherLayer), Effect.provide(Logger.layer([]))),
		{
			signal: abort.signal,
		},
	);
} catch (cause) {
	if (!abort.signal.aborted) {
		process.stderr.write(`${cause instanceof Error ? cause.message : "Watcher failed"}\n`);
		process.exitCode = 1;
	}
}
