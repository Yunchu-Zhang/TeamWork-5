const storageKey = "campusseg-last-job";
const comparePageUrl = "./compare.html";
const menuButton = document.querySelector(".menu-button");
const siteHeader = document.querySelector(".site-header");
const languageButtons = document.querySelectorAll(".language-toggle");

let currentLanguage = localStorage.getItem("campusseg-language") || "zh";

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

let selectedMethod = "sam2";
let selectedFileUrl = "";
let selectedFileDataUrl = "";
let selectedFileName = "";
let selectedPoint = null;

function hasImage() {
  return Boolean(selectedFileUrl && selectedFileDataUrl);
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
  extractButton.disabled = !(hasImage() && hasTarget());

  if (promptStatus) {
    setText(promptStatus, targetPrompt?.value.trim() ? "已填写" : "未填写", targetPrompt?.value.trim() ? "Ready" : "Empty");
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
  selectedFileUrl = URL.createObjectURL(file);
  selectedFileDataUrl = "";
  selectedFileName = file.name;
  selectedPoint = null;
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

  setText(maskSlotText, "等待结果", "Waiting for result");
  setText(pngSlotText, "等待结果", "Waiting for result");
  downloadButton && (downloadButton.disabled = true);
  readImageFile(file);
  refreshWorkspace();
}

function saveComparisonJob() {
  const job = {
    imageDataUrl: selectedFileDataUrl,
    fileName: selectedFileName,
    method: selectedMethod === "sam2" ? "SAM2" : "LangSAM",
    target: targetText(),
    point: selectedPoint,
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

imageCanvas?.addEventListener("click", (event) => {
  if (!selectedFileUrl || selectedMethod !== "sam2") return;
  const rect = imageCanvas.getBoundingClientRect();
  const x = Math.round(((event.clientX - rect.left) / rect.width) * 1000);
  const y = Math.round(((event.clientY - rect.top) / rect.height) * 1000);
  selectedPoint = { x, y };

  if (pointMarker) {
    pointMarker.style.left = `${event.clientX - rect.left}px`;
    pointMarker.style.top = `${event.clientY - rect.top}px`;
    pointMarker.classList.add("visible");
  }

  if (pointReadout) pointReadout.textContent = `X ${x} / Y ${y}`;
  setText(canvasStatus, "目标已选择", "Target selected");
  disableCompareLink();
  refreshWorkspace();
});

targetPrompt?.addEventListener("input", () => {
  disableCompareLink();
  refreshWorkspace();
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!targetPrompt) return;
    targetPrompt.value = button.dataset.prompt;
    disableCompareLink();
    refreshWorkspace();
  });
});

extractButton?.addEventListener("click", () => {
  if (!hasImage()) {
    setText(canvasStatus, "请上传图像", "Please upload an image");
    return;
  }
  if (!hasTarget()) {
    setText(canvasStatus, "请选择目标", "Please select a target");
    return;
  }

  saveComparisonJob();
  setText(canvasStatus, "已提交处理", "Submitted");
  setText(maskSlotText, "等待分割结果", "Waiting for mask");
  setText(pngSlotText, "等待 PNG 结果", "Waiting for PNG");
  enableCompareLink();
});

clearButton?.addEventListener("click", () => {
  if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
  selectedFileUrl = "";
  selectedFileDataUrl = "";
  selectedFileName = "";
  selectedPoint = null;
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
  setText(maskSlotText, "等待结果", "Waiting for result");
  setText(pngSlotText, "等待结果", "Waiting for result");
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

function getSavedJob() {
  const raw = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
    compareSamPoint.style.left = `${Math.max(0, Math.min(100, job.point.x / 10))}%`;
    compareSamPoint.style.top = `${Math.max(0, Math.min(100, job.point.y / 10))}%`;
    compareSamPoint.classList.add("visible");
  }
}

const sceneOptions = document.querySelectorAll(".scene-card");
const sceneKicker = document.querySelector("#sceneKicker");
const sceneTitle = document.querySelector("#sceneTitle");
const sceneDescription = document.querySelector("#sceneDescription");
const sceneImageArea = document.querySelector("#sceneImageArea");
const sceneUseLink = document.querySelector("#sceneUseLink");

const sceneCopy = {
  classroom: {
    zh: "教室",
    en: "Classroom",
    zhCopy: "可放入讲台、黑板内容、书本、笔记本电脑和演示道具图片",
    enCopy: "Prepared images can include podiums, board content, books, laptops, and presentation props",
    images: [],
  },
  library: {
    zh: "图书馆",
    en: "Library",
    zhCopy: "可放入书架、座椅、学习用品和阅读空间图片",
    enCopy: "Prepared images can include shelves, seats, study tools, and reading spaces",
    images: [],
  },
  dorm: {
    zh: "宿舍桌面",
    en: "Dorm Desk",
    zhCopy: "可放入水杯、键盘、台灯、书包和个人学习用品图片",
    enCopy: "Prepared images can include cups, keyboards, lamps, backpacks, and personal items",
    images: [],
  },
  cafeteria: {
    zh: "食堂",
    en: "Cafeteria",
    zhCopy: "可放入餐盘、饮品、餐桌物品和校园生活图片",
    enCopy: "Prepared images can include trays, drinks, table objects, and campus life photos",
    images: [],
  },
  outdoor: {
    zh: "校园户外",
    en: "Outdoor",
    zhCopy: "可放入校门、路牌、雕塑、运动器材和活动物料图片",
    enCopy: "Prepared images can include gates, signs, sculptures, sports gear, and event materials",
    images: [],
  },
  lab: {
    zh: "实验室",
    en: "Lab",
    zhCopy: "可放入设备、显示屏、工具盒和课程实验物品图片",
    enCopy: "Prepared images can include devices, screens, tool boxes, and lab objects",
    images: [],
  },
};

let activeScene = "classroom";

function renderScene(sceneId = activeScene) {
  if (!sceneImageArea || !sceneTitle || !sceneDescription) return;
  const item = sceneCopy[sceneId] || sceneCopy.classroom;
  activeScene = sceneId;

  sceneKicker && (sceneKicker.textContent = item.en);
  sceneTitle.textContent = label(item.zh, item.en);
  sceneDescription.textContent = label(item.zhCopy, item.enCopy);
  sceneImageArea.innerHTML = `<div class="scene-empty"><strong>${label("素材区域", "Material area")}</strong><span>${label("图片素材待加入", "Images to be added")}</span></div>`;
  sceneUseLink?.classList.add("disabled");
  sceneUseLink?.setAttribute("aria-disabled", "true");

  item.images.forEach((image) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scene-image-button";
    const img = document.createElement("img");
    img.src = image.src;
    img.alt = image.alt;
    button.append(img);
    sceneImageArea.append(button);
  });
}

sceneOptions.forEach((button) => {
  button.addEventListener("click", () => {
    sceneOptions.forEach((item) => item.classList.toggle("active", item === button));
    renderScene(button.dataset.scene);
  });
});

applyLanguage(currentLanguage);
