import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { codexRateLimits } from "./codexRateLimits.ts";

function synthetic(mode: string, timeoutMs = 2000) {
	return codexRateLimits(
		() => spawn(process.execPath, [fileURLToPath(new URL("../test-support/codexAppServer.ts", import.meta.url)), mode], { stdio: "pipe" }),
		timeoutMs,
	);
}
it("uses the rate-limit method after initialization and account read, and denies provider approvals", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			expect(yield* synthetic("ready")).toEqual({ synthetic: "limits" });
		}),
	));
for (const mode of ["missing", "api-key"]) {
	it(`${mode} account is not configured for Codex usage windows`, () =>
		Effect.runPromise(
			Effect.gen(function* () {
				expect(yield* synthetic(mode).pipe(Effect.flip)).toMatchObject({ kind: "not-configured" });
			}),
		));
}
it("reports API-key usage windows as not available without requesting rate limits", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			expect(yield* synthetic("api-key").pipe(Effect.flip)).toMatchObject({
				kind: "not-configured",
				message: "Codex usage windows are not available for API-key accounts",
			});
		}),
	));
for (const [mode, message] of [
	["initialize-error", "Initialize refused"],
	["refusal", "Account forbidden"],
	["exit", "exited"],
	["malformed", "invalid"],
]) {
	it(`reports the cause of ${mode}`, () =>
		Effect.runPromise(
			Effect.gen(function* () {
				const error = yield* synthetic(mode ?? "").pipe(Effect.flip);
				expect(error.kind).toBe("error");
				expect(error.message).toContain(message);
			}),
		));
}
it("times out and interruption terminates the child", () =>
	Effect.runPromise(
		Effect.gen(function* () {
			expect(yield* synthetic("timeout", 50).pipe(Effect.flip)).toMatchObject({ kind: "error", message: "Codex rate limits timed out" });
			const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "pipe" });
			yield* codexRateLimits(() => child).pipe(Effect.timeout("50 millis"), Effect.ignore);
			expect(child.killed).toBe(true);
		}),
	));
