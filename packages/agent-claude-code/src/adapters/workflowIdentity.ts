import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { isRecord } from "#blocks.ts";
import type { ChildOutcome } from "#protocol.ts";

type SystemMessage = Extract<
	SDKMessage,
	{
		type: "system";
	}
>;
type TaskProgress = Extract<
	SystemMessage,
	{
		subtype: "task_progress";
	}
>;
export interface WorkflowIdentity {
	readonly ended: ChildOutcome | undefined;
	readonly label: string | undefined;
	readonly model: string | undefined;
	readonly phase: string | undefined;
	readonly spawnedBy: string | undefined;
}
function stringAt(entry: Record<string, unknown>, field: string) {
	return typeof entry[field] === "string" ? entry[field] : undefined;
}
function endingOf(state: string | undefined): ChildOutcome | undefined {
	if (state === "done") {
		return "completed";
	}
	return state === "error" || state === "blocked" ? "failed" : undefined;
}
function labelOf(entry: Record<string, unknown>): string | undefined {
	const label = stringAt(entry, "label");
	const phase = stringAt(entry, "phaseTitle");
	if (label === undefined) {
		return phase;
	}
	return phase === undefined ? label : `${phase}: ${label}`;
}
function identityOf(entry: Record<string, unknown>, spawnedBy: string | undefined): WorkflowIdentity {
	return {
		ended: endingOf(stringAt(entry, "state")),
		label: labelOf(entry),
		model: stringAt(entry, "model"),
		phase: stringAt(entry, "phaseTitle"),
		spawnedBy,
	};
}
function snapshot(message: TaskProgress): readonly unknown[] {
	const carried = "workflow_progress" in message && message.workflow_progress;
	return Array.isArray(carried) ? carried : [];
}
export interface WorkflowIdentities {
	readonly observe: (message: TaskProgress) => void;
	readonly of: (agentId: string) => WorkflowIdentity | undefined;
}
// `workflow_progress` is absent from the published SDK types; live progress frames carry the workflow-agent identity snapshot.
export function openWorkflowIdentities(): WorkflowIdentities {
	const identities = new Map<string, WorkflowIdentity>();
	return {
		observe: (message) => {
			for (const entry of snapshot(message)) {
				if (!isRecord(entry) || entry.type !== "workflow_agent") {
					continue;
				}
				const agentId = stringAt(entry, "agentId");
				if (agentId !== undefined) {
					identities.set(agentId, identityOf(entry, message.tool_use_id));
				}
			}
		},
		of: (agentId) => identities.get(agentId),
	};
}
