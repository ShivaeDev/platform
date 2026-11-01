import { expect } from "vitest";
import { email } from "#test/internal/email.ts";
import { development, rejected, unavailableTwice } from "#test/internal/traits.ts";

for (const kind of ["Confirm", "Reset"] as const) {
	email.it(
		`the web producer's ${kind} email is rendered and delivered once with its job id`,
		[],
		function* ({ enqueue, startWorker, nextEmail, untilIdle, delivered }) {
			const url = "https://app.test/confirm?token=secret-link";
			const id = yield* enqueue(kind, url);
			expect(yield* delivered()).toEqual([]);

			yield* startWorker();
			const received = yield* nextEmail();
			yield* untilIdle();

			expect(received).toEqual({
				from: "App <app@example.test>",
				html: `<a href="${url}">${kind}</a>`,
				idempotencyKey: id,
				subject: `${kind} your account`,
				text: `${kind}: ${url}`,
				to: "alice@example.test",
			});
			expect(yield* delivered()).toEqual([received]);
		},
	);
}

email.it("the inbox reads the one-time link delivered by the worker", [], function* ({ enqueue, startWorker, nextLink }) {
	yield* enqueue("Confirm", "https://app.test/confirm?token=secret-link");

	yield* startWorker();

	expect(yield* nextLink()).toBe("https://app.test/confirm?token=secret-link");
});

email.it(
	"successive failed sends back off further and keep the same idempotency key",
	[unavailableTwice],
	function* ({ enqueue, startWorker, storedRetryPlan, retry, nextEmail, providerRequests, untilIdle }) {
		const id = yield* enqueue("Confirm", "https://app.test/confirm?token=secret-link");
		yield* startWorker();
		const plan = yield* storedRetryPlan();
		expect(plan.secondsUntilRetry).toBeGreaterThan(25);
		expect(plan.secondsUntilRetry).toBeLessThanOrEqual(60);

		yield* retry();
		yield* untilIdle();
		const second = yield* storedRetryPlan();
		expect(second.secondsUntilRetry).toBeGreaterThan(55);
		expect(second.secondsUntilRetry).toBeLessThanOrEqual(120);

		yield* retry();
		const received = yield* nextEmail();
		yield* untilIdle();

		expect(received.idempotencyKey).toBe(id);
		expect(yield* providerRequests()).toEqual([
			{ idempotencyKey: id, status: 500 },
			{ idempotencyKey: id, status: 500 },
			{ idempotencyKey: id, status: 200 },
		]);
	},
);

email.it(
	"an exhausted failure is recorded without its redacted link",
	[rejected],
	function* ({ enqueue, startWorker, failedDiagnostics, logs, retry, untilIdle }) {
		yield* enqueue("Confirm", "https://app.test/confirm?token=secret-link");

		yield* startWorker();

		yield* untilIdle();
		for (let attempt = 0; attempt < 3; attempt += 1) {
			yield* retry();
			yield* untilIdle();
		}
		const diagnostics = yield* failedDiagnostics();
		expect(diagnostics).toContain("MailerError");
		expect(diagnostics).toContain("<redacted>");
		expect(diagnostics).not.toContain("secret-link");
		expect(yield* logs()).not.toContain("secret-link");
	},
);

email.it(
	"the development worker writes the rendered message instead of sending it",
	[development],
	function* ({ enqueue, startWorker, untilIdle, logs, delivered }) {
		const id = yield* enqueue("Reset", "https://app.test/reset?token=development-link");

		yield* startWorker();
		yield* untilIdle();

		const written = yield* logs();
		expect(written).toContain("Reset your account");
		expect(written).toContain("https://app.test/reset?token=<redacted>");
		expect(written).toContain(id);
		expect(yield* delivered()).toEqual([]);
	},
);
