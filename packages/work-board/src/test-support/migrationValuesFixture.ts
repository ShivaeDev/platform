export const unmappedValues = [
	["kind", "initiative"],
	["status", "stuck"],
	["fleet", "allowed"],
	["owner", "robot"],
	["delivers", "document"],
	["scope", "global"],
	["urgency", "soon"],
	["relationships", [{ kind: "blocks", target: "released" }]],
] as const;
export const unmappedCases = unmappedValues.flatMap(([field, value]) =>
	(["status", "scope", "urgency"].includes(field) ? ["question", "decision"] : ["question"]).map((kind) => ({ field, kind, value })),
);

export const releasedApprovalFixture = {
	"released.md": "---\nid: released\nkind: task\nstatus: ready\nfleet: released\n---\n# Released work\n",
};
export function unmappedBoard(field: string, value: unknown, kind = "question") {
	return {
		"a-released.md": releasedApprovalFixture["released.md"].replace("status: ready", "status: planned"),
		"z-unknown.md": `---\n${JSON.stringify({ id: "unknown", kind, scope: "task", urgency: "whenever", [field]: value })}\n---\n# Unknown vocabulary\n`,
	};
}

const aliases = ["Marvin", "marvin", "MARVIN", "Claude", "cLaUdE", "ORCHESTRATOR", "Claude-Cloud", "CLAUDE-LOCAL", "CLOUD-WORKER", "Codex"];
export const ownerAliasFixture = Object.fromEntries(
	aliases.map((owner, index) => [`${index}.md`, `---\nid: owner.${index}\nkind: task\nowner: ${owner}\n---\n# Owner ${index}\n`]),
);
