# VR GLB release with Piyomi — 2026-09-09

## VR headset and supplied Piyomi release — 2026-09-10

### Final status
DONE

### Changes / files changed
- `assets/characters/piyomi.glb`: included the supplied update unchanged.
- `assets/props/vr-headset.glb`: included the supplied headset unchanged.
- `src/characters/model.js`, `src/characters/vr-gltf.js`, `src/main.js`: load the headset only into the existing head-attached VR group. The existing animation visibility switch, head movement and character dimensions remain in place.
- `tests/vr-headset-gltf.test.js`: verifies the supplied headset remains head-attached for all three residents.

### Validation
- `npm.cmd test`: PASS — 26 passed, 0 failed.
- `npm.cmd run build -- --base /chikipiyo-life-web/`: PASS. Production output contains `piyomi-DBcO-02r.glb` and `vr-headset-CDrAEWUL.glb`.


## Supplied Piyomi asset release — 2026-09-09

Updated `assets/characters/piyomi.glb` for the supplied revision. The incoming GLB included meshes outside the required six rigid parts, so it was normalized to the existing Web contract (`Body`, `Head`, `Wing_L`, `Wing_R`, `Leg_L`, `Leg_R`) before release. No source code or other asset is changed for this update.

## Final status
DONE

## Piyomi model repair — 2026-09-09

The previous Piyomi export applied an extra head-height offset, causing the visible model to break apart. Rebuilt `assets/characters/piyomi.glb` from the supplied blend's existing `piyormi` meshes, with its six rigid parts authored at their matching Web pivots. The corrected asset spans floor `y=.01` to `y=1.073`; the broken asset's head extended to `y=1.703`.

`model-work/export_piyomi_web.py` records the repeatable export. `tests/character-gltf.test.js` now guards against the duplicate vertical offset while retaining the existing six-part and attachment checks.

## Changes / files changed
- `assets/furniture/vr.glb`: used the user-supplied updated VR furniture model.
- `src/world/furniture-gltf.js`: loads only the VR GLB and preserves the established furniture group, placement and click ownership.
- `src/main.js`: makes the production asset URL available to that bounded loader.
- `tests/furniture-gltf.test.js`: verifies the supplied VR GLB replaces only its rendering while retaining its installation origin and click target metadata.
- `CODEX_REPORT.md`: this report.

## Validation
- `npm.cmd test`: PASS — 23 passed, 0 failed.
- `npm.cmd run build -- --base /chikipiyo-life-web/`: PASS. The production output contains `piyomi`, `chicken`, `piyokichi`, and the updated `vr` GLBs.
- Production preview opened at `/chikipiyo-life-web/` before publication.

## Scope / limitations
The updated VR model replaces only the visual children of the existing VR furniture group. Its world position, action anchor, click behavior, house, camera and all other furniture remain unchanged. The Piyomi implementation from the preceding commit is included in this release. Unrelated working-tree changes were preserved.

# Optional GLB character adapter — 2026-09-09

## Final status
DONE_WITH_NOTES

## Changes / files changed this request
- src/characters/gltf.js: GLTFLoader loading, rigid named-part validation and neutral-pose attachment to existing pivots. Missing/broken/unsupported files retain procedural visuals.
- src/main.js: optional Vite asset discovery and async visual loading only; simulation setup unchanged.
- assets/characters/.gitkeep: asset placement directory for chicken.glb and piyokichi.glb.
- tests/character-gltf.test.js: missing/failing loader, invalid structure, real in-memory binary GLB parsing and loading during sleep for both characters; checks original rig/VR identity and neutral transforms.
- README.md: file paths, rebuild instructions, six named rigid parts, axes, pivots, sizing, VR and limitations.
- CODEX_REPORT.md: this report.

## Contracts
Procedural model generation, root position/rotation/scale, original head/wing/leg groups, props, VR, interaction anchors and all action/animation code unchanged this request. Adapter hides original visual children only after full structural validation. Imported parts are bound in neutral rig coordinates even if the current rig is sleeping or walking. Body reference remains the original internal procedural anchor; new visible body is under the same rig.

## Validation
- npm test: PASS, 15 tests, 0 failures (11 existing + 4 adapter cases).
- npm run build: PASS, Vite 7.3.6, 21 modules, 1.13s. Nonfatal chunk warning: 653.99 kB JS / 172.36 kB gzip.
- Browser production preview http://127.0.0.1:4173/: both procedural characters rendered without GLBs and autonomously walked toward desk/kitchen; Japanese UI present.
- Development browser on 5173/5175 remained blank in this session, with no captured console errors; production preview succeeded. The development-browser issue was not conclusively diagnosed.
- GLB success path verified with real GLTFLoader parsing an in-memory binary fixture, not a finished Blender character (none provided).

## Limitations / Claude review focus
Only six independent rigid parts (Body, Head, Wing_L/R, Leg_L/R) are supported to preserve current limb animation. Skinned armatures, embedded animation playback and compressed asset decoders are not supported. GLBs must be authored to documented neutral coordinates/dimensions; no automatic normalization or contact fitting. Review final Blender asset fit for VR, sleeping and sitting after delivery. Asset load errors are recorded on character.visualLoadError; no new UI added. Existing unrelated working-tree changes were preserved. Earlier review excluded GLTF conversion, but this latest explicit user request authorizes this bounded adapter.

---

# Character silhouette redesign — 2026-09-09

## Final status
DONE_WITH_NOTES

## Changes / files changed this request
- `src/characters/model.js`: rebuilt character appearance from drawn outlines using custom inflated BufferGeometry, thin extruded shapes and a continuous hood rim. Preserved root/rig/head/limb pivots, returned rig keys, props and VR code.
- `CODEX_REPORT.md`: this report, earlier reports retained below.
- No changes this request to animation.js, config, tests, house, furniture, camera, UI, movement, actions or sleep mechanism. Pre-existing changes from earlier turns remain.

## Appearance
- Piyokichi: wider dominant head, compact lobed body overlapping the head, planar black eyes and triangular beak, thin small wing silhouettes, one swept crest, simplified flat zigzag legs/feet and silhouette tail.
- Chicken: broad round hood, recessed skin face inside a continuous white opening rim, flat three-section blunt fringe, horizontal line eyes, scalloped external red comb, short lobed white suit body and thin costume wings. Removed anatomical toes.
- Head pivots remain 1.01 / .69. Arm and leg pivots, VR parent/size/position, all prop offsets and root transforms remain unchanged. Grounding and size-ratio tests still pass.

## Validation
- `npm test`: PASS, 11 tests, 0 failures, including grounding, original VR anchors, all real-model furniture arrivals, relative size, sleep orientation/containment for four approach yaws and return from sleep.
- `npm run build`: PASS. Existing non-fatal warning for JS bundle exceeding 500 kB remains.
- Browser: rendered actual imported models at identical scale in front, oblique and back views in a temporary review page. Corrected the initially visible applied-plate hood edge into a continuous curved rim and increased head/body overlap after inspecting it. Verified final three views and actual application rendering with original camera. Temporary review page removed after verification.

## Self-review / limitations / Claude review focus
- Front silhouette now reads as a human face in a white chicken hood and a big-headed compact chick; face, feather/wing outlines and zigzag feet are graphic rather than anatomical.
- Compared with sheet: original hand-drawn irregularities are simplified; default chick uses neutral dot eyes rather than expressive chevrons. Comb is a rounded extruded strip and remains flatter across its width than the drawing's front-view dome. Head/body shading still reveals some separation in 3D despite silhouette overlap.
- Review side/back hood curvature, swept crest and tail thickness, plus full-cycle prop fit with unchanged accessory anchors. Three-view review covers static appearance; existing tests cover transforms/behavior, not every animation's visual contact.

---

# Character appearance and sleep refinement — 2026-09-09

## Final status
DONE_WITH_NOTES

## Changes / files changed
- `src/characters/model.js`: smaller piyokichi head, torso, wings, beak, tail and finer swept crest; rounder chicken hood, circular face opening, visible skin, fitted fringe, clearer red comb, rounder torso and finer bird feet.
- `src/characters/animation.js`: sleep-only support height for piyokichi reduced from 1.14 to 1.065 to match its smaller head depth. Existing world-Z alignment, approach-yaw cancellation and pillow head anchor were already correct and retained.
- `tests/character-model.test.js`: updated head-height expectation and strengthened relative-size thresholds (height <75%, width <80%).
- `CODEX_REPORT.md`: this report; earlier reports preserved below.

## Dimensions / preserved behavior
- Visible standing height: chicken 1.505, piyokichi 1.12482 (74.7%); width: .88 / .62 (70.5%). Both soles remain y=.01.
- Piyokichi head pivot .78 -> .69; torso center .41 -> .365; wing pivot .53 -> .45. Root, leg pivots and VR attachment positions unchanged.
- No changes to house, furniture, camera, reel, build plate, simulation, UI or non-sleep animation branches.
- Latest explicit user request authorizes smaller proportions and sleep correction beyond the earlier review's conservative size guidance. CURRENT_TASK.md and CLAUDE_REVIEW.md were read and not modified.

## Tests / build
- `npm test`: PASS, 11 tests, 0 failures. Includes real-model furniture arrival, grounding, size difference, sleep pillow alignment and bed containment across four approach yaws for both characters, and reset after sleep.
- `npm run build`: PASS, Vite 7.3.6, 18 modules, 1.52s. Non-fatal >500 kB bundle warning (552.63 kB JS).
- `npm run dev -- --port 5173`: local browser verification server.

## Browser verification
- Opened the actual app at http://127.0.0.1:5173/ with its unchanged default camera.
- Observed clear size difference, white rounded chicken costume with skin/fringe face, and yellow chick with small body and swept crest while walking.
- Issued bed command to chicken, observed sleep with head on pillow side and body along bed within its edges.
- Moved chicken to sofa, selected piyokichi and issued bed command; observed the smaller chick sleeping in the same correct direction on the pillow side.

## Limitations / Claude review focus
- Character sheet translated into rounded 3D geometry; not an exact traced model. Default camera's rails partially occlude details, and close-up turntable inspection was not performed.
- Review fringe/skin overlap and small-character accessory fit throughout non-sleep animations. Their existing logic and VR offsets were intentionally preserved.
- Build bundle warning remains. Existing unrelated working-tree changes to review/manager/setup files were untouched.

---

# CODEX IMPLEMENTATION REPORT

## GitHub Pages deployment task — 2026-09-09

### Final status
BLOCKED — destination confirmed as https://github.com/niwanotorico/chikipiyo-life-web (empty public repository, default branch main). Origin is configured and local commit 50f77a7 contains the current application, tests and Pages workflow. `git push -u origin master:main` has been started but is waiting for Git Credential Manager authentication; no successful push or public deployment has been verified. Pages settings have not yet been changed. The in-app browser is signed out of GitHub.

### Repository connection follow-up
- Preserved the local master branch and existing baseline history; the push targets remote main without force.
- Committed current application changes and tests alongside deployment configuration. Unrelated local changes to CLAUDE_REVIEW.md, manager-loop-v2.ps1 and the SETUP_BASELINE.ps1 deletion remain uncommitted and untouched.
- Re-ran `npm.cmd test`: 11 passed. Re-ran `npm.cmd run build -- --base /chikipiyo-life-web/`: passed, same non-fatal chunk warning.
- Expected public URL after successful deployment: https://niwanotorico.github.io/chikipiyo-life-web/ . This is not yet a verified live site.

### Changes / files changed
- `.github/workflows/pages.yml`: default-branch-only deployment on main/master pushes or manual dispatch, Node 22, npm ci, tests, Pages-derived build base, dist artifact upload and deployment. Official action revisions are pinned. Deployment permissions are limited to the deploy job.
- `README.md`: Pages setup, deployment trigger, phone controls and local subpath preview instructions.
- `CODEX_REPORT.md`: this task report; previous implementation report retained below.
- Application source, dependencies and existing local changes were preserved. CURRENT_TASK.md and CLAUDE_REVIEW.md were read and not modified; their APPROVED_WITH_NOTES review concerns the earlier character task. The latest user request authorizes Pages configuration.

### Tests / build commands and results
- `npm.cmd test`: 11 passed, 0 failed.
- `npm.cmd run build`: passed, Vite 7.3.6, 18 modules.
- `npm.cmd run build -- --base /chikipiyo-life-web/`: passed.
- `npm.cmd run preview -- --base /chikipiyo-life-web/ --port 4187 --strictPort`: started successfully; Node fetch verified HTML and both generated JS/CSS assets with HTTP 200 under the Pages subpath and correct asset content types. Preview process stopped afterward.
- `git diff --check`: reported existing trailing blank lines in src/characters/animation.js, src/ui.js, src/world/furniture.js and src/world/house.js; these files were not changed in this task.

### Limitations / Claude review focus
- No live GitHub Actions run, public URL or physical smartphone verification yet. Destination repository and Pages Source = GitHub Actions must be configured before deployment.
- Existing >500 kB JavaScript chunk warning remains (552.55 kB, gzip 144.39 kB); build succeeds. Existing mobile CSS and touch controls were preserved, not visually revalidated in this task.
- Review workflow permissions, default branch gate, Pages base_path interpolation and initial Pages setup against the destination repository. Only dist is uploaded as the website artifact.

---

## Previous implementation report

## Final status
DONE_WITH_NOTES

## Scope and authority
Implemented the user's latest request in the existing project. CURRENT_TASK.md and CLAUDE_REVIEW.md were read; review approval is APPROVED_WITH_NOTES. Their earlier character-only scope is superseded by the user's explicit request to also update the house and furniture layout. Neither document was edited. No new project or dependency was created.

## Changes / files changed
- src/world/house.js: substantial mint enclosure, large left yellow filament reel, horizontal X rails, right print head/nozzle, continuous filament tube, warm walls/windows, central rug. Supports remain outside the walk grid.
- src/world/furniture.js: kitchen/dining left, sofa and VR low table centrally, desk/build plate right. Existing bed retained at front left. Furniture and interaction spots translated together; original relative offsets and facing are retained. Desk/build plate and VR table footprints expanded to cover their visual bounds. Build plate is part of the existing desk click target and retains its read action; no printing action added.
- src/characters/config.js: names changed to ちきん/ぴよきち, separate appearance variants/colors; IDs, starting positions, personalities unchanged.
- src/characters/model.js: white chicken costume with human face, dark straight fringe, horizontal eyes, red crown/rear comb; yellow chick with a single swept tuft, small beak; both have wings, tail and yellow bird feet. No piyomi.
- src/ui.js: only the initial selected-name text now reads characterDefinitions name. UI layout and controls unchanged.
- tests/character-model.test.js: actual-model anchor and action integration coverage, furniture raycast ownership.
- CODEX_REPORT.md: this report.

## Preservation / measurements
- src/simulation/*, src/characters/animation.js, src/main.js, src/style.css and existing tests/life.test.js unchanged.
- Root transform/start, head pivot y=1.01, body center y=.51 and radii [.32,.38,.27], arm/leg pivots, book/food/broom attachment offsets unchanged.
- VR remains a head child at [0,.025,.34], same dimensions; no attachment offset change.
- Standing foot minimum y=.01, equal to the original floor top. Original measured full height including comb was 1.505 (the review's 1.37 excluded the comb).
- Furniture-relative spots and animation offsets preserved, including bed/sofa. All 49 furniture-to-furniture routes remain reachable. Both real character models can reach every furniture action from their original starting positions.
- Expanded obstacle footprints are spatial data updates; pathfinding, autonomous selection, reservation and action state machines were not changed.

## Commands / results
Final `npm.cmd test` (Windows equivalent of npm test): 8 tests, 8 pass, 0 fail, duration 247 ms.
Covers real model floor/VR anchors, all action animation transforms and visibility, 14 actual-model furniture commands, raycast IDs, mutual reachability, reservations, pause/resume.
Final `npm.cmd run build` (npm run build): success, Vite 7.3.6, 18 modules transformed, 844 ms. JS 534.16 kB / gzip 137.56 kB. Non-fatal >500 kB chunk warning remains.
`npm.cmd run dev -- --port 5173`: existing port occupied; verification server started at http://127.0.0.1:5174/.

## Browser verification
Rendered the updated scene in the browser. Observed both characters autonomously moving/acting and the clock advancing, including eating and sleeping status. Clicked the sofa directly in the 3D canvas and verified the sofa action popover, then issued the command. Verified VR selection and movement-command event, pause/resume status, and camera drag rotation. No UI layout changes introduced.

## Differences / limitations
- Reference is translated to simple rounded Three.js geometry, not photographic fidelity. Reel winding, filament, rails and head are static; lighting remains the existing renderer/light setup. Fine fabric, tools, plants and dense decor omitted for clarity and geometry cost.
- Kept original camera and spacious floor plan, so framing is more elevated/open than the frontal key visual; rails can obscure parts of furniture at some angles.
- Build plate is compact enough to fit beside the right desk and stay within the existing room; bed retained for sleeping functionality although absent in the key visual.
- Character height differences are intentionally subtle to preserve existing animation/bed dimensions. Tuft and rear comb use overlapping smooth forms; no custom mesh or exact traced silhouette. Default chick expression uses the sheet's neutral dot eyes.
- Tests establish reachability, transform/attachment contracts and action transitions, not pixel-perfect contact. Exhaustive close-up front/side/back checks of every animation pose, VR fit throughout its full cycle, zoom and right-button pan were not performed. Existing bed/sofa pose offsets are preserved rather than corrected or redesigned.

## Claude review focus
Review face/fringe and rear silhouette, full-cycle VR fit, bed/sofa contact, revised clearances near the left dining/bed area, and the build plate/desk shared footprint. Compare against the reference while keeping the existing action contracts. Unrelated pre-existing working-tree changes (review, manager scripts, deleted setup script) were left untouched.

# 2026-09-09 Existing Blender → six-part GLB delivery

Final status: DONE_WITH_NOTES

## Scope and changes
The latest user request supersedes the earlier procedural-model implementation scope: GLB assets and review renders only. No Web source, CURRENT_TASK.md, or CLAUDE_REVIEW.md was changed in this task. Existing working-tree edits were preserved. The original references/ここからチキンズ_2026_09.blend was opened read-only and never saved over. Source SHA256: 7DFE8BCBBFBA5D1D092792742DC56A6151B1BC5EBEC4906554A1BE0D0CEE3D94.

Every visible mesh derives from chicken_main (+ .001/.002/.003) or piyokichi in that blend. No replacement character was generated. Connected source components were partitioned into rigid groups; source bones and animations were excluded. One subdivision level smooths the retained topology. provenance.json records the exact source/component-to-part mapping.

Adjustments: chicken uniform scale .96, head width +17%, head down .045, lower face extended to close the hood gap, internal neck material white, original wings lowered 52 degrees. Piyokichi uniform scale 1.25, original wings reduced/lowered, beak reduced to 64% about its local center, original crest turned 48 degrees to read from front and side. Materials converted to simple self-contained rough PBR colors. Original fringe, eyes, combs, body lobes, feet, and tails retained.

## Files changed/created
- assets/characters/chicken.glb (781,156 bytes)
- assets/characters/piyokichi.glb (690,220 bytes)
- model-work/chicken_piyokichi_web.blend: working derivative; separate WEB_chicken / WEB_piyokichi collections, chicken visible initially. Original rig remains available in the untouched source blend.
- model-work/renders/: eight 640 x 640 PNGs, front / three-quarter / side / back for each character, equal camera scale.
- model-work/review.html: render gallery.
- model-work/build_models.py, inspect_source.py, source-components.json, provenance.json, validate_glb.mjs, validation.json, build.log: reproducible derivation, component inventory, and validation records.
- CODEX_REPORT.md: this appended report, previous reports preserved.

## Web contract and measurements
GLBs contain exactly Body, Head, Wing_L, Wing_R, Leg_L, Leg_R, with no skins or animation clips. +Y up, +Z front, global origin zero; both soles min Y=0.010000005. Blender +Z up / -Y front converts on export. Wing_L and Leg_L denote -X, matching the current loader.
Head pivots: chicken (0,1.01,0), piyokichi (0,.69,0). Wings: chicken (+/-.30,.67,0), piyokichi (+/-.195,.45,0). Legs: chicken (+/-.14,.25,0), piyokichi (+/-.11,.25,0). Body pivot zero. Geometry offsets absorb grounding; no Web anchor edits.
Chicken max Y=1.40310, width=.82188, depth=.69596; piyokichi max Y=1.11781, width=.63897, depth=.78541 (including beak and tail).

## Checks and results
- Blender 5.2 --factory-startup background source inspection and build_models.py: successful exports, all eight renders, derivative blend saved.
- node model-work/validate_glb.mjs: PASS for both actual final GLBs using Three.js GLTFLoader and existing installCharacterVisual. Verified six required parts, no skins/clips, floor bounds, successful installation.
- npm.cmd test: 15 passed, 0 failed.
- npm.cmd run build after final exports: PASS; both GLBs included in dist. Existing >500 kB JavaScript chunk warning remains.
- Visually inspected all eight final PNGs. Face/hood gap corrected; swept crest visible from front, side, and back.

## Limitations and Claude review focus
- Kept piyokichi's original >< expression, matching the sheet's large front drawing; this intentionally differs from the older review's suggested neutral dot eyes.
- Source body/hip lobes and volumetric feet remain more sculpted than the flat sheet. Keeping existing geometry took priority over replacing the whole silhouette. The crest is diagonally oriented to remain readable in multiple views.
- Rigid segmentation does not retain the source's deforming armature. Web animation/furniture/VR contact was not visually tested in the running Web scene, per the GLB-only scope. Loader and unit checks do not establish those contacts. Review wing swings, head turns, seated hip volume, bed and VR fit before any later integration adjustments.
- The source meshes retain some sculpted surface irregularities; these are visible in rear lighting and were not redesigned.
- Placing the assets in the existing configured folder makes them discoverable by the already-present Web loader/build without code edits. Nothing was deployed.

# 2026-09-09 Sofa orientation and Pages release

<!-- Furniture export report is appended below; prior release report retained. -->

## Work Performed

- Treated `assets/characters/chicken.glb` and `assets/characters/piyokichi.glb` as supplied, final assets. Their contents were not modified.
- Changed only the sofa's `face` target from `Math.PI` to `0`. The sofa backrest is at local/world -Z and character fronts are +Z, so this makes both characters face toward +Z and keep their backs toward the backrest. The existing seat point `[.6, 0, 1.25]` is unchanged.
- Added a regression test that exercises both character definitions while relaxing and asserts the sofa target rotation is zero.
- Limited Vite's GLB import list to the two current assets, excluding local `*_old.glb` backups from the production bundle.
- No responsive CSS change was needed: the existing mobile rules passed a 390×844 interactive check without horizontal overflow.

## Files Changed

- `src/world/furniture.js`
- `src/main.js`
- `tests/character-model.test.js`
- Existing GLB integration files and the two supplied current GLBs are included in the release commit. Local `*_old.glb`, `model-work/`, and source `.blend` files are excluded.

## Validation

- `npm test`: PASS — 16 tests passed, 0 failed. This includes both characters' sofa-facing regression test.
- `npm run build`: PASS.
- `npm run build -- --base /chikipiyo-life-web/`: PASS. Only `chicken.glb` and `piyokichi.glb` were emitted.
- Served that Pages-base build at `/chikipiyo-life-web/`: PASS. Both latest GLB visuals, controls, and furniture panel appeared correctly.
- Interactive 390×844 check: 3D view visible; document/body width 375px with scroll width 375px; furniture action dialog, pause/resume, drag rotation, and zoom were exercised. No unintended horizontal scroll occurred.

## Known Limitations

- The intentional JavaScript bundle-size warning (>500 kB) remains unchanged.
- Production deployment verification is recorded after GitHub Actions completes.

## Final Status

DONE

# Piyomi resident and furniture anchors

## Work Performed

- Added `piyomi` as the third resident using the existing `piyormi` Blender meshes and the character sheet as references. The resulting rigid GLB is `assets/characters/piyomi.glb`; existing chicken and piyokichi GLBs were not changed.
- Added the third definition, avatar, asset lookup, and UI card. Piyomi shares autonomous simulation and all existing furniture/action routes.
- Kept the sofa facing direction and raised the relax pose from `rig.position.y=.35` to `.48` so all three bodies meet the cushion. The bed sleep anchor and corrected pillow orientation remain unchanged.
- Updated visible labels to `トリ家族のおうち` and `ちきんとぴよこたちはきままにやっています`. Added the pink piyomi avatar styling.

## Files Changed

`src/characters/config.js`, `src/characters/gltf.js`, `src/main.js`, `src/characters/animation.js`, `src/ui.js`, `src/style.css`, `tests/character-gltf.test.js`, `tests/character-model.test.js`, and `assets/characters/piyomi.glb`.

## Validation

- `npm test`: PASS — 22 tests passed, 0 failed, including three-resident GLB, sofa cushion, and bed contact checks.
- `npm run build`: PASS. Production output includes chicken, piyokichi, and piyomi GLBs.
- Browser check at 127.0.0.1:5175: three resident cards and 3D characters visible; requested title and free-text visible; piyomi sofa action and bed action dialog exercised.
- Piyomi GLB inspection: six rigid required parts, pink cheek material `#ffaac8`, and no armature/animation dependency.

## Known Limitations

The sofa and bed contact checks use geometry bounds and the existing action anchors; the browser camera view can partially occlude characters behind the room rails. Existing furniture, room, 3DP mechanism, camera, and the chicken/piyokichi GLBs were preserved.

## Final Status

DONE_WITH_NOTES

# Furniture GLB export for Blender editing

## Changes
Exported current procedural furniture without modifying application code or character GLBs. Seven individual files use local installation origins; furniture-layout.glb preserves current room placement. All 69 meshes retain their geometry and PBR materials, with stable part names for editing. No deployment or commit was performed for this export.

## Files
- scripts/export-furniture.mjs
- assets/furniture/{bed,sofa,table,kitchen,fridge,vr,desk,furniture-layout}.glb
- assets/furniture/layout.json and README.md
- CODEX_REPORT.md

## Validation
- node scripts/export-furniture.mjs: all eight GLBs exported and reloaded; mesh counts and geometry bounds match the source.
- Blender 5.2 factory-startup import of furniture-layout.glb: PASS, 69 meshes.
- npm test: PASS, 16 tests.
- npm run build: PASS; existing bundle-size warning remains.

## Limitations / Claude review
These are editing exports, not a furniture loader implementation. Edited GLBs do not automatically update the Web app. Desk includes the adjacent build plate; VR includes its table. Preserve installation origins, scale, and interaction heights when editing. The exporter overwrites its output filenames when rerun, so edited copies should be saved separately.

## Final Status
DONE
