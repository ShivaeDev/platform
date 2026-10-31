import { todayFleetFixture } from "./todayFleetFixture.ts";

export function progressWaits() {
	const data = todayFleetFixture();
	if (data.state !== "ready" || !data.items[0]) {
		throw new Error("Missing Fleet work");
	}
	const item = data.items[0];
	const owners = ["automation", "maintainer", "orchestrator"] as const;
	return {
		...data,
		items: [
			item,
			...owners.map((attentionOwner) => ({ ...item, attentionOwner, stage: "waiting" as const, workId: attentionOwner })),
			{ ...item, prUrl: undefined, stage: "waiting" as const, workId: "no-change" },
		],
	};
}
