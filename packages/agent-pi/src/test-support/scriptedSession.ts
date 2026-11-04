import type { AgentSessionEvent, CreateAgentSessionOptions, PromptOptions } from "@earendil-works/pi-coding-agent";

interface SessionScript {
	readonly abortFails: boolean;
	readonly handled: string | undefined;
	readonly held: boolean;
	readonly persisted: boolean;
	readonly prompted: () => void;
	readonly refusal: "rejected" | "unknown" | undefined;
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
	let running = false;
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
					return script.refusal === "rejected" ? Promise.reject(new Error("provider refused text")) : Promise.resolve();
				}
				if (text === script.handled) {
					promptOptions?.preflightResult?.("handled");
					return Promise.resolve();
				}
				if (running) {
					promptOptions?.preflightResult?.("queued");
					return Promise.resolve();
				}
				function accept() {
					promptOptions?.preflightResult?.("started");
					running = true;
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
		settle: (aborted: boolean) => {
			running = false;
			for (const resolve of completions.splice(0)) {
				resolve();
			}
			emit({ aborted, type: "agent_settled" });
		},
		unsettled: () => completions.length,
	};
}
