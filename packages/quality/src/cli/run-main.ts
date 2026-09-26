import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Cause, Console, Effect, Exit, type FileSystem, Runtime } from "effect";
import { SetupFailure } from "../failure.ts";

const INTERRUPTED = 130;
const COULD_NOT_RUN = 2;

const explain = (cause: Cause.Cause<unknown>): Effect.Effect<void> => {
	const error = Cause.squash(cause);
	if (error instanceof SetupFailure) {
		return Console.error(`quality: ${error.message}`);
	}
	return Runtime.getErrorReported(error) ? Console.error(`quality: internal error\n${Cause.pretty(cause)}`) : Effect.void;
};

const exitCodeOf = (error: unknown): number =>
	typeof error === "object" && error !== null && Runtime.errorExitCode in error ? Runtime.getErrorExitCode(error) : COULD_NOT_RUN;

const teardown: Runtime.Teardown = (exit, onExit) => {
	if (Exit.isSuccess(exit)) {
		return onExit(0);
	}
	return onExit(Cause.hasInterruptsOnly(exit.cause) ? INTERRUPTED : exitCodeOf(Cause.squash(exit.cause)));
};

export const runMain = <Value, Error>(program: Effect.Effect<Value, Error, FileSystem.FileSystem>): void => {
	const explained = Effect.tapCause(program, (cause) => (Cause.hasInterruptsOnly(cause) ? Effect.void : explain(cause)));
	NodeRuntime.runMain(Effect.provide(explained, NodeFileSystem.layer), { disableErrorReporting: true, teardown });
};
