import { Clock, Effect } from "effect";
import { act } from "react";
import { beforeEach, expect, vi } from "vitest";

export function expectNoReactWarnings() {
	beforeEach(({ onTestFinished }) => {
		const errors = vi.spyOn(console, "error");
		onTestFinished(() => {
			const calls = errors.mock.calls;
			errors.mockRestore();
			expect(calls).toEqual([]);
		});
	});
}

export async function eventually(assert: () => void) {
	const deadline = Effect.runSync(Clock.currentTimeMillis) + 3000;
	while (true) {
		// Network responses must settle inside act, including the time between assertions.
		await act(async () => {
			await new Promise<void>((resolve) => setTimeout(resolve, 10));
		});
		try {
			assert();
			return;
		} catch (error) {
			if (Effect.runSync(Clock.currentTimeMillis) >= deadline) {
				throw error;
			}
		}
	}
}
