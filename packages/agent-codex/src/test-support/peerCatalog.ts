export const children = {
	data: [
		{
			id: "child",
			source: { subAgent: { "thread_spawn": { "agent_nickname": "researcher", "parent_thread_id": "root" } } },
			status: { activeFlags: [], type: "active" },
		},
	],
	nextCursor: null,
};
export const models = {
	data: [
		{
			defaultReasoningEffort: "high",
			displayName: "Codex",
			isDefault: true,
			model: "codex-model",
			supportedReasoningEfforts: [{ reasoningEffort: "high" }],
		},
	],
};
