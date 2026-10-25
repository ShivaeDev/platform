import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { GitHubWebhookSignatureError } from "#errors.ts";
import { WORKFLOW_BODY, webhookSignature } from "#test/appFixture.ts";
import { appGithub } from "#test/appGithub.ts";

appGithub.it("a signed workflow_run delivery decodes with the caller's Schema", [], function* ({ verifyDelivery }) {
	expect(yield* verifyDelivery()).toEqual({ action: "completed", workflowRun: { conclusion: "success", id: 42 } });
});

for (const [name, body, signature, secret] of [
	["tampered body", Buffer.from("invalid-json"), webhookSignature(), undefined],
	["wrong secret", WORKFLOW_BODY, webhookSignature(), "wrong-secret"],
	["missing header", WORKFLOW_BODY, undefined, undefined],
] as const) {
	appGithub.it(`a ${name} fails typed before decoding`, [], function* ({ verifyAs }) {
		let decoded = false;
		const schema = Schema.Unknown.check(
			Schema.makeFilter(() => {
				decoded = true;
				return true;
			}),
		);
		expect(yield* Effect.flip(verifyAs(body, signature, schema, secret))).toEqual(new GitHubWebhookSignatureError());
		expect(decoded).toBe(false);
	});
}

appGithub.it(
	"credentials stay out of errors, logs and spans on success and failure",
	[],
	function* ({ readPull, readWithInvalidKey, rejectExchange, verifyDelivery, secrets, telemetry }) {
		yield* rejectExchange();
		const unauthorized = yield* Effect.flip(readPull());
		yield* readPull();
		yield* verifyDelivery();
		const signing = yield* Effect.flip(readWithInvalidKey());
		const webhook = yield* Effect.flip(verifyDelivery(WORKFLOW_BODY, webhookSignature(), "wrong-secret"));
		const { logs, spans } = telemetry();
		expect(spans.length).toBeGreaterThan(0);
		const captured = JSON.stringify({
			errors: [unauthorized, signing, webhook],
			logs,
			spans: spans.map(({ attributes, events, status }) => ({
				attributes: [...attributes],
				events: events.map(([name, , fields]) => ({ fields, name })),
				exit: status._tag === "Ended" ? status.exit : undefined,
			})),
		});
		for (const secret of [...secrets(), "wrong-secret"]) {
			expect(captured).not.toContain(secret);
			expect(captured).not.toContain(JSON.stringify(secret).slice(1, -1));
		}
	},
);
