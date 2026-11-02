import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { type MemberScreen, memberScreens } from "#memberScreens.ts";
import { screenDriver } from "#screenDriver.ts";
import { storyKit } from "#storyKit.ts";
import { type DialogKind, MemberPreferences } from "./MemberPreferences.tsx";

expectNoReactWarnings();

const mount = Effect.fnUntraced(function* (member: MemberScreen, kind: DialogKind, screens: Map<string, HTMLElement>) {
	const container = document.createElement("div");
	member.root.append(container);
	const root = yield* Effect.acquireRelease(
		Effect.sync(() => createRoot(container)),
		(mounted) =>
			Effect.promise(async () => {
				await act(() => mounted.unmount());
			}),
	);
	yield* Effect.promise(async () => {
		await act(() => root.render(<MemberPreferences kind={kind} member={member} />));
	});
	screens.set(member.name, container);
});

export const memberDialogs = storyKit({
	clock: "live",
	create: () => ({ screens: new Map<string, HTMLElement>() }),
	inspect: ({ screens }) => Object.fromEntries([...screens].map(([name, root]) => [name, root.parentElement?.innerHTML])),
	name: "member dialogs",
	stages: ["members"],
	verbs: ({ screens }, story) => {
		function as(name: string) {
			const root = screens.get(name);
			if (!root) {
				throw new Error(`No preferences screen is open for ${name}`);
			}
			return screenDriver({
				act: async (action) => {
					await act(action);
				},
				root,
				tell: story.tell,
			});
		}
		return {
			as,
			saved: (name: string) => Effect.sync(() => as(name).text("output")),
		};
	},
});

export function twoMembers(kind: DialogKind) {
	return memberDialogs.trait("members", `ada and grace have open ${kind} preferences`, function* ({ screens }) {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const members = memberScreens({
			baseUrl: "http://localhost:3000",
			mount: (member) => mount(member, kind, screens),
			verbs: (member, tell) =>
				screenDriver({
					act: async (action) => {
						await act(action);
					},
					root: member.root,
					tell,
				}),
		});
		for (const name of ["ada", "grace"]) {
			yield* members.open(name, []);
			yield* members
				.verbs(() => undefined)
				.as(name)
				.click({ name: "Preferences", role: "button" });
		}
	});
}
