import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { onPostgres } from "#test/engines.ts";
import { orderedDaysEngine } from "#test/orderedDaysEngine.ts";
import { orderedDaysRace } from "#test/orderedDaysRace.ts";
import { attempt } from "#test/outcome.ts";

export const orderedDays = storyKit({
	...onPostgres,
	create: orderedDaysEngine,
	name: "ordered days under a plan",
	stages: ["rows"],
	verbs: (engine, story) => ({
		...orderedDaysRace(engine, story.tell),
		append: (plan: number, id: number) => {
			story.tell(`append day ${id} to plan ${plan}`);
			return attempt(engine.order.append(plan, { id, name: `Day ${id}` }));
		},
		move: (plan: number, id: number, position: number) => {
			story.tell(`move day ${id} in plan ${plan} to position ${position}`);
			return attempt(
				engine.order.move(plan, id, position).pipe(Effect.catchTag("ChildOrderError", ({ reason }) => Effect.succeed(`refused ${reason}`))),
			);
		},
		readDays: (plan = 1) =>
			engine.days.findMany({ orderBy: { direction: "asc", field: "position" }, select: ["id", "position", "version", "name"], where: { plan } }),
		renameDay: () => {
			story.tell("an open edit sheet renames day one using its original version");
			return engine.days.update({ id: 1, name: "Edited day", version: 0 }, { columns: ["name"] });
		},
		reorder: (ids: readonly number[]) => {
			story.tell(`reorder plan one's days to ${ids.join(", ")}`);
			return attempt(engine.order.reorder(1, ids).pipe(Effect.catchTag("ChildOrderError", ({ reason }) => Effect.succeed(`refused ${reason}`))));
		},
	}),
});

export function daysStored() {
	return orderedDays.trait("rows", "plan one holds three days, and plan two holds day four, all at version zero with text-stored IDs", (engine) =>
		Effect.gen(function* () {
			for (const id of [1, 2, 3, 4]) {
				yield* engine.days.insertVoid({ id, name: `Day ${id}`, plan: id === 4 ? 2 : 1, position: id === 4 ? 0 : id - 1 });
			}
		}),
	);
}
