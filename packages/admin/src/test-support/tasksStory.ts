import { Effect, Ref } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { answered } from "#test/answers.ts";
import { adminTasks } from "#test/Tasks.ts";
import { tasksEngine } from "#test/tasksEngine.ts";

export const tasksStory = storyKit({
	create: () => tasksEngine,
	name: "admin page served from its module",
	stages: ["tasks", "page"],
	verbs: (engine, story) => {
		let before: unknown;
		return {
			closes: (title: string) => {
				story.tell(`alice closes ${title} on the tasks page`);
				before = engine.registry.get(engine.list);
				return answered(engine.close(title).pipe(Effect.as("closed")));
			},
			opensElsewhere: (title: string) => {
				story.tell(`a task titled ${title} is opened outside the page, which publishes the tasks table's key`);
				before = engine.registry.get(engine.list);
				return Ref.update(engine.open, (open) => [...open, title]).pipe(Effect.andThen(engine.publish(invalidationKeys([adminTasks.list]))));
			},
			shownTasks: () => answered(AtomRegistry.getResult(engine.registry, engine.list)),
			untilRefreshed: () => {
				story.tell("the open tasks list receives the server's new result");
				return until(
					AtomRegistry.toStream(engine.registry, engine.list),
					(result) => result !== before && AsyncResult.isSuccess(result) && !result.waiting,
					{ name: "refreshed open tasks list" },
				);
			},
		};
	},
});

export function openTasks(...titles: readonly string[]) {
	return tasksStory.trait("tasks", `the open tasks are ${titles.join(" and ")}`, ({ open }) => Ref.set(open, titles));
}

export const listOpen = tasksStory.trait(
	"page",
	"alice, an auditor, has the live open tasks list on the tasks page",
	function* ({ api, list, registry }) {
		registry.mount(list);
		yield* until(AtomRegistry.toStream(registry, api[LiveConnection].status), (status) => status.connection === "live", { name: "live tasks list" });
		yield* AtomRegistry.getResult(registry, list);
	},
);
