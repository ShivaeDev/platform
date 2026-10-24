import { rmSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { Effect, Layer } from "effect";
import type { FleetHost } from "#host/config.ts";
import { loadHost } from "#host/configFile.ts";
import { continuationMessage } from "#host/continuationMessage.ts";
import { hostSql } from "#host/runtime.ts";
import { hostBoard } from "#test/fleetHost.ts";
import { hostProcess } from "#test/hostProcess.ts";
import { unavailableFleetItems } from "#test/unavailableFleetItems.ts";

export function hostInputVerbs() {
	function configurationFolder(text?: string) {
		return Effect.acquireRelease(
			Effect.sync(() => hostBoard(text)),
			(path) => Effect.sync(() => rmSync(path, { force: true, recursive: true })),
		);
	}
	return {
		configurationFile: (text: string) => configurationFolder(text).pipe(Effect.map((path) => join(path, "fleet.config.json"))),
		continuationMessage: (message?: string, chunks: readonly string[] = []) => continuationMessage(message, Readable.from(chunks)),
		loadConfiguration: (text?: string, override?: string) => configurationFolder(text).pipe(Effect.flatMap((path) => loadHost(path, override))),
		openDatabase: (host: FleetHost) => Layer.build(hostSql(host)).pipe(Effect.scoped),
		spawnInvalidHost: () => configurationFolder("{").pipe(Effect.flatMap((path) => hostProcess(join(path, "fleet.config.json")))),
		spawnMissingHost: () => hostProcess("/synthetic/missing-config.json"),
		unavailableFleetItems,
	};
}
