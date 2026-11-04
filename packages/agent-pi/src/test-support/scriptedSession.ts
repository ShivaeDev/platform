import type { AgentSessionEvent, CreateAgentSessionOptions, PromptOptions } from "@earendil-works/pi-coding-agent";

export function scriptedSession(options: CreateAgentSessionOptions, refusal: "preflight" | "unknown" | undefined, abortFails: boolean) {
	if (options.sessionManager === undefined) {
		throw new Error("adapter supplied no session manager");
	}
	const manager = options.sessionManager;
	const listeners = new Set<(event: AgentSessionEvent) => void>();
	const prompts: { delivery: string | undefined; text: string }[] = [];
	const completions: (() => void)[] = [];
	const lifecycle: string[] = [];
	const history = manager.buildSessionContext().messages;
	function emit(event: AgentSessionEvent) {
		if (event.type === "message_end" && (event.message.role === "user" || event.message.role === "assistant")) {
			manager.appendMessage(event.message);
		}
		for (const listener of listeners) {
			listener(event);
		}
	}
	return {
		emit,
		history,
		lifecycle,
		options,
		prompts,
		session: {
			abort: () => {
				lifecycle.push("abort");
				return abortFails ? Promise.reject(new Error("scripted abort failure")) : Promise.resolve();
			},
			dispose: () => {
				lifecycle.push("dispose");
				for (const resolve of completions.splice(0)) {
					resolve();
				}
			},
			prompt: (text: string, promptOptions?: PromptOptions) => {
				prompts.push({ delivery: promptOptions?.streamingBehavior, text });
				if (refusal !== undefined) {
					if (refusal === "preflight") {
						promptOptions?.preflightResult?.(false);
					}
					return Promise.reject(new Error("provider refused text"));
				}
				promptOptions?.preflightResult?.(true);
				emit({ type: "agent_start" });
				return new Promise<void>((resolve) => {
					completions.push(resolve);
				});
			},
			sessionFile: manager.getSessionFile(),
			sessionId: manager.getSessionId(),
			subscribe: (listener: (event: AgentSessionEvent) => void) => {
				listeners.add(listener);
				return () => {
					lifecycle.push("unsubscribe");
					listeners.delete(listener);
				};
			},
		},
		settle: () => {
			for (const resolve of completions.splice(0)) {
				resolve();
			}
			emit({ type: "agent_settled" });
		},
		unsettled: () => completions.length,
	};
}
