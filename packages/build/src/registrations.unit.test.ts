import ts from "typescript";
import { expect, it } from "vitest";
import { inPathOrder, mayRegister, registrationsIn } from "#registrations.ts";

function found(text: string) {
	return registrationsIn(ts.createSourceFile("registration.ts", text, ts.ScriptTarget.Latest, true));
}

const IMPORTED = 'import type { AppModule } from "@shivaedev/server/AppModule.ts";\n';

it("finds an exported registration written satisfies AppModule, also under a renamed import and in parentheses, in declaration order", () => {
	expect(
		found(
			`${IMPORTED}import type { AppModule as Registered } from "@shivaedev/server/AppModule.ts";\nexport const tags = { module: Tags, services } satisfies AppModule;\nexport const notes = ({ module: Notes, services } satisfies Registered);\n`,
		),
	).toEqual({ refusals: [], registrations: ["tags", "notes"] });
});

it("skips a registration that is not exported, one written satisfies another type and one whose AppModule comes from elsewhere", () => {
	expect(
		found(
			`${IMPORTED}import type { AppModule as Local } from "#server/types.ts";\nconst hidden = { module: Hidden, services } satisfies AppModule;\nexport const admin = { module: Admin, services } satisfies AdminRegistration;\nexport const local = { module: Local, services } satisfies Local;\nexport const helper = { module: "not a registration" };\n`,
		),
	).toEqual({ refusals: [], registrations: [] });
});

it("refuses an exported registration typed as AppModule or cast to it, naming the fix", () => {
	expect(
		found(`${IMPORTED}export const tags: AppModule = { module: Tags, services };\nexport const notes = { module: Notes, services } as AppModule;\n`),
	).toEqual({
		refusals: [
			"tags is typed as AppModule, which leaves it out of the server's module list and loses its module's services; write `satisfies AppModule` after its object instead",
			"notes is typed as AppModule, which leaves it out of the server's module list and loses its module's services; write `satisfies AppModule` after its object instead",
		],
		registrations: [],
	});
});

it("refuses an exported object naming a module and its services without satisfies AppModule, even with no AppModule import", () => {
	expect(found("export const tags = { module: Tags, services: TagsRepository.layer };\n")).toEqual({
		refusals: [
			"tags names a module and its services but is not written `satisfies AppModule`, so the server's module list leaves it out; write `satisfies AppModule` after its object, with AppModule imported from @shivaedev/server/AppModule.ts",
		],
		registrations: [],
	});
});

it("orders registrations by their file's path, keeping a file's own order", () => {
	expect(
		inPathOrder([
			{ file: "/app/src/modules/tags/server/registration.ts", refusals: [], registrations: ["tags"] },
			{ file: "/app/src/modules/notes/server/registration.ts", refusals: [], registrations: ["notes", "noteArchive"] },
		]),
	).toEqual([
		{ file: "/app/src/modules/notes/server/registration.ts", name: "notes" },
		{ file: "/app/src/modules/notes/server/registration.ts", name: "noteArchive" },
		{ file: "/app/src/modules/tags/server/registration.ts", name: "tags" },
	]);
});

it("never takes a registration from a test file or a kit", () => {
	expect(
		[
			"src/modules/notes/server/registration.ts",
			"src/modules/notes/test-support/host.ts",
			"src/server/host.spec.ts",
			"src/client/App.dom.test.tsx",
		].map(mayRegister),
	).toEqual([true, false, false, false]);
});
