import { Option } from "effect";
import { expect } from "vitest";
import { AuthActionUnavailable } from "#client/authAction.ts";
import { authStories } from "#test/authStories.ts";

authStories.it("exposes a rejected auth promise as a typed transport failure", [], function* ({ dispatch, failure, rejection }) {
	yield* dispatch();
	const error = Option.getOrThrow(failure());
	expect(error).toBeInstanceOf(AuthActionUnavailable);
	expect(error).toMatchObject({ _tag: "AuthActionUnavailable", cause: rejection() });
});
