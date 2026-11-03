import { access } from "node:fs/promises";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { Effect, Schema } from "effect";
import type { PiOptions } from "#PiOptions.ts";
import { rejected, unavailable } from "./piFailure.ts";
export interface PiOpenRequest {
	readonly cwd: string;
	readonly effort?: string | undefined;
	readonly model?: string | undefined;
	readonly resume?: string;
}
export type PiSession = Pick<AgentSession, "abort" | "dispose" | "prompt" | "sessionId" | "subscribe"> & {
	readonly sessionFile: string;
};
const efforts = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const decodeEffort = Schema.decodeUnknownEffect(Schema.Literals(efforts));
const load = Effect.tryPromise({ catch: unavailable, try: () => import("@earendil-works/pi-coding-agent") });
export const listModels = load.pipe(
	Effect.flatMap((sdk) =>
		Effect.tryPromise({
			catch: unavailable,
			try: async () => {
				const runtime = await sdk.ModelRuntime.create();
				return (await runtime.getAvailable()).map((model, index) => ({
					efforts,
					id: `${model.provider}/${model.id}`,
					isDefault: index === 0,
					name: `${model.name} (${model.provider})`,
				}));
			},
		}),
	),
);
async function adopt(session: AgentSession): Promise<PiSession> {
	const sessionFile = session.sessionFile;
	if (sessionFile === undefined) {
		try {
			await session.abort();
		} finally {
			session.dispose();
		}
		throw new Error("Pi opened a session without a persisted session file");
	}
	return {
		abort: () => session.abort(),
		dispose: () => session.dispose(),
		prompt: (text, promptOptions) => session.prompt(text, promptOptions),
		sessionFile,
		sessionId: session.sessionId,
		subscribe: (listener) => session.subscribe(listener),
	};
}
export const openPiSession = Effect.fn("Pi.openPiSession")(function* (request: PiOpenRequest, options: PiOptions) {
	const thinkingLevel =
		request.effort === undefined
			? undefined
			: yield* decodeEffort(request.effort).pipe(
					Effect.mapError(() => rejected(`effort ${request.effort} is not a thinking level Pi offers; choose ${efforts.join(", ")}`)),
				);
	const sdk = yield* load;
	return yield* Effect.tryPromise({
		catch: rejected,
		try: async (): Promise<PiSession> => {
			const modelRuntime = await sdk.ModelRuntime.create();
			const models = await modelRuntime.getAvailable();
			const model = request.model === undefined ? models[0] : models.find((candidate) => `${candidate.provider}/${candidate.id}` === request.model);
			if (model === undefined) {
				throw new Error(`Pi offers no model ${request.model ?? "(default)"} with credentials; choose provider/model-id from its catalog`);
			}
			const agentDir = sdk.getAgentDir();
			const resourceLoader = new sdk.DefaultResourceLoader({
				additionalSkillPaths: [...(options.additionalSkillPaths ?? [])],
				agentDir,
				cwd: request.cwd,
			});
			await resourceLoader.reload();
			if (request.resume !== undefined) {
				await access(request.resume);
			}
			const sessionManager =
				request.resume === undefined ? sdk.SessionManager.create(request.cwd) : sdk.SessionManager.open(request.resume, undefined, request.cwd);
			const { session } = await sdk.createAgentSession({
				agentDir,
				cwd: request.cwd,
				model,
				modelRuntime,
				resourceLoader,
				sessionManager,
				...(thinkingLevel === undefined ? {} : { thinkingLevel }),
			});
			return adopt(session);
		},
	});
});
