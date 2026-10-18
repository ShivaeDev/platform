import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import type { EngineFixture } from "#test/engine.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { upgradeMergedDeliveries } from "#test/upgradeMergedDeliveries.ts";

export function engineBoardVerbs(state: EngineStory, tell: (line: string) => void) {
	function files() {
		if (state.root === "") {
			throw new Error("No Markdown Board is configured");
		}
		return boardHttpFiles(state.root);
	}
	function write(path: string, text: string) {
		files().write(path, text);
	}
	return {
		acknowledgeProviderTurn: (...args: Parameters<EngineFixture["acknowledgeTurn"]>) => {
			tell(`persist the accepted turn for ${args[0]}`);
			return running(state).fixture.acknowledgeTurn(...args);
		},
		boardBrief: () => state.source,
		boardDecisionFiles: () => {
			files();
			return readdirSync(join(state.root, "responses")).filter((file) => file.startsWith("decision."));
		},
		boardFileIdentity: (path = "one.md") => {
			files();
			return statSync(join(state.root, path)).ino;
		},
		boardReceipts: () => files().receipts(),
		editBoardAtCompletion: (text: string) => {
			state.completionEdit = () => write("one.md", text);
			tell("a Board edit will race completion");
		},
		editBoardDuringAssessment: (text: string) => {
			state.closeDuringAssessment = () => write("one.md", text);
			tell("a Board edit will arrive during main assessment");
		},
		occupyExecution: (owner: string) => {
			tell(`reserve foreign execution for ${owner}`);
			return running(state).fixture.occupy(owner);
		},
		readBoardPublication: (path: string) => {
			files();
			return metadataParse(readFileSync(join(state.root, path), "utf8"));
		},
		readBoardWork: (path = "one.md") => {
			files();
			return readFileSync(join(state.root, path), "utf8");
		},
		replaceStoredRecord: (...args: Parameters<EngineFixture["replaceRecord"]>) => {
			tell(`write the legacy Fleet record for ${args[0].workId}`);
			return running(state).fixture.replaceRecord(...args);
		},
		reserveForeign: (owner: string) => {
			tell(`reserve backlog for ${owner}`);
			return running(state).fixture.foreign(owner);
		},
		setAreas: (...args: Parameters<EngineFixture["areas"]>) => {
			running(state).fixture.areas(...args);
			tell(`Board assigns ${args[0]} to areas ${args[1].join(", ")}`);
		},
		setBoardStatus: (...args: Parameters<EngineFixture["boardStatus"]>) => {
			running(state).fixture.boardStatus(...args);
			tell(`Board marks ${args[0]} ${args[1]}`);
		},
		setDependencies: (...args: Parameters<EngineFixture["dependencies"]>) => {
			running(state).fixture.dependencies(...args);
			tell(`Board changes dependencies of ${args[0]}`);
		},
		upgradeDecisionCodes: () => {
			tell("upgrade persisted decision codes");
			return running(state).fixture.upgradeDecisionCodes;
		},
		upgradeMergedDeliveries: () => {
			tell("migrate released deliveries from the previous PostgreSQL schema");
			return upgradeMergedDeliveries;
		},
		vacateExecution: (owner: string) => {
			tell(`release foreign execution for ${owner}`);
			return running(state).fixture.vacate(owner);
		},
		writeBoardWork: (path: string, text: string) => {
			write(path, text);
			tell(`write Board work ${path}`);
		},
	};
}
