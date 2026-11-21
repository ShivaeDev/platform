import type { ClientActivityState } from "@shivaedev/contract/clientActivity.ts";

export interface HeldWork {
	// Accepted commands that wait for a rerun the server holds, or undefined when the kit cannot tell how many reruns cover.
	readonly awaitingReruns: number | undefined;
	readonly commands: number;
}

// A command the server holds stays sent and unreflected; every other command has its reply and its push on the screen.
export function settledBeside(held: () => HeldWork) {
	return (state: ClientActivityState) => {
		const { awaitingReruns, commands } = held();
		const reflected = awaitingReruns === undefined ? state.unreflectedCommands >= commands : state.unreflectedCommands === commands + awaitingReruns;
		return state.initialQueries === 0 && state.commands === commands && reflected;
	};
}
