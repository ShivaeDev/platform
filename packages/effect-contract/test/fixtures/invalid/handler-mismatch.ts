import { Effect } from "effect";
import { Notes } from "../../notes.ts";

Notes.of({
	"notes.create": (draft) => Effect.succeed({ id: 1, ...draft }),
	"notes.get": ({ id }) => Effect.succeed({ id: String(id) }),
	"notes.list": () => Effect.succeed([]),
	"notes.rename": ({ id, title }) => Effect.succeed({ body: "", id, title }),
});
