import { Layer } from "effect";
import { DiagnosticsSources } from "@shivaedev/work-board/diagnostics/source.ts";
import type { HostParts } from "#host/commands.ts";
import { daemonLayer } from "#host/daemon.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";

export function hostDaemonLayer(engine: HostStoryEngine, parts: HostParts, port: number, onSnapshot: () => void) {
	const layer = engine.scheduled ? daemonLayer(engine.fixture.host, parts, port) : readDaemonLayer(engine.fixture.host, { onSnapshot, parts, port });
	return engine.diagnostics === undefined ? layer : layer.pipe(Layer.provide(Layer.succeed(DiagnosticsSources, engine.diagnostics)));
}
