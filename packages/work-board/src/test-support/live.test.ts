import { expect, it } from "vitest";
import { waitFor } from "./live.ts";

it("awaits asynchronous checks and retries their rejected assertions", async () => {
	let attempts = 0;
	await waitFor(async () => {
		await Promise.resolve();
		attempts += 1;
		expect(attempts).toBe(2);
	});
	expect(attempts).toBe(2);
});
