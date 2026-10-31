import { task } from "#test/fleetHost.ts";
import { boardWork } from "#test/hostStory.ts";

function brief(id: string, area: string, fields = "") {
	return task(id, "approved").replace("kind: task", `kind: task\nareas: [${area}]${fields}`);
}

export const areaLanesProject = boardWork({
	"dependent.md": brief("dependent", "work-fleet", "\nrelationships:\n  - kind: depends_on\n    target: external"),
	"external.md": task("external").replace("kind: task", "kind: task\nstatus: draft"),
	"first.md": brief("first", "work-fleet"),
	"holder.md": brief("holder", "work-fleet"),
	"short.md": brief("short", "work-board"),
	"urgent.md": brief("urgent", "work-fleet/host", "\nfleet-priority: urgent"),
});
