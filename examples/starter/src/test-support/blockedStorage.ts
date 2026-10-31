import { Effect } from "effect";
import { vi } from "vitest";
import { screens } from "./screens.ts";

export function blockedStorage(operation: "access" | "read" | "write") {
	return screens.trait("storage", `browser storage throws on ${operation}`, function* () {
		yield* Effect.acquireRelease(
			Effect.sync(() => {
				const classes = document.documentElement.className;
				const saved = localStorage.getItem("theme");
				localStorage.removeItem("theme");
				function blocked(): never {
					throw new DOMException("Storage blocked", "SecurityError");
				}
				const spy =
					operation === "access"
						? vi.spyOn(globalThis, "localStorage", "get").mockImplementation(blocked)
						: vi.spyOn(localStorage, operation === "read" ? "getItem" : "setItem").mockImplementation(blocked);
				return { classes, saved, spy };
			}),
			({ classes, saved, spy }) =>
				Effect.sync(() => {
					spy.mockRestore();
					document.documentElement.className = classes;
					if (saved === null) {
						localStorage.removeItem("theme");
					} else {
						localStorage.setItem("theme", saved);
					}
				}),
		);
	});
}
