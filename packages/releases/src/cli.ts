#!/usr/bin/env node
import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { applyRelease } from "#applyRelease.ts";
import { checkRepository } from "#check.ts";
import { ChangesetError } from "#error.ts";
import { planRelease, summarizePlan } from "#planner.ts";
import { loadConfig } from "#workspace.ts";

const program = Effect.gen(function* () {
	const [command, argument, ...extra] = process.argv.slice(2);
	if (
		!["plan", "apply", "check"].includes(command ?? "")
		|| extra.length > 0
		|| (argument !== undefined && command !== "check" && !(command === "plan" && argument === "--json"))
	) {
		return yield* new ChangesetError({ message: "Use releases plan [--json], releases apply, or releases check [base-ref]." });
	}
	const root = process.cwd();
	const config = yield* loadConfig(root);
	if (command === "check") {
		yield* checkRepository(root, config, argument);
		yield* Console.log("Changesets and release notes are valid.");
	} else {
		const plan = yield* command === "apply" ? applyRelease(root, config) : planRelease(root, config);
		yield* Console.log(argument === "--json" ? JSON.stringify(plan, null, 2) : summarizePlan(plan));
	}
});
NodeRuntime.runMain(
	program.pipe(
		Effect.tapError((error) => Console.error(error.message)),
		Effect.provide(NodeFileSystem.layer),
	),
	{ disableErrorReporting: true },
);
