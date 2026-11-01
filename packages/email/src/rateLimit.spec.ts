import { expect } from "vitest";
import { email } from "#test/internal/email.ts";
import { rateLimited } from "#test/internal/traits.ts";

const AT = "Sun, 01 Nov 2099 10:00:00 GMT";
email.it(
	"a Resend 429 defers to the provider's HTTP date without spending a retry",
	[rateLimited(AT)],
	function* ({ enqueue, startWorker, storedRetryPlan, retry, nextEmail, untilIdle, providerRequests }) {
		const id = yield* enqueue("Confirm", "https://app.test/confirm?token=secret-link");

		yield* startWorker();
		const plan = yield* storedRetryPlan();
		expect(plan).toMatchObject({ at: "2099-11-01T10:00:00.000Z", retryCount: 0 });

		yield* retry();
		expect((yield* nextEmail()).idempotencyKey).toBe(id);
		yield* untilIdle();
		expect(yield* providerRequests()).toEqual([
			{ idempotencyKey: id, status: 429 },
			{ idempotencyKey: id, status: 200 },
		]);
	},
);

email.it(
	"a Resend 429 with delay seconds schedules the provider's delay",
	[rateLimited("3600")],
	function* ({ enqueue, startWorker, storedRetryPlan }) {
		yield* enqueue("Confirm", "https://app.test/confirm?token=secret-link");

		yield* startWorker();

		const plan = yield* storedRetryPlan();
		expect(plan.secondsUntilRetry).toBeGreaterThan(3595);
		expect(plan.secondsUntilRetry).toBeLessThanOrEqual(3600);
		expect(plan.retryCount).toBe(0);
	},
);

for (const header of [undefined, "invalid"] as const) {
	email.it(
		`a Resend 429 with ${header ?? "no"} Retry-After still retries and delivers`,
		[rateLimited(header)],
		function* ({ enqueue, startWorker, nextEmail, untilIdle, providerRequests }) {
			const id = yield* enqueue("Confirm", "https://app.test/confirm?token=secret-link");

			yield* startWorker();

			expect((yield* nextEmail()).idempotencyKey).toBe(id);
			yield* untilIdle();
			expect(yield* providerRequests()).toEqual([
				{ idempotencyKey: id, status: 429 },
				{ idempotencyKey: id, status: 200 },
			]);
		},
	);
}
