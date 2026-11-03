import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentSessionEvent, CreateAgentSessionOptions, DefaultResourceLoader, PromptOptions } from "@earendil-works/pi-coding-agent";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";
import { assistant } from "./piEvents.ts";

type ResourceOptions = ConstructorParameters<typeof DefaultResourceLoader>[0];

export function scriptedPi() {
	const directory = mkdtempSync(join(tmpdir(), "platform-pi-"));
	const { promise: prompted, resolve: signalPrompted } = Promise.withResolvers<void>();
	const calls: {
		text: string;
		delivery: string | undefined;
	}[] = [];
	const opened: {
		file: string | undefined;
		history: unknown[];
		model: unknown;
		effort: string | undefined;
		cwd: string | undefined;
	}[] = [];
	const resourceRequests: ResourceOptions[] = [];
	const listeners = new Set<(event: AgentSessionEvent) => void>();
	const prompts: {
		options: PromptOptions | undefined;
		accept: () => void;
	}[] = [];
	let preflight = true;
	let aborted = 0;
	let disposed = 0;
	let failure: string | undefined;
	let noFile = false;
	const catalog = [
		{ id: "sonnet", name: "Sonnet", provider: "anthropic" },
		{ id: "gpt", name: "GPT", provider: "openai" },
	];
	const module = {
		createAgentSession: (options: CreateAgentSessionOptions) => {
			const manager = options.sessionManager;
			if (manager === undefined) {
				throw new Error("SDK peer requires a session manager");
			}
			opened.push({
				cwd: options.cwd,
				effort: options.thinkingLevel,
				file: manager.getSessionFile(),
				history: manager.getBranch(),
				model: options.model,
			});
			return Promise.resolve({
				session: {
					abort: () => {
						aborted += 1;
						for (const prompt of prompts) {
							prompt.accept();
						}
						return Promise.resolve();
					},
					dispose: () => {
						disposed += 1;
					},
					prompt: (text: string, promptOptions?: PromptOptions) => {
						signalPrompted();
						calls.push({ delivery: promptOptions?.streamingBehavior, text });
						if (failure !== undefined) {
							promptOptions?.preflightResult?.(false);
							return Promise.reject(new Error(failure));
						}
						manager.appendMessage({ content: text, role: "user", timestamp: 0 });
						manager.appendMessage(assistant());
						const pending = Promise.withResolvers<void>();
						prompts.push({ accept: pending.resolve, options: promptOptions });
						if (preflight) {
							promptOptions?.preflightResult?.(true);
						}
						return pending.promise;
					},
					sessionFile: noFile ? undefined : manager.getSessionFile(),
					sessionId: manager.getSessionId(),
					subscribe: (listener: (event: AgentSessionEvent) => void) => {
						listeners.add(listener);
						return () => {
							listeners.delete(listener);
						};
					},
				},
			});
		},
		DefaultResourceLoader: class {
			constructor(options: ResourceOptions) {
				resourceRequests.push(options);
			}
			reload() {
				return Promise.resolve();
			}
		},
		getAgentDir: () => directory,
		ModelRuntime: { create: async () => ({ getAvailable: async () => catalog }) },
		SessionManager: {
			create: (cwd: string) => SessionManager.create(cwd, directory),
			open: SessionManager.open,
		},
	};
	vi.doMock("@earendil-works/pi-coding-agent", () => module);
	return {
		accept: () => prompts.at(-1)?.options?.preflightResult?.(true),
		calls,
		catalog,
		cleanup: () => {
			vi.doUnmock("@earendil-works/pi-coding-agent");
			rmSync(directory, { force: true, recursive: true });
		},
		directory,
		emit: (event: AgentSessionEvent) => {
			for (const listener of listeners) {
				listener(event);
			}
		},
		holdPreflight: () => {
			preflight = false;
		},
		omitFile: () => {
			noFile = true;
		},
		opened,
		prompted,
		refuse: (message: string) => {
			failure = message;
		},
		released: () => ({ aborted, disposed, listeners: listeners.size }),
		removeFile: (file: string) => unlinkSync(file),
		resourceRequests,
	};
}
