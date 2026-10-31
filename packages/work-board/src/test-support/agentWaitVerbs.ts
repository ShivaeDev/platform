import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import { Cause, Clock, type Context, type Duration, Effect, Exit, Fiber, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Question, WaitReading } from "#browser/responses/schema.ts";
import { agentRequest } from "#server/responses/agent.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";
import { waitForResponse } from "#server/responses/waitFor.ts";
import { questionnaireSource } from "./questionnaire.ts";
import { type AgentAnswer, questionRecords, registeredQuestion, type ServiceStep } from "./questionRecordState.ts";
import { recordedEdgeResponse } from "./responseEdges.ts";
import { refusal, settledEffect } from "./responseOutcome.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

const execute = promisify(execFile);

function scriptedQuestion(deadline: number): Question {
	const reviewedRevision = revisionOf(questionnaireSource);
	return {
		context: questionnaireSource,
		id: questionId("investigation.choices", "direction", reviewedRevision, "proposal.md"),
		question: {
			deadline,
			item: "investigation.choices",
			reason: "Choose.",
			registeredAt: 0,
			request: "direction",
			reviewedRevision,
			source: "proposal.md",
		},
	};
}

function scriptedReading(step: ServiceStep, question: Question): Effect.Effect<WaitReading, ServiceUnavailable> {
	if (step === "unavailable") {
		return Effect.fail(new ServiceUnavailable({ message: "The workspace could not be indexed." }));
	}
	return Effect.succeed(step === "replies" ? { expired: false, question, response: recordedEdgeResponse(question) } : { expired: false, question });
}

function replyOf(result: AgentAnswer) {
	return "response" in result && result.response ? result.response.id : "no reply";
}

function noScriptedService(): never {
	throw new Error("No scripted service; add localServiceAnswers() to the story");
}

export function agentWaitVerbs(engine: BoardEngine, tell: (line: string) => void) {
	const records = questionRecords(engine);
	function url() {
		return served(engine).board.url;
	}
	function told(text: string) {
		records.agentLines.push(text);
	}
	let agentClock: Context.Context<never> | undefined;
	return {
		agentAsks: (action: "question" | "wait", request: string) => {
			tell(`an agent runs ${action} ${request}`);
			return settledEffect(agentRequest(action, { request, url: url() }));
		},
		agentClockAdvances: (duration: Duration.Input) => {
			tell(`${String(duration)} pass on the agent's clock`);
			if (!agentClock) {
				throw new Error("The agent's wait has not started; call agentWaitStarts() first");
			}
			return TestClock.adjust(duration).pipe(Effect.provide(agentClock));
		},
		agentMessages: () => {
			tell("the reader reads what the agent's wait told it");
			return Effect.succeed([...records.agentLines]);
		},
		agentReadsReplies: () => {
			tell("the agent reads the replies to the registered question by its identity");
			return Effect.map(agentRequest("response", { request: registeredQuestion(engine).id, url: url() }), (reading) =>
				"responses" in reading ? reading.responses.map(({ id }) => id) : [],
			);
		},
		agentStartsWaiting: (after?: string) => {
			tell(`an agent starts waiting on the registered question${after ? ` for the reply after ${after}` : ""}`);
			return Effect.gen(function* () {
				records.agentWait = yield* Effect.forkChild(agentRequest("wait", { after, request: registeredQuestion(engine).id, url: url() }));
			});
		},
		agentStopsWaiting: () => {
			tell("the agent interrupts its wait");
			return Effect.gen(function* () {
				if (!records.agentWait) {
					throw new Error("No agent is waiting; call agentStartsWaiting() first");
				}
				yield* Fiber.interrupt(records.agentWait);
			});
		},
		agentWaitOutcome: () => {
			tell("the reader reads how the agent's wait ended");
			const waiting = records.agentWait;
			if (!waiting) {
				throw new Error("No agent is waiting; call agentStartsWaiting() or agentWaitStarts() first");
			}
			return Effect.map(Fiber.await(waiting), (exit) => {
				if (Exit.isSuccess(exit)) {
					return replyOf(exit.value);
				}
				return Cause.hasInterrupts(exit.cause) ? "interrupted" : refusal(Cause.squash(exit.cause));
			});
		},
		agentWaitStarts: () => {
			tell("an agent starts waiting through the scripted local service");
			const script = records.scripted ?? noScriptedService();
			const deadline = script.steps[0] === "waiting past its deadline" ? 0 : 48 * 60 * 60 * 1000;
			const question = scriptedQuestion(deadline);
			let calls = 0;
			function read() {
				return Effect.gen(function* () {
					script.requestedAt.push(yield* Clock.currentTimeMillis);
					const step = script.steps[calls];
					calls += 1;
					if (step === undefined) {
						return yield* Effect.die(new Error("The agent asked the local service more often than the story scripted"));
					}
					return yield* scriptedReading(step, question);
				});
			}
			return Effect.gen(function* () {
				const clock = yield* Layer.build(TestClock.layer());
				agentClock = clock;
				records.agentWait = yield* Effect.forkChild(waitForResponse(read, told).pipe(Effect.provide(clock)));
				yield* Effect.yieldNow;
			});
		},
		agentWaits: (after?: string) => {
			tell(`an agent waits on the registered question${after ? ` for the reply after ${after}` : ""}`);
			return settledEffect(agentRequest("wait", { after, request: registeredQuestion(engine).id, url: url() })).pipe(
				Effect.map((result) => (typeof result === "string" ? result : replyOf(result))),
			);
		},
		agentWaitsByShorthand: () => {
			tell("an agent previews investigation.choices/direction and waits on it by item and request with the reviewed revision");
			return Effect.gen(function* () {
				const preview = yield* agentRequest("question", { request: "investigation.choices/direction", url: url() });
				if (!("reviewedRevision" in preview)) {
					return yield* Effect.die(new Error("The agent's question did not return a preview"));
				}
				const result = yield* agentRequest(
					"wait",
					{ request: "investigation.choices/direction", revision: preview.reviewedRevision, url: url() },
					told,
				);
				return replyOf(result);
			});
		},
		cliWaits: () => {
			const question = registeredQuestion(engine);
			tell(`the agent runs the bundled work-board wait ${question.id}`);
			const args = ["--conditions=source", "src/server/cli.ts", "wait", question.id, "--port", String(served(engine).board.port)];
			return Effect.promise(() =>
				execute(process.execPath, args, { cwd: new URL("../../", import.meta.url), timeout: 10_000 }).then(
					({ stdout, stderr }) => ({ exitCode: 0, printed: stdout === "" ? "nothing" : replyOf(JSON.parse(stdout)), told: stderr.trim() }),
					(failure: { code?: number; stdout?: string; stderr?: string }) => ({
						exitCode: failure.code,
						printed: failure.stdout ? failure.stdout : "nothing",
						told: failure.stderr?.trim() ?? "",
					}),
				),
			);
		},
		serviceRequestTimes: () => {
			tell("the reader reads when the agent asked the local service, in milliseconds on the agent's clock");
			return Effect.succeed([...(records.scripted?.requestedAt ?? [])]);
		},
	};
}
