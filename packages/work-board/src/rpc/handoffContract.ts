import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { Handoff, HandoffInput, HandoffPreview, HandoffReading } from "#browser/handoffs/schema.ts";
import { ResponseFailed } from "#browser/responses/schema.ts";
import { index, workspace } from "#rpc/keys.ts";

const locate = query("handoffSource", {
	payload: { item: Schema.String },
	reads: () => [workspace.list, index.list],
	rejections: { ResponseFailed },
	success: HandoffPreview,
});
const read = query("handoffs", {
	payload: { item: Schema.String },
	reads: () => [workspace.list, index.list],
	rejections: { ResponseFailed },
	success: HandoffReading,
});
const prepare = command("prepareHandoff", {
	invalidates: () => [workspace.list, index.list],
	payload: HandoffInput,
	rejections: { ResponseFailed },
	success: Handoff,
});
export const handoffContract = contract("work-board", { commands: [prepare], queries: [locate, read] });
