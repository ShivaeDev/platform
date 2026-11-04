import { access } from "node:fs/promises";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { Effect } from "effect";
import type { StartRequest } from "@shivaedev/agent/run.ts";
import { thinkingLevel } from "#adapters/effort.ts";
import { rejected, unavailable } from "#adapters/failure.ts";
import type { PiOptions } from "#PiOptions.ts";

export const loadSdk = Effect.tryPromise({ catch: unavailable, try: () => import("@earendil-works/pi-coding-agent") });

export const openRuntime = Effect.fnUntraced(function* (options: PiOptions, request: StartRequest, resume: string | undefined) {
	const effort = yield* thinkingLevel(request.effort);
	if (resume !== undefined) {
		yield* Effect.tryPromise({ catch: () => unavailable("Pi session file is unavailable for resume"), try: () => access(resume) });
	}
	const sdk = yield* loadSdk;
	const modelRuntime = yield* Effect.tryPromise({ catch: unavailable, try: () => sdk.ModelRuntime.create() });
	const models = yield* Effect.tryPromise({ catch: unavailable, try: () => modelRuntime.getAvailable() });
	const model = request.model === undefined ? models[0] : models.find((value) => `${value.provider}/${value.id}` === request.model);
	if (model === undefined) {
		return yield* Effect.fail(
			rejected(`Pi offers no model ${request.model ?? "(default)"} with credentials; choose provider/model-id from its catalog`),
		);
	}
	const session = yield* Effect.acquireRelease(
		Effect.tryPromise({
			catch: unavailable,
			try: async () => {
				const agentDir = sdk.getAgentDir();
				const resourceLoader = new sdk.DefaultResourceLoader({
					agentDir,
					cwd: request.cwd,
					...resourceOptions(options),
				});
				await resourceLoader.reload();
				const { session: opened } = await sdk.createAgentSession({
					agentDir,
					customTools: [],
					cwd: request.cwd,
					model,
					modelRuntime,
					resourceLoader,
					sessionManager: resume === undefined ? sdk.SessionManager.create(request.cwd) : sdk.SessionManager.open(resume, undefined, request.cwd),
					...(options.constrainedPrompt === undefined ? {} : { tools: [] }),
					...(effort === undefined ? {} : { thinkingLevel: effort }),
				});
				return opened;
			},
		}),
		(openedSession: AgentSession) => Effect.promise(() => openedSession.abort()).pipe(Effect.ensuring(Effect.sync(() => openedSession.dispose()))),
	);
	if (session.sessionFile === undefined) {
		return yield* Effect.fail(unavailable("Pi opened a session without a persisted file reference"));
	}
	return { session, sessionFile: session.sessionFile };
});

function resourceOptions(options: PiOptions) {
	if (options.constrainedPrompt === undefined) {
		return { additionalSkillPaths: [...(options.skills ?? [])] };
	}
	return {
		noContextFiles: true,
		noExtensions: true,
		noPromptTemplates: true,
		noSkills: true,
		noThemes: true,
		systemPrompt: options.constrainedPrompt,
	};
}
