import type { FleetItems } from "#diagnostics/fleetItems.ts";

type Execution = NonNullable<FleetItems["items"][number]["execution"]>;
export const workerTurn = {
	finishedAt: 61_000,
	fixingCi: false,
	id: "worker",
	role: "worker",
	sessionId: "worker",
	started: true,
	startedAt: 1000,
	status: "completed",
} as const;
export function agentItems(execution: Partial<Execution> = {}): FleetItems {
	return {
		completed: [],
		items: [
			{
				execution: { attempts: [workerTurn], mergeReady: false, question: false, step: "working", ...execution },
				stage: "working",
				stageEnteredAt: 0,
				updatedAt: 1000,
				workId: "task.build",
			},
		],
	};
}
