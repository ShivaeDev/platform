import { Effect, Fiber, Layer } from "effect";
import type { RetryAt } from "@shivaedev/jobs/server/definition.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Mailer } from "#server/Mailer.ts";
import type { MailerError } from "#server/MailerError.ts";
import { inbox } from "#server/testing/adapters/inbox.ts";

export const transport = storyKit({
	clock: "live",
	*create() {
		const mail = yield* inbox();
		const held = yield* mail.endpoint.hold("send");
		const context = yield* Layer.build(mail.mailerLayer);
		const mailer = yield* Mailer.pipe(Effect.provideContext(context));
		const sending: { fiber?: Fiber.Fiber<void, MailerError | RetryAt> } = {};
		return { held, mail, mailer, sending };
	},
	inspect: () => ({}),
	name: "Resend transport",
	stages: [],
	verbs: (engine, story) => ({
		abandonedRequest: () => engine.mail.endpoint.untilAbandoned(() => true, { name: "Resend request aborted" }).pipe(Effect.map(({ path }) => path)),
		beginSend: () =>
			Effect.gen(function* () {
				story.tell("start sending alice's email while Resend holds the request");
				engine.sending.fiber = yield* Effect.forkScoped(
					engine.mailer.send({ from: "app@example.test", html: "Hello", subject: "Hello", text: "Hello", to: "alice@example.test" }, "held-job"),
				);
				yield* engine.held.waiting;
			}),
		cancelSend: () =>
			Effect.suspend(() => {
				story.tell("interrupt the send");
				return engine.sending.fiber === undefined ? Effect.die("Start the send before interrupting it") : Fiber.interrupt(engine.sending.fiber);
			}),
	}),
});
