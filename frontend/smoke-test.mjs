import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.dirname(root);
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

test("workspace submits real segmentation requests and renders returned assets", async () => {
  const script = await readSource("app.js");
  assert.match(script, /new FormData\(\)/);
  assert.match(script, /\/segment\/point/);
  assert.match(script, /\/segment\/lang/);
  assert.match(script, /formData\.append\("image"/);
  assert.match(script, /formData\.append\("x"/);
  assert.match(script, /formData\.append\("y"/);
  assert.match(script, /formData\.append\("point_label", "1"\)/);
  assert.match(script, /fetch\(endpoint/);
  assert.match(script, /renderSegmentationResult/);
  assert.match(script, /mask_url/);
  assert.match(script, /png_url/);
  assert.match(script, /downloadButton/);
});

test("workspace converts preview clicks to original image pixels", async () => {
  const script = await readSource("app.js");
  assert.match(script, /previewImage\.naturalWidth/);
  assert.match(script, /previewImage\.naturalHeight/);
  assert.match(script, /getImagePointFromEvent/);
  assert.match(script, /Math\.round\(\(offsetX \/ rect\.width\) \* previewImage\.naturalWidth\)/);
  assert.match(script, /Math\.round\(\(offsetY \/ rect\.height\) \* previewImage\.naturalHeight\)/);
});

test("frontend includes Chinese to English prompt data from teammate materials", async () => {
  const assetPath = path.join(root, "assets", "prompt_map.json");
  const asset = await stat(assetPath);
  assert.equal(asset.isFile(), true);
  const promptMap = JSON.parse(await readFile(assetPath, "utf8"));
  assert.equal(promptMap["杯子"], "cup");
  assert.equal(promptMap["笔记本电脑"], "laptop");
  const script = await readSource("app.js");
  assert.match(script, /prompt_map\.json/);
  assert.match(script, /resolveTargetPrompt/);
});

test("phase two report material folder is prepared outside frontend pages", async () => {
  const folder = path.join(workspaceRoot, "李一赫_阶段二报告素材");
  const info = await stat(folder);
  assert.equal(info.isDirectory(), true);
  const readme = await readFile(path.join(folder, "README.md"), "utf8");
  assert.match(readme, /前端功能实现/);
  assert.match(readme, /上传/);
  assert.match(readme, /下载/);
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
  assert.match(index, /hero-scanline/);
  assert.doesNotMatch(css, /115deg|245deg/);
  assert.match(css, /--flow-x/);
  assert.match(css, /--flow-y/);
  assert.match(css, /\.hero-scanline/);
  assert.match(css, /scanSweep/);
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

test("scene library renders categorized teammate image materials", async () => {
  const script = await readSource("app.js");
  const css = await readSource("styles.css");
  const expectedByScene = {
    classroom: [
      "10_medium_classroom_bottle_desk.jpg",
      "11_medium_classroom_chairs_web.jpg",
      "12_medium_empty_classroom_chair.jpg",
      "13_medium_empty_classroom_rows.jpg",
      "16_hard_classroom_person_front.jpg",
      "17_hard_classroom_people_occlusion.jpg",
    ],
    library: [
      "09_medium_library_books_desk.jpg",
      "18_hard_laptop_window_reflection.jpg",
    ],
    dorm: [
      "01_easy_cup_table.jpg",
      "02_easy_bottle_desk.jpg",
      "03_easy_laptop_mouse_notebook.jpg",
      "06_medium_keyboard_mouse.jpg",
      "07_medium_rotated_laptop_desk.jpg",
      "08_medium_study_desk_notebook.jpg",
      "19_hard_room_chair_clutter.jpg",
    ],
    cafeteria: [
      "14_medium_canteen_chair.jpg",
      "15_medium_cafe_table.jpg",
    ],
    outdoor: [
      "04_easy_bus_street.jpg",
      "05_medium_bicycle_street.jpg",
      "20_hard_bus_trees_rain.jpg",
      "21_hard_bus_interior_backpack.jpg",
      "22_hard_night_campus_person.jpg",
      "23_hard_night_street_car.jpg",
    ],
    lab: [
      "24_medium_laboratory_equipment.jpg",
      "25_medium_computer_lab_screens.jpg",
      "26_hard_physics_lab_equipment.jpg",
    ],
  };

  assert.match(script, /scene-material-grid/);
  assert.match(script, /scene-material-meta/);
  assert.match(script, /sceneUseLink\.href = `\.\/workspace\.html\?sceneImage=/);
  assert.match(css, /\.scene-material-grid/);
  assert.match(css, /\.scene-material-card/);

  for (const [scene, files] of Object.entries(expectedByScene)) {
    assert.match(script, new RegExp(`${scene}: \\{[\\s\\S]*images: \\[`));
    for (const file of files) {
      const asset = await stat(path.join(root, "assets", "test-scenes", scene, file));
      assert.equal(asset.isFile(), true, `${scene}/${file} should exist`);
      assert.match(script, new RegExp(`sceneImage\\("${scene}", "${file}"`));
    }
  }
});
