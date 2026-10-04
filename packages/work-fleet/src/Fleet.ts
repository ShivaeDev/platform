import { Effect, Semaphore } from "effect";
import { defineService } from "@shivaedev/effect-service";
import { observeAttempts } from "./attempts.ts";
import { acceptBatch, decide, setPolicy } from "./decisions.ts";
import { dispatch } from "./dispatch.ts";
import type { Decision, ProviderRef } from "./domain.ts";
import { Agent, ChangeHost, failure } from "./ports.ts";
import { reconcileDelivery } from "./reconcileDelivery.ts";
import { recoverAttempt } from "./recoverAttempt.ts";
import { Store } from "./Store.ts";
export const Fleet = defineService({
	id: "@shivaedev/work-fleet/Fleet",
	initialize: Effect.gen(function* () {
		return { agent: yield* Agent, host: yield* ChangeHost, mutex: yield* Semaphore.make(1), store: yield* Store };
	}),
	methods: ({ store, agent, host, mutex }) => ({
		accept: (input: unknown) => mutex.withPermit(acceptBatch(store, input)),
		decide: (workId: string, action: Exclude<Decision["action"], "attach" | "reject-submission">, reason: string) =>
			mutex.withPermit(decide(store, workId, action, reason)),
		policy: (input: unknown) => mutex.withPermit(setPolicy(store, input)),
		recover: (attemptId: string, reference: ProviderRef | null, reason: string) =>
			mutex.withPermit(recoverAttempt(store, attemptId, reference, reason)),
		snapshot: () => store.read(),
		tick: () =>
			mutex.withPermit(
				Effect.gen(function* () {
					const backend = `${agent.backendId}/${host.backendId}`;
					yield* store.update((state) =>
						state.backend !== null && state.backend !== backend
							? Effect.fail(failure("This database belongs to a different backend; use a separate state database"))
							: Effect.succeed({ ...state, backend }),
					);
					yield* observeAttempts(store, agent);
					yield* reconcileDelivery(store, host);
					yield* dispatch(store, agent);
				}),
			),
	}),
	requires: [Store, Agent, ChangeHost],
});
