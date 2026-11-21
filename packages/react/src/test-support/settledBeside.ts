import type { ClientActivityState } from "@shivaedev/contract/clientActivity.ts";

export interface HeldWork {
	// Accepted commands that wait for a rerun the server holds, or undefined while the server holds a read the kit cannot attribute: a rerun or a query's first read.
	readonly awaitingReruns: number | undefined;
	readonly commands: number;
}

// A command the server holds stays sent and unreflected; every other command has its reply and its push on the screen.
export function settledBeside(held: () => HeldWork) {
	return (state: ClientActivityState) => {
		const { awaitingReruns, commands } = held();
		if (state.commands !== commands) {
			return false;
		}
		if (awaitingReruns === undefined) {
			return state.unreflectedCommands >= commands;
		}
		return state.initialQueries === 0 && state.unreflectedCommands === commands + awaitingReruns;
	};
}
