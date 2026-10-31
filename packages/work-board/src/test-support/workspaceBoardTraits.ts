import { relative } from "node:path";
import { Clock, Effect } from "effect";
import { vi } from "vitest";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import * as metadata from "#server/metadata/model.ts";
import * as parsing from "#server/metadata/parse.ts";
import * as updates from "#server/metadata/updateModel.ts";
import { boardStory } from "./boardStory.ts";
import { rawDiagnosticsDaemon } from "./diagnosticsDaemon.ts";
import { fleetBriefRequests, fleetDaemons, metadataSpies } from "./workspaceReads.ts";

export function rawDaemonSnapshot(read: (observedAt: number) => unknown, line: string) {
	return boardStory.trait("project", `the diagnostics daemon publishes ${line}`, function* (engine) {
		const observedAt = yield* Clock.currentTimeMillis;
		const daemon = yield* rawDiagnosticsDaemon(() => read(observedAt));
		engine.fleetPort = daemon.port;
	});
}

export function fleetDaemon(items: FleetItems) {
	return boardStory.trait(
		"project",
		`Fleet reports ${items.items.map((item) => item.workId).join(", ")} and completed ${items.completed.map((item) => item.workId).join(", ")}`,
		function* (engine) {
			const missing = { cause: "Not configured for the story", observedAt: 0, state: "not-configured" as const };
			const state = { items };
			const daemon = yield* rawDiagnosticsDaemon(
				() => ({ codex: missing, fleet: missing, github: missing }),
				0,
				() => state.items,
			);
			fleetDaemons.set(engine, {
				get items() {
					return state.items;
				},
				set items(next) {
					state.items = next;
				},
				stop: daemon.stop,
			});
			engine.fleetPort = daemon.port;
		},
	);
}

export function rejectingFleetDaemon(message: string) {
	return boardStory.trait("project", `Fleet rejects requests for its items: ${message}`, function* (engine) {
		const missing = { cause: "Not configured for the story", observedAt: 0, state: "not-configured" as const };
		const daemon = yield* rawDiagnosticsDaemon(
			() => ({ codex: missing, fleet: missing, github: missing }),
			0,
			Effect.fail(new ServiceUnavailable({ message })),
		);
		engine.fleetPort = daemon.port;
	});
}

export function briefRefusingFleet(refusals: Readonly<Record<string, string>>, items: FleetItems = { completed: [], items: [] }) {
	const refused = Object.keys(refusals).join(", ");
	return boardStory.trait(
		"project",
		refused ? `Fleet refuses the brief ids ${refused}` : "a story Fleet daemon accepts every brief id",
		function* (engine) {
			const requests: string[][] = [];
			fleetBriefRequests.set(engine, requests);
			const daemon = yield* rawDiagnosticsDaemon(
				() => ({}),
				0,
				() => items,
				(briefs) => {
					requests.push(briefs.map((brief) => `${brief.workId} at ${relative(engine.notes.root, brief.sourcePath)}`));
					return briefs.flatMap((brief) => {
						const message = refusals[brief.workId];
						return message === undefined ? [] : [{ ...brief, message }];
					});
				},
			);
			engine.fleetPort = daemon.port;
		},
	);
}

export const countedMetadataWork = boardStory.trait("project", "the board's metadata parser and model builders are counted", function* (engine) {
	const spies = {
		builds: vi.spyOn(metadata, "metadataModel"),
		parses: vi.spyOn(parsing, "metadataParse"),
		updates: vi.spyOn(updates, "updateModel"),
	};
	metadataSpies.set(engine, spies);
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			for (const spy of [spies.builds, spies.parses, spies.updates]) {
				spy.mockRestore();
			}
		}),
	);
});

// Without a Fleet trait the board asks the machine's own Fleet daemon about each active brief it reads.
export const fleetAcceptsEveryBrief = briefRefusingFleet({});
