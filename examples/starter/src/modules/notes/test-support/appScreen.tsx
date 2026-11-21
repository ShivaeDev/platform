import { Effect } from "effect";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import type { ClientOptions } from "@shivaedev/contract/ClientOptions.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { StatisticsPage } from "#modules/notes/admin/pages.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { appScreen as openAppScreen } from "#test-support/appScreen.tsx";

const modules = {
	connect(options: Pick<ClientOptions, "url" | "protocol">) {
		const client = makeClient({ notes: Notes, statistics: StatisticsPage.contract }, options);
		return { activities: [clientActivity(client)], registrations: [notesRegistration(client)] };
	},
	contracts: [Notes, StatisticsPage.contract],
};

export const appScreen = Effect.fn("NotesStory.appScreen")(function* (options: Omit<Parameters<typeof openAppScreen>[0], "modules">) {
	return yield* openAppScreen({ ...options, modules });
});
