import { inboxFixture } from "./inboxFixture.ts";

export function searchRankingFixture() {
	function task(status: string, title: string, body = "") {
		return `---\nkind: task\nstatus: ${status}\n---\n# ${title}\n\n${body}\n`;
	}
	return {
		files: {
			"active.md": task("active", "Active watch"),
			"deferred.md": task("deferred", "Deferred watch"),
			"done-body.md": task("done", "Finished", "The watch is complete."),
			"done.md": task("done", "Done watch"),
			"held.md": task("fleet-held", "Held watch"),
			"needs-you.md": task("needs-you", "Watch needs you"),
			"open-body.md": task("planned", "Keep reviews visible", "The watch keeps running."),
			"planned.md": task("planned", "A running watch sees reviews finish"),
			"superseded.md": task("superseded", "Superseded watch"),
		},
		modified: new Map([
			["active.md", 2000],
			["deferred.md", 8000],
			["done-body.md", 10_000],
			["done.md", 9000],
			["held.md", 1000],
			["needs-you.md", 3000],
			["open-body.md", 6000],
			["planned.md", 4000],
			["superseded.md", 7000],
		]),
	};
}

export function identityRankingFixture(titleStatus: string, passageStatus: string) {
	return {
		files: {
			"passage.md": `---\nid: task.notes\nkind: task\nstatus: ${passageStatus}\n---\n# Captured notes\n\nThe inbox and task.inbox need another look.\n`,
			"task.md": `---\nid: task.inbox\nkind: task\nstatus: ${titleStatus}\n---\n# Inbox triage\n`,
		},
		modified: new Map([
			["passage.md", 10_000],
			["task.md", 1000],
		]),
	};
}

export function fleetRankingFixture() {
	const report = `# Watch report\n\n${Array.from({ length: 18 }, (_, index) => `## Watch ${index}\n\nWatch progress.\n\nWatch details.`).join("\n\n")}`;
	return {
		files: {
			"done.md": "---\nid: task.watch-done\nkind: task\nstatus: done\n---\n# Done watch\n",
			"fleet/status.md": report,
			"notes.md": "# Notes\n\n## Watch notes\n\nWatch details.\n\nWatch updates.\n",
			"open.md": "---\nid: task.review\nkind: task\nstatus: active\n---\n# Keep reviews visible\n\nThe watch keeps running.\n",
			"responses/fleet-report.2026-10-15.md": "# Archived watch report\n\nWatch context.\n",
			"responses/fleet-report.md": report,
		},
		modified: new Map([
			["open.md", 1000],
			["done.md", 2000],
			["notes.md", 3000],
			["fleet/status.md", 4000],
			["responses/fleet-report.md", 5000],
			["responses/fleet-report.2026-10-15.md", 6000],
		]),
	};
}
export function fleetItemRankingFixture() {
	const { files, modified } = fleetRankingFixture();
	const decision = (inboxFixture()["responses/decision.md"] ?? "").replace("kind: decision", "kind: decision\nstatus: active");
	return {
		files: {
			...files,
			"decision-body.md":
				decision.replace("decision.delivery", "decision.policy").replace("Fleet delivery decision", "Review policy")
				+ "\nThe watch needs a policy.\n",
			"decision-title.md": decision.replace("decision.delivery", "decision.watch").replace("Fleet delivery decision", "Watch decision"),
		},
		modified: new Map([...modified, ["decision-title.md", 500], ["decision-body.md", 10_000]]),
	};
}
