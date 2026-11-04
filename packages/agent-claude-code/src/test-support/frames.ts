import type { SDKMessage, SessionKey, SessionMessage, SessionStoreEntry } from "@anthropic-ai/claude-agent-sdk";
export const NATIVE_SESSION = "2d45725d-a92d-4c08-af46-f49f899671cf";
let sequence = 0;
export function stamp() {
	sequence += 1;
	return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}` as const;
}
export function init(id = NATIVE_SESSION): SDKMessage {
	return {
		agents: [],
		apiKeySource: "user",
		"claude_code_version": "scripted",
		cwd: "/project",
		"fast_mode_state": "off",
		"mcp_servers": [],
		model: "sonnet",
		"output_style": "default",
		permissionMode: "auto",
		plugins: [],
		"session_id": id,
		skills: [],
		"slash_commands": [],
		subtype: "init",
		tools: [],
		type: "system",
		uuid: stamp(),
	};
}
export function assistant(
	text: string,
	uuid: `${string}-${string}-${string}-${string}-${string}` = stamp(),
): Extract<
	SDKMessage,
	{
		type: "assistant";
	}
> {
	return {
		message: {
			container: null,
			content: [{ citations: null, text, type: "text" }],
			"context_management": null,
			diagnostics: null,
			id: "message",
			model: "sonnet",
			role: "assistant",
			"stop_details": null,
			"stop_reason": "end_turn",
			"stop_sequence": null,
			type: "message",
			usage: {
				"cache_creation": null,
				"cache_creation_input_tokens": 0,
				"cache_read_input_tokens": 0,
				"fallback_credit": null,
				"inference_geo": null,
				"input_tokens": 3,
				iterations: null,
				"output_tokens": 2,
				"output_tokens_details": null,
				"server_tool_use": null,
				"service_tier": null,
				speed: null,
			},
		},
		"parent_tool_use_id": null,
		"session_id": NATIVE_SESSION,
		type: "assistant",
		uuid,
	};
}
export function progress(
	state: string,
	label: string,
): SDKMessage & {
	"workflow_progress": readonly unknown[];
} {
	return {
		description: "audit",
		"session_id": NATIVE_SESSION,
		subtype: "task_progress",
		"task_id": "audit",
		"tool_use_id": "workflow-call",
		type: "system",
		usage: { "duration_ms": 1, "tool_uses": 1, "total_tokens": 1 },
		uuid: stamp(),
		"workflow_progress": [{ agentId: "auditor", label, model: "sonnet", state, type: "workflow_agent" }],
	};
}
export function line(text: string, uuid: string = stamp()): SessionStoreEntry {
	return {
		message: { content: [{ text, type: "text" }], role: "assistant" },
		type: "assistant",
		uuid,
	};
}
export function stored(text: string, uuid: string = stamp()): SessionMessage {
	return {
		message: { content: [{ text, type: "text" }], role: "assistant" },
		"parent_agent_id": null,
		"parent_tool_use_id": "spawn",
		"session_id": NATIVE_SESSION,
		type: "assistant",
		uuid,
	};
}
export function key(subpath?: string): SessionKey {
	return {
		projectKey: "project",
		sessionId: NATIVE_SESSION,
		...(subpath === undefined ? {} : { subpath }),
	};
}
