import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { subjectStory, withoutSessions } from "#test/subject/story.ts";

subjectStory.it("alice receives the declared refusal when subscribing to bob's changes", [], function* ({ requestChanges }) {
	const answer = yield* requestChanges("alice", "bob");

	expect(answer).toEqual({ refused: "bob" });
});

subjectStory.it("alice renames her own account without sending an account id", [], function* ({ rename }) {
	const answer = yield* rename("own", "alice", "Alice's title");

	expect(answer).toEqual({ actor: "alice", name: "alice", subject: "alice", title: "Alice's title" });
});

subjectStory.it("a self subject ignores a client attempt to select bob", [], function* ({ rename }) {
	const answer = yield* rename("own", "alice", "Alice's title", "bob");

	expect(answer).toEqual({ actor: "alice", name: "alice", subject: "alice", title: "Alice's title" });
});

subjectStory.it("a manager renames bob's account while services still see the manager as the session user", [], function* ({ rename }) {
	const answer = yield* rename("delegated", "manager", "Bob's title", "bob");

	expect(answer).toEqual({ actor: "manager", name: "manager", subject: "bob", title: "Bob's title" });
});

subjectStory.it("a delegated command without an account selection acts on alice's own account", [], function* ({ rename }) {
	const answer = yield* rename("delegated", "alice", "Alice's title");

	expect(answer).toEqual({ actor: "alice", name: "alice", subject: "alice", title: "Alice's title" });
});

for (const actor of ["alice", "visitor"]) {
	subjectStory.it(`${actor} receives the typed account refusal before bob's handler runs`, [], function* ({ handledRequests, rename, storedTitles }) {
		yield* rename("own", actor, "Own title");

		const answer = yield* rename("delegated", actor, "Bob's title", "bob");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), { refused: "bob" }],
			["handled requests", () => handledRequests(), [`${actor} renamed ${actor}`]],
			["stored titles", () => storedTitles(), { [actor]: "Own title" }],
		]);
	});
}

for (const boundary of ["own", "delegated"] as const) {
	subjectStory.it(`an anonymous ${boundary} command is refused before its handler runs`, [], function* ({ handledRequests, rename }) {
		const answer = yield* rename(boundary, undefined, "Title", "bob");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "failed with unauthorized"],
			["handled requests", () => handledRequests(), []],
		]);
	});
}

subjectStory.it("concurrent self commands keep each request's subject and session user", [], function* ({ rename }) {
	const answers = yield* Effect.all([rename("own", "alice", "Alice's title"), rename("own", "bob", "Bob's title")], { concurrency: "unbounded" });

	expect(answers).toEqual([
		{ actor: "alice", name: "alice", subject: "alice", title: "Alice's title" },
		{ actor: "bob", name: "bob", subject: "bob", title: "Bob's title" },
	]);
});

subjectStory.it(
	"a manager's stream for bob ends with the typed refusal when delegation is revoked",
	[],
	function* ({ follow, revokeDelegation, revalidationIntervalPasses }) {
		expect(yield* follow("manager", "bob")).toBe("bob");

		yield* revokeDelegation("manager");
		const ending = yield* revalidationIntervalPasses("manager");

		expect(ending).toBe("failed with cannot act for bob");
	},
);

subjectStory.it(
	"a subject command on a host without sessions is unauthorized before its handler runs",
	[withoutSessions],
	function* ({ rename, handledRequests }) {
		const answer = yield* rename("own", "alice", "Title");

		yield* outcomes([
			["answer", () => Effect.succeed(answer), "failed with unauthorized"],
			["handled requests", () => handledRequests(), []],
		]);
	},
);

for (const [boundary, actor, subject] of [
	["own", "alice", "alice"],
	["delegated", "manager", "bob"],
] as const) {
	subjectStory.it(`${actor}'s ${boundary} query receives ${subject} as its subject`, [], function* ({ read }) {
		const answer = yield* read(boundary, actor, subject);

		expect(answer).toBe(subject);
	});
}

subjectStory.it("self and delegated commands sharing a namespace keep their own subjects", [], function* ({ rename }) {
	const delegated = yield* rename("shared", "manager", "Bob's title", "bob");

	expect(delegated).toEqual({ actor: "manager", name: "manager", subject: "bob", title: "Bob's title" });

	const self = yield* rename("own", "manager", "Own title", "bob");

	expect(self).toEqual({ actor: "manager", name: "manager", subject: "manager", title: "Own title" });
});
