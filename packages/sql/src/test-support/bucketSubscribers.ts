import { Effect, Queue } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { bucketRows } from "./bucketRows.ts";
import { onPostgres } from "./engines.ts";

const subscriberEngine = Effect.fnUntraced(function* () {
	const { keys, rows } = yield* bucketRows;
	const reactivity = yield* Reactivity.Reactivity;
	const lists = yield* reactivity.query(readKeys([keys.bucket.listId(0)]), rows.findMany({ where: { listId: 0 } }));
	const owners = yield* reactivity.query(readKeys([keys.bucket.owner("alice:team")]), rows.findMany({ where: { owner: "alice:team" } }));
	return { lists, owners, rows };
});

export const bucketSubscribers = storyKit({
	...onPostgres,
	create: subscriberEngine,
	name: "PostgreSQL bucket subscribers",
	stages: [],
	verbs: ({ lists, owners, rows }: Effect.Success<ReturnType<typeof subscriberEngine>>, story) => ({
		insert: (slug: string) =>
			Effect.suspend(() => {
				story.tell(`${slug} is inserted for list zero and owner alice:team`);
				return rows.insert({ listId: 0, owner: "alice:team", slug });
			}),
		listRows: () => Effect.map(Queue.take(lists), (values) => values.map(({ slug }) => slug)),
		ownerRows: () => Effect.map(Queue.take(owners), (values) => values.map(({ slug }) => slug)),
	}),
});
