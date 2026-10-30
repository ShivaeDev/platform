import { Effect, Exit, Scope } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { type MemberScreen, memberScreens } from "#memberScreens.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { sharedListHost } from "./sharedListHost.ts";

const draft = Atom.make("");

function mount(member: MemberScreen, pending: Set<string>) {
	return Effect.promise(async () => {
		member.root.innerHTML =
			'<form aria-label="Item"><input aria-label="Title"><button>Add</button></form><button>Refresh</button><button>Sign out</button><output></output>';
		const field = member.root.querySelector("input");
		const form = member.root.querySelector("form");
		const buttons = member.root.querySelectorAll("button");
		const found = member.root.querySelector("output");
		if (!(field && form && found && buttons[1] && buttons[2])) {
			throw new Error("The shared list screen could not mount");
		}
		const output = found;
		member.registry.mount(draft);
		async function load(method = "GET") {
			pending.add(member.name);
			try {
				const response = await member.fetch("/items", { ...(method === "POST" ? { body: member.registry.get(draft) } : {}), method });
				const result = await response.json();
				output.textContent = response.ok ? `${result.name}'s list: ${result.items.join(", ")}` : result.message;
			} finally {
				pending.delete(member.name);
			}
		}
		field.addEventListener("input", () => member.registry.set(draft, field.value));
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			void load("POST");
		});
		buttons[1].addEventListener("click", () => void load());
		buttons[2].addEventListener("click", () => {
			pending.add(member.name);
			void member.fetch("/sign-out", { method: "POST" }).then(async (response) => {
				await response.text();
				await load();
			});
		});
		await load();
	});
}

export const sharedLists = storyKit({
	clock: "live",
	*create() {
		const baseUrl = yield* sharedListHost;
		const pending = new Set<string>();
		const scope = yield* Scope.make();
		yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
		const mounted = new Map<string, MemberScreen>();
		const members = memberScreens({
			baseUrl,
			mount: (member) => {
				mounted.set(member.name, member);
				return mount(member, pending);
			},
			verbs: (member, tell) => screenDriver({ pending: () => pending.has(member.name), root: member.root, tell }),
		});
		return { members, mounted, scope };
	},
	name: "member screen",
	stages: ["members"],
	verbs: (engine, story) => ({
		...engine.members.verbs(story.tell),
		attachedRoots: () => [...engine.mounted.values()].filter(({ root }) => root.isConnected).map(({ name }) => name),
		closeMembers: () => Scope.close(engine.scope, Exit.void),
		readDraft: (name: string) => {
			const member = engine.mounted.get(name);
			if (!member) {
				throw new Error(`No member ${name}`);
			}
			return member.registry.get(draft);
		},
	}),
});

export function signedInMembers(...names: readonly string[]) {
	return sharedLists.trait("members", `${names.join(" and ")} open their shared list signed in`, function* (engine) {
		for (const name of names) {
			yield* engine.members
				.open(name, [{ httpOnly: true, name: "member", path: "/", value: name }])
				.pipe(Effect.provideService(Scope.Scope, engine.scope));
		}
	});
}
