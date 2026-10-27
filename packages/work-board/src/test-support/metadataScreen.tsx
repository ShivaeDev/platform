import { Effect } from "effect";
import { render } from "@shivaedev/react/client/testing.ts";
import { DocumentWorkMetadata } from "#client/react/DocumentWorkMetadata.tsx";
import { fileUrl } from "#files/url.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export const metadataScreen = Effect.fn("BoardStory.metadataScreen")(function* (engine: BoardEngine, file: string) {
	const { client } = served(engine);
	const document = yield* Effect.promise(() => client.run(client.api.document.run({ url: fileUrl(file) })));
	return yield* Effect.acquireRelease(
		Effect.promise(() => render(<DocumentWorkMetadata document={document} />)),
		(view) => Effect.promise(() => view.unmount()),
	);
});
