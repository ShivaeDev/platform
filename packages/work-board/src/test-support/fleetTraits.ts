import { Clock } from "effect";
import type { DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import type { FleetHealth } from "#diagnostics/health.ts";
import { boardStory } from "./boardStory.ts";
import { health } from "./diagnostics.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";

const missing = { cause: "Not configured in this story", observedAt: 0, state: "not-configured" } as const;

export type FleetReport = Omit<FleetItems["items"][number], "stageEnteredAt" | "updatedAt"> & { readonly enteredAgo?: number };

export function fleetReports(items: readonly FleetReport[], waiting: FleetHealth["waiting"] = health.waiting) {
	const owners = Object.entries(waiting).map(([owner, count]) => `${count} on ${owner}`);
	return boardStory.trait("project", `Fleet reports ${items.length} items and counts waiting work as ${owners.join(", ")}`, function* (engine) {
		const now = yield* Clock.currentTimeMillis;
		const snapshot: DiagnosticsSnapshot = {
			codex: missing,
			fleet: { observedAt: now, state: "ready", value: { ...health, lastSchedulerPass: now, observedAt: now, staleAfterMs: 600_000, waiting } },
			github: missing,
		};
		const reported = items.map(({ enteredAgo, ...item }) => ({
			...item,
			stageEnteredAt: enteredAgo === undefined ? null : now - enteredAgo,
			updatedAt: now,
		}));
		const daemon = yield* diagnosticsDaemon(
			() => snapshot,
			0,
			() => ({ completed: [], items: reported }),
		);
		engine.fleetPort = daemon.port;
	});
}

export function fleetUnreachable() {
	return boardStory.trait("project", "no Fleet daemon answers on the Board's Fleet port", function* (engine) {
		const daemon = yield* diagnosticsDaemon(() => ({ codex: missing, fleet: missing, github: missing }));
		yield* daemon.stop();
		engine.fleetPort = daemon.port;
	});
}
