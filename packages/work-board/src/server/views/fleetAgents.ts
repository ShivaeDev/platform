import type { FleetAgent, FleetItem } from "#diagnostics/fleetItems.ts";

type Item = typeof FleetItem.Type;
type Agent = typeof FleetAgent.Type;
type Attempt = NonNullable<Item["execution"]>["attempts"][number];

export function fleetAgents(item: Item): Pick<Item, "agents" | "inFlight"> {
	const execution = item.execution;
	if (execution === undefined) {
		return {};
	}
	const inFlight = execution.attempts.some((attempt) => attempt.started) && !["done", "released"].includes(execution.step);
	const latest = new Map<string, Attempt>();
	for (const [index, attempt] of execution.attempts.entries()) {
		latest.set(attempt.sessionId ?? `scheduled:${attempt.role}:${index}`, attempt);
	}
	const agents: Agent[] = [...latest.values()].map((attempt) => ({
		finishedAt: attempt.finishedAt ?? null,
		id: attempt.sessionId ?? attempt.id,
		role: attempt.role === "reviewer" ? "reviewer" : "worker",
		running: ["accepted", "running"].includes(attempt.status),
		startedAt: attempt.startedAt ?? null,
		state: agentState(item, attempt),
	}));
	for (const role of ["worker", "reviewer"] as const) {
		if (!agents.some((agent) => agent.role === role)) {
			agents.push({ finishedAt: null, id: `planned:${role}`, role, running: false, startedAt: null, state: "not started yet" });
		}
	}
	return { agents, inFlight };
}

function agentState(item: Item, attempt: Attempt): Agent["state"] {
	if (!attempt.started) {
		return "not started yet";
	}
	const latestWorker = item.execution?.attempts.findLast((entry) => entry.role !== "reviewer");
	if (item.execution?.question && attempt === latestWorker) {
		return "waiting on an answer";
	}
	if (["accepted", "running"].includes(attempt.status)) {
		return runningState(attempt);
	}
	if (attempt === latestWorker) {
		if (item.execution?.step === "validating") {
			return "waiting for CI";
		}
		if (item.execution?.step === "delivering" || item.execution?.mergeReady) {
			return "waiting for merge";
		}
	}
	return "done";
}

function runningState(attempt: Attempt): Agent["state"] {
	if (attempt.role === "reviewer") {
		return "reviewing";
	}
	if (attempt.role === "worker") {
		return "coding";
	}
	return attempt.fixingCi ? "fixing CI" : "addressing review";
}
