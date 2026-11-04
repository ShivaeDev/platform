import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { discord } from "#test/story.ts";

discord.it("heartbeats carry the last dispatch sequence", [], function* ({ connect, dispatch, heartbeatIntervalPasses, nextEvent }) {
	yield* connect();
	yield* dispatch("MESSAGE_CREATE", { content: "latest" });
	yield* nextEvent();

	const heartbeat = yield* heartbeatIntervalPasses();

	expect(heartbeat).toEqual({ d: 2, op: 1 });
});

discord.it(
	"a missing heartbeat acknowledgement reconnects and resumes",
	[],
	function* ({ connect, heartbeatDeadlinePasses, heartbeatIntervalPasses, reconnectIntervalPasses, stopAcknowledging }) {
		yield* connect();
		yield* stopAcknowledging();
		yield* heartbeatIntervalPasses();

		yield* heartbeatDeadlinePasses();
		const event = yield* reconnectIntervalPasses();

		expect(event.type).toBe("RESUMED");
	},
);

discord.it("malformed gateway frames fail through the typed protocol error", [], function* ({ connect, malformedFrame, protocolFailure }) {
	yield* connect();

	yield* malformedFrame();

	expect(yield* protocolFailure()).toBe("invalid gateway frame");
});

discord.it("a server reconnect request resumes the session", [], function* ({ connect, reconnectIntervalPasses, requestReconnect }) {
	yield* connect();

	yield* requestReconnect();
	const event = yield* reconnectIntervalPasses();

	expect(event.type).toBe("RESUMED");
});

discord.it("the gateway identifies with the configured bot and delivers READY", [], function* ({ connect, outboundFrames }) {
	const ready = yield* connect();

	expect(ready.type).toBe("READY");
	expect(yield* outboundFrames()).toEqual([
		{ d: { intents: 513, properties: { browser: "platform", device: "platform", os: "linux" }, token: "story-discord-token" }, op: 2 },
	]);
});

discord.it(
	"a dropped socket resumes from the last dispatch and delivers missed events",
	[],
	function* ({ connect, dispatch, dropSocket, nextEvent, outboundFrames, reconnectIntervalPasses, socketDestinations }) {
		yield* connect();
		yield* dispatch("MESSAGE_CREATE", { content: "before" });
		expect((yield* nextEvent()).data).toEqual({ content: "before" });

		yield* dropSocket();
		yield* dispatch("MESSAGE_CREATE", { content: "while disconnected" });
		const replay = yield* reconnectIntervalPasses();

		expect(replay).toEqual({ data: { content: "while disconnected" }, sequence: 3, type: "MESSAGE_CREATE" });
		yield* outcomes([
			["resumed dispatch", () => nextEvent(), { type: "RESUMED" }],
			["resume frame", () => outboundFrames(), [{ op: 2 }, { d: { seq: 2, "session_id": "session-1", token: "story-discord-token" }, op: 6 }]],
			[
				"socket destinations",
				() => socketDestinations(),
				["wss://gateway.discord.test/?v=10&encoding=json", "wss://resume.discord.test/?v=10&encoding=json"],
			],
		]);
	},
);

discord.it(
	"an invalid session identifies again instead of resuming",
	[],
	function* ({ connect, invalidateSession, outboundFrames, reconnectIntervalPasses }) {
		yield* connect();

		yield* invalidateSession();
		const event = yield* reconnectIntervalPasses();

		expect(event.type).toBe("READY");
		expect((yield* outboundFrames()).map(({ op }) => op)).toEqual([2, 2]);
	},
);

for (const code of [4004, 4010, 4011, 4012, 4013, 4014]) {
	discord.it(`fatal gateway close ${code} fails with its typed close code`, [], function* ({ connect, dropSocket, gatewayFailure }) {
		yield* connect();

		yield* dropSocket(code);

		expect(yield* gatewayFailure()).toBe(code);
	});
}

for (const code of [4007, 4009]) {
	discord.it(`gateway close ${code} starts a fresh session`, [], function* ({ connect, dropSocket, outboundFrames, reconnectIntervalPasses }) {
		yield* connect();

		yield* dropSocket(code);
		const event = yield* reconnectIntervalPasses();

		expect(event.type).toBe("READY");
		expect((yield* outboundFrames()).map(({ op }) => op)).toEqual([2, 2]);
	});
}

discord.it(
	"a resumable invalid session retains its session id",
	[],
	function* ({ connect, invalidateSession, outboundFrames, reconnectIntervalPasses }) {
		yield* connect();

		yield* invalidateSession(true);
		const event = yield* reconnectIntervalPasses();

		expect(event.type).toBe("RESUMED");
		expect((yield* outboundFrames()).at(-1)).toEqual({ d: { seq: 1, "session_id": "session-1", token: "story-discord-token" }, op: 6 });
	},
);

discord.it("interrupting the gateway closes its socket", [], function* ({ closedSockets, connect, stop }) {
	yield* connect();
	expect(yield* closedSockets()).toBe("open");

	yield* stop();

	expect(yield* closedSockets()).toBe("closed");
});
