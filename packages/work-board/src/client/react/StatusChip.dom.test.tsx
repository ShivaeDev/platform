import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { StatusChip } from "./StatusChip.tsx";

for (const [status, token, icon] of [
	["planned", "deferred", "circle"],
	["active", "agent-working", "loader-circle"],
	["received", "deferred", "inbox"],
	["needs-human", "needs-you", "message-circle"],
	["running", "agent-working", "loader-circle"],
	["in-progress", "agent-working", "loader-circle"],
	["needs-you", "needs-you", "message-circle"],
	["agent-working", "agent-working", "loader-circle"],
	["waiting-on-agents", "waiting-on-agents", "users"],
	["blocked", "blocked", "ban"],
	["done", "done", "check"],
	["deferred", "deferred", "circle-pause"],
	["superseded", "deferred", "clock"],
	["unexpected", "deferred", "circle-help"],
]) {
	screenStory.it(
		`renders ${status} with its semantic token, icon and source word`,
		[componentScreen(<StatusChip status={status} />)],
		({ findElement, readAttribute }) => {
			const chip = findElement("[data-status-token]");
			expect(chip?.getAttribute("data-status-token")).toBe(token);
			expect(chip?.classList.contains(`text-${token}`)).toBe(true);
			expect(chip?.textContent).toBe(status);
			expect(readAttribute(`svg.lucide-${icon}`, "aria-hidden", chip)).toBe("true");
		},
	);
}

for (const status of [undefined, ""]) {
	screenStory.it(`omits absent status chips (${status})`, [componentScreen(<StatusChip status={status} />)], ({ readText, findElement }) => {
		expect(readText()).toBe("");
		expect(findElement("[data-status-token]")).toBeNull();
	});
}
