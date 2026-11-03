import { expect } from "@effect/vitest";
import { prWatchBudget } from "#test/prWatchBudget.ts";

const FIRST = "repos/example/first/pulls?state=open&per_page=100";
const SECOND = "repos/example/second/pulls?state=open&per_page=100";
const FLEET = "repos/example/project/pulls/7";
const SEARCH = "search/issues?q=repo:example/project";

prWatchBudget.it("repository watchers share Fleet's reserve while Fleet calls on another resource continue", [], function* (story) {
	const github = yield* story.connect(4);
	github.reply(FLEET, { number: 7 });
	github.reply(FIRST, []);
	github.reply(SECOND, []);
	github.reply(
		SEARCH,
		{ items: [{ number: 8 }] },
		{
			headers: {
				"x-ratelimit-limit": "10",
				"x-ratelimit-remaining": "9",
				"x-ratelimit-resource": "search",
				"x-ratelimit-used": "1",
			},
		},
	);
	const fleet = yield* github.read(FLEET);
	expect(fleet).toEqual({ number: 7 });
	const first = yield* github.poll("example/first");
	expect(first).toBe("observed");
	const second = yield* github.poll("example/second");
	expect(second).toBe("observed");

	const paused = yield* github.poll("example/first");
	const other = yield* github.read(SEARCH);

	expect(paused).toEqual({
		message: "GitHub paused below the 20% reserve until 1970-01-01T00:10:00.000Z",
		retryAt: 600_000,
		retryable: true,
	});
	expect(other).toEqual({ items: [{ number: 8 }] });
	expect(github.requests()).toEqual([`200 ${FLEET}`, `200 ${FIRST}`, `200 ${SECOND}`, `200 ${SEARCH}`]);
});

prWatchBudget.it("PR discovery stops pagination when its first page reaches Fleet's reserve", [], function* (story) {
	const github = yield* story.connect(2);
	const next = `${FIRST}&page=2`;
	github.reply(FIRST, [], { headers: { link: `</${next}>; rel="next"` } });
	github.reply(next, []);

	const paused = yield* github.poll("example/first");

	expect(paused).toEqual({
		message: "GitHub paused below the 20% reserve until 1970-01-01T00:10:00.000Z",
		retryAt: 600_000,
		retryable: true,
	});
	expect(github.requests()).toEqual([`200 ${FIRST}`]);
});
