import { Effect } from "effect";
import { act } from "react";
import { vi } from "vitest";
import { ThemeToggle } from "#client/ThemeToggle.tsx";
import { acquireScreen, type ScreenSurface, screenView } from "#test-support/screenState.ts";

export function themeScreenVerbs(engine: ScreenSurface, tell: (line: string) => void) {
	let systemDark = false;
	const queries = new Set<MediaQueryList>();
	function prepare() {
		return Effect.gen(function* () {
			const original = globalThis.matchMedia;
			yield* Effect.acquireRelease(
				Effect.sync(() => {
					const classes = document.documentElement.className;
					const saved = localStorage.getItem("theme");
					localStorage.removeItem("theme");
					const spy = vi.spyOn(globalThis, "matchMedia").mockImplementation((query) => {
						const media = original(query);
						Object.defineProperty(media, "matches", { get: () => systemDark });
						queries.add(media);
						return media;
					});
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
	return {
		chooseTheme: (theme: string) =>
			Effect.promise(async () => {
				tell(`choose ${theme}`);
				const select = screenView(engine).container.querySelector("select");
				if (select === null) {
					throw new Error("Missing theme selector");
				}
				await act(() => {
					select.value = theme;
					select.dispatchEvent(new Event("change", { bubbles: true }));
				});
			}),
		closeThemeControl: () => Effect.promise(() => screenView(engine).render(null)),
		openThemeControl: () =>
			Effect.gen(function* () {
				tell("open the theme control");
				if (engine.view === undefined) {
					yield* prepare();
					yield* acquireScreen(engine);
				}
				const view = screenView(engine);
				yield* Effect.promise(() => view.render(<ThemeToggle />));
			}),
		savedTheme: () => localStorage.getItem("theme"),
		systemTheme: (dark: boolean) =>
			Effect.promise(async () => {
				tell(`the system changes to ${dark ? "dark" : "light"}`);
				await act(() => {
					systemDark = dark;
					for (const media of [...queries]) {
						media.dispatchEvent(new Event("change"));
					}
				});
			}),
		themeAppearance: () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
		themeSelection: () => screenView(engine).container.querySelector("select")?.value,
	};
}
