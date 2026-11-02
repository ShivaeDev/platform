import { Effect } from "effect";
import { stringify } from "yaml";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import type { Folder } from "./board.ts";
import { health } from "./diagnostics.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";

export const workspaceFleet = Effect.fn("Test.workspaceFleet")(function* (
	notes: Folder,
	files: Readonly<Record<string, string>>,
	options?: BoardFixtureOptions,
) {
	const fleet = options?.fleet;
	if (fleet?.state !== "ready") {
		return options?.fleetPort ?? null;
	}
	for (const item of [...fleet.items, ...fleet.completed]) {
		if (item.document && files[item.document.file] === undefined) {
			notes.write(item.document.file, `---\n${stringify(item.document.metadata)}---\n# ${item.document.title}\n`);
		}
	}
	const daemon = yield* diagnosticsDaemon(
		() => ({
			codex: { cause: "Not configured", observedAt: 0, state: "not-configured" },
			fleet: { observedAt: 0, state: "ready", value: health },
			github: { cause: "Not configured", observedAt: 0, state: "not-configured" },
		}),
		0,
		() => fleet,
	);
	return daemon.port;
});
