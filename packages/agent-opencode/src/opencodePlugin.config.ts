export default () => ({
	"tool.execute.before": (
		input: {
			tool: string;
			"sessionID": string;
			"callID": string;
		},
		output: {
			args: Record<string, unknown>;
		},
	) => {
		if (input.tool.startsWith("platform_")) {
			output.args.callerSession = input.sessionID;
			output.args.callerCall = input.callID;
		}
	},
});
