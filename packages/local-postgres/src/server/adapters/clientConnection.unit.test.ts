import { Result } from "effect";
import { expect, it } from "vitest";
import { clientConnection } from "./clientConnection.ts";

for (const password of ["bad%", "bad%GG", "bad%C3%28"]) {
	it(`refuses malformed password escape ${password}`, () => {
		const url = new URL(`postgresql://postgres:${password}@127.0.0.1:55432/postgres`);
		const failure = Result.getOrThrow(Result.flip(clientConnection(url)));
		expect(failure.message).toBe("Invalid local database password escape.");
	});
}
