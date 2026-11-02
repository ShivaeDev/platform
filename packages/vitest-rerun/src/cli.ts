#!/usr/bin/env node
import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Exit, Runtime } from "effect";
import { main } from "#internal/main.ts";

NodeRuntime.runMain(main(process.argv.slice(2), process.cwd()).pipe(Effect.provide(NodeServices.layer)), {
	teardown: (exit, onExit) => (Exit.isSuccess(exit) ? onExit(Number(exit.value)) : Runtime.defaultTeardown(exit, onExit)),
});
