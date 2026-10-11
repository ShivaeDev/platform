import { expect, it } from "vitest";
import { readTaskResponse } from "#providers/readTaskResponse.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";

it("caps streamed downloads without Content-Length and cancels before EOF", async () => {
	let cancelled = false;
	let chunks = 0;
	const body = new ReadableStream<Uint8Array>({
		cancel: () => {
			cancelled = true;
		},
		pull: (controller) => {
			chunks += 1;
			controller.enqueue(new Uint8Array(1024 * 1024));
		},
	});
	await expect(readTaskResponse(new Response(body))).rejects.toMatchObject({ message: expect.stringContaining("Downloaded report task size limit") });
	expect(cancelled).toBe(true);
	expect(chunks).toBeLessThanOrEqual(REPORT_LIMITS.downloadBytes / (1024 * 1024) + 2);
});

it("rejects an oversized Content-Length before reading and cancels the body", async () => {
	let cancelled = false;
	const body = new ReadableStream<Uint8Array>({
		cancel: () => {
			cancelled = true;
		},
	});
	await expect(
		readTaskResponse(new Response(body, { headers: { "Content-Length": String(REPORT_LIMITS.downloadBytes + 1) } })),
	).rejects.toMatchObject({ message: expect.stringContaining("Downloaded report task size limit") });
	expect(cancelled).toBe(true);
});

it("reads a bounded task response", async () => {
	expect(await readTaskResponse(new Response('{"task":true}'))).toEqual({ task: true });
});
