import { agentWaitVerbs } from "./agentWaitVerbs.ts";
import { attentionLaneVerbs } from "./attentionLaneVerbs.ts";
import { distinctVerbs } from "./distinctVerbs.ts";
import { packetPageVerbs } from "./packetPageVerbs.ts";
import { publicationBoardVerbs } from "./publicationBoardVerbs.ts";
import { questionEditorVerbs } from "./questionEditorVerbs.ts";
import { questionRecordVerbs } from "./questionRecordVerbs.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function responsesBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return distinctVerbs(
		questionRecordVerbs(engine, tell),
		questionEditorVerbs(engine, tell),
		agentWaitVerbs(engine, tell),
		publicationBoardVerbs(engine, tell),
		attentionLaneVerbs(engine, tell),
		packetPageVerbs(engine, tell),
	);
}
