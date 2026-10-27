import { expect } from "vitest";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { adminScreens, emptyJobsScreen } from "#modules/notes/test-support/admin/screens.tsx";

adminScreens.it("shows an empty state and health with no registered queues", [emptyJobsScreen], function* ({ screenContent }) {
	const content = yield* screenContent();
	yield* eventually(() => expect(content.querySelector('[aria-label="Jobs health"]')?.textContent).toContain("Failed0"));
	expect(content.textContent).toContain("No queues or schedules registered.");
	expect(content.querySelector("select")).toBeNull();
	expect(content.querySelector('[aria-label="Queue counts"]')).toBeNull();
	expect(content.querySelector('[role="tablist"]')).toBeNull();
});
