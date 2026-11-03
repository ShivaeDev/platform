import * as fs from "node:fs/promises";
import { afterEach, vi } from "vitest";

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return { ...actual, open: vi.fn(actual.open) };
});
afterEach(() => vi.restoreAllMocks());

export function duringTemporaryWrite(change: () => void) {
	vi.mocked(fs.open).mockImplementation(async (...args) => {
		const actual = await vi.importActual<typeof fs>("node:fs/promises");
		const file = await actual.open(...args);
		if (String(args[0]).endsWith(".tmp")) {
			const write = file.writeFile.bind(file);
			vi.spyOn(file, "writeFile").mockImplementation(async (...input) => {
				await write(...input);
				change();
			});
		}
		return file;
	});
}

export function pausedTemporaryWrite() {
	const started = Promise.withResolvers<void>();
	vi.mocked(fs.open).mockImplementation(async (...args) => {
		const actual = await vi.importActual<typeof fs>("node:fs/promises");
		const file = await actual.open(...args);
		if (String(args[0]).endsWith(".tmp")) {
			const write = file.writeFile.bind(file);
			vi.spyOn(file, "writeFile").mockImplementation(async (content, options) => {
				await write(typeof content === "string" ? content.slice(0, 5) : content, options);
				const signal = options && typeof options === "object" ? options.signal : undefined;
				if (!signal) {
					throw new Error("The native write has no cancellation signal");
				}
				started.resolve();
				await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
				signal.throwIfAborted();
			});
		}
		return file;
	});
	return started.promise;
}
