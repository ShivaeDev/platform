import { Effect, Schema } from "effect";
import { Create, Get, Notes } from "#test/notes.ts";

class Other extends Schema.TaggedError<Other>()("Other", {}) {}

Notes.of({
	"notes.create": () => Create.reject.Invalid({ field: "title", message: "" }),
	"notes.get": () => Effect.fail(new Other()),
	"notes.list": () => Effect.succeed([]),
	"notes.rename": ({ id }) => Get.reject.NoteMissing({ id }),
});
