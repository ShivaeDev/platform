import { expect, it } from "vitest";
import { SessionFailure } from "#session/schema.ts";
import { genericRejection } from "./genericRejection.ts";

for (const message of [
	"Codex rejected the protocol request",
	"Codex rejected the protocol request: ",
	"Codex rejected the protocol request: Request ID: synthetic-request",
	"Codex rejected the protocol request: Something went wrong",
	"Codex rejected the protocol request: Something went wrong. Request ID: synthetic-request",
	"Codex rejected the protocol request: Internal error.",
	"Codex rejected the protocol request: Internal server error. Request ID: synthetic-request",
]) {
	it(`a rejection with no specific cause can retry: ${message}`, () => {
		expect(genericRejection(new SessionFailure({ code: "session-rejected", message, reason: "rejected" }))).toBe(true);
	});
}

for (const message of [
	"Codex rejected the protocol request: Invalid request",
	"Codex rejected the protocol request: Permission denied",
	"Codex rejected the protocol request: Quota exceeded",
	"Codex rejected the protocol request: Something went wrong. Invalid request. Request ID: synthetic-request",
	"Codex rejected the protocol request: Internal server error: permission denied",
]) {
	it(`a rejection that names a cause cannot use generic retries: ${message}`, () => {
		expect(genericRejection(new SessionFailure({ code: "session-rejected", message, reason: "rejected" }))).toBe(false);
	});
}

it("generic wording cannot override structured capacity, a distinct code or an uncertain submission", () => {
	const message = "Codex rejected the protocol request: Something went wrong.";
	for (const error of [
		new SessionFailure({ capacity: "serverOverloaded", code: "session-rejected", message, reason: "rejected" }),
		new SessionFailure({ code: "session-queue-full", message, reason: "rejected" }),
		new SessionFailure({ code: "session-rejected", message, reason: "ambiguous" }),
	]) {
		expect(genericRejection(error)).toBe(false);
	}
});
