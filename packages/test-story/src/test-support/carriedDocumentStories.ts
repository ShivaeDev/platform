import { Effect } from "effect";
import { outcomes } from "#outcomes.ts";
import { storyKit } from "#storyKit.ts";

const visitor = storyKit({
	clock: "live",
	create: () => ({}),
	name: "visitor",
	stages: [],
	verbs: () => ({
		cookies: () => Effect.sync(() => document.cookie),
		draft: () => Effect.sync(() => localStorage.getItem("draft") ?? "none"),
		opensTab: (tab: string) => Effect.sync(() => sessionStorage.setItem("tab", tab)),
		savesDraft: (draft: string) => Effect.sync(() => localStorage.setItem("draft", draft)),
		signsIn: (member: string) => Effect.promise(() => window.cookieStore.set("session", member)),
		tab: () => Effect.sync(() => sessionStorage.getItem("tab") ?? "none"),
	}),
});

visitor.it("signs in, saves a draft and opens a tab", [], function* ({ cookies, draft, opensTab, savesDraft, signsIn, tab }) {
	yield* signsIn("ada");
	yield* savesDraft("Bread");
	yield* opensTab("list");

	yield* outcomes({ cookies: [cookies(), "session=ada"], draft: [draft(), "Bread"], tab: [tab(), "list"] });
});

visitor.it("starts signed out with no draft and no tab", [], function* ({ cookies, draft, tab }) {
	yield* outcomes({ cookies: [cookies(), ""], draft: [draft(), "none"], tab: [tab(), "none"] });
});
