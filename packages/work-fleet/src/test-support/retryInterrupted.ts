import { Effect } from "effect";
import { originalWork } from "#engine/originalWork.ts";
import { FleetRepository } from "#engine/repository.ts";
import { hostLayer } from "#host/commands.ts";
import { BoardGateway } from "#policy.ts";
import { boardHttp } from "#test/boardHttp.ts";
import type { HostFixture } from "#test/fleetHost.ts";

export const retryInterrupted = Effect.fn("CloudRestart.retryInterrupted")(function* (fixture: HostFixture) {
	const { published, interrupted } = yield* Effect.gen(function* () {
		const store = yield* FleetRepository;
		const stored = yield* store.load("synthetic-work");
		if (stored === undefined) {
			return yield* Effect.die(new Error("Expected the interrupted launch intent"));
		}
		const decision = {
			attentionOwner: "maintainer" as const,
			id: `${stored.value.workId}.${stored.version}`,
			links: [],
			reason: "No matching accepted turn is observable; absence does not authorize replay",
			recommendation: "Inspect this specific integration failure and retry the existing work",
		};
		const publication = yield* (yield* BoardGateway).decision(stored.value.workId, decision, originalWork(stored.value));
		const attempts = stored.value.attempts.map(({ prompt: _prompt, settings: _settings, ...attempt }) => attempt);
		yield* store.compareAndSet(stored.value.workId, stored.version, {
			...stored.value,
			attempts,
			attentionOwner: "maintainer",
			decision: { ...decision, published: publication },
			decisionPublished: true,
			step: "waiting",
		});
		return { interrupted: stored.value, published: publication };
	}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
	const { client } = yield* boardHttp(fixture.host.boardDir);
	yield* Effect.tryPromise(() =>
		client.mutate(
			client.responses.recordResponse.run({
				answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
				author: "maintainer",
				body: "Retry the interrupted launch on its existing thread.",
				id: "response.launch.retry",
				question: published.questionId,
				type: "answer",
			}),
		),
	);
	return interrupted;
});
