import type { Deferred, Effect, Fiber } from "effect";
import type { Question, RecordedResponse } from "#browser/responses/schema.ts";
import type { agentRequest } from "#server/responses/agent.ts";
import type { BoardEngine } from "./storyEngine.ts";

export const MODEL_REVIEW =
	"---\nid: investigation.model\nkind: task\nattention:\n  - id: review-model\n    kind: review\n    state: open\n    response_from: [maintainer]\n    reason: Which approach should we use?\n    unblocks: [investigation.model]\n---\n# Model\n\nChoose explicit requests.\n";

export const OPTION_DECISION =
	"---\nid: task.a\nattention:\n - id: question\n   kind: decision\n   state: open\n   reason: Which option?\n   response_from: [maintainer]\n   unblocks: [task.a]\n---\n# Options\n\nExplicit requests.\n";

export type AgentAnswer = Effect.Success<ReturnType<typeof agentRequest>>;

export type ServiceStep = "unavailable" | "waiting" | "waiting past its deadline" | "replies";

export interface ScriptedService {
	readonly requestedAt: number[];
	readonly steps: readonly ServiceStep[];
}

export interface QuestionRecords {
	agentLines: string[];
	agentWait?: Fiber.Fiber<AgentAnswer, unknown>;
	answerRequestEnded?: Deferred.Deferred<void>;
	leaving?: { readonly abort: () => void; readonly settled: Promise<unknown> };
	questions: Question[];
	readMark?: number;
	reply?: RecordedResponse;
	scripted?: ScriptedService;
}

const records = new WeakMap<BoardEngine, QuestionRecords>();

export function questionRecords(engine: BoardEngine) {
	const known = records.get(engine);
	if (known) {
		return known;
	}
	const created: QuestionRecords = { agentLines: [], questions: [] };
	records.set(engine, created);
	return created;
}

export type Registration = "current" | "earlier";

// Verbs act on the latest registration; "earlier" is the one registered before it.
export function registeredQuestion(engine: BoardEngine, which: Registration = "current") {
	const { questions } = questionRecords(engine);
	const question = questions.at(which === "current" ? -1 : -2);
	if (!question) {
		throw new Error(`No ${which} question is registered; add questionRegistered() to the story`);
	}
	return question;
}
