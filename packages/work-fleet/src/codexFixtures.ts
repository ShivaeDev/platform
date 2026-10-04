import { Effect, FileSystem, Option } from "effect";
import { CodexRpc } from "#codexRpc.ts";
import type { AgentRequest } from "#ports.ts";
export const request: AgentRequest = {
	attempt: {
		createdAt: 1,
		feedback: "",
		id: "attempt-1",
		ref: null,
		result: null,
		revision: null,
		role: "worker",
		status: "submitting",
		workId: "fix-widget",
	},
	outcome: null,
	work: {
		baseBranch: "main",
		checkout: "/tmp/widget-checkout",
		completion: "merged",
		id: "fix-widget",
		instructions: "Fix the widget",
		repository: "example/widgets",
		requiredChecks: ["test"],
		scope: [{ key: null, path: "src/widget.ts" }],
	},
};
export const noChange = {
	kind: "outcome",
	outcome: { justification: "The behavior already satisfies the request", kind: "no-change", revision: "abc123" },
};
export function rpc(respond: (method: string, params: unknown) => unknown, events: string[] = []) {
	return CodexRpc.of({
		call: (method, params) =>
			Effect.sync(() => {
				events.push(method);
				return respond(method, params);
			}),
	});
}
export function acknowledged(original: AgentRequest = request): AgentRequest {
	return {
		...original,
		attempt: { ...original.attempt, ref: { sessionId: "thread-example", turnId: "turn-example" } },
	};
}
export function thread(status = "completed", text = JSON.stringify(noChange)) {
	return {
		thread: {
			id: "thread-example",
			status: { type: status === "inProgress" ? "active" : "idle" },
			turns: [
				{
					id: "turn-example",
					items: [
						{
							content: [{ text: 'Work Fleet attempt: "attempt-1"\nInstructions', "text_elements": [], type: "text" }],
							id: "user-example",
							type: "userMessage",
						},
						{ id: "answer-example", phase: "final_answer", text, type: "agentMessage" },
					],
					status,
				},
			],
		},
	};
}
export function launchResponse(method: string) {
	if (method === "config/read") {
		return { config: {} };
	}
	if (method === "account/read") {
		return { account: { type: "chatgpt" } };
	}
	if (method === "turn/start") {
		return { turn: { id: "turn-example" } };
	}
	return { thread: { id: "thread-example" } };
}
export const codexFilesystem = FileSystem.layerNoop({
	realPath: (path) => Effect.succeed(path),
	stat: () =>
		Effect.succeed({
			atime: Option.none(),
			birthtime: Option.none(),
			blksize: Option.none(),
			blocks: Option.none(),
			dev: 0,
			gid: Option.none(),
			ino: Option.none(),
			mode: 0,
			mtime: Option.none(),
			nlink: Option.none(),
			rdev: Option.none(),
			size: FileSystem.Size(0),
			type: "Directory",
			uid: Option.none(),
		}),
});
