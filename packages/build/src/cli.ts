#!/usr/bin/env node
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Console, Effect } from "effect";
import { CliError, Command } from "effect/cli";
import { buildCommand } from "#command.ts";
import packageInfo from "#package.json" with { type: "json" };

const main = Command.run(buildCommand, { version: packageInfo.version }).pipe(
	Effect.tapError((error) => (CliError.isCliError(error) || error._tag === "GenerateFailed" ? Effect.void : Console.error(error.message))),
	Effect.tapCause((cause) => (Cause.hasDies(cause) ? Console.error(Cause.pretty(cause)) : Effect.void)),
	Effect.provide([NodeServices.layer, NodeCrypto.layer]),
);

NodeRuntime.runMain(main, { disableErrorReporting: true });
