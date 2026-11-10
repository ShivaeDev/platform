import type { SessionKey } from "@anthropic-ai/claude-agent-sdk";

const SUBAGENTS = "subagents";
const WORKFLOWS = "workflows";
const AGENT = "agent-";
// Observed transcript keys identify delegated agents by a final `agent-<id>` segment. Workflow keys start with
// `subagents/workflows/<run-id>` and may nest through further delegates.
export interface WorkflowAgentRef {
	readonly agentId: string;
	readonly runId: string;
}
function agentIdOf(segment = ""): string | undefined {
	return segment.startsWith(AGENT) ? segment.slice(AGENT.length) : undefined;
}
export function workflowAgentRef(key: SessionKey): WorkflowAgentRef | undefined {
	const segments = key.subpath?.split("/") ?? [];
	const [scope, kind, runId] = segments;
	if (scope !== SUBAGENTS || kind !== WORKFLOWS || runId === undefined) {
		return undefined;
	}
	const agentId = agentIdOf(segments.at(-1));
	return agentId === undefined || segments.length < 4 ? undefined : { agentId, runId };
}
export function subagentRef(key: SessionKey): string | undefined {
	const segments = key.subpath?.split("/") ?? [];
	return segments.length >= 2 && segments[0] === SUBAGENTS ? agentIdOf(segments.at(-1)) : undefined;
}
export function agentFileRef(agentId: string): string {
	return [SUBAGENTS, `${AGENT}${agentId}`].join("/");
}
export function workflowRunRef(runId: string): string {
	return [SUBAGENTS, WORKFLOWS, runId].join("/");
}
