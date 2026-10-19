import { expect } from "vitest";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { StatusChip } from "./StatusChip.tsx";

for (const [status, token, icon, label] of [
	["planned", "deferred", "circle", "Planned"],
	["active", "agent-working", "loader-circle", "Active"],
	["received", "deferred", "inbox", "Received"],
	["needs-human", "needs-you", "message-circle", "Needs you"],
	["running", "agent-working", "loader-circle", "Running"],
	["in-progress", "agent-working", "loader-circle", "In progress"],
	["needs-you", "needs-you", "message-circle", "Needs you"],
	["agent-working", "agent-working", "loader-circle", "Agent working"],
	["waiting-on-agents", "waiting-on-agents", "users", "Waiting on agents"],
	["blocked", "blocked", "ban", "Blocked"],
	["done", "done", "check", "Done"],
	["finished", "done", "check", "Finished"],
	["in-review", "agent-working", "loader-circle", "In review"],
	["deferred", "deferred", "circle-pause", "Deferred"],
	["superseded", "deferred", "clock", "Superseded"],
	["unexpected", "deferred", "circle-help", "Unexpected"],
	["ready_for-review", "deferred", "circle-help", "Ready for review"],
]) {
	screenStory.it(
		`renders ${status} with its semantic token, icon and plain words`,
		[componentScreen(<StatusChip status={status} />)],
		({ findElement, readAttribute }) => {
			const chip = findElement("[data-status-token]");
			expect(chip?.getAttribute("data-status-token")).toBe(token);
			expect(chip?.classList.contains(token === "needs-you" ? "text-primary-foreground" : `[--tone:var(--color-${token})]`)).toBe(true);
			expect(chip?.textContent).toBe(label);
			expect(readAttribute(`svg.lucide-${icon}`, "aria-hidden", chip)).toBe("true");
		},
	);
}

screenStory.it(
	"renders needs-you as the one solid amber chip and every other state as a quiet tint mixed over the card, all at 12px",
	[
		componentScreen(
			["needs-you", "agent-working", "waiting-on-agents", "blocked", "done", "deferred"].map((status) => <StatusChip key={status} status={status} />),
		),
	],
	({ findElements }) => {
		const chips = findElements("[data-status-token]");
		expect(chips.map((chip) => [chip.getAttribute("data-status-token"), chip.getAttribute("data-variant")])).toEqual([
			["needs-you", "default"],
			["agent-working", "outline"],
			["waiting-on-agents", "outline"],
			["blocked", "outline"],
			["done", "outline"],
			["deferred", "outline"],
		]);
		expect(chips.filter((chip) => chip.classList.contains("bg-primary")).map((chip) => chip.getAttribute("data-status-token"))).toEqual([
			"needs-you",
		]);
		expect(
			chips
				.filter((chip) => chip.classList.contains("bg-[color-mix(in_oklab,var(--tone)_10%,var(--color-card))]"))
				.map((chip) => chip.getAttribute("data-status-token")),
		).toEqual(["agent-working", "waiting-on-agents", "blocked", "done", "deferred"]);
		expect(chips.every((chip) => chip.classList.contains("text-xs") && !chip.classList.contains("text-[0.625rem]"))).toBe(true);
	},
);

for (const status of [undefined, ""]) {
	screenStory.it(`omits absent status chips (${status})`, [componentScreen(<StatusChip status={status} />)], ({ readText, findElement }) => {
		expect(readText()).toBe("");
		expect(findElement("[data-status-token]")).toBeNull();
	});
}
