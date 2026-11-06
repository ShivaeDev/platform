import { Effect } from "effect";
import { clientActivity, isClientSettled } from "@shivaedev/contract/clientActivity.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { StatisticsPage } from "#modules/notes/admin/pages.ts";
import { makeAdminClient } from "#modules/notes/client/admin/make.ts";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import { notesRegistration } from "#modules/notes/client/registration.tsx";
import { Notes } from "#modules/notes/notes.ts";
import { appScreen as openAppScreen } from "#test-support/appScreen.tsx";

const modules = {
	connect(options: Pick<ClientOptions, "url" | "protocol">) {
		const client = makeNotesClient(options.url, options);
		const admin = makeAdminClient(options.url, { ...options, live: false });
		return {
			activity: clientActivity(client),
			pending: () => !isClientSettled(Effect.runSync(clientActivity(admin).current)),
			registrations: [notesRegistration(client, admin)],
		};
	},
	contracts: [Notes, StatisticsPage.contract],
};

export const appScreen = Effect.fn("NotesStory.appScreen")(function* (options: Omit<Parameters<typeof openAppScreen>[0], "modules">) {
	return yield* openAppScreen({ ...options, modules });
});
