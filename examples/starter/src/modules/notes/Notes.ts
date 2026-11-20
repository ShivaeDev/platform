import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { notesWire } from "#generated/modules/notes/Notes.ts";
import { Create } from "#modules/notes/server/Create.ts";
import { Delete } from "#modules/notes/server/Delete.ts";
import { Get } from "#modules/notes/server/Get.ts";
import { Import } from "#modules/notes/server/Import.ts";
import { List } from "#modules/notes/server/List.ts";
import { Update } from "#modules/notes/server/Update.ts";

export const Notes = defineModule({
	middleware: AuthenticatedUser,
	name: "notes",
	operations: [List, Get, Create, Import, Update, Delete],
	wire: notesWire,
});
