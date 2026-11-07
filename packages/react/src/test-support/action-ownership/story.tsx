import { Deferred, Effect, Exit } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type CommandName, type Mode, ownershipClient } from "#test/action-ownership/client.ts";
import { OwnershipView } from "#test/action-ownership/view.tsx";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";

interface State {
	readonly client: ReturnType<typeof ownershipClient>;
	input: string;
	mode: Mode;
	name: CommandName;
	view?: Rendered;
}

function view(state: State) {
	if (!state.view) {
		throw new Error("Command control is not open");
	}
	return state.view;
}

function dispatch(state: State, screen: Screen) {
	return screen.act(`click ${state.name}`, async () => {
		await Effect.runPromise(screen.driver(view(state).container).click({ name: state.name, role: "button" }));
		await Effect.runPromise(Deferred.await(state.client.commands[state.name].arrived));
	});
}

function answer(state: State, screen: Screen, name: CommandName, result: Exit.Exit<string, string>) {
	return screen.act(`the server answers ${name}`, async () => {
		const command = state.client.commands[name];
		Deferred.doneUnsafe(command.answer, result);
		await Effect.runPromise(Deferred.await(command.finished));
	});
}

export const ownership = storyKit(
	screenKit(
		"command ownership",
		(): State => ({ client: ownershipClient(), input: "the-reef", mode: "native", name: "Launch" }),
		(state, screen) => ({
			alert: () => Effect.sync(() => view(state).container.querySelector('[role="alert"]')?.textContent ?? ""),
			cause: () => Effect.sync(() => view(state).container.querySelector("[data-cause]")?.textContent),
			complete: (name: CommandName, value: string) => answer(state, screen, name, Exit.succeed(value)),
			control: () =>
				Effect.sync(() => {
					const button = view(state).container.querySelector("button");
					if (!button) {
						throw new Error("Command control has no button");
					}
					return { label: button.textContent, state: button.disabled ? "disabled" : "enabled" };
				}),
			dispatch: () => dispatch(state, screen),
			feedback: () => Effect.sync(() => view(state).container.querySelector('[role="status"]')?.textContent),
			reject: (name: CommandName, reason: string) => answer(state, screen, name, Exit.fail(reason)),
			sent: () => Effect.sync(() => [...state.client.sent]),
			shown: () => Effect.sync(() => view(state).container.querySelector("output")?.textContent),
			switchCommand: (name: CommandName, input = "the-shoals") =>
				screen.act(`switch the mounted control to ${name}`, () => {
					state.name = name;
					state.input = input;
					return view(state).render(<OwnershipView {...state} />);
				}),
		}),
	),
);

export function launchControl(mode: Mode) {
	return ownership.trait("screen", `a mounted ${mode} Launch control`, function* ({ screen, state }) {
		state.mode = mode;
		state.view = yield* screen.open(<OwnershipView {...state} />);
	});
}

export function launchPending(mode: Mode) {
	return ownership.traits(
		launchControl(mode),
		ownership.trait("screen", "Launch is waiting for the server", ({ screen, state }) => dispatch(state, screen)),
	);
}
