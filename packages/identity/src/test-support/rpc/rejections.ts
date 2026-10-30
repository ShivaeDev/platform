import { Cause, Effect, ErrorReporter, Exit, Layer } from "effect";
import { RpcClient } from "effect/rpc";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { requestTracingLayer } from "#server/tracing.ts";
import { httpClient, recorder, rpcHttp, serve } from "./harness.ts";
import { rejectionAnswer } from "./rejectionAnswer.ts";
import { Invalid, Profiles, Handlers as RenameHandlers, type RenameRejection } from "./renameFixture.ts";
import { Api, Handlers as SaveHandlers, type SaveOutcome } from "./saveFixture.ts";

const Group = Profiles.merge(Api);
const createRejections = Effect.gen(function* () {
	const recorded = recorder();
	const rejected: { error?: unknown } = {};
	const reported: Array<{ message: string; severity: string; beforeReply: boolean }> = [];
	const reporter = ErrorReporter.make(({ error, severity }) =>
		reported.push({ beforeReply: !("error" in rejected), message: error.message, severity }),
	);
	const app = serve(
		rpcHttp(Group).pipe(
			Layer.provide(Layer.mergeAll(SaveHandlers, RenameHandlers, requestTracingLayer())),
			Layer.provide(Layer.merge(recorded.layer, ErrorReporter.layer([reporter]))),
		),
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const client = yield* RpcClient.make(Group).pipe(Effect.provide(httpClient(app, {})));
	const save: { outcome?: typeof SaveOutcome.Type; storageDetail: string } = { storageDetail: "" };
	return { client, rejected, reported, save, ...recorded };
});

type Engine = Effect.Success<typeof createRejections>;

function rejection(engine: Engine) {
	if (!("error" in engine.rejected)) {
		throw new Error("No call has been rejected");
	}
	return engine.rejected.error;
}

function loggedStacks(cause: Cause.Cause<unknown>) {
	return cause.reasons.flatMap((reason) => {
		if (Cause.isInterruptReason(reason)) {
			return [];
		}
		const error = Cause.isFailReason(reason) ? reason.error : reason.defect;
		return error instanceof Error ? [error.stack] : [];
	});
}

export const rejections = storyKit({
	clock: "live",
	create: () => createRejections,
	name: "RPC rejection",
	stages: ["storage"],
	verbs: (engine, story) => ({
		rejection: () => Effect.sync(() => rejectionAnswer(rejection(engine))),
		rejectionCause: () =>
			Effect.sync(() => {
				const error = rejection(engine);
				return error instanceof Error && error.cause !== undefined ? String(error.cause) : "none";
			}),
		rejectionMentions: (text: string) => Effect.sync(() => JSON.stringify(rejection(engine)).includes(text)),
		renameRejectedWith: (rejectWith: RenameRejection) => {
			story.tell(`an anonymous caller renames a profile over HTTP, and the handler rejects it with ${rejectWith}`);
			return Effect.flip(engine.client.Rename({ rejectWith })).pipe(Effect.map((error) => rejectionAnswer(error, { Invalid })));
		},
		reportedFailures: () => Effect.sync(() => engine.reported),
		requestLogs: () =>
			Effect.sync(() =>
				engine.logs
					.filter((log) => log.annotations["rpc.method"] === "Save")
					.map((log) => ({
						level: log.level,
						message: log.message,
						stacks: loggedStacks(log.cause),
					})),
			),
		save: () => {
			const { outcome, storageDetail } = engine.save;
			if (outcome === undefined) {
				throw new Error("The story has not said how storage behaves");
			}
			story.tell("an anonymous caller saves a profile over HTTP");
			return Effect.gen(function* () {
				engine.rejected.error = yield* Effect.flip(engine.client.Save({ outcome, storageDetail }));
			});
		},
		tracedCause: () =>
			Effect.sync(() => {
				const traced = engine.spans
					.filter((span) => span.kind === "server" && span.name === "Save")
					.flatMap((span) => (span.status._tag === "Ended" && Exit.isFailure(span.status.exit) ? span.status.exit.cause.reasons : []))
					.filter(Cause.isFailReason)
					.map(({ error }) => error)
					.filter((error) => error instanceof InternalServerError)
					.map((error) => (Cause.isCause(error.cause) ? Cause.squash(error.cause) : undefined));
				return traced.map((cause) => (cause instanceof Error ? cause.message : String(cause)));
			}),
	}),
});

function storage(line: string, outcome: typeof SaveOutcome.Type, storageDetail = "") {
	return rejections.trait("storage", line, (engine) => {
		engine.save.outcome = outcome;
		engine.save.storageDetail = storageDetail;
	});
}

export const nameTaken = storage("the profile name is already taken", "name taken");

export const storageUnavailable = storage("storage reports itself unavailable", "storage unavailable");

export function storageError(fault: "fails" | "crashes", secret: string) {
	return storage(`storage ${fault} with an error that mentions ${secret}`, fault === "fails" ? "storage fails" : "storage crashes", secret);
}

export const storageTextFailure = storage(
	"storage rejects with a plain message containing a secret",
	"storage returns text",
	"password=private-value",
);
