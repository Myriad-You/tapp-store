# 回声剧场方案 3 设计 QA

- source visual truth: selected theatre concept and the repository-owned artwork under `assets/`
- repository visual assets reviewed:
  - launcher: `assets/launcher/echo-stage-library.png`
  - theatre cover: `assets/demo/echo-theatre-stage.png`
  - observatory cover: `assets/starlight/echo-theatre-starlight.png`
  - station and observatory scene backgrounds under their respective sample directories
- implementation evidence: iterative real-Myriad captures covering launcher, player, dual repertoire, light theme, expanded/restored layout, CSS-only Loading, editor feedback and AI result rendering
- target viewport: source concept 1440 × 1024; real Myriad app content approximately 1152 × 843 after excluding host chrome
- pixel dimensions: source 1487 × 1058; initial library screenshot 1159 × 895; revised library screenshot 1194 × 907; player screenshot 1228 × 903
- density normalization: concept was judged proportionally against the visible Myriad Page content; host title bar and desktop area outside the Page were excluded from layout findings
- state: simplified Chinese; library home and opening narration of the built-in story
- primary interaction evidence: built-in stories, local package loading, editor generation, AI scene rendering, player controls, saves and host expansion were exercised in real Myriad
- final runtime evidence: the installer tested package `0.1.4` in real Myriad and reported all tested flows normal on 2026-08-24

**Full-view comparison evidence**

- The source, real library and real player screenshots were opened together in one comparison input.
- The generated stage asset, woman/station crop, midnight-blue and antique-gold palette, serif hierarchy and bottom repertoire layout all survive the real Myriad render.
- Myriad's title bar and safe areas do not overlap the app-owned brand, central action or player toolbar. No document scrollbar or clipped persistent control is visible.
- The player intentionally uses the story package's current background rather than keeping the library curtain asset; this is a product constraint, not design drift.

**Focused region comparison evidence**

- Center title stack: title scale and color match the concept, but the first implementation compressed the vertical gaps from act cue through opening action.
- Bottom actions: both local-folder and repertoire information remain visible inside the generated frame; text is legible and not clipped.
- Player toolbar/dialogue: gold borders and ivory text are consistent with the library; the empty station opening is intentional narrative composition.

**Findings**

- [P1] Loading 与加载后的启动器占用不同的 Page 根边界。
  - Location: `.loading-layer`, `.echo-app`, `.library-view`.
  - Evidence: 同一浅色扩大态中，固定 Loading 覆盖完整宿主 Page；隐藏后启动器四周重新露出深色背景，证明宿主扩大状态未变而内容根发生收缩。
  - Impact: 用户看到加载阶段正确、完成阶段退回嵌入式窗口，视觉上等同于扩大适配失效。
  - Fix applied: 内容根改为 `position: absolute; inset: 0`，显式重置 margin、padding、最大宽度、边框和圆角；安全区仍由内部视图消费，并新增加载后根边界回归。

- [P1] 浅色宿主扩大态没有滚动，但启动器主体仍停留在普通窗口的上部窄列。
  - Location: `.library-scroll`, `.launcher-layout` and expanded/low-height media queries.
  - Evidence: supplied expanded screenshot shows the Page boundary filled correctly while the lower half and both sides remain largely unused.
  - Impact: the launcher reads as an undersized embedded card instead of a host-expanded Tapp; removing scroll alone did not complete expanded-state adaptation.
  - Fix applied: retained the host-owned percentage height chain, changed the single internal scroller to a three-row Grid, centered the launcher in remaining height, added a combined wide-and-tall breakpoint, and restored top alignment for low-height windows.

- [P2] Loading reused the header ripple bitmap as a large pale rectangle without adding progress meaning.
  - Location: `#loading-layer`, `loadLibraryAssets()` and the launcher decoration load order.
  - Evidence: supplied light-theme Loading screenshot exposes the raster bounds above the native progress indicator.
  - Impact: the image looked unfinished and made a decorative asset part of the critical startup decode path.
  - Fix applied: replaced the Loading image with three CSS echo rings plus the existing native progress/title/detail, and moved the header bitmap to an asynchronous post-launcher decoration load without awaiting `decode()`.

- [P1] Dual-repertoire library used a viewport height larger than the expanded iframe.
  - Location: `html`, `body`, `.echo-app`, `.library-view`, `.player-view`.
  - Evidence: the supplied expanded-state screenshot shows the local-directory footer cut by the physical bottom edge and a vertical scrollbar despite the library being a single-screen composition.
  - Impact: users must scroll to reach persistent entry controls, and the generated theatre frame no longer aligns with the Page viewport.
  - Fix applied: replaced every remaining `100dvh`/minimum document height with a continuous `height: 100%`, `min-height: 0`, `overflow: hidden` iframe-height chain; added a regression that rejects `100dvh` in this single-screen Page.

- [P2] The theatrical cue stack was vertically compressed.
  - Location: `.act-label`, `.featured-description`, `.scene-number`, `.featured-actions`.
  - Evidence: the first real render grouped `第一幕`, title, description, `SCENE 01` and `开场` tightly in the upper-middle, while the selected concept used negative space to create a slower cinema-title rhythm.
  - Impact: the implementation felt more like a conventional hero section and less like a stage opening.
  - Fix applied: increased the four vertical rhythm intervals while retaining the existing low-height compact media query.

- [P2] The `/ 01` total was unsupported decorative data.
  - Location: library scene marker and static preview.
  - Evidence: the engine has no scene-count model, so displaying a total of one implied information the runtime does not know.
  - Impact: fake specificity reinforced the AI-mockup feeling the redesign was meant to remove.
  - Fix applied: retained the repertoire marker `SCENE 01` and removed the invented total.

- [P2] Dialogue surface was visually heavier than the scene.
  - Location: `--echo-panel` and `.dialogue-panel`.
  - Evidence: the real player screenshot showed the panel as an almost solid black block over the station.
  - Impact: it reduced the background's role in visual-novel composition.
  - Fix applied: reduced the panel alpha from 0.90 to 0.72 and added bounded in-document blur while retaining ivory text and shadow contrast.

- [P2] Controls and Loading lacked the selected theatre finish.
  - Location: primary, secondary, toolbar, advance, choice and loading controls.
  - Evidence: real buttons read as plain bordered rectangles, while Loading exposed only text despite representing asynchronous image decoding and package inspection.
  - Impact: interaction states felt less finished than the library artwork.
  - Fix applied: unified restrained gold borders, subtle inset/elevation, hover motion and active color; added an accessible native indeterminate progress element on a translucent stage overlay.

**Required fidelity surfaces**

- Fonts and typography: Chinese serif fallback renders clearly; brand/title scale, weight and letter spacing are consistent with the target.
- Spacing and layout rhythm: frame crop and safe-area offsets pass; the revised Myriad library screenshot confirms the expanded cue-stack rhythm and removal of the fake total.
- Colors and visual tokens: midnight navy, warm ivory and antique gold match; control contrast is adequate in both supplied states.
- Image quality and asset fidelity: the real raster theatre background is sharp and correctly cropped; the player correctly swaps to package backgrounds. No CSS/SVG substitute is used for the selected decorative asset.
- Copy and content: app-specific copy is coherent; the invented scene total was removed.

**Implementation Checklist**

- Automated checks cover the full-height root chain, safe-area ownership, theme tokens, reduced motion, feedback dismissal, local package boundaries, parser safety, AI task result normalization and package closure.
- Real-Myriad review covered startup Loading, launcher, player, editor, AI text/image completion, local game loading, host expanded/restored layout and the final full-width dismissible feedback treatment.
- The installer confirmed the `0.1.4` package completed the tested flows without a remaining blocking issue.

**Follow-up Polish**

- No blocking P1/P2 issue remains in the reviewed `0.1.4` package. Future visual polish should remain non-blocking and preserve the validated host boundary and safe-area behavior.

**Comparison history**

1. Initial evidence found compressed center rhythm and an invented scene total.
2. CSS spacing was expanded and `/ 01` removed.
3. Revised Myriad library evidence confirms both fixes without overflow or safe-area regression.
4. User review then requested a lighter dialogue surface, more refined controls and non-text-only Loading; all three were implemented and automatically validated.
5. Post-fix Loading/player review confirmed that the newest refinements render inside the real host boundary.
6. The first dual-repertoire expanded screenshot exposed `100dvh` overflow; the percentage-height-chain fix was subsequently validated in expanded and restored states.
7. A later light-theme expanded screenshot exposed poor content-density distribution; Grid-based remaining-height allocation and the combined width/height breakpoint were then confirmed in real Myriad.
8. The same review exposed a redundant raster inside Loading; Loading is now CSS-only and the retained launcher decoration no longer blocks first paint.
9. A direct before/after expanded-state comparison proved the fixed Loading masked a constrained normal-flow Page root; the content root now owns the same full Page boundary and has passed real-Myriad regression.
10. Version `0.1.4` completed final installer regression on 2026-08-24 with no reported blocking issue.

final result: passed
