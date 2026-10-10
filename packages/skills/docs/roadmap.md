# Roadmap

This file owns the maintained shared skills, their distribution and updates, compatibility work and package-local questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed application features and host-level validation. Repository policy and adoption are not another completion checklist here.

## Built

- [x] A shipped `pr-description` skill and selection through `package.json.shivaedevSkills`.
- [x] Ordinary repository copies of selected skill folders, including supporting files, and relative Claude compatibility links to the same content. Sync requires symlink creation; its failure stops the operation.
- [x] A manifest recording package version, copied-folder hashes and package ownership of names.
- [x] Sync replacement of managed copies, removal of deselected managed skills, coexistence with local skills and refusal of unowned name collisions before changes begin.
- [x] A check for missing manifest or copies, changed installed version, selection differences and copied-file edits, additions or removals.
- [x] CLI coverage using the shipped skill and a packed executable case that checks its copied files and version.
- [x] An opt-in pnpm GitHub Actions template for syncing shared skills on same-repository pull requests. Its configuration is present; live GitHub permissions and pushes are not validated by the package tests.

## Next

- [ ] Make the core copying/update path reliable when a host cannot create or load the Claude compatibility link. Keep ordinary `.agents/skills/` content primary, decide the compatibility behavior below and test its failure path.
- [ ] Validate discovery of committed copies in the cloud agent hosts the maintainer actually uses before documenting a supported host matrix.
- [ ] Add focused tests for the existing helper validation paths, including malformed selection and manifest files.
- [ ] Add a test of the workflow configuration before making stronger claims about its composition. Hosted execution remains a separate validation task.

## Open questions

- Should an unavailable Claude compatibility link stop syncing ordinary files, become optional, or be replaced by another host-specific path? The intended delivery is directly readable repository content, while sync currently requires symlink creation. Tests prove the successful link path, not the right behavior when a host cannot create it.
- Is `check` intentionally limited to the manifest's names, version and copied-folder hashes, or should it also compare the installed source at the same package version and verify Claude links? The implementation establishes the narrower check; tests do not establish why that boundary was chosen.
- Are the helper modules exposed by the wildcard export map intended as supported integration APIs, or should the package keep its public surface to sync, check and the executable? Existing adoption uses the executable; tests use the helpers.
- Which of the maintainer's shared instructions should join `pr-description` next? The package owns the maintained collection as well as delivery; the next skill and its adoption need remain the maintainer's choice.
