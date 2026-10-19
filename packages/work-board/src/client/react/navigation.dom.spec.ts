import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { followLink } from "#test/followLink.ts";
import { PLAN, waitFor } from "#test/live.ts";
import { frame, title } from "#test/pageObservation.ts";

describe("document navigation", () => {
	// Guards real window.history selection and details restoration.
	boardStory.it(
		"navigates without reloading and restores selection and open details through back and forward",
		[
			projectFiles({ "home.md": "# Home", "other.md": "# Other\n\nNext page.", "plan.md": PLAN.replace("# Plan", "# Plan\n\n## Reading") }),
			boardHome("home.md"),
			readerAt("/plan.md"),
		],
		function* ({ page }) {
			yield* Effect.promise(() => waitFor(() => expect(page.document.getElementById("favorite-toggle")?.hasAttribute("disabled")).toBe(false)));
			yield* Effect.promise(() => waitFor(() => expect(page.pageRequests.answered).toBeGreaterThanOrEqual(1)));
			page.window.document.body.dataset.visit = "kept";
			const details = page.document.querySelector("article details");
			details?.setAttribute("open", "");
			const text = page.document.querySelector("article p")?.firstChild;
			if (text === undefined || text === null) {
				throw new Error("Missing text");
			}
			page.window.getSelection()?.setBaseAndExtent(text, 0, text, 5);
			followLink(page, "/other.md");
			yield* Effect.promise(() => frame(page));
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Other")));
			expect(page.document.body.dataset.visit).toBe("kept");
			expect(page.window.location.pathname).toBe("/other.md");
			page.window.history.back();
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Plan")));
			yield* Effect.promise(() => waitFor(() => expect(page.document.querySelector("article details")?.hasAttribute("open")).toBe(true)));
			expect(page.window.getSelection()?.toString()).toBe("Intro");
			page.window.history.forward();
			yield* Effect.promise(() => waitFor(() => expect(title(page)).toBe("Other")));
		},
	);
});
