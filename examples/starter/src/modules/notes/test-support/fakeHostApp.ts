import type * as Atom from "effect/reactivity/Atom";
import { type ClientActivity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { ContractClient, ContractsClient } from "@shivaedev/contract/makeClient.ts";
import { type AppConnection, type ClientApp, type ClientAppOptions, clientApp } from "@shivaedev/react/client/app.ts";
import { type ClientModule, clientModule } from "@shivaedev/react/client/module.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { notesModule } from "#modules/notes/client/module.tsx";
import { recordedApp } from "#test-support/recordedApp.ts";

export interface NotesConnection {
	readonly activity: ClientActivity;
	readonly notes: ContractClient<typeof Notes>;
	readonly runtime: Atom.AtomRuntime<ContractsClient>;
	readonly sync: AppConnection["sync"];
}

// The kit names the notes contract as a module of its own, so it holds the very binding the notes screens read.
export function fakeHostApp(
	options: ClientAppOptions,
	record: (connection: NotesConnection) => void,
	modules: readonly ClientModule[] = [],
): ClientApp {
	const bound: { notes?: ContractClient<typeof Notes> } = {};
	const observer = clientModule({ notes: Notes }, ({ notes }) => {
		bound.notes = notes;
		return {};
	});
	return recordedApp(clientApp([...modules, notesModule, observer], options), (connection) => {
		if (bound.notes === undefined) {
			throw new Error("The notes contract was not bound");
		}
		record({ activity: clientActivity(connection), notes: bound.notes, runtime: connection.runtime, sync: connection.sync });
	});
}
