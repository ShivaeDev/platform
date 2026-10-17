import process from "node:process";
import { NodeFileSystem, NodeRuntime } from "@effect/platform-node";
import { Cause, Clock, Console, Effect, Runtime } from "effect";
import { ChangelogFailure } from "#changelog/attempt.ts";
import { checkRepository } from "#changelog/checkRepository.ts";
import { ciBase } from "#changelog/ciBase.ts";
import { releasePackage } from "#changelog/releasePackage.ts";

const [command, argument] = process.argv.slice(2);
const program = Effect.gen(function* () {
	if (command === "check" || command === "--check") {
		yield* checkRepository(process.cwd(), argument ?? (yield* ciBase));
		yield* Console.log("Changelog fragments and release notes are valid.");
		return;
	}
	if (command === undefined || !/^[a-z][a-z0-9-]*$/u.test(command)) {
		return yield* Effect.fail(new Error("Use pnpm run changelog:release <package>, or pnpm run changelog:check [base-ref]."));
	}
	const count = yield* releasePackage(`${process.cwd()}/packages/${command}`, new Date(yield* Clock.currentTimeMillis).toISOString().slice(0, 10));
	yield* Console.log(`${command}: collected ${count} fragment(s).`);
});
NodeRuntime.runMain(
	program.pipe(
		Effect.tapError((error) => (error instanceof ChangelogFailure ? Console.error(error.message) : Effect.void)),
		Effect.tapCause((cause) => (Runtime.getErrorReported(Cause.squash(cause)) ? Console.error(Cause.pretty(cause)) : Effect.void)),
		Effect.provide(NodeFileSystem.layer),
	),
	{ disableErrorReporting: true },
);
