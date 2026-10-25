import { host } from "#test/hostStory.ts";
import { configureReportHistory } from "#test/reportHistory.ts";

export const reportHistoryTrait = host.trait(
	"observation",
	"the research repository has current, older and divergent revisions",
	configureReportHistory,
);
