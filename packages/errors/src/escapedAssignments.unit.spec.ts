import { expect, it } from "vitest";
import { isSensitiveKey, redactText } from "#sensitive.ts";

it.each([
	[
		String.raw`{"error":"{\"access_token\":\"abc123\",\"detail\":\"nope\"}"}`,
		String.raw`{"error":"{\"access_token\":\"<redacted>\",\"detail\":\"nope\"}"}`,
	],
	[String.raw`request failed: \"password\":\"hunter2\" for alice`, String.raw`request failed: \"password\":\"<redacted>\" for alice`],
	[String.raw`\"password\" : \"hunter 2\"`, String.raw`\"password\" : \"<redacted>\"`],
	[String.raw`\'token\':\'abc\'`, String.raw`\'token\':\'<redacted>\'`],
	[String.raw`{\"pin\":1234,\"status\":\"ready\"}`, String.raw`{\"pin\":<redacted>,\"status\":\"ready\"}`],
	[String.raw`\"password\":\"a\\\"b\",\"status\":\"ready\"`, String.raw`\"password\":\"<redacted>\",\"status\":\"ready\"`],
	[String.raw`\"password\":\"a\\\\\",\"status\":\"ready\"`, String.raw`\"password\":\"<redacted>\",\"status\":\"ready\"`],
	[String.raw`\"password\":\"abc`, String.raw`\"password\":\"<redacted>`],
	[String.raw`detail="{\"token\":\"abc\"}"`, String.raw`detail="{\"token\":\"<redacted>\"}"`],
	[
		String.raw`{"body":"{\"error\":\"{\\\"client_secret\\\":\\\"abc\\\",\\\"status\\\":\\\"ready\\\"}\"}"}`,
		String.raw`{"body":"{\"error\":\"{\\\"client_secret\\\":\\\"<redacted>\\\",\\\"status\\\":\\\"ready\\\"}\"}"}`,
	],
	[String.raw`\\\\\\\"token\\\\\\\":\\\\\\\"abc\\\\\\\"`, String.raw`\\\\\\\"token\\\\\\\":\\\\\\\"<redacted>\\\\\\\"`],
	[String.raw`password=\"abc\"`, String.raw`password=\"<redacted>\"`],
])("masks the value of an escaped sensitive name in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it.each([
	[String.raw`{\"status\":\"a b c\",\"note\":\"ready\"}`],
	[String.raw`note="\"password\": Cannot encode"`],
	[String.raw`\"user.password\": Cannot encode Redacted`],
	[String.raw`{"error":"{\"detail\":\"missing \\\"code\\\"\"}"}`],
])("leaves %s readable", (input) => {
	expect(redactText(input, isSensitiveKey)).toBe(input);
});

it.each([
	[String.raw`\"password\": Swordfish`, String.raw`\"password\": <redacted>`],
	[String.raw`\"password\": hunter2 was rejected`, String.raw`\"password\": <redacted> was rejected`],
	[String.raw`"password\": Swordfish is set`, String.raw`"password\": <redacted> is set`],
	[String.raw`\'password\": Swordfish is set`, String.raw`\'password\": <redacted> is set`],
	[String.raw`\"password\"= Swordfish is set`, String.raw`\"password\"= <redacted> is set`],
])("reads an escaped quoted path the way it reads an unescaped one in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it.each([
	['message: "password: hunter2"', 'message: "password: <redacted>"'],
	['{"error_description":"client_secret: abc is invalid"}', '{"error_description":"client_secret: <redacted> is invalid"}'],
])("masks an assignment written inside a quoted value in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it.each([
	[String.raw`{"error":"{\"Authorization\":\"Bearer abc.def\"}"}`, String.raw`{"error":"{\"Authorization\":\"<redacted>\"}"}`],
	["Authorization: token ghp-private was rejected", "Authorization: <redacted> <redacted> was rejected"],
	["proxy-authorization: Digest username-private", "proxy-authorization: <redacted> <redacted>"],
	["callback?access_token=abc&state=1 failed", "callback?access_token=<redacted>&state=<redacted>"],
	["client_secret=abc&grant_type=client_credentials", "client_secret=<redacted>&grant_type=client_credentials"],
])("masks the credential in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it.each([
	["many escaped names", String.raw`\"a\":\"`.repeat(30_000)],
	["many escaped sensitive names", String.raw`\"token\":\"`.repeat(30_000)],
	["many quoted values holding escaped names", String.raw`"a":"\"b\":\"`.repeat(20_000)],
	["escaped values at every depth", String.raw`a:"b:\"c:\\\"d:\\\\\\\"`.repeat(10_000)],
	["unterminated values at every depth", `${String.raw`a:"b:\"c:\\\"d:\\\\\\\"`}${"e:'".repeat(50_000)}`],
	["long backslash runs before a separator", `password${"\\".repeat(200_000)}:x`],
	["long backslash runs after a separator", `password:${"\\".repeat(200_000)}x`],
	["many authorization headers", "Authorization: token ".repeat(30_000)],
])("scans %s in linear time", (_name, input) => {
	const started = performance.now();
	redactText(input, isSensitiveKey, Number.POSITIVE_INFINITY);
	expect(performance.now() - started).toBeLessThan(1000);
});
