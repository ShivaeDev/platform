### Fixed

- Share the navigation query between route loaders and the React shell instead of requesting the workspace tree again for each selected file. Document navigation shows the new document or a loading message as the URL changes, and returning before a read completes cannot display that late result over the returned page or overwrite its saved reading details.
- Opening unchanged indexed documents reuses their parsed metadata and workspace model. Backlinks are resolved once per model instead of scanning every document's links on each open; the selected source is still read to detect edits before watcher notification.
