import { Effect } from "effect";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { Notes } from "#generated/modules/notes/Notes.ts";
import { StatisticsPage } from "#modules/notes/admin/pages.ts";
import { makeAdminClient } from "#modules/notes/client/admin/make.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { appScreen as openAppScreen } from "#test-support/appScreen.tsx";

const modules = {
	connect(options: Pick<ClientOptions, "url" | "protocol">) {
		const client = makeNotesClient(options.url, options);
		const admin = makeAdminClient(options.url, options);
		return { activities: [clientActivity(client), clientActivity(admin)], registrations: [notesRegistration(client, admin)] };
	},
	contracts: [Notes, StatisticsPage.contract],
};

export const appScreen = Effect.fn("NotesStory.appScreen")(function* (options: Omit<Parameters<typeof openAppScreen>[0], "modules">) {
	return yield* openAppScreen({ ...options, modules });
});
