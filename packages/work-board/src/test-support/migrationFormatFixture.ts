export const migrationFormatFixture = {
	"dropped.md": "---\nid: dropped\nkind: task\nstatus: superseded\nsuperseded_by: plain\n---\n# Dropped\n",
	"json.md":
		'---\n{"id":"json","kind":"decision","status":"open","fleet-deliverable":"report","owner":"Claude","attention":[{"id":"choice","kind":"decision","managed":true,"reason":"Choose","response_from":["maintainer"],"state":"closed","unblocks":["plain"]}]}\n---\n# Ask\n',
	"plain.md": "---\nid: plain\nkind: project # kind comment\nstatus: active\nowner: Claude\nfleet-deliverable: report\n---\n# Plain  \n",
	"quoted.md": "---\nid: quoted\nkind: 'project'\nstatus: \"active\"\nowner: 'Claude'\n'fleet-deliverable': report\n---\n# Quoted\n",
	"response.md": "---\nkind: response\nid: response\n---\n# Response\n",
};
