const storageKey = "campusseg-last-job";
const comparePageUrl = "./compare.html";
const apiBaseStorageKey = "campusseg-api-base";
const defaultApiBaseUrl = "http://127.0.0.1:8000";
const promptMapUrl = "./assets/prompt_map.json";
const menuButton = document.querySelector(".menu-button");
const siteHeader = document.querySelector(".site-header");
const languageButtons = document.querySelectorAll(".language-toggle");

const fallbackPromptMap = {
  "杯子": "cup",
  "水杯": "cup",
  "白色水杯": "cup",
  "瓶子": "bottle",
  "水瓶": "bottle",
  "电脑": "laptop",
  "笔记本电脑": "laptop",
  "公交车": "bus",
  "校车": "bus",
  "自行车": "bicycle",
  "键盘": "keyboard",
  "笔记本": "notebook",
  "书": "book",
  "椅子": "chair",
  "座椅": "chair",
  "桌子": "table",
  "人": "person",
  "人物": "person",
  "背包": "backpack",
  "汽车": "car",
  "台灯": "lamp",
  "餐盘": "tray",
  "屏幕": "screen",
  "显示器": "monitor",
};

let currentLanguage = localStorage.getItem("campusseg-language") || "zh";
let promptMap = { ...fallbackPromptMap };

function applyLanguage(language) {
  currentLanguage = language;
  localStorage.setItem("campusseg-language", language);
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";

  document.querySelectorAll("[data-zh][data-en]").forEach((node) => {
    node.textContent = node.dataset[language];
  });

  document.querySelectorAll("[data-placeholder-zh][data-placeholder-en]").forEach((node) => {
    node.placeholder = node.dataset[`placeholder${language === "zh" ? "Zh" : "En"}`];
  });

  refreshWorkspace?.();
  renderComparison?.();
  renderScene?.(activeScene);
}

function label(zh, en) {
  return currentLanguage === "zh" ? zh : en;
}

function setText(node, zh, en) {
  if (node) node.textContent = label(zh, en);
}

function getApiBaseUrl() {
  return (localStorage.getItem(apiBaseStorageKey) || defaultApiBaseUrl).replace(/\/+$/, "");
}

function getSegmentEndpoint(method = selectedMethod) {
  return `${getApiBaseUrl()}${method === "sam2" ? "/segment/point" : "/segment/lang"}`;
}

function normalizeApiAssetUrl(url) {
  if (!url) return "";
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url;
  if (url.startsWith("/")) return `${getApiBaseUrl()}${url}`;
  return `${getApiBaseUrl()}/${url.replace(/^\.?\//, "")}`;
}

async function loadPromptMap() {
  try {
    const response = await fetch(promptMapUrl, { cache: "no-store" });
    if (!response.ok) return;
    promptMap = { ...promptMap, ...(await response.json()) };
  } catch {
    promptMap = { ...fallbackPromptMap };
  }
}

function resolveTargetPrompt(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (promptMap[text]) return promptMap[text];
  const matchedKey = Object.keys(promptMap).find((key) => text.includes(key));
  return matchedKey ? promptMap[matchedKey] : text;
}

function clearGeneratedObjectUrls() {
  generatedObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  generatedObjectUrls = [];
}

function setSlotText(slot, zh, en) {
  if (!slot) return;
  slot.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = label(zh, en);
  slot.append(span);
}

function renderSlotImage(slot, url, altText) {
  if (!slot || !url) return;
  slot.innerHTML = "";
  const image = document.createElement("img");
  image.src = url;
  image.alt = altText;
  slot.append(image);
}

function pickResultUrl(result, keys) {
  for (const key of keys) {
    const value = result?.[key];
    if (typeof value === "string" && value.trim()) return normalizeApiAssetUrl(value.trim());
  }
  return "";
}

function setProcessing(active) {
  isProcessing = active;
  if (extractButton) {
    extractButton.disabled = isProcessing || !(hasImage() && hasTarget());
    setText(extractButton, active ? "处理中" : "提取目标", active ? "Processing" : "Extract Target");
  }
}

async function readSegmentResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  if (contentType.startsWith("image/")) {
    const blobUrl = URL.createObjectURL(await response.blob());
    generatedObjectUrls.push(blobUrl);
    return {
      status: "success",
      method: selectedMethod === "sam2" ? "point" : "lang",
      mask_url: blobUrl,
      png_url: blobUrl,
    };
  }
  return { status: response.ok ? "success" : "error" };
}

function createSegmentFormData() {
  const formData = new FormData();
  formData.append("image", selectedFile, selectedFileName || selectedFile.name);

  if (selectedMethod === "sam2") {
    formData.append("x", String(selectedPoint.x));
    formData.append("y", String(selectedPoint.y));
    formData.append("point_label", "1");
  } else {
    const prompt = resolveTargetPrompt(targetPrompt?.value || "");
    formData.append("prompt", prompt);
    formData.append("text_prompt", prompt);
  }

  return formData;
}

function renderSegmentationResult(result) {
  latestMaskUrl = pickResultUrl(result, ["mask_url", "maskUrl", "mask", "annotated_url", "result_url"]);
  latestPngUrl = pickResultUrl(result, ["png_url", "pngUrl", "png", "asset_url", "output_url"]);

  if (latestMaskUrl) {
    renderSlotImage(maskSlot, latestMaskUrl, label("分割区域结果", "Mask result"));
  } else {
    setSlotText(maskSlot, "未返回 mask", "No mask returned");
  }

  if (latestPngUrl) {
    renderSlotImage(pngSlot, latestPngUrl, label("透明 PNG 素材", "Transparent PNG asset"));
    downloadButton && (downloadButton.disabled = false);
  } else {
    setSlotText(pngSlot, "未返回 PNG", "No PNG returned");
    downloadButton && (downloadButton.disabled = true);
  }

  setText(canvasStatus, result?.status === "error" ? "处理失败" : "处理完成", result?.status === "error" ? "Failed" : "Ready");
  saveComparisonJob(result);
  enableCompareLink();
}

function handleSegmentError(error) {
  const message = error?.message || label("接口调用失败", "Request failed");
  setText(canvasStatus, `处理失败 ${message}`, `Failed ${message}`);
  setSlotText(maskSlot, "接口未返回结果", "No result returned");
  setSlotText(pngSlot, "接口未返回结果", "No result returned");
  downloadButton && (downloadButton.disabled = true);
}

async function runSegmentation() {
  if (!hasImage()) {
    setText(canvasStatus, "请上传图像", "Please upload an image");
    return;
  }
  if (!hasTarget()) {
    setText(canvasStatus, "请选择目标", "Please select a target");
    return;
  }

  setProcessing(true);
  setText(canvasStatus, "正在处理", "Processing");
  setSlotText(maskSlot, "等待分割结果", "Waiting for mask");
  setSlotText(pngSlot, "等待 PNG 结果", "Waiting for PNG");

  try {
    const endpoint = getSegmentEndpoint();
    const response = await fetch(endpoint, {
      method: "POST",
      body: createSegmentFormData(),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
    renderSegmentationResult(await readSegmentResponse(response));
  } catch (error) {
    handleSegmentError(error);
  } finally {
    setProcessing(false);
    refreshWorkspace();
  }
}

function downloadLatestPng() {
  if (!latestPngUrl) return;
  const link = document.createElement("a");
  link.href = latestPngUrl;
  link.download = `${(selectedFileName || "campusseg").replace(/\.[^.]+$/, "")}_object.png`;
  document.body.append(link);
  link.click();
  link.remove();
}

menuButton?.addEventListener("click", () => {
  siteHeader?.classList.toggle("open");
});

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyLanguage(currentLanguage === "zh" ? "en" : "zh");
  });
});

const customCursor = document.createElement("div");
customCursor.className = "custom-cursor";
customCursor.setAttribute("aria-hidden", "true");
document.body.append(customCursor);

document.addEventListener("pointermove", (event) => {
  const x = Math.round((event.clientX / window.innerWidth) * 100);
  const y = Math.round((event.clientY / window.innerHeight) * 100);
  document.documentElement.style.setProperty("--flow-x", `${x}%`);
  document.documentElement.style.setProperty("--flow-y", `${y}%`);
  document.documentElement.style.setProperty("--flow-alt-x", `${100 - x}%`);
  document.documentElement.style.setProperty("--flow-alt-y", `${Math.max(8, Math.min(92, 100 - y * 0.72))}%`);
  document.documentElement.style.setProperty("--flow-angle", `${Math.round(x * 1.8 + y)}deg`);
  customCursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
});

document.addEventListener("pointerover", (event) => {
  if (event.target.closest("a, button, input, [data-tilt]")) customCursor.classList.add("cursor-active");
});

document.addEventListener("pointerout", (event) => {
  if (event.target.closest("a, button, input, [data-tilt]")) customCursor.classList.remove("cursor-active");
});

document.querySelectorAll("[data-tilt]").forEach((node) => {
  node.addEventListener("pointermove", (event) => {
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    node.style.setProperty("--cursor-x", `${Math.round(x * 100)}%`);
    node.style.setProperty("--cursor-y", `${Math.round(y * 100)}%`);
    node.style.setProperty("--tilt-x", `${(x - 0.5) * 4}deg`);
    node.style.setProperty("--tilt-y", `${(0.5 - y) * 3}deg`);
  });

  node.addEventListener("pointerleave", () => {
    node.style.setProperty("--tilt-x", "0deg");
    node.style.setProperty("--tilt-y", "0deg");
    node.style.setProperty("--cursor-x", "50%");
    node.style.setProperty("--cursor-y", "50%");
  });
});

const imageFile = document.querySelector("#imageFile");
const dropArea = document.querySelector("#dropArea");
const uploadStatus = document.querySelector("#uploadStatus");
const methodButtons = document.querySelectorAll(".method-button");
const methodLabel = document.querySelector("#methodLabel");
const samPanel = document.querySelector("#samPanel");
const langPanel = document.querySelector("#langPanel");
const imageCanvas = document.querySelector("#imageCanvas");
const previewImage = document.querySelector("#previewImage");
const emptyCanvas = document.querySelector("#emptyCanvas");
const pointMarker = document.querySelector("#pointMarker");
const pointReadout = document.querySelector("#pointReadout");
const targetPrompt = document.querySelector("#targetPrompt");
const promptStatus = document.querySelector("#promptStatus");
const extractButton = document.querySelector("#extractButton");
const clearButton = document.querySelector("#clearButton");
const compareLink = document.querySelector("#compareLink");
const downloadButton = document.querySelector("#downloadButton");
const canvasStatus = document.querySelector("#canvasStatus");
const sourceSlot = document.querySelector("#sourceSlot");
const maskSlotText = document.querySelector("#maskSlotText");
const pngSlotText = document.querySelector("#pngSlotText");
const maskSlot = maskSlotText?.parentElement;
const pngSlot = pngSlotText?.parentElement;

let selectedMethod = "sam2";
let selectedFile = null;
let selectedFileUrl = "";
let selectedFileDataUrl = "";
let selectedFileName = "";
let selectedPoint = null;
let latestPngUrl = "";
let latestMaskUrl = "";
let isProcessing = false;
let generatedObjectUrls = [];

function hasImage() {
  return Boolean(selectedFile && selectedFileUrl && selectedFileDataUrl);
}

function targetText() {
  if (selectedMethod === "sam2") {
    return selectedPoint ? `X ${selectedPoint.x} / Y ${selectedPoint.y}` : "";
  }
  return targetPrompt?.value.trim() || "";
}

function hasTarget() {
  return Boolean(targetText());
}

function refreshWorkspace() {
  if (!extractButton) return;
  if (methodLabel) methodLabel.textContent = selectedMethod === "sam2" ? "SAM2" : "LangSAM";
  samPanel?.classList.toggle("hidden", selectedMethod !== "sam2");
  langPanel?.classList.toggle("hidden", selectedMethod !== "langsam");
  extractButton.disabled = isProcessing || !(hasImage() && hasTarget());

  if (promptStatus) {
    const prompt = resolveTargetPrompt(targetPrompt?.value || "");
    setText(promptStatus, prompt ? prompt : "未填写", prompt ? prompt : "Empty");
  }
}

function enableCompareLink() {
  if (compareLink) compareLink.href = comparePageUrl;
  compareLink?.classList.remove("disabled");
  compareLink?.removeAttribute("aria-disabled");
}

function disableCompareLink() {
  compareLink?.classList.add("disabled");
  compareLink?.setAttribute("aria-disabled", "true");
}

function readImageFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    selectedFileDataUrl = String(reader.result || "");
    refreshWorkspace();
  });
  reader.readAsDataURL(file);
}

function setImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
  clearGeneratedObjectUrls();
  selectedFile = file;
  selectedFileUrl = URL.createObjectURL(file);
  selectedFileDataUrl = "";
  selectedFileName = file.name;
  selectedPoint = null;
  latestMaskUrl = "";
  latestPngUrl = "";
  previewImage.src = selectedFileUrl;
  previewImage.alt = file.name;
  pointMarker?.classList.remove("visible");
  imageCanvas?.classList.remove("empty");
  imageCanvas?.classList.add("ready");
  emptyCanvas?.classList.add("hidden");
  setText(uploadStatus, file.name, file.name);
  setText(canvasStatus, "图像已载入", "Image loaded");
  disableCompareLink();

  if (sourceSlot) {
    sourceSlot.innerHTML = "";
    const image = document.createElement("img");
    image.src = selectedFileUrl;
    image.alt = file.name;
    sourceSlot.append(image);
  }

  setSlotText(maskSlot, "等待结果", "Waiting for result");
  setSlotText(pngSlot, "等待结果", "Waiting for result");
  downloadButton && (downloadButton.disabled = true);
  readImageFile(file);
  refreshWorkspace();
}

async function preloadSceneImageFromQuery() {
  if (!imageFile) return;
  const params = new URLSearchParams(window.location.search);
  const sceneImage = params.get("sceneImage");
  if (!sceneImage) return;

  try {
    const response = await fetch(sceneImage);
    if (!response.ok) return;
    const blob = await response.blob();
    const name = sceneImage.split("/").pop() || "campus-scene.jpg";
    setImage(new File([blob], name, { type: blob.type || "image/jpeg" }));
    const scenePrompt = params.get("scenePrompt");
    if (scenePrompt && targetPrompt) {
      targetPrompt.value = scenePrompt;
      selectedMethod = "langsam";
      methodButtons.forEach((button) => {
        const active = button.dataset.method === selectedMethod;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
    }
  } catch {
    setText(canvasStatus, "图片载入失败", "Image load failed");
  } finally {
    refreshWorkspace();
  }
}

function saveComparisonJob(result = {}) {
  const maskUrl = latestMaskUrl || pickResultUrl(result, ["mask_url", "maskUrl", "mask", "annotated_url", "result_url"]);
  const pngUrl = latestPngUrl || pickResultUrl(result, ["png_url", "pngUrl", "png", "asset_url", "output_url"]);
  const job = {
    imageDataUrl: selectedFileDataUrl,
    fileName: selectedFileName,
    method: selectedMethod === "sam2" ? "SAM2" : "LangSAM",
    target: targetText(),
    prompt: selectedMethod === "langsam" ? resolveTargetPrompt(targetPrompt?.value || "") : "",
    point: selectedPoint,
    maskUrl,
    pngUrl,
    status: result?.status || "success",
    time: new Date().toISOString(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(job));
  } catch {
    sessionStorage.setItem(storageKey, JSON.stringify(job));
  }
}

dropArea?.addEventListener("click", () => imageFile?.click());

imageFile?.addEventListener("change", (event) => {
  const [file] = event.target.files;
  setImage(file);
});

methodButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedMethod = button.dataset.method;
    methodButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    refreshWorkspace();
  });
});

function getImagePointFromEvent(event) {
  if (!previewImage?.naturalWidth || !previewImage?.naturalHeight) return null;
  const rect = previewImage.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  if (offsetX < 0 || offsetY < 0 || offsetX > rect.width || offsetY > rect.height) return null;
  return {
    x: Math.round((offsetX / rect.width) * previewImage.naturalWidth),
    y: Math.round((offsetY / rect.height) * previewImage.naturalHeight),
  };
}

imageCanvas?.addEventListener("click", (event) => {
  if (!selectedFileUrl || selectedMethod !== "sam2") return;
  const point = getImagePointFromEvent(event);
  if (!point) return;
  const canvasRect = imageCanvas.getBoundingClientRect();
  selectedPoint = {
    ...point,
    imageWidth: previewImage.naturalWidth,
    imageHeight: previewImage.naturalHeight,
  };

  if (pointMarker) {
    pointMarker.style.left = `${event.clientX - canvasRect.left}px`;
    pointMarker.style.top = `${event.clientY - canvasRect.top}px`;
    pointMarker.classList.add("visible");
  }

  if (pointReadout) pointReadout.textContent = `X ${point.x} / Y ${point.y}`;
  setText(canvasStatus, "目标已选择", "Target selected");
  disableCompareLink();
  setSlotText(maskSlot, "等待结果", "Waiting for result");
  setSlotText(pngSlot, "等待结果", "Waiting for result");
  latestMaskUrl = "";
  latestPngUrl = "";
  downloadButton && (downloadButton.disabled = true);
  refreshWorkspace();
});

targetPrompt?.addEventListener("input", () => {
  disableCompareLink();
  latestMaskUrl = "";
  latestPngUrl = "";
  setSlotText(maskSlot, "等待结果", "Waiting for result");
  setSlotText(pngSlot, "等待结果", "Waiting for result");
  downloadButton && (downloadButton.disabled = true);
  refreshWorkspace();
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!targetPrompt) return;
    targetPrompt.value = button.dataset.prompt;
    disableCompareLink();
    latestMaskUrl = "";
    latestPngUrl = "";
    setSlotText(maskSlot, "等待结果", "Waiting for result");
    setSlotText(pngSlot, "等待结果", "Waiting for result");
    downloadButton && (downloadButton.disabled = true);
    refreshWorkspace();
  });
});

extractButton?.addEventListener("click", runSegmentation);

downloadButton?.addEventListener("click", downloadLatestPng);

clearButton?.addEventListener("click", () => {
  if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
  clearGeneratedObjectUrls();
  selectedFile = null;
  selectedFileUrl = "";
  selectedFileDataUrl = "";
  selectedFileName = "";
  selectedPoint = null;
  latestMaskUrl = "";
  latestPngUrl = "";
  isProcessing = false;
  imageFile && (imageFile.value = "");
  previewImage && (previewImage.removeAttribute("src"));
  imageCanvas?.classList.add("empty");
  imageCanvas?.classList.remove("ready");
  emptyCanvas?.classList.remove("hidden");
  pointMarker?.classList.remove("visible");
  setText(uploadStatus, "未选择", "No file");
  setText(canvasStatus, "请上传图像", "Please upload an image");
  if (pointReadout) pointReadout.textContent = "X -- / Y --";
  if (sourceSlot) sourceSlot.innerHTML = `<span>${label("等待图像", "Waiting for image")}</span>`;
  setSlotText(maskSlot, "等待结果", "Waiting for result");
  setSlotText(pngSlot, "等待结果", "Waiting for result");
  downloadButton && (downloadButton.disabled = true);
  disableCompareLink();
  refreshWorkspace();
});

const comparisonEmpty = document.querySelector("#comparisonEmpty");
const comparisonReady = document.querySelector("#comparisonReady");
const compareFileName = document.querySelector("#compareFileName");
const compareTarget = document.querySelector("#compareTarget");
const compareMethod = document.querySelector("#compareMethod");
const compareSamSource = document.querySelector("#compareSamSource");
const compareLangSource = document.querySelector("#compareLangSource");
const compareSamPoint = document.querySelector("#compareSamPoint");
const samResultSlot = document.querySelector("#samResultSlot");
const langResultSlot = document.querySelector("#langResultSlot");

function getSavedJob() {
  const raw = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function renderAlgorithmOutput(slot, url, altText, emptyText) {
  if (!slot) return;
  slot.innerHTML = "";
  if (!url) {
    const span = document.createElement("span");
    span.textContent = emptyText;
    span.style.display = "grid";
    span.style.placeItems = "center";
    span.style.minHeight = "230px";
    span.style.color = "var(--faint)";
    slot.append(span);
    return;
  }
  const image = document.createElement("img");
  image.src = url;
  image.alt = altText;
  image.style.width = "100%";
  image.style.height = "230px";
  image.style.objectFit = "contain";
  image.style.display = "block";
  slot.append(image);
}

function renderComparison() {
  if (!comparisonEmpty || !comparisonReady) return;
  const job = getSavedJob();
  const ready = Boolean(job?.imageDataUrl);
  comparisonEmpty.classList.toggle("hidden", ready);
  comparisonReady.classList.toggle("hidden", !ready);
  if (!ready) return;

  compareFileName && (compareFileName.textContent = job.fileName || label("已上传图像", "Uploaded image"));
  compareTarget && (compareTarget.textContent = job.target || "--");
  compareMethod && (compareMethod.textContent = job.method || "--");

  if (compareSamSource) compareSamSource.src = job.imageDataUrl;
  if (compareLangSource) compareLangSource.src = job.imageDataUrl;

  if (compareSamPoint && job.point) {
    const width = job.point.imageWidth || 1000;
    const height = job.point.imageHeight || 1000;
    compareSamPoint.style.left = `${Math.max(0, Math.min(100, (job.point.x / width) * 100))}%`;
    compareSamPoint.style.top = `${Math.max(0, Math.min(100, (job.point.y / height) * 100))}%`;
    compareSamPoint.classList.add("visible");
  } else {
    compareSamPoint?.classList.remove("visible");
  }

  const resultUrl = job.pngUrl || job.maskUrl || "";
  renderAlgorithmOutput(
    samResultSlot,
    job.method === "SAM2" ? resultUrl : "",
    label("SAM2 输出结果", "SAM2 result"),
    label("本次未运行 SAM2", "SAM2 not run")
  );
  renderAlgorithmOutput(
    langResultSlot,
    job.method === "LangSAM" ? resultUrl : "",
    label("LangSAM 输出结果", "LangSAM result"),
    label("本次未运行 LangSAM", "LangSAM not run")
  );
}

const sceneOptions = document.querySelectorAll(".scene-card");
const sceneKicker = document.querySelector("#sceneKicker");
const sceneTitle = document.querySelector("#sceneTitle");
const sceneDescription = document.querySelector("#sceneDescription");
const sceneImageArea = document.querySelector("#sceneImageArea");
const sceneUseLink = document.querySelector("#sceneUseLink");

function sceneImage(scene, file, zhTarget, enTarget, prompt, zhLevel, enLevel) {
  return {
    src: `./assets/test-scenes/${scene}/${file}`,
    alt: `${zhTarget} ${file}`,
    zhTarget,
    enTarget,
    prompt,
    zhLevel,
    enLevel,
  };
}

const sceneCopy = {
  classroom: {
    zh: "教室",
    en: "Classroom",
    zhCopy: "可放入讲台、黑板内容、书本、笔记本电脑和演示道具图片",
    enCopy: "Prepared images can include podiums, board content, books, laptops, and presentation props",
    images: [
      sceneImage("classroom", "10_medium_classroom_bottle_desk.jpg", "瓶子", "Bottle", "bottle", "中等", "Medium"),
      sceneImage("classroom", "11_medium_classroom_chairs_web.jpg", "椅子", "Chair", "chair", "中等", "Medium"),
      sceneImage("classroom", "12_medium_empty_classroom_chair.jpg", "椅子", "Chair", "chair", "中等", "Medium"),
      sceneImage("classroom", "13_medium_empty_classroom_rows.jpg", "椅子", "Chair", "chair", "中等", "Medium"),
      sceneImage("classroom", "16_hard_classroom_person_front.jpg", "人物", "Person", "person", "较难", "Hard"),
      sceneImage("classroom", "17_hard_classroom_people_occlusion.jpg", "人物", "Person", "person", "较难", "Hard"),
    ],
  },
  library: {
    zh: "图书馆",
    en: "Library",
    zhCopy: "可放入书架、座椅、学习用品和阅读空间图片",
    enCopy: "Prepared images can include shelves, seats, study tools, and reading spaces",
    images: [
      sceneImage("library", "09_medium_library_books_desk.jpg", "书本", "Books", "book", "中等", "Medium"),
      sceneImage("library", "18_hard_laptop_window_reflection.jpg", "电脑", "Laptop", "laptop", "较难", "Hard"),
    ],
  },
  dorm: {
    zh: "宿舍桌面",
    en: "Dorm Desk",
    zhCopy: "可放入水杯、键盘、台灯、书包和个人学习用品图片",
    enCopy: "Prepared images can include cups, keyboards, lamps, backpacks, and personal items",
    images: [
      sceneImage("dorm", "01_easy_cup_table.jpg", "杯子", "Cup", "cup", "简单", "Easy"),
      sceneImage("dorm", "02_easy_bottle_desk.jpg", "瓶子", "Bottle", "bottle", "简单", "Easy"),
      sceneImage("dorm", "03_easy_laptop_mouse_notebook.jpg", "电脑", "Laptop", "laptop", "简单", "Easy"),
      sceneImage("dorm", "06_medium_keyboard_mouse.jpg", "键盘", "Keyboard", "keyboard", "中等", "Medium"),
      sceneImage("dorm", "07_medium_rotated_laptop_desk.jpg", "电脑", "Laptop", "laptop", "中等", "Medium"),
      sceneImage("dorm", "08_medium_study_desk_notebook.jpg", "笔记本", "Notebook", "notebook", "中等", "Medium"),
      sceneImage("dorm", "19_hard_room_chair_clutter.jpg", "椅子", "Chair", "chair", "较难", "Hard"),
    ],
  },
  cafeteria: {
    zh: "食堂",
    en: "Cafeteria",
    zhCopy: "可放入餐盘、饮品、餐桌物品和校园生活图片",
    enCopy: "Prepared images can include trays, drinks, table objects, and campus life photos",
    images: [
      sceneImage("cafeteria", "14_medium_canteen_chair.jpg", "椅子", "Chair", "chair", "中等", "Medium"),
      sceneImage("cafeteria", "15_medium_cafe_table.jpg", "桌子", "Table", "table", "中等", "Medium"),
    ],
  },
  outdoor: {
    zh: "校园户外",
    en: "Outdoor",
    zhCopy: "可放入校门、路牌、雕塑、运动器材和活动物料图片",
    enCopy: "Prepared images can include gates, signs, sculptures, sports gear, and event materials",
    images: [
      sceneImage("outdoor", "04_easy_bus_street.jpg", "公交车", "Bus", "bus", "简单", "Easy"),
      sceneImage("outdoor", "05_medium_bicycle_street.jpg", "自行车", "Bicycle", "bicycle", "中等", "Medium"),
      sceneImage("outdoor", "20_hard_bus_trees_rain.jpg", "公交车", "Bus", "bus", "较难", "Hard"),
      sceneImage("outdoor", "21_hard_bus_interior_backpack.jpg", "背包", "Backpack", "backpack", "较难", "Hard"),
      sceneImage("outdoor", "22_hard_night_campus_person.jpg", "人物", "Person", "person", "较难", "Hard"),
      sceneImage("outdoor", "23_hard_night_street_car.jpg", "汽车", "Car", "car", "较难", "Hard"),
    ],
  },
  lab: {
    zh: "实验室",
    en: "Lab",
    zhCopy: "可放入设备、显示屏、工具盒和课程实验物品图片",
    enCopy: "Prepared images can include devices, screens, tool boxes, and lab objects",
    images: [
      sceneImage("lab", "24_medium_laboratory_equipment.jpg", "设备", "Equipment", "laboratory equipment", "中等", "Medium"),
      sceneImage("lab", "25_medium_computer_lab_screens.jpg", "屏幕", "Screen", "screen", "中等", "Medium"),
      sceneImage("lab", "26_hard_physics_lab_equipment.jpg", "工具", "Tool", "tool", "较难", "Hard"),
    ],
  },
};

let activeScene = "classroom";

function selectSceneImage(image, button) {
  if (!image || !sceneUseLink) return;
  sceneImageArea?.querySelectorAll(".scene-material-card").forEach((node) => node.classList.toggle("active", node === button));
  const params = new URLSearchParams({
    sceneImage: image.src,
    sceneTarget: image.zhTarget,
    scenePrompt: image.prompt,
  });
  sceneUseLink.href = `./workspace.html?sceneImage=${encodeURIComponent(image.src)}&sceneTarget=${encodeURIComponent(image.zhTarget)}&scenePrompt=${encodeURIComponent(image.prompt)}`;
  sceneUseLink.dataset.params = params.toString();
  sceneUseLink.classList.remove("disabled");
  sceneUseLink.removeAttribute("aria-disabled");
}

function renderScene(sceneId = activeScene) {
  if (!sceneImageArea || !sceneTitle || !sceneDescription) return;
  const item = sceneCopy[sceneId] || sceneCopy.classroom;
  activeScene = sceneId;

  sceneKicker && (sceneKicker.textContent = item.en);
  sceneTitle.textContent = label(item.zh, item.en);
  sceneDescription.textContent = label(item.zhCopy, item.enCopy);
  sceneImageArea.innerHTML = "";

  if (!item.images.length) {
    sceneImageArea.innerHTML = `<div class="scene-empty"><strong>${label("素材区域", "Material area")}</strong><span>${label("图片素材待加入", "Images to be added")}</span></div>`;
    sceneUseLink?.classList.add("disabled");
    sceneUseLink?.setAttribute("aria-disabled", "true");
    return;
  }

  const grid = document.createElement("div");
  grid.className = "scene-material-grid";
  sceneImageArea.append(grid);

  item.images.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-material-card";
    const img = document.createElement("img");
    img.src = image.src;
    img.alt = image.alt;
    const meta = document.createElement("div");
    meta.className = "scene-material-meta";
    const target = document.createElement("strong");
    target.textContent = label(image.zhTarget, image.enTarget);
    const detail = document.createElement("span");
    detail.textContent = `${image.prompt} / ${label(image.zhLevel, image.enLevel)}`;
    meta.append(target, detail);
    button.append(img);
    button.append(meta);
    button.addEventListener("click", () => selectSceneImage(image, button));
    grid.append(button);
    if (index === 0) selectSceneImage(image, button);
  });
}

sceneOptions.forEach((button) => {
  button.addEventListener("click", () => {
    sceneOptions.forEach((item) => item.classList.toggle("active", item === button));
    renderScene(button.dataset.scene);
  });
});

loadPromptMap().finally(() => {
  applyLanguage(currentLanguage);
  preloadSceneImageFromQuery();
});
