import { Clock, Effect } from "effect";
import type { FileSystemWrapper } from "./board.ts";
import { rawDiagnosticsDaemon } from "./diagnosticsDaemon.ts";
import type { RpcRequest } from "./rpc.ts";
import { screenStory } from "./screenStory.ts";

export interface SessionTransport {
	readonly commands: RpcRequest[];
	gate?: Promise<void> | undefined;
	offline: boolean;
	release?: (() => void) | undefined;
	readonly tag: string;
}

export function sessionDiagnostics(read: (observedAt: number) => unknown) {
	return screenStory.trait("workspace", "the diagnostics daemon serves its native snapshot", function* (engine) {
		const observedAt = yield* Clock.currentTimeMillis;
		const daemon = yield* rawDiagnosticsDaemon(() => read(observedAt));
		engine.sessionFleetPort = daemon.port;
	});
}

export function sessionBoundary(tag: string, wrap?: FileSystemWrapper) {
	return screenStory.trait("workspace", "the native command transport can pause or lose delivery", function* (engine) {
		engine.sessionWrap = wrap;
		engine.sessionTransport = { commands: [], offline: false, tag };
		yield* Effect.addFinalizer(() => Effect.sync(() => engine.sessionTransport?.release?.()));
	});
}
