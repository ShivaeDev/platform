import { AS_RELEASED, starterAt010, starterAt020 } from "#test/updateTraits.ts";

function legacyImport(source: string) {
	return source.replaceAll("#admin/foundation.ts", "#admin/modules.ts");
}

export const separateAdminRegistry = starterAt010("registers admin features and queues separately from server modules", {
	"src/admin/foundation.ts": null,
	"src/admin/foundationPages.ts": `import type { JobsEntry } from "@shivaedev/admin/jobs/entry.ts";
import { jobsPage } from "@shivaedev/admin/jobs/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { SessionsPage } from "@shivaedev/admin/sessions/Page.ts";
import { usersPage } from "@shivaedev/admin/users/page.ts";
import { AppAccess } from "#AppAccess.ts";
import { foundationQueues } from "./foundationQueues.ts";

const UsersPage = usersPage(AppAccess);

export function foundationPages<const TQueues extends readonly JobsEntry[]>(...queues: TQueues) {
	const JobsPage = jobsPage(...foundationQueues, ...queues);
	return { admin: adminRegistry(JobsPage, UsersPage, SessionsPage), JobsPage, queues: JobsPage.queues, SessionsPage, UsersPage };
}
`,
	"src/admin/modules.ts": `import { mergeAdminRegistries } from "@shivaedev/admin/registry.ts";
import { Admin as notesModule } from "#modules/notes/admin/pages.ts";
import { noteQueue } from "#modules/notes/queue.ts";
import { foundationPages } from "./foundationPages.ts";

const modules = [notesModule] as const;
const queues = [noteQueue] as const;

export const foundation = foundationPages(...queues);
export const Admin = mergeAdminRegistries(foundation.admin, ...modules);
`,
	"src/client/admin/foundation.ts": legacyImport,
	"src/client/admin/foundationRegistration.tsx": legacyImport,
	"src/modules/notes/test-support/admin/group.ts": legacyImport,
	"src/modules/notes/test-support/admin/host.ts": legacyImport,
	"src/server/admin/foundationRegistration.ts": `import { jobsHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { usersHandlers } from "@shivaedev/admin/server/usersHandlers.ts";
import { sessionsHandlers } from "@shivaedev/identity/server/better-auth/sessionsHandlers.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { foundation } from "#admin/modules.ts";

const AdminJobs = makePgBoss("app/AdminJobs");

export function foundationRegistration() {
	const jobs = AdminJobs.layer({ jobs: [] });
	return {
		...registerAdmin(foundation.admin, {
			jobs: jobsHandlers(foundation.JobsPage, AdminJobs),
			sessions: sessionsHandlers,
			users: usersHandlers(foundation.UsersPage),
		}),
		services: jobs,
	};
}
`,
	"src/server/modules.ts": `import type { Layer } from "effect";
import { appModules } from "@shivaedev/server/appModules.ts";
import { notesRegistration } from "#modules/notes/server/registration.ts";
import { serverRegistration } from "#server/registration.ts";

const modules = [serverRegistration(), notesRegistration] as const;

export function serverModules<R = never, E = never, TRequirements = never>(replacements: Layer.Layer<R, E, TRequirements>) {
	return appModules(modules, { replacements });
}
`,
	"src/server/registration.ts": `import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Path } from "effect";
import { RpcGroup } from "effect/rpc";
import * as MigratorFileSystem from "effect/sql/MigratorFileSystem";
import { pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { AuthEmailQueue } from "#server/AuthEmailQueue.ts";
import { foundationRegistration } from "#server/admin/foundationRegistration.ts";
import { foundationWorker } from "#server/foundationWorker.ts";

export function serverRegistration() {
	const admin = foundationRegistration();
	return {
		admin,
		group: RpcGroup.make(),
		handlers: Layer.empty,
		migrations: {
			components: [pgBossSchema()],
			loader: Path.Path.pipe(
				Effect.flatMap((path) => MigratorFileSystem.fromFileSystem(path.resolve(import.meta.dirname, "migrations"))),
				Effect.provide(NodeServices.layer),
			),
		},
		name: "foundation",
		queues: [AuthEmailQueue.queue, ...foundationWorker.queues],
		services: Layer.merge(AuthEmailQueue.producerLayer, admin.services),
		workers: Layer.merge(foundationWorker.workers, AuthEmailQueue.workerLayer),
	} satisfies AppModule;
}
`,
	"src/test-support/admin/foundation.ts": legacyImport,
	"src/test-support/admin/foundationJobsScreen.tsx": legacyImport,
});

export const unifiedAdminRegistry = starterAt020("derives server admin handlers and queues from its feature entries", {
	"src/admin/foundation.ts": AS_RELEASED,
	"src/admin/foundationPages.ts": AS_RELEASED,
	"src/admin/modules.ts": null,
	"src/client/admin/foundation.ts": AS_RELEASED,
	"src/client/admin/foundationRegistration.tsx": AS_RELEASED,
	"src/modules/notes/test-support/admin/group.ts": AS_RELEASED,
	"src/modules/notes/test-support/admin/host.ts": AS_RELEASED,
	"src/server/admin/foundationRegistration.ts": AS_RELEASED,
	"src/server/modules.ts": AS_RELEASED,
	"src/server/registration.ts": AS_RELEASED,
	"src/test-support/admin/foundation.ts": AS_RELEASED,
	"src/test-support/admin/foundationJobsScreen.tsx": AS_RELEASED,
});
