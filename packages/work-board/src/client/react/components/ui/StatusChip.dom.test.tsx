import { expect, it } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { StatusChip } from "./StatusChip.tsx";

it.each([
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
	[undefined, "deferred", "circle-help"],
	["", "deferred", "circle-help"],
])("renders %s with its semantic token, icon and source word", async (status, token, icon) => {
	const view = await render(<StatusChip status={status} />);
	try {
		const chip = view.container.querySelector("[data-status-token]");
		expect(chip?.getAttribute("data-status-token")).toBe(token);
		expect(chip?.classList.contains(`text-${token}`)).toBe(true);
		expect(chip?.textContent).toBe(status || "Not recorded");
		expect(chip?.querySelector(`svg.lucide-${icon}`)?.getAttribute("aria-hidden")).toBe("true");
	} finally {
		await view.unmount();
	}
});
