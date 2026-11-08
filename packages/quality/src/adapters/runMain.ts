import type { EventEmitter } from "node:events";
import process from "node:process";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Cause, Console, Effect, Exit, type FileSystem, Layer, Runtime } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import { SetupFailure } from "#failure.ts";

const INTERRUPTED = 130;
const COULD_NOT_RUN = 2;

function explain(cause: Cause.Cause<unknown>): Effect.Effect<void> {
	const error = Cause.squash(cause);
	if (error instanceof SetupFailure) {
		return Console.error(`quality: ${error.message}`);
	}
	return Runtime.getErrorReported(error) ? Console.error(`quality: internal error\n${Cause.pretty(cause)}`) : Effect.void;
}

function exitCodeOf(error: unknown): number {
	return typeof error === "object" && error !== null && Runtime.errorExitCode in error ? Runtime.getErrorExitCode(error) : COULD_NOT_RUN;
}

export function exitCode(exit: Exit.Exit<unknown, unknown>): number {
	if (Exit.isSuccess(exit)) {
		return 0;
	}
	return Cause.hasInterruptsOnly(exit.cause) ? INTERRUPTED : exitCodeOf(Cause.squash(exit.cause));
}

function teardown(exit: Parameters<Runtime.Teardown>[0], onExit: Parameters<Runtime.Teardown>[1]): void {
	process.stdout.write("", () => process.stderr.write("", () => onExit(exitCode(exit))));
}

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

export const services = NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)));

export function explained<TValue, TError, TRequirements>(
	program: Effect.Effect<TValue, TError, TRequirements>,
): Effect.Effect<TValue, TError, TRequirements> {
	return Effect.tapCause(program, (cause) => (Cause.hasInterruptsOnly(cause) ? Effect.void : explain(cause)));
}

export function runMain<TValue, TError>(
	program: Effect.Effect<TValue, TError, FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner>,
): void {
	quietOnClosedPipe(process.stdout);
	quietOnClosedPipe(process.stderr);
	NodeRuntime.runMain(Effect.provide(explained(program), services), { disableErrorReporting: true, teardown });
}
