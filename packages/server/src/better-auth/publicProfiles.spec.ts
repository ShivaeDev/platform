import { Result } from "effect";
import { expect } from "vitest";
import { auth } from "#test/auth/story.ts";

auth.it("public profiles include only known users' ids, names and images", [], function* ({ signInProfile, lookupProfiles }) {
	const ada = yield* signInProfile({ email: "ada@example.test", image: "https://example.test/ada.png", name: "Ada" });
	const grace = yield* signInProfile({ email: "grace@example.test", name: "Grace" });
	const { result } = yield* lookupProfiles([ada.user.id, "unknown-user", grace.user.id]);
	const profiles = Result.getOrThrow(result);
	expect([...profiles].sort((left, right) => left.name.localeCompare(right.name))).toEqual([
		{ id: ada.user.id, image: "https://example.test/ada.png", name: "Ada" },
		{ id: grace.user.id, image: null, name: "Grace" },
	]);
});

auth.it("a Better Auth rename appears on the next profile lookup", [], function* ({ signInProfile, lookupProfiles, renameProfile }) {
	const ada = yield* signInProfile({ email: "ada@example.test", name: "Ada" });
	expect(Result.getOrThrow((yield* lookupProfiles([ada.user.id])).result)).toEqual([{ id: ada.user.id, image: null, name: "Ada" }]);
	yield* renameProfile(ada.headers, "Ada Lovelace");
	expect(Result.getOrThrow((yield* lookupProfiles([ada.user.id])).result)).toEqual([{ id: ada.user.id, image: null, name: "Ada Lovelace" }]);
});

auth.it("a profile batch reads storage once and reads duplicate ids once", [], function* ({ signInProfile, lookupProfiles }) {
	const ada = yield* signInProfile({ email: "ada@example.test", name: "Ada" });
	const grace = yield* signInProfile({ email: "grace@example.test", name: "Grace" });
	const { queries, result } = yield* lookupProfiles([ada.user.id, grace.user.id, ada.user.id]);
	expect(
		Result.getOrThrow(result)
			.map(({ id }) => id)
			.sort(),
	).toEqual([ada.user.id, grace.user.id].sort());
	expect(queries.map(({ values }) => values)).toEqual([[ada.user.id, grace.user.id, 2]]);
});

auth.it("an empty profile lookup sends no storage query", [], function* ({ lookupProfiles }) {
	const { queries, result } = yield* lookupProfiles([]);
	expect(Result.getOrThrow(result)).toEqual([]);
	expect(queries).toEqual([]);
});

auth.it("an auth storage outage returns only AuthUnavailable", [], function* ({ signInProfile, lookupProfiles, stopAuthStorage }) {
	const ada = yield* signInProfile({ email: "ada@example.test", name: "Ada" });
	yield* stopAuthStorage();
	const { logs, result } = yield* lookupProfiles([ada.user.id]);
	expect(logs).toMatchObject([["Authentication provider failed", { message: "Cannot use a pool after calling end on the pool" }]]);
	expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable", message: "Authentication is temporarily unavailable" } });
	if (result._tag === "Failure") {
		expect(result.failure).not.toHaveProperty("cause");
		expect(String(result.failure)).toBe("AuthUnavailable: Authentication is temporarily unavailable");
	}
});
