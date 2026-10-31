import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import type { PromptAnswer, RecordedResponse } from "#browser/responses/schema.ts";
import { watchChanges } from "#server/files/changes.ts";
import { Responses } from "#server/Responses.ts";
import { Workspace, WorkspaceConfig } from "#server/workspace.ts";
import { fullIndex } from "./fullIndex.ts";
import { changedOutside } from "./publicationFaults.ts";
import { questionRecords, type Registration, registeredQuestion } from "./questionRecordState.ts";
import { settledCall } from "./responseOutcome.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export interface Reply {
	readonly answers?: readonly PromptAnswer[];
	readonly author?: string;
	readonly body?: string;
	readonly id?: string;
	readonly supersedes?: string;
	readonly type?: RecordedResponse["response"]["type"];
}

export const SAVED = "Use explicit requests.";

export function described(reply: Reply) {
	return `${reply.id ?? "response.first"}${reply.type && reply.type !== "answer" ? ` as ${reply.type}` : ""}`;
}

export function questionRecordReads(engine: BoardEngine) {
	const records = questionRecords(engine);
	function client() {
		return served(engine).client;
	}
	function path(file: string) {
		return join(engine.notes.root, file);
	}
	function outside(paths: readonly string[], change: () => void) {
		return changedOutside(engine, paths, change);
	}
	function draft(reply: Reply) {
		return {
			author: reply.author ?? "maintainer",
			body: reply.body ?? SAVED,
			id: reply.id ?? "response.first",
			question: registeredQuestion(engine).id,
			type: reply.type ?? "answer",
			...(reply.answers ? { answers: reply.answers } : {}),
			...(reply.supersedes ? { supersedes: reply.supersedes } : {}),
		};
	}
	function questionFile() {
		return `responses/${registeredQuestion(engine).id}.md`;
	}
	function reading(question: Registration = "current") {
		const { id } = registeredQuestion(engine, question);
		return settledCall(() => client().run(client().responses.responses.run({ question: id })));
	}
	const service = Responses.layer.pipe(
		Layer.provideMerge(Workspace.layer),
		Layer.provide(
			Layer.effect(
				WorkspaceConfig,
				Effect.gen(function* () {
					return {
						changes: yield* watchChanges(engine.notes.root),
						index: fullIndex(engine.notes.root).pipe(Effect.provide(NodeServices.layer)),
						root: engine.notes.root,
						writable: engine.responses,
					};
				}),
			),
		),
		Layer.provide(NodeServices.layer),
	);
	return { client, draft, outside, path, questionFile, reading, records, service };
}
