import { rpcCall } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function standingQuestionVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		readToday: () => {
			tell("the maintainer reads Today's inbox projection");
			return rpcCall(served(engine).board, (client) => client("work-board.inbox", undefined));
		},
	};
}
