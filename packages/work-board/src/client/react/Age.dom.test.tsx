import { Clock, Effect } from "effect";
import { act } from "react";
import { expect, it, vi } from "vitest";
import { expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { Age, AgeTicker } from "./Age.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
it("ticks mounted ages and updates a refreshed timestamp without replacing its span", async () => {
	vi.useFakeTimers();
	const modified = Effect.runSync(Clock.currentTimeMillis);
	const view = await render(
		<AgeTicker>
			<Age modified={modified} short />
		</AgeTicker>,
	);
	try {
		const span = view.container.querySelector("span");
		expect(span?.textContent).toBe("0s");
		await act(async () => vi.advanceTimersByTimeAsync(5000));
		expect(span?.textContent).toBe("5s");
		await view.render(
			<AgeTicker>
				<Age modified={modified - 60_000} short />
			</AgeTicker>,
		);
		expect(view.container.querySelector("span")).toBe(span);
		expect(span?.textContent).toBe("1m");
	} finally {
		await view.unmount();
		vi.useRealTimers();
	}
});
