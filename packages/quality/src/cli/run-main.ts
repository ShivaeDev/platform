import type { EventEmitter } from "node:events";
import process from "node:process";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Cause, Console, Effect, Exit, type FileSystem, Layer, Runtime } from "effect";
import { SetupFailure } from "#failure.ts";
import type { Git } from "#git/command.ts";

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

const exitCode = (exit: Exit.Exit<unknown, unknown>): number => {
	if (Exit.isSuccess(exit)) {
		return 0;
	}
	return Cause.hasInterruptsOnly(exit.cause) ? INTERRUPTED : exitCodeOf(Cause.squash(exit.cause));
};

const teardown: Runtime.Teardown = (exit, onExit) => {
	process.stdout.write("", () => process.stderr.write("", () => onExit(exitCode(exit))));
};

function isClosedPipe(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "EPIPE";
}

export function quietOnClosedPipe(stream: EventEmitter): void {
	stream.on("error", (error: unknown) => {
		if (!isClosedPipe(error)) {
			throw error;
		}
	});
}

const services = NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)));

export const runMain = <Value, Error>(program: Effect.Effect<Value, Error, FileSystem.FileSystem | Git>): void => {
	quietOnClosedPipe(process.stdout);
	quietOnClosedPipe(process.stderr);
	const explained = Effect.tapCause(program, (cause) => (Cause.hasInterruptsOnly(cause) ? Effect.void : explain(cause)));
	NodeRuntime.runMain(Effect.provide(explained, services), { disableErrorReporting: true, teardown });
};
