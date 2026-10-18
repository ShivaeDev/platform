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
		({ screen }) => {
			const view = screen();

			const chip = view.container.querySelector("[data-status-token]");
			expect(chip?.getAttribute("data-status-token")).toBe(token);
			expect(chip?.classList.contains(`text-${token}`)).toBe(true);
			expect(chip?.textContent).toBe(status);
			expect(chip?.querySelector(`svg.lucide-${icon}`)?.getAttribute("aria-hidden")).toBe("true");
		},
	);
}

for (const status of [undefined, ""]) {
	screenStory.it(`omits absent status chips (${status})`, [componentScreen(<StatusChip status={status} />)], ({ screen }) => {
		const view = screen();

		expect(view.container.textContent).toBe("");
		expect(view.container.querySelector("[data-status-token]")).toBeNull();
	});
}
