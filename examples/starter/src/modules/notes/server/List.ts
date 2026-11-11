import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { NotesRepository } from "#modules/notes/server/Repository.ts";

export const List = query("list", {
	*run() {
		const repository = yield* NotesRepository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany({
			orderBy: { direction: "desc", field: "id" },
			select: ["id", "title", "wordCount", "version"],
			where: { userId },
		});
	},
});
