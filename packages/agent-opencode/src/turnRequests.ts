import { Effect } from "effect";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import { Provider } from "#Provider.ts";
import type { PromptSettings } from "#sessionOpen.ts";
export interface TurnRequests {
	readonly abort: Effect.Effect<unknown, BackendFailure>;
	readonly prompt: (text: string) => Effect.Effect<unknown, BackendFailure>;
}
export const turnRequests = Effect.fnUntraced(function* (sessionId: string, cwd: string, settings: PromptSettings) {
	const server = yield* Provider;
	const query = { directory: cwd };
	return {
		abort: server.post({
			body: {},
			path: `/session/${sessionId}/abort`,
			query,
		}),
		prompt: (text: string) =>
			server.post({
				body: { ...settings, parts: [{ text, type: "text" }] },
				path: `/session/${sessionId}/prompt_async`,
				query,
			}),
	};
});
