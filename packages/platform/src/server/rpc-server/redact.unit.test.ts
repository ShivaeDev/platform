import { inspect } from "node:util";
import { expect, it } from "vitest";
import { redact } from "#server/rpc-server/redact.ts";

it("credential-shaped keys are redacted whatever their casing or separator", () => {
	const keys = [
		"jwt",
		"idJwt",
		"session",
		"sessionId",
		"session_id",
		"bearer",
		"bearerToken",
		"signature",
		"webhookSignature",
		"pan",
		"cardNumber",
		"card_number",
	];
	const redacted = redact(Object.fromEntries(keys.map((key) => [key, `${key}-plaintext`])));
	expect(redacted).toEqual(Object.fromEntries(keys.map((key) => [key, "<redacted>"])));
	expect(redact({ panel: "visible", sessions: 3 })).toEqual({ panel: "visible", sessions: 3 });
});
it("anti-forgery, one-time code, access key and bank account names are redacted by word", () => {
	const keys = [
		"csrf",
		"csrfToken",
		"xsrf",
		"x-xsrf",
		"otpCode",
		"OTPCode",
		"pinCode",
		"userPin",
		"accessKeyId",
		"access_key_id",
		"iban",
		"payoutIban",
		"accountNumber",
	];
	const redacted = redact(Object.fromEntries(keys.map((key) => [key, `${key}-plaintext`])));
	expect(redacted).toEqual(Object.fromEntries(keys.map((key) => [key, "<redacted>"])));
	const visible = { accountName: "c", options: 1, pinboard: 2, pinned: true, spinner: "a", topic: "b" };
	expect(redact(visible)).toEqual(visible);
});
it("long strings are cut with a marker counting the dropped characters", () => {
	expect(redact({ note: `${"a".repeat(2048)}${"b".repeat(952)}` })).toEqual({ note: `${"a".repeat(2048)}…<952 more chars>` });
	expect(redact("short")).toBe("short");
});
it("credential-shaped text inside strings is masked", () => {
	const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJlLXBsYWludGV4dA";
	const redacted = redact({
		detail: "retry with password=hunter2-plaintext&user=alice, token: tok-plaintext",
		message: `upstream rejected Authorization: Bearer abc.def-plaintext and ${jwt}`,
		stack: "Error: connect postgres://app:db-plaintext@db.internal:5432/app failed\n    at connect (file:///srv/token.ts:1:2)",
	});
	expect(inspect(redacted, { depth: 20 })).not.toMatch(/abc\.def-plaintext|c2lnbmF0dXJl|db-plaintext|hunter2-plaintext|tok-plaintext/u);
	expect(redacted).toEqual({
		detail: "retry with password=<redacted>&user=alice, token: <redacted>",
		message: "upstream rejected Authorization: <redacted> <redacted> and <redacted>",
		stack: "Error: connect postgres://app:<redacted>@db.internal:5432/app failed\n    at connect (file:///srv/token.ts:1:2)",
	});
});
it("large collections and binary data are summarised instead of walked", () => {
	const redacted = redact({
		buffer: new ArrayBuffer(16),
		items: Array.from({ length: 500 }, (_, index) => index),
		upload: new Uint8Array(4096),
		wide: Object.fromEntries(Array.from({ length: 500 }, (_, index) => [`k${index}`, index])),
	});
	expect(redacted).toMatchObject({ buffer: "<ArrayBuffer 16 bytes>", upload: "<Uint8Array 4096 bytes>" });
	expect(inspect(redacted, { depth: 5, maxArrayLength: null }).length).toBeLessThan(3000);
	expect(redacted).toMatchObject({ items: expect.arrayContaining(["<450 more items>"]) });
	expect(redacted).toMatchObject({ wide: expect.objectContaining({ "<truncated>": "450 more keys" }) });
});
it("cyclic payloads stop at the depth limit while nearby secrets are redacted", () => {
	const payload: {
		child?: unknown;
		password: string;
	} = { password: "cycle-secret" };
	payload.child = payload;
	let expected: unknown = "<truncated>";
	for (let depth = 0; depth < 8; depth += 1) {
		expected = { child: expected, password: "<redacted>" };
	}
	expect(redact(payload)).toEqual(expected);
});
