import type { AgentSessionEvent, CreateAgentSessionOptions, PromptOptions } from "@earendil-works/pi-coding-agent";

interface SessionScript {
	readonly abortFails: boolean;
	readonly held: boolean;
	readonly persisted: boolean;
	readonly prompted: () => void;
	readonly refusal: "preflight" | "unknown" | undefined;
}
export function scriptedSession(options: CreateAgentSessionOptions, script: SessionScript) {
	if (options.sessionManager === undefined) {
		throw new Error("adapter supplied no session manager");
	}
	const manager = options.sessionManager;
	const listeners = new Set<(event: AgentSessionEvent) => void>();
	const prompts: { delivery: string | undefined; text: string }[] = [];
	const completions: (() => void)[] = [];
	const acceptances: (() => void)[] = [];
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
		accept: () => {
			for (const accept of acceptances.splice(0)) {
				accept();
			}
		},
		emit,
		history,
		lifecycle,
		options,
		prompts,
		session: {
			abort: () => {
				lifecycle.push("abort");
				return script.abortFails ? Promise.reject(new Error("scripted abort failure")) : Promise.resolve();
			},
			dispose: () => {
				lifecycle.push("dispose");
				for (const resolve of completions.splice(0)) {
					resolve();
				}
			},
			prompt: (text: string, promptOptions?: PromptOptions) => {
				prompts.push({ delivery: promptOptions?.streamingBehavior, text });
				script.prompted();
				if (script.refusal !== undefined) {
					if (script.refusal === "preflight") {
						promptOptions?.preflightResult?.(false);
					}
					return Promise.reject(new Error("provider refused text"));
				}
				function accept() {
					promptOptions?.preflightResult?.(true);
					emit({ type: "agent_start" });
				}
				if (script.held) {
					acceptances.push(accept);
				} else {
					accept();
				}
				return new Promise<void>((resolve) => {
					completions.push(resolve);
				});
			},
			sessionFile: script.persisted ? manager.getSessionFile() : undefined,
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
