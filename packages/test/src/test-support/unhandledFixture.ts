import { setImmediate } from "node:timers/promises";
import { it } from "vitest";

it("a body with an unhandled rejection", async () => {
	void Promise.reject(new Error("a rejection escaped the body"));
	await setImmediate();
});
