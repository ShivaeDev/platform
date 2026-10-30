import { storyKit } from "#storyKit.ts";
import { conditionalKit } from "./conditionalKit.ts";
import { mill } from "./mill.ts";

const disabled = conditionalKit(false);
const village = storyKit({ extends: [mill, disabled.kit], name: "bakery" });

village.it("joins a disabled bakery", disabled.given, function* ({ recordsBody }) {
	yield* recordsBody();
});
