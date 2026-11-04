import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bucketExhausted, continuouslyLimited, discord, rateLimited } from "#test/story.ts";

discord.it(
	"bot requests create and edit messages that subsequent history reads observe",
	[],
	function* ({ createMessage, editMessage, history, requests }) {
		const created = yield* createMessage("hello");

		yield* editMessage(created.id, "edited");

		yield* outcomes([
			["message history", () => history(), [{ channelId: "111", content: "edited", id: created.id }]],
			[
				"outbound requests",
				() => requests(),
				[
					{ authorization: "Bot story-discord-token", body: '{"content":"hello"}', method: "POST", path: "/channels/111/messages" },
					{ method: "PATCH", path: `/channels/111/messages/${created.id}` },
					{ method: "GET", path: "/channels/111/messages" },
				],
			],
		]);
	},
);

discord.it(
	"a Discord 429 waits for retry_after before delivering the message",
	[rateLimited],
	function* ({ history, rateLimitIntervalPasses, requests, startMessage, waitForRateLimit }) {
		yield* startMessage("after the limit");
		yield* waitForRateLimit();
		expect((yield* requests()).map(({ status }) => status)).toEqual([429]);

		const created = yield* rateLimitIntervalPasses();

		expect(created.content).toBe("after the limit");
		expect(yield* history()).toEqual([created]);
	},
);

discord.it(
	"an exhausted bucket delays the next request until reset-after",
	[bucketExhausted],
	function* ({ createMessage, rateLimitIntervalPasses, requests, startMessage, waitForRateLimit }) {
		yield* createMessage("earlier");
		yield* startMessage("after reset");
		yield* waitForRateLimit();
		expect((yield* requests()).map(({ body }) => body)).toEqual(['{"content":"earlier"}']);

		const created = yield* rateLimitIntervalPasses();

		expect(created.content).toBe("after reset");
	},
);

discord.it("a successful empty delete response removes the message from history", [], function* ({ createMessage, history, removeMessage }) {
	const created = yield* createMessage("remove me");
	expect(yield* history()).toEqual([created]);

	yield* removeMessage(created.id);

	expect(yield* history()).toEqual([]);
});

discord.it(
	"exhausting the retries returns a typed rate limit and paces another channel globally",
	[continuouslyLimited],
	function* ({ finalRetryIntervalPasses, rateLimitIntervalPasses, requests, retryIntervalPasses, startMessage, waitForRateLimit }) {
		yield* startMessage("limited");
		yield* waitForRateLimit();
		yield* retryIntervalPasses();
		yield* retryIntervalPasses();

		const failure = yield* finalRetryIntervalPasses();

		expect(failure).toEqual({ retryAfter: 2 });
		expect((yield* requests()).map(({ status }) => status)).toEqual([429, 429, 429, 429]);

		yield* startMessage("another channel", "222");
		yield* waitForRateLimit();
		expect((yield* requests()).map(({ path }) => path)).toEqual(new Array(4).fill("/channels/111/messages"));

		const created = yield* rateLimitIntervalPasses();

		expect(created).toMatchObject({ channelId: "222", content: "another channel" });
	},
);

discord.it("one channel's exhausted bucket leaves another channel available", [bucketExhausted], function* ({ createMessage }) {
	yield* createMessage("earlier");

	const created = yield* createMessage("another channel", "222");

	expect(created).toMatchObject({ channelId: "222", content: "another channel" });
});

discord.it("a missing message retains the typed HTTP not-found failure", [], function* ({ editMissingMessage }) {
	const result = yield* editMissingMessage();

	expect(result).toBe("message not found");
});
