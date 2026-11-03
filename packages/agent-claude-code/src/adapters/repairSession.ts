import { Effect } from "effect";
import { BackendUnavailable } from "@shivaedev/agent/failures.ts";
import type { Repair } from "#adapters/workflowAdoption.ts";
import { ClaudeProvider } from "#ClaudeProvider.ts";

export const repairSession = Effect.fn("ClaudeCode.repairSession")(function* (sessionId: string, cwd: string) {
	const peer = yield* ClaudeProvider;
	return yield* Effect.tryPromise({
		catch: (error) => new BackendUnavailable({ backend: "claude-code", message: String(error) }),
		try: async () => {
			const ids = await peer.listSubagents(sessionId, { dir: cwd });
			return Promise.all(ids.map(async (agentId) => ({ agentId, messages: await peer.getSubagentMessages(sessionId, agentId, { dir: cwd }) })));
		},
	}).pipe(
		Effect.match({
			onFailure: (error): Repair => ({ agents: [], failure: error.message }),
			onSuccess: (agents): Repair => ({ agents, failure: undefined }),
		}),
	);
});
