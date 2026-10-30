import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Clock, ConfigProvider, Context, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import type { Options } from "#model.ts";
import { Watcher } from "#Watcher.ts";
import { makeIo } from "./io.ts";
import { startServer } from "./server.ts";
import { services } from "./services.ts";
import { makeWatchProcess } from "./watchProcess.ts";

export const nativeIo = Layer.mergeAll(
	NodeServices.layer,
	FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit)({ redirect: "error" }))),
);

export interface CliRun {
	exit?: number | null;
	stderr: string;
	stdout: string;
}

export const makeEngine = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const github = yield* Effect.acquireRelease(
		Effect.promise(() => startServer(() => clock.currentTimeMillisUnsafe())),
		(server) => Effect.promise(server.close),
	);
	const io = yield* makeIo;
	const layer = services.pipe(
		Layer.provide(io.layer),
		Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({ "GH_TOKEN": "test-token" }))),
	);
	const context = yield* Layer.build(Layer.fresh(layer));
	const process = makeWatchProcess(clock);
	io.control.changed = process.changed;
	const options: { -readonly [TKey in keyof Options]: Options[TKey] } = {
		apiUrl: github.apiUrl,
		fleet: false,
		interval: 60_000,
		numbers: [],
		repository: "acme/project",
		stateFile: join(github.directory, "state.json"),
	};
	const cli: CliRun = { stderr: "", stdout: "" };
	const cliEnvironment: NodeJS.ProcessEnv = { "GH_TOKEN": "test-token" };
	const diagnostics: string[] = [];
	const lines: string[] = [];
	const settings: { heartbeat?: number } = {};
	return {
		cli,
		cliEnvironment,
		context,
		diagnostics,
		github,
		io,
		lastPoll: "not polled",
		layer,
		lines,
		options,
		process,
		roundStart: 0,
		settings,
		watcher: Context.get(context, Watcher),
	};
});

export type Engine = Effect.Success<typeof makeEngine>;

export function programArguments(engine: Engine, ...extra: readonly string[]) {
	const { options, settings } = engine;
	return [
		"--repo",
		options.repository,
		"--state",
		options.stateFile,
		"--api-url",
		options.apiUrl,
		...(options.fleet ? ["--fleet"] : options.numbers.map(String)),
		...(settings.heartbeat === undefined ? [] : ["--heartbeat", String(settings.heartbeat)]),
		...(options.events === undefined ? [] : ["--events", options.events.join(",")]),
		...extra,
	];
}
