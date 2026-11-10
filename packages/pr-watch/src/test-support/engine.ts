import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Clock, ConfigProvider, Context, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import type { Options } from "#model.ts";
import type { WatchEvent } from "#outputEvent.ts";
import { makeIo } from "#test/io.ts";
import { makeOutput } from "#test/makeOutput.ts";
import { fakeGitHub } from "#test/server.ts";
import { services } from "#test/services.ts";
import { makeWatchProcess } from "#test/watchProcess.ts";
import type { WaitResult } from "#waitResult.ts";
import { Watcher } from "#watcher/service.ts";

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
	const github = yield* fakeGitHub;
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
	const observation: { failure?: unknown } = {};
	const lines: WatchEvent[] = [];
	const settings: { heartbeat?: number } = {};
	const wait: { exit?: number; printed: WaitResult[]; progress: string[] } = { printed: [], progress: [] };
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
		observation,
		options,
		output: makeOutput(lines, process.changed),
		process,
		roundStart: 0,
		settings,
		wait,
		watcher: Context.get(context, Watcher),
	};
});

export type Engine = Effect.Success<typeof makeEngine>;

export function waitArguments(engine: Engine, number: number, extra: readonly string[]) {
	const { apiUrl, repository, stateFile } = engine.options;
	return ["--repo", repository, "--state", stateFile, "--api-url", apiUrl, String(number), ...extra];
}

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
