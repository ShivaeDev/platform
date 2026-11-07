import { storyKit } from "#server/storyKit.ts";
import { conditionalKit } from "#test/conditionalKit.ts";
import { mill } from "#test/mill.ts";

const disabled = conditionalKit(false);
const village = storyKit({ extends: [mill, disabled.kit], name: "bakery" });

village.it("joins a disabled bakery", disabled.given, function* ({ recordsBody }) {
	yield* recordsBody();
});
