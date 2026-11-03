import { Effect, Scope } from "effect";
import type { Receipt } from "@shivaedev/agent/run.ts";
import { attempt } from "#test/attempt.ts";
import type { CodexState } from "#test/codexState.ts";
import { currentReceipt } from "#test/currentReceipt.ts";
import { supported } from "#test/supported.ts";

const request = { cwd: "/project", input: { parts: [{ text: "make the change", type: "text" }] }, operationId: "edit" } as const;
export function codexDelivery(state: CodexState, tell: (line: string) => void) {
	function remembered(receipt: Receipt) {
		return Effect.sync(() => {
			state.receipt.value = receipt;
		});
	}
	function submit() {
		return state.backend.start(request).pipe(Effect.provideService(Scope.Scope, state.callerScope));
	}
	return {
		beginStart: () => Effect.forkScoped(attempt(submit())),
		interrupt: () => Effect.forkScoped(supported(state.backend.features.interruption).interrupt(currentReceipt(state))),
		interruptAndWait: () => supported(state.backend.features.interruption).interrupt(currentReceipt(state)),
		queue: () =>
			Effect.forkScoped(
				attempt(
					supported(state.backend.features.queuedInput).queue(currentReceipt(state), {
						id: "follow-up",
						parts: [{ text: "then document it", type: "text" }],
					}),
				),
			),
		recover: () =>
			state.backend.reconcile("edit").pipe(Effect.tap((result) => (result.type === "accepted" ? remembered(result.receipt) : Effect.void))),
		rejectedStart: () =>
			submit().pipe(
				Effect.match({
					onFailure: (error) => ({ outcome: error._tag === "Rejected" ? "rejected" : error._tag, providerCode: error.providerCode }),
					onSuccess: () => ({ outcome: "accepted" }),
				}),
			),
		resume: () =>
			supported(state.backend.features.sessions)
				.resume({ value: "saved-root", version: 1 }, { ...request, operationId: "continue" })
				.pipe(Effect.provideService(Scope.Scope, state.callerScope), Effect.tap(remembered)),
		resumeChild: () =>
			attempt(supported(state.backend.features.sessions).resume({ value: "child", version: 1 }, { ...request, operationId: "child-edit" })),
		start: () => {
			tell("submit edit");
			return attempt(submit().pipe(Effect.tap(remembered)));
		},
		startImage: () =>
			supported(state.backend.features.imageInput)
				.start({ ...request, input: { parts: [{ mediaType: "image/png", path: "/project/design.png", type: "image" }] } })
				.pipe(Effect.provideService(Scope.Scope, state.callerScope), Effect.tap(remembered)),
		steer: () =>
			attempt(
				supported(state.backend.features.steering).steer(currentReceipt(state), {
					id: "correction",
					parts: [{ text: "keep the API", type: "text" }],
				}),
			),
	};
}
