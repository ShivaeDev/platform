import { Redacted } from "effect";
import { expect } from "vitest";
import { aliceAccount, approvalRequested, emails } from "#test/better-auth/emails.ts";

for (const kind of ["ConfirmAccount", "ResetPassword", "AccountAlreadyExists", "ApproveEmailChange", "ConfirmNewAddress"] as const) {
	const change = kind === "ApproveEmailChange" || kind === "ConfirmNewAddress";
	const traits = [aliceAccount(change), ...(kind === "ConfirmNewAddress" ? [approvalRequested] : [])];

	emails.it(
		`${kind} keeps its delivered link and token redacted in logs and traces`,
		traits,
		function* ({ request, messages, deliveryLogs, deliveryTraces }) {
			yield* request(kind);

			const delivered = yield* messages(kind);
			expect(delivered).toMatchObject([{ _tag: kind }]);
			for (const message of delivered) {
				expect(Redacted.isRedacted(message.url)).toBe(true);
				const secrets = [Redacted.value(message.url)];
				if ("token" in message) {
					expect(Redacted.isRedacted(message.token)).toBe(true);
					secrets.push(Redacted.value(message.token));
				}
				for (const readout of [yield* deliveryLogs(), yield* deliveryTraces()]) {
					expect(readout).toContain(kind);
					expect(readout).toContain("<redacted>");
					for (const secret of secrets) {
						expect(readout).not.toContain(secret);
					}
				}
			}
		},
	);
}
