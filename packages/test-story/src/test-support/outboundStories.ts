import { Effect } from "effect";
import { notesRoutingAfterEachStory, outboundKit, thirdPartyAvailable } from "#test/outbound.ts";

notesRoutingAfterEachStory();

outboundKit.it("fails with outbound routing", [thirdPartyAvailable], function* ({ notesRouting }) {
	yield* notesRouting();
	yield* Effect.fail("the story fails on purpose");
});

outboundKit.it("passes with outbound routing", [thirdPartyAvailable], function* ({ notesRouting }) {
	yield* notesRouting();
});
