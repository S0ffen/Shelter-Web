# Project tools

The game builds and runs from the committed runtime assets. None of these preparation tools is required to start a downloaded checkout.

| Tool | Purpose |
| --- | --- |
| `Verify-Milestone.ps1 -Stage <name>` | Run client tests, client build, server build and HTTP/SQLite checks. Writes local reports to `verification/`. |
| `render-current-layout.py` | Draw the current map from the shared gameplay layout. |
| `generate-reference-map.py` | Recreate the initial map data from the supplied reference layout. This overwrites generated layout data; use only when deliberately changing the map source. |
| `place-reference-resources.py` | Generate resource placement for the reference layout. |
| `prepare-enemy-models.ps1` | Optimize the locally supplied enemy models, then add their rigs and animations with `model-tools/`. |
| `prepare-environment-textures.py` | Convert locally supplied 4K materials to browser-ready 2K maps. |

Model preparation dependencies are pinned in `model-tools/package-lock.json`; install them with `npm ci --prefix scripts/model-tools`. Texture preparation requires Python, Pillow, NumPy and OpenCV with OpenEXR support.

Original model/texture downloads in `/models`, duplicate soundtrack downloads in `/music`, extraction/research scripts, Python caches and all `/verification` outputs stay local and are ignored by Git. Runtime models, textures, music and the two sound effects actually used by the game are committed under `client/`.

Older CSNZ archive readers and audio-extraction experiments may remain in this folder locally. They are not part of the maintained tool set or a game build.
