import { vi } from "vitest";

export function until<A>(read: () => Promise<A | undefined>, timeoutMilliseconds = 15_000): Promise<A> {
	return vi.waitFor(
		async () => {
			const value = await read();
			if (value === undefined) {
				throw new Error("Timed out waiting for pg-boss");
			}
			return value;
		},
		{ interval: 50, timeout: timeoutMilliseconds },
	);
}
