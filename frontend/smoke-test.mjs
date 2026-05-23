import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const sourceFiles = [
  "index.html",
  "workspace.html",
  "compare.html",
  "scenes.html",
  "styles.css",
  "app.js",
];

async function readSource(file) {
  return readFile(path.join(root, file), "utf8");
}

test("product pages and shared assets exist", async () => {
  for (const file of sourceFiles) {
    const info = await stat(path.join(root, file));
    assert.equal(info.isFile(), true, `${file} should exist`);
  }
});

test("home page is a Chinese-first product entry with multi-page navigation", async () => {
  const html = await readSource("index.html");
  assert.match(html, /校园场景图像智能分割/);
  assert.match(html, /中文/);
  assert.match(html, /English/);
  assert.match(html, /workspace\.html/);
  assert.match(html, /compare\.html/);
  assert.match(html, /scenes\.html/);
});

test("workspace starts from user upload without sample loading", async () => {
  const html = await readSource("workspace.html");
  assert.match(html, /type="file"/);
  assert.match(html, /请上传图像/);
  assert.doesNotMatch(html, /加载样例|Load Sample/);
});

test("algorithm comparison is a dedicated side-by-side page", async () => {
  const html = await readSource("compare.html");
  assert.match(html, /SAM2/);
  assert.match(html, /LangSAM/);
  assert.match(html, /compare-columns/);
  assert.match(html, /comparisonEmpty/);
  assert.match(html, /workspace\.html/);
  assert.doesNotMatch(html, /slider|range|drag|覆盖|拖动/);
  assert.doesNotMatch(html, /输入方式|适用对象|选择建议|理论/);
});

test("workspace hands an uploaded extraction job to comparison page", async () => {
  const html = await readSource("workspace.html");
  const script = await readSource("app.js");
  assert.match(html, /compareLink/);
  assert.match(script, /campusseg-last-job/);
  assert.match(script, /FileReader/);
  assert.match(script, /compare\.html/);
});

test("scene library exposes scene selection without fake illustrated placeholders", async () => {
  const html = await readSource("scenes.html");
  const css = await readSource("styles.css");
  assert.match(html, /sceneSelector/);
  assert.match(html, /scenePreview/);
  assert.doesNotMatch(html, /scene-visual|object-dot|board-shape|desk-shape|tray-shape/);
  assert.doesNotMatch(css, /object-dot|board-shape|desk-shape|tray-shape|thumb-book|thumb-cup|thumb-laptop/);
});

test("public frontend copy does not expose internal process language", async () => {
  const forbidden = [
    /阶段/g,
    /Phase|Stage/g,
    /任务/g,
    /mock|Mock/g,
    /模拟/g,
    /state[- ]?machine/gi,
    /payload/gi,
    /Bento/g,
    /截图/g,
    /实验报告/g,
    /里程碑/g,
    /加载样例/g,
    /Load Sample/g,
    /占位/g,
  ];

  for (const file of sourceFiles) {
    const body = await readSource(file);
    for (const pattern of forbidden) {
      assert.doesNotMatch(body, pattern, `${file} contains ${pattern}`);
    }
  }
});

test("visual system avoids glass-heavy styling", async () => {
  const css = await readSource("styles.css");
  assert.doesNotMatch(css, /backdrop-filter/);
});

test("visual polish removes decorative grid floors and restores first icon style", async () => {
  const css = await readSource("styles.css");
  const html = await Promise.all(["index.html", "workspace.html", "compare.html", "scenes.html"].map(readSource));
  assert.doesNotMatch(css, /background-size:\s*4[0-9]px\s+4[0-9]px/);
  assert.doesNotMatch(css, /\.hud-grid/);
  assert.doesNotMatch(css, /brand-mark::after/);
  for (const body of html) {
    assert.match(body, /circle cx='12' cy='12' r='10'/);
    assert.match(body, /circle cx='20' cy='20' r='10'/);
  }
});

test("interface keeps intentional dynamic interactions", async () => {
  const css = await readSource("styles.css");
  const script = await readSource("app.js");
  assert.match(css, /@keyframes\s+heroFloat/);
  assert.match(css, /@keyframes\s+panelIn/);
  assert.match(css, /transition:\s*transform/);
  assert.match(script, /pointermove/);
  assert.match(script, /data-tilt/);
});

test("home scan uses a campus segmentation scene and mouse-flow background", async () => {
  const index = await readSource("index.html");
  const css = await readSource("styles.css");
  const script = await readSource("app.js");
  const asset = await stat(path.join(root, "assets", "campus-segmentation-scene.png"));
  assert.equal(asset.isFile(), true);
  assert.match(index, /campus-segmentation-scene\.png/);
  assert.doesNotMatch(css, /115deg|245deg/);
  assert.match(css, /--flow-x/);
  assert.match(css, /--flow-y/);
  assert.match(css, /\.brand-mark\s*\{[^}]*width:\s*26px/s);
  assert.match(css, /\.brand-mark\s*\{[^}]*height:\s*26px/s);
  assert.match(script, /--flow-x/);
  assert.match(script, /--flow-y/);
});

test("latest copy and layout polish rules are represented", async () => {
  const index = await readSource("index.html");
  const scenes = await readSource("scenes.html");
  const css = await readSource("styles.css");
  const script = await readSource("app.js");

  assert.match(index, /校园场景图像智能分割/);
  for (const file of ["index.html", "workspace.html", "compare.html", "scenes.html"]) {
    assert.doesNotMatch(await readSource(file), /。/);
  }
  assert.match(css, /workflow-section[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /workflow-section[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\.brand-mark\s*\{[^}]*width:\s*26px/s);
  assert.match(css, /\.brand-mark\s*\{[^}]*height:\s*26px/s);
  assert.match(css, /\.upload-control\s*\{[^}]*min-height:\s*88px/s);
  assert.match(css, /cursor:\s*none/);
  assert.match(css, /\.custom-cursor/);
  assert.match(script, /custom-cursor/);
  assert.match(scenes, /scene-album/);
  assert.match(scenes, /scene-card/);
  assert.match(css, /filter:\s*blur/);
});

test("scene album references realistic scene images", async () => {
  const scenes = await readSource("scenes.html");
  const expected = [
    "scene-classroom.png",
    "scene-library.png",
    "scene-dorm.png",
    "scene-cafeteria.png",
    "scene-outdoor.png",
    "scene-lab.png",
  ];
  for (const file of expected) {
    const info = await stat(path.join(root, "assets", file));
    assert.equal(info.isFile(), true, `${file} should exist`);
    assert.match(scenes, new RegExp(file));
  }
});
