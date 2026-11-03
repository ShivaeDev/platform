import { Effect, PubSub, Scope, Stream } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { StartRequest } from "@shivaedev/agent/run.ts";
import { delivery } from "#adapters/delivery.ts";
import { toAgentEvents } from "#adapters/mapping.ts";
import { ThreadResponse } from "#adapters/protocol.ts";
import { decode } from "#adapters/reads.ts";
import { AppServer } from "#adapters/server.ts";
import { openThreadTree } from "#adapters/threadTree.ts";
import type { CodexConfiguration } from "#config.ts";
export const openSession = Effect.fn("Codex.openSession")(function* (
	config: CodexConfiguration,
	request: Omit<StartRequest, "input">,
	resume: string | undefined,
	remember: (operationId: string, threadId: string) => void,
) {
	const server = yield* AppServer;
	const threadTools = config.tools?.map(({ name, description, inputSchema }) => ({ description, inputSchema, name, type: "function" }));
	const opening = resume === undefined ? { ...(threadTools?.length ? { dynamicTools: threadTools } : {}) } : { threadId: resume };
	const response = yield* server
		.request(
			resume === undefined ? "thread/start" : "thread/resume",
			{
				approvalsReviewer: "auto_review",
				cwd: request.cwd,
				model: request.model,
				sandbox: config.sandbox ?? "workspace-write",
				...(config.baseInstructions === undefined ? {} : { baseInstructions: config.baseInstructions }),
				...opening,
			},
			request.operationId,
		)
		.pipe(Effect.flatMap((value) => decode(ThreadResponse, value)));
	const threadId = response.thread.id;
	const driver = yield* delivery(
		threadId,
		{
			...(request.model === undefined ? {} : { model: request.model }),
			...(request.effort === undefined ? {} : { effort: request.effort }),
		},
		(operationId) => remember(operationId, threadId),
	);
	const toolScope = yield* Scope.fork(yield* Effect.scope);
	server.registrations.set(threadId, toolScope);
	const events = yield* PubSub.unbounded<RunEvent>();
	const tree = openThreadTree(threadId, server.claims, request.model ?? "");
	const subscription = yield* PubSub.subscribe(server.notifications);
	yield* Effect.forkScoped(
		Stream.fromSubscription(subscription).pipe(
			Stream.interruptWhen(server.exited),
			Stream.runForEach((notification) =>
				Effect.gen(function* () {
					const mapped =
						notification.method === "account/rateLimits/updated" ? toAgentEvents(notification, request.model ?? "") : tree.events(notification);
					for (const event of mapped) {
						yield* PubSub.publish(events, event);
					}
					yield* driver.track(notification);
				}),
			),
		),
	);
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			server.registrations.delete(threadId);
			server.claims.release(threadId);
		}),
	);
	return { driver, events, threadId };
});
export type Session = Effect.Success<ReturnType<typeof openSession>>;
