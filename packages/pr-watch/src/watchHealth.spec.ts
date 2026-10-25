import { Clock } from "effect";
import { expect } from "vitest";
import { historyIs, queuedPulls } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("quota pacing explains a half-hour polling gap while heartbeats continue", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	yield* h.quotaRemaining(9);
	yield* h.cliStart("--heartbeat", "1");
	yield* h.cliWaitFor("heartbeat");
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	const once = yield* h.cliRun("1", "--once");
	expect(once.code).toBe(0);
	const onceEvents = once.stdout
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line))
		.filter((line) => line.number !== undefined)
		.map((line) => line.event);
	expect(onceEvents).toEqual(["dequeued", "auto-merge-off"]);
	const requests = [...h.requests];
	yield* h.cliWaitFor("heartbeat", 2);
	yield* h.cliStop();
	yield* h.cliFinish();
	const cooldown = h.cliLines().find((line) => line.event === "cooldown");
	const halfHour = 30 * 60 * 1000;
	expect(cooldown).toMatchObject({ delayMs: expect.any(Number), nextPollAt: expect.any(String) });
	expect(cooldown.delayMs).toBeGreaterThanOrEqual(halfHour);
	expect(h.cliLines().filter((line) => line.number !== undefined)).toEqual([]);
	expect(h.requests).toEqual(requests);
	expect((yield* h.stored()).prs["1"].queued).toBe(false);
	const heartbeats = h.cliLines().filter((line) => line.event === "heartbeat");
	const minimumHeartbeats = 2;
	expect(heartbeats.length).toBeGreaterThanOrEqual(minimumHeartbeats);
	expect(new Set(heartbeats.map((line) => line.nextPollAt))).toEqual(new Set([cooldown.nextPollAt]));
	expect(h.cliLines().at(-1)).toMatchObject({ event: "stopped", reason: "interrupted" });
});

watch.it("a filtered continuous CLI exits on a request error with JSON health lines", [], function* (h) {
	h.reply("/pulls/1", { body: {}, status: 500 });
	yield* h.cliStart("--events", "dequeued", "--heartbeat", "0");
	const code = yield* h.cliFinish();
	expect(code).toBe(1);
	expect(h.cliLines().map((line) => line.event)).toEqual(["error", "stopped"]);
	expect(h.cliLines()[0]).toMatchObject({ at: expect.any(String), message: "GitHub request failed" });
	expect(h.cliStderr()).toContain("GitHub request failed");
});

watch.it("a filtered rate-limited CLI reports the retry instant and exits without plain stdout logs", [], function* (h) {
	h.throttled(900);
	const now = yield* Clock.currentTimeMillis;
	yield* h.cliStart("--events", "merged", "--heartbeat", "0");
	const code = yield* h.cliFinish();
	expect(code).toBe(1);
	expect(h.cliLines().map((line) => line.event)).toEqual(["error", "cooldown", "stopped"]);
	const retryAt = Date.parse(h.cliLines()[1].nextPollAt);
	const minimumCooldown = 890_000;
	expect(retryAt - now).toBeGreaterThan(minimumCooldown);
});

watch.it("invalid startup state prints an error and stop even with a transition filter", [historyIs("broken")], function* (h) {
	const result = yield* h.cliRun("--fleet", "--events", "dequeued");
	expect(result.code).toBe(1);
	expect(
		result.stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line).event),
	).toEqual(["error", "stopped"]);
	expect(h.requests).toEqual([]);
});
