import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import { driveWatchTimers } from "#test/driveWatchTimers.ts";

const entry: typeof import("#server/responses/agent-cli.ts") = await import(new URL("../../assets/agent.js", import.meta.url).href);

NodeRuntime.runMain(
	Effect.gen(function* () {
		yield* TestClock.setTime(Number(process.argv[2]));
		yield* watchedClock;
		yield* driveWatchTimers(entry.agentCommand(process.argv.slice(3)));
	}).pipe(Effect.scoped, Effect.provide(TestClock.layer())),
);
