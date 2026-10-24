export function decisionCoverage(codes: readonly string[], sites: readonly string[], rows: readonly { code?: string; sites?: readonly string[] }[]) {
	const coveredCodes = new Set(rows.map((row) => row.code));
	const coveredSites = new Set(rows.flatMap((row) => row.sites ?? []));
	const actualSites = new Set(sites);
	return {
		codes: codes.filter((code) => !coveredCodes.has(code)),
		obsoleteSites: [...coveredSites].filter((site) => !actualSites.has(site)),
		sites: sites.filter((site) => !coveredSites.has(site)),
	};
}
