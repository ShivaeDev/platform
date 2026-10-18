import { Clock, Effect } from "effect";
import { act } from "react";
import { expect, vi } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { Age, AgeTicker } from "./Age.tsx";

expectNoReactWarnings();
screenStory.it("ticks mounted ages and updates a refreshed timestamp without replacing its span", [], function* ({ render }) {
	vi.useFakeTimers();
	const modified = Effect.runSync(Clock.currentTimeMillis);
	const view = yield* Effect.promise(() =>
		render(
			<AgeTicker>
				<Age modified={modified} short />
			</AgeTicker>,
		),
	);
	try {
		const span = view.container.querySelector("span");
		expect(span?.textContent).toBe("0s");
		yield* Effect.promise(() => act(async () => vi.advanceTimersByTimeAsync(5000)));
		expect(span?.textContent).toBe("5s");
		yield* Effect.promise(() =>
			view.render(
				<AgeTicker>
					<Age modified={modified - 60_000} short />
				</AgeTicker>,
			),
		);
		expect(view.container.querySelector("span")).toBe(span);
		expect(span?.textContent).toBe("1m");
	} finally {
		yield* Effect.promise(() => view.unmount());
		vi.useRealTimers();
	}
});
