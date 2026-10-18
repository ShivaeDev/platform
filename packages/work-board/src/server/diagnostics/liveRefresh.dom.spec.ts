import { Effect } from "effect";
import { expect } from "vitest";
import { fleetHealth } from "#server/diagnostics/fleetHealth.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { health, syntheticSources } from "#test/diagnostics.ts";
import { waitFor } from "#test/live.ts";
import { controlledDiagnosticsPolling, diagnosticsSources } from "#test/readingTraits.ts";

boardStory.it(
	"navigates to System, pauses and resumes polling, and stops polling after navigation",
	[
		projectFiles({ "fleet/health.json": JSON.stringify(health), "home.md": "# Home" }),
		boardHome("home.md"),
		diagnosticsSources((root) => syntheticSources({ fleet: fleetHealth(root) })),
		controlledDiagnosticsPolling(),
	],
	function* ({ page, reader, editFile, pollDiagnostics, activeDiagnosticsPolls }) {
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("live")?.textContent).toBe("live")));
		reader.clickSelector("#diagnostics-open");
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("3 / 8")));
		expect(page.window.location.pathname).toBe("/_board/system");
		expect(page.document.querySelector("#primary-navigation #diagnostics-open")).not.toBeNull();
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("time[data-reset]")?.textContent).toContain(", 14:20")));
		expect(page.document.getElementById("diagnostics-open")?.getAttribute("aria-current")).toBe("page");
		reader.clickSelector("#settings-open");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("updates-toggle")?.getAttribute("aria-pressed")).toBe("false")));
		reader.clickSelector("#updates-toggle");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("updates-toggle")?.getAttribute("aria-pressed")).toBe("true")));
		editFile("fleet/health.json", JSON.stringify({ ...health, running: 7 }));
		pollDiagnostics();
		expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("3 / 8");
		reader.clickSelector("#updates-toggle");
		yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("updates-toggle")?.getAttribute("aria-pressed")).toBe("false")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("7 / 8")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("time[data-reset]")?.textContent).toContain(", 14:20")));
		editFile("fleet/health.json", JSON.stringify({ ...health, running: 6 }));
		pollDiagnostics();
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("6 / 8")));
		expect(activeDiagnosticsPolls()).toBeGreaterThan(0);
		yield* reader.follow("/home.md");
		yield* Effect.promise(() => waitFor(() => expect(page.window.location.pathname).toBe("/home.md")));
		yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector(".diagnostics")).toBeNull()));
		expect(activeDiagnosticsPolls()).toBe(0);
		pollDiagnostics();
		expect(page.document.querySelector(".diagnostics")).toBeNull();
	},
);
