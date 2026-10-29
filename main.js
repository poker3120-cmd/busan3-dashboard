/* =========================================================
   부산3지점 통합 영업 대시보드 — 앱 진입점
   ========================================================= */

import {
  $, $$, escapeHtml, formatNumber, formatKoreanDate, todayISO,
  debounce, truncate, slugify, downloadBlob, copyText, readAsText, unique,
} from "./utils.js";

import { state, emptyAnalysis, saveAnalysis, loadAnalysis, saveFlyer, loadFlyer,
  saveTraining, loadTraining, saveProposal, loadProposal,
  clearMaterials, resetFlyer, resetTraining, defaultFlyer, defaultTraining } from "./state.js?v=20261028b";

import { extractFiles } from "./extract.js?v=20261027e";
import { createMedicalIllustration } from "./medical-illustration.js?v=20261028c";
import { wireAging } from "./aging.js?v=20261027r";
import { analyze } from "./analyze.js?v=20261028c";
import { sampleUnits, sampleFileReport } from "./demo.js";

import {
  normalizeFlyer, renderFlyerHtml, renderFlyerEditor,
  findBestDense, findBestFit, measureFlyerHeight, flyerToPlainText,
} from "./flyer.js?v=20261028d";

import {
  normalizeTraining, renderTrainingHtml, renderTrainingEditor,
  buildTrainingFromAnalysis, trainingToPlainText,
} from "./training.js";

import {
  renderProposalHtml, proposalToPlainText,
} from "./proposal.js?v=20261028f";

import {
  fitScaler, printFlyer, printHtml, exportFlyerPng, exportFlyerImagePdf,
  exportFlyerPptx, exportHtmlPng, exportHtmlImagePdf, exportWord, exportProposalPdf,
} from "./export.js";

/* ---------- 상태 보조 ---------- */

let currentDense = 0;
let flyerImage = null;
let currentTrainingDense = 0;

/* 제안서 — A4 문서(794px) 미리보기 상태 */
const PROPOSAL_WIDTH = 794;
let proposalHtml = "";

/* 학술교육 서브탭 */
function showSubtab(name) {
  $$(".subtab").forEach((tab) => tab.classList.toggle("active", tab.id === name));
  $$(".subnav-btn").forEach((btn) => {
    const on = btn.dataset.subtab === name;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (name === "training-script") renderTrainingPage();
  if (name === "training-docs") renderTrainingDocList();
}

function getImageById(id) {
  if (!id) return null;
  return state.images.find((img) => img.id === id) || null;
}

/* 검사 주제에 맞는 개념도를 기본 히어로로 사용하고, 첨부자료 속 도식·그래프는 보조 이미지로 보존합니다. */
function getBestFlyerImage() {
  // 제목과 파일명을 먼저 판정해, 자료 묶음의 다른 검사 키워드가 이미지를 덮어쓰지 않게 합니다.
  const candidateTexts = [
    state.analysis?.title || "",
    ...(state.files || []).map((file) => file.name || ""),
    state.analysis?.subtitle || "",
  ].filter((value) => String(value).trim());

  let illustration = null;
  for (const sourceText of candidateTexts) {
    const candidate = createMedicalIllustration(sourceText);
    if (candidate && candidate.topicKey !== "clinical") {
      illustration = candidate;
      break;
    }
  }

  // 제목과 파일명으로 주제를 찾지 못했을 때만 본문 전체를 확인합니다.
  if (!illustration) {
    illustration = createMedicalIllustration(String(state.rawText || "").slice(0, 12000));
  }

  // 주제별 개념도가 전혀 맞지 않으면 눈·세포처럼 보이는 추상 원형 그림 대신
  // 검사 결과지와 검체 튜브 형태의 중립적인 검사 안내 그래픽을 사용합니다.
  if (!illustration || illustration.topicKey === "clinical") {
    illustration = createMedicalIllustration("");
  }

  const existing = state.images.find((img) => img.id === illustration.id);
  if (existing) return existing;
  state.images.push(illustration);
  return illustration;
}

function refreshFlyerImage() {
  const f = state.flyer || defaultFlyer();
  let selected = getImageById(f.imageId);

  // 추출 이미지는 새로고침 후 세션에서 사라질 수 있습니다.
  // 선택된 이미지가 없으면 현재 검사 주제의 자동 생성 개념도를 다시 연결합니다.
  if (!selected) {
    const generated = getBestFlyerImage();
    if (generated) {
      selected = generated;
      f.imageId = generated.id;
      f.imageCaption = truncate(generated.name || "", 40);
      if (state.flyer) saveFlyer();
    }
  }
  if (!selected) {
    flyerImage = null;
    return;
  }

  const likelyBrandAsset = (img) =>
    /(?:^|[/_-])(?:logo|brand|seegene|ci)(?:[/_.-]|$)/i.test(String(img.name || "")) ||
    /(?:^|[/_-])(?:logo|brand|seegene|ci)(?:[/_.-]|$)/i.test(String(img.source || ""));

  const candidates = state.images.filter((img) => {
    if (!img || img.id === selected.id || img.fullPage) return false;
    if (likelyBrandAsset(img)) return false;
    if (img.width > 0 && img.height > 0) {
      const ratio = img.width / img.height;
      if (ratio > 2.35 || ratio < 0.42) return false;
      if (img.width * img.height < 36000) return false;
    }
    return true;
  });

  // PPTX의 image1.*는 표지 로고인 경우가 많아, 대안이 충분하면 뒤쪽 도식을 우선합니다.
  const mediaNamed = candidates.filter((img) => !/^image1\.(png|jpe?g|gif|webp)$/i.test(String(img.name || "")));
  const ordered = mediaNamed.length ? mediaNamed : candidates;
  const extraImages = ordered.slice(0, 2).map((img) => ({
    dataUrl: img.dataUrl,
    name: img.name || "첨부 자료 이미지",
    source: img.source || "",
    width: img.width || 0,
    height: img.height || 0,
  }));

  flyerImage = { ...selected, extraImages };
}

function setStatus(el, message, kind = "") {
  if (!el) return;
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}

function showPage(name) {
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === name));
  $$(".navbtn").forEach((btn) => btn.classList.toggle("active", btn.dataset.page === name));

  if (name === "flyer") {
    renderFlyerPage();
  }
  if (name === "training") {
    renderTrainingDocList();
  }
  if (name === "materials") {
    renderAnalysis();
  }
  if (name === "jobs") {
    loadClinicJobs();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- 홈 통계 ---------- */

function renderHomeStats() {
  const a = state.analysis || emptyAnalysis();
  $("statFiles").textContent = formatNumber(state.files.filter((f) => f.ok).length);
  $("statFilesMeta").textContent = state.files.length
    ? `${state.files.length}개 선택 · ${formatNumber(state.files.reduce((s, f) => s + (f.units || 0), 0))}개 페이지/슬라이드`
    : "PDF · PPTX 파일";
  $("statChars").textContent = formatNumber(a.charCount || 0);
  $("statImages").textContent = formatNumber(state.images.length);

  const hasFlyer = Boolean(state.flyer && normalizeFlyer(state.flyer).title);
  const hasTraining = Boolean(state.training && normalizeTraining(state.training).title);
  const done = [
    hasFlyer ? "홍보물" : "",
    hasTraining ? "교육화법" : "",
  ].filter(Boolean);
  const el = $("statFlyer");
  el.textContent = done.length ? `${done.length}/2` : "미작성";
  el.classList.add("text");
  $("statFlyerMeta").textContent = done.length
    ? `${done.join(" · ")} 작성됨`
    : "홍보물 · 교육화법 미작성";
}

/* ---------- 자료 첨부 · 분석 ---------- */

function renderFileReport() {
  const status = $("extractStatus");
  if (!state.files.length) {
    setStatus(status, "아직 첨부된 자료가 없습니다.");
    return;
  }
  const okList = state.files.filter((f) => f.ok);
  const badList = state.files.filter((f) => !f.ok);
  const lines = [];
  lines.push(`총 ${state.files.length}개 파일 · 정상 ${okList.length}개 · 확인 필요 ${badList.length}개`);
  state.files.forEach((f) => {
    const sizeMb = f.size ? ` (${(f.size / 1024 / 1024).toFixed(1)}MB)` : "";
    if (f.ok) {
      lines.push(`· ${f.name}${sizeMb} — ${f.kind} ${f.units}개 단위, ${formatNumber(f.chars)}자${f.images ? `, 이미지 ${f.images}개` : ""}`);
    } else {
      lines.push(`· ${f.name}${sizeMb} — 실패: ${f.error || "텍스트 없음"}`);
    }
  });
  if (badList.length && okList.length) {
    lines.push("※ 실패한 파일은 텍스트가 없거나(이미지 전용 자료) 형식 문제일 수 있습니다.");
  }
  setStatus(status, lines.join("\n"), okList.length ? "ok" : "err");
}

function renderRawText() {
  const area = $("rawText");
  if (!area) return;
  const has = Boolean(state.rawText.trim());
  $("textCard").hidden = !has;
  if (area.value !== state.rawText) area.value = state.rawText;
}

function renderAnalysis() {
  const a = state.analysis;
  const card = $("analysisCard");
  renderFileReport();
  renderRawText();
  renderImageGallery();

  const hasContent = Boolean(a && (a.title || a.keyPoints.length || a.metrics.length || a.infoRows.length));
  card.hidden = !hasContent;
  if (!hasContent) return;

  $("anTitle").textContent = a.title || "(제목을 찾지 못했습니다. 원문을 확인하거나 홍보물에서 직접 입력하세요.)";
  $("anSubtitle").textContent = a.subtitle || "(요약 문장을 찾지 못했습니다.)";

  $("anKeyPoints").innerHTML = a.keyPoints.length
    ? a.keyPoints
        .map((p) => `<li><span>${escapeHtml(p.text)}</span><span class="from">${escapeHtml(p.source)}</span></li>`)
        .join("")
    : `<li><span class="meta">핵심 문장을 찾지 못했습니다. 아래 원문에서 내용을 확인해 주세요.</span></li>`;

  $("anMetrics").innerHTML = a.metrics.length
    ? a.metrics.map((m) => `<span class="chip">${escapeHtml(m.label)} · ${escapeHtml(m.value)}</span>`).join("")
    : `<span class="chip grey">수치 정보를 찾지 못했습니다</span>`;

  const tbody = $("anInfoTable").querySelector("tbody");
  tbody.innerHTML = a.infoRows.length
    ? a.infoRows
        .map((r) => `<tr><td>${escapeHtml(r.field)}</td><td>${escapeHtml(r.value)}</td><td>${escapeHtml(r.source)}</td></tr>`)
        .join("")
    : `<tr><td colspan="3" class="meta">자동으로 정리된 검사 정보가 없습니다. 원문을 확인해 주세요.</td></tr>`;

  $("anTargets").innerHTML = a.targets.length
    ? a.targets.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("")
    : `<span class="chip grey">적용 대상 문구를 찾지 못했습니다</span>`;

  renderHomeStats();
}

function renderImageGallery() {
  const card = $("imageCard");
  const gallery = $("imageGallery");
  const has = state.images.length > 0;
  card.hidden = !has;
  if (!has) {
    gallery.innerHTML = "";
    return;
  }
  gallery.innerHTML = state.images
    .map(
      (img) => `<figure>
        <img src="${img.dataUrl}" alt="${escapeHtml(img.name || "추출 이미지")}" loading="lazy">
        <figcaption>${escapeHtml(truncate(img.name || "", 34))}</figcaption>
        <div class="g-actions">
          <button type="button" class="btn small" data-action="use-image" data-image-id="${escapeHtml(img.id)}">홍보물에 넣기</button>
          <button type="button" class="btn ghost small" data-action="delete-image" data-image-id="${escapeHtml(img.id)}">삭제</button>
        </div>
      </figure>`
    )
    .join("");
}

function analyzeCurrent() {
  const { analysis } = analyze(
    state.rawText.trim()
      ? parseRawTextToUnits(state.rawText)
      : []
  );
  state.analysis = analysis;
  saveAnalysis();
  renderAnalysis();
  renderHomeStats();
}

/** 원문 텍스트(—파일/단위— 형식)를 units로 되돌립니다. */
function parseRawTextToUnits(raw) {
  const units = [];
  let current = null;
  String(raw).split(/\r?\n/).forEach((line) => {
    const match = line.trim().match(/^---\s*(.*?)\s*---$/);
    if (match) {
      current = { file: "직접 입력", label: "", lines: [], text: "" };
      const parts = match[1].split(/\s*\/\s*/);
      current.file = parts[0] || "직접 입력";
      current.label = parts.slice(1).join(" ") || "본문";
      units.push(current);
      return;
    }
    if (!current) {
      current = { file: "직접 입력", label: "본문", lines: [], text: "" };
      units.push(current);
    }
    current.lines.push({ text: line, size: 0 });
  });
  units.forEach((unit) => { unit.text = unit.lines.map((l) => l.text).join("\n"); });
  return units.filter((unit) => unit.lines.length);
}

/** 분석 결과를 홍보물 초안으로 변환합니다. */
function splitFlyerPoint(value, index) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return { icon: String(index + 1), title: "", desc: "" };

  const colon = text.match(/^(.{2,32}?)\s*[:：]\s*(.{4,})$/);
  if (colon) {
    return {
      icon: String(index + 1),
      title: truncate(colon[1].trim(), 32),
      desc: truncate(colon[2].trim(), 105),
    };
  }

  const clause = text.match(/^(.{8,38}?)[,，;；—–]\s*(.{8,})$/);
  if (clause) {
    return {
      icon: String(index + 1),
      title: truncate(clause[1].trim(), 34),
      desc: truncate(clause[2].trim(), 105),
    };
  }

  if (text.length <= 38) {
    return { icon: String(index + 1), title: text, desc: "" };
  }

  const target = Math.min(31, Math.max(20, Math.floor(text.length * 0.42)));
  let splitAt = text.indexOf(" ", target);
  if (splitAt < 16 || splitAt > 42) splitAt = text.lastIndexOf(" ", target);
  if (splitAt < 16) splitAt = 30;

  return {
    icon: String(index + 1),
    title: truncate(text.slice(0, splitAt).trim(), 36),
    desc: truncate(text.slice(splitAt).trim(), 105),
  };
}

/** 분석 자료를 회사 배포형 검사 안내 1P에 맞는 밀도와 순서로 재구성합니다. */
function buildFlyerFromAnalysis() {
  const a = state.analysis || emptyAnalysis();
  const f = defaultFlyer();

  f.title = a.title || "";
  f.subtitle = a.subtitle || "";
  f.kicker = "검사 안내";

  // 실제 자료에 기재된 연구·성능 수치만 강조 지표로 사용합니다.
  // 코드·수가·본인부담 등 운영정보는 아래 검사 정보 표에 배치합니다.
  const metricRank = ["AUC", "민감도", "특이도", "정확도", "양성일치율", "음성일치율", "검출률"];
  const metrics = (a.metrics || [])
    .filter((m) => m && String(m.value || "").trim() && !/코드|수가|부담|일정|결과 보고/i.test(String(m.label || "")))
    .sort((left, right) => {
      const l = metricRank.findIndex((label) => String(left.label || "").includes(label));
      const r = metricRank.findIndex((label) => String(right.label || "").includes(label));
      return (l < 0 ? 99 : l) - (r < 0 ? 99 : r);
    })
    .slice(0, 4)
    .map((m) => ({ value: String(m.value), label: String(m.label || "자료 수치") }));
  f.metrics = metrics;

  // 한 문장짜리 항목도 제목과 설명으로 분리합니다.
  f.points = (a.keyPoints || [])
    .filter((point) => point && String(point.text || "").trim())
    .slice(0, 4)
    .map((point, index) => splitFlyerPoint(point.text, index));

  const normalizeField = (value) => String(value || "")
    .replace(/[\s·/()[\]:：_-]/g, "")
    .toLowerCase();
  const priority = [
    /^(검사코드|검사코드번호|보험코드|edicode|edi코드)/,
    /^(검사명|항목명|검사항목)/,
    /^(검체|시료|검체종류)/,
    /^(검사방법|방법|분석법|측정방법)/,
    /^(검사일정|검사일|시행일|운영일)/,
    /^(보험정보|보험|급여|수가정보|수가|검사수가|본인부담)/,
    /^(소요시간|결과보고|결과통보|검사결과)/,
    /^(보관|유의사항|의뢰방법)/,
  ];
  const rawRows = (a.infoRows || [])
    .filter((row) => row && String(row.field || "").trim() && String(row.value || "").trim())
    .map((row) => ({ field: String(row.field).trim(), value: String(row.value).trim() }));
  const seenFields = new Set();
  const rows = rawRows
    .filter((row) => {
      const key = normalizeField(row.field);
      if (!key || seenFields.has(key)) return false;
      seenFields.add(key);
      return true;
    })
    .sort((left, right) => {
      const score = (row) => {
        const field = normalizeField(row.field);
        const index = priority.findIndex((pattern) => pattern.test(field));
        return index < 0 ? priority.length : index;
      };
      return score(left) - score(right);
    });

  // 제목이 검사명으로 확인되는 경우 보조 행으로 추가합니다.
  if (f.title && !rows.some((row) => /검사명|항목명|검사항목/.test(normalizeField(row.field)))) {
    rows.unshift({ field: "검사명", value: f.title });
  }
  f.infoRows = rows.slice(0, 7);
  f.targets = (a.targets || []).slice(0, 6);

  const usedInPoints = f.points.map((point) => point.title + " " + point.desc);
  const noteCandidate = (a.keyPoints || [])
    .map((point) => String(point && point.text || "").trim())
    .find((text) => text && !usedInPoints.some((used) => used.includes(text.slice(0, 18))));
  f.note = truncate(noteCandidate || "", 150);

  // 참고문헌은 분석기가 추출한 원문만 사용합니다.
  f.references = (a.references || [])
    .map((reference) => typeof reference === "string" ? reference : String(reference && reference.text || "").trim())
    .filter(Boolean)
    .slice(0, 4);

  const flyerImageChoice = getBestFlyerImage();
  f.imageId = flyerImageChoice ? flyerImageChoice.id : null;
  f.imageCaption = flyerImageChoice ? truncate(flyerImageChoice.name || "", 40) : "";

  state.flyer = normalizeFlyer(f);
  saveFlyer();
  return state.flyer;
}

/* ---------- 홍보물 페이지 ---------- */

function renderFlyerPage() {
  if (!state.flyer) {
    // 최초 방문 시 분석 결과가 있으면 초안을 만들고, 없으면 빈 양식을 제공합니다.
    state.flyer = state.analysis && (state.analysis.title || state.analysis.keyPoints.length)
      ? buildFlyerFromAnalysis()
      : normalizeFlyer(defaultFlyer());
    saveFlyer();
  }
  renderFlyerEditorPanel();
  renderFlyerPreview();
}

function renderFlyerEditorPanel() {
  $("flyerEditor").innerHTML = renderFlyerEditor(state.flyer, state.images);
}

function renderFlyerPreview() {
  refreshFlyerImage();
  const root = $("printRoot");
  const fitted = findBestDense(state.flyer, flyerImage, 3);
  currentDense = fitted.level;

  root.innerHTML = renderFlyerHtml(state.flyer, flyerImage, currentDense);
  // 스케일 계산 전에 높이를 잡아 둡니다.
  root.style.width = "794px";
  requestAnimationFrame(() => fitScaler(root));

  if ($("exportStatus")) {
    const levelText = ["기본", "소폭 축소", "축소", "최대 축소"][currentDense] || "기본";
    setStatus(
      $("exportStatus"),
      fitted.fitted
        ? `A4 1장에 맞춰 배치했습니다 (${levelText}). 인쇄 결과와 동일한 비율입니다.`
        : `내용이 1장을 초과해 최대 축소했습니다. 문구를 줄이면 더 선명하게 인쇄됩니다.`,
      fitted.fitted ? "ok" : "err"
    );
  }
  renderHomeStats();
}

const refreshPreview = debounce(() => {
  renderFlyerPreview();
}, 240);

function syncEditorToState(target) {
  const f = state.flyer;
  const singular = target.dataset.flyer;
  if (singular === "targetsText") {
    f.targets = target.value.split(/[,，\n]/).map((t) => t.trim()).filter(Boolean).slice(0, 6);
    return true;
  }
  if (singular === "referencesText") {
    f.references = target.value.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 4);
    return true;
  }
  if (singular) {
    f[singular] = target.value;
    return true;
  }
  const list = target.dataset.flyerList;
  const index = Number(target.dataset.index);
  const key = target.dataset.key;
  if (list && f[list] && f[list][index]) {
    f[list][index][key] = target.value;
    return true;
  }
  return false;
}

/* ---------- 제안서 ---------- */

function collectProposalInput() {
  const baseRaw = $("pBasePrice").value;
  const rateRaw = $("pDiscountRate").value;
  const basePrice = Number(baseRaw) || 0;
  const rate = Number(rateRaw);
  const hasBase = baseRaw !== "" && basePrice >= 0;
  const hasRate = rateRaw !== "" && Number.isFinite(rate) && rate >= 0 && rate <= 100;
  const discount = hasBase && hasRate ? Math.round((basePrice * rate) / 100) : null;
  const proposed = hasBase && hasRate ? basePrice - discount : null;

  return {
    clinic: $("pClinic").value.trim(),
    manager: $("pManager").value.trim(),
    type: $("pType").value,
    date: $("pDate").value || todayISO(),
    situation: $("pSituation").value.trim(),
    needs: $("pNeeds").value.trim(),
    action: $("pAction").value.trim(),
    item: $("pOfferItem").value.trim(),
    basePrice, rate, hasBase, hasRate, discount, proposed,
    period: $("pOfferPeriod").value.trim(),
    conditions: $("pOfferConditions").value.trim(),
    support: $("pSupport").value.trim(),
    includeFlyer: $("pIncludeFlyer").checked,
  };
}

function updatePricingDisplay() {
  const p = collectProposalInput();
  const fmt = (v) => `${formatNumber(v)}원`;
  $("pDiscountAmountDisplay").textContent = !p.hasBase
    ? "기준 단가 입력 필요"
    : !p.hasRate
      ? "승인 할인율 입력 필요"
      : fmt(p.discount);
  $("pProposedPriceDisplay").textContent = p.proposed === null
    ? "기준 단가와 승인 할인율 입력 후 계산"
    : fmt(p.proposed);
  return p;
}

/* 제안서에 넣을 이미지 — 1P 홍보물에 연결된 이미지를 우선 사용합니다. */
function proposalImage() {
  if ($("pIncludeImage") && !$("pIncludeImage").checked) return null;
  const usable = state.images.filter((img) => !img.fullPage);
  if (!usable.length) return null;

  const flyer = state.flyer ? normalizeFlyer(state.flyer) : null;
  const linked = flyer ? usable.find((img) => img.id === flyer.imageId) : null;
  const picked = linked || usable[0];

  return {
    dataUrl: picked.dataUrl,
    name: picked.name || "첨부 자료 이미지",
    caption: (flyer && flyer.imageCaption) || picked.name || "",
  };
}

/** 제안서 문서(HTML) + 텍스트 요약을 함께 만듭니다. */
function buildProposalDocument() {
  const p = updatePricingDisplay();
  const a = state.analysis || emptyAnalysis();

  proposalHtml = renderProposalHtml(p, a, { image: proposalImage() });

  let text = proposalToPlainText(p, a);
  // 복사·Word 저장용 텍스트에는 1P 홍보물 요약을 선택적으로 덧붙입니다.
  if (p.includeFlyer && state.flyer && normalizeFlyer(state.flyer).title) {
    text = `${text}\n\n[첨부 홍보물 요약]\n${flyerToPlainText(state.flyer)}`;
  }

  return { text, proposal: p, html: proposalHtml };
}

/** A4 제안서 미리보기를 화면 폭에 맞춰 축소 배치합니다. */
function fitProposalScaler() {
  const host = $("proposalPreview");
  if (!host) return;
  const doc = host.querySelector(".proposal-doc");
  if (!doc) {
    host.style.height = "";
    return;
  }
  const avail = host.clientWidth || PROPOSAL_WIDTH;
  const scale = Math.min(1, Math.max(0.24, avail / PROPOSAL_WIDTH));
  doc.style.width = `${PROPOSAL_WIDTH}px`;
  doc.style.transformOrigin = "top left";
  doc.style.transform = `scale(${scale})`;
  host.style.height = `${Math.round(doc.offsetHeight * scale)}px`;
}

function renderProposalPreview() {
  const host = $("proposalPreview");
  if (!host) return;
  if (!proposalHtml) {
    host.innerHTML = "";
    host.style.height = "";
    return;
  }
  host.innerHTML = proposalHtml;
  requestAnimationFrame(fitProposalScaler);
}

/* ---------- 신규개원·채용정보 ---------- */
let clinicJobs = [];
let clinicJobsLoaded = false;

function jobRegionMatches(item, area) {
  if (!area) return true;
  const region = String(item.region || "");
  const title = String(item.title || "");
  const text = region + " " + title;
  if (area === "김해") return /김해/.test(text);
  if (area === "강서") return /강서/.test(text);
  if (area === "사하") return /사하/.test(text);
  if (area === "사상") return /사상/.test(text);
  return true;
}

function renderClinicJobs() {
  const list = $("jobList");
  if (!list) return;
  const area = $("jobArea")?.value || "";
  const query = ($("jobSearch")?.value || "").trim().toLowerCase();
  const filtered = clinicJobs.filter((item) =>
    jobRegionMatches(item, area) &&
    (!query || (String(item.title || "") + " " + String(item.region || "") + " " + String(item.source || "")).toLowerCase().includes(query))
  );
  $("jobCount").textContent = String(filtered.length);
  if (!filtered.length) {
    list.innerHTML = '<div class="card"><h3>표시할 공고가 없습니다.</h3><p>지역 필터를 전체로 바꾸거나 다른 검색어를 입력해 주세요. 수집 결과가 없는 경우 다음 자동 업데이트를 기다려 주세요.</p></div>';
    return;
  }
  list.innerHTML = filtered.map((item) => {
    const title = escapeHtml(item.title || "제목 없음");
    const region = escapeHtml(item.region || "지역 확인 필요");
    const source = escapeHtml(item.source || "출처 미상");
    const date = escapeHtml(item.date || "게시일 확인 필요");
    const link = String(item.link || "");
    const safeLink = /^https?:\/\//i.test(link) ? link : "";
    return '<article class="card job-card"><div class="job-card-top"><span class="job-region">' + region + '</span><span class="job-date">' + date + '</span></div><h3>' + title + '</h3><p class="meta">출처: ' + source + '</p>' + (safeLink ? '<a class="btn job-link" href="' + escapeHtml(safeLink) + '" target="_blank" rel="noopener noreferrer">공고·기사 열기 ↗</a>' : '') + '</article>';
  }).join("");
}

async function loadClinicJobs() {
  const status = $("jobStatus");
  if (!status) return;
  status.textContent = "공고 데이터를 불러오는 중입니다.";
  try {
    const response = await fetch("../results.json?ts=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    clinicJobs = Array.isArray(data.results) ? data.results : [];
    clinicJobsLoaded = true;
    $("jobUpdated").textContent = "마지막 업데이트: " + String(data.updated_at || "날짜 정보 없음").replace("T", " ").slice(0, 16);
    status.textContent = "자동수집 결과 " + clinicJobs.length + "건 · 공고를 선택하면 원문이 새 탭에서 열립니다.";
    renderClinicJobs();
  } catch (error) {
    clinicJobsLoaded = false;
    clinicJobs = [];
    $("jobUpdated").textContent = "업데이트 날짜를 확인할 수 없습니다.";
    status.textContent = "공고 데이터를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";
    $("jobList").innerHTML = '<div class="card"><h3>데이터 연결을 확인해 주세요.</h3><p>기존 자동수집 결과 파일(results.json)을 읽지 못했습니다.</p></div>';
  }
}

/* ---------- 이벤트 배선 ---------- */

function wireNavigation() {
  $$(".navbtn").forEach((btn) => btn.addEventListener("click", () => showPage(btn.dataset.page)));
  $("jobArea")?.addEventListener("change", renderClinicJobs);
  $("jobSearch")?.addEventListener("input", renderClinicJobs);
  $("jobReload")?.addEventListener("click", loadClinicJobs);
  document.addEventListener("click", (event) => {
    const launcher = event.target.closest("[data-page]");
    if (launcher && !launcher.classList.contains("navbtn")) {
      showPage(launcher.dataset.page);
    }
  });
}

function wireMaterials() {
  const input = $("materialFiles");
  const zone = $("dropZone");

  ["dragenter", "dragover"].forEach((type) => {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add("hover");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.remove("hover");
    });
  });
  zone.addEventListener("drop", (event) => {
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      input.files = files;
      setStatus($("extractStatus"), `${files.length}개 파일이 선택되었습니다. ‘자료 읽고 분석하기’를 눌러 주세요.`);
    }
  });

  input.addEventListener("change", () => {
    const count = input.files ? input.files.length : 0;
    setStatus($("extractStatus"), count ? `${count}개 파일이 선택되었습니다. ‘자료 읽고 분석하기’를 눌러 주세요.` : "아직 첨부된 자료가 없습니다.");
  });

  $("btnExtract").addEventListener("click", async () => {
    const files = input.files;
    if (!files || !files.length) {
      setStatus($("extractStatus"), "먼저 PDF 또는 PPTX 파일을 선택해 주세요.", "err");
      return;
    }

    const options = {
      images: $("optImages").checked,
      fontSize: $("optFontSize").checked,
      clean: $("optClean").checked,
    };

    const button = $("btnExtract");
    button.disabled = true;
    const progress = $("extractProgress");
    const bar = $("extractProgressBar");
    progress.hidden = false;
    bar.style.width = "4%";
    setStatus($("extractStatus"), "자료를 읽는 중입니다. 파일 크기에 따라 시간이 걸릴 수 있습니다.");

    try {
      const result = await extractFiles(files, options, (info) => {
        const overall = ((info.fileIndex + info.page / Math.max(1, info.total)) / info.fileCount) * 100;
        bar.style.width = `${Math.max(4, Math.min(99, overall))}%`;
        setStatus($("extractStatus"), `읽는 중: ${info.name} (${info.page}/${info.total})`);
      });

      state.files = result.report;
      state.rawText = result.rawText;
      if (options.images) {
        state.images = result.images;
      }

      loadExtractedResult(result, { imagesApplied: options.images });

      bar.style.width = "100%";

      const okCount = result.report.filter((f) => f.ok).length;
      renderFileReport();
      if (!okCount) {
        setStatus($("extractStatus"), "텍스트를 추출하지 못했습니다. 이미지로만 만들어진 자료인지 확인해 주세요.", "err");
      }
    } catch (error) {
      setStatus($("extractStatus"), `처리 중 문제가 발생했습니다: ${error.message}`, "err");
    } finally {
      button.disabled = false;
      setTimeout(() => { progress.hidden = true; bar.style.width = "0"; }, 800);
    }
  });

  $("btnResetMaterials").addEventListener("click", () => {
    if (!confirm("첨부 자료, 추출 텍스트, 분석 결과를 모두 지웁니다. 계속할까요?")) return;
    clearMaterials();
    input.value = "";
    $("extractStatus").className = "status";
    renderAnalysis();
    renderHomeStats();
  });

  $("btnSample").addEventListener("click", () => {
    if (state.rawText.trim() && !confirm("현재 분석 결과를 샘플 자료로 바꿉니다. 계속할까요?")) return;
    const units = sampleUnits();
    state.files = sampleFileReport();
    state.rawText = units
      .map((unit) => `--- ${unit.file} / ${unit.label} ---\n${unit.lines.map((l) => l.text).join("\n")}`)
      .join("\n\n");
    const { analysis } = analyze(units);
    state.analysis = analysis;
    saveAnalysis();
    renderAnalysis();
    renderHomeStats();
    setStatus($("extractStatus"), "샘플 자료를 불러왔습니다. 실제 파일을 쓰지 않고 결과물을 먼저 확인할 수 있습니다.", "ok");
  });

  $("btnReanalyze").addEventListener("click", () => {
    state.rawText = $("rawText").value;
    analyzeCurrent();
    setStatus($("extractStatus"), "원문을 다시 분석했습니다.", "ok");
  });

  $("btnDownloadText").addEventListener("click", () => {
    const text = $("rawText").value;
    if (!text.trim()) {
      setStatus($("extractStatus"), "저장할 텍스트가 없습니다.", "err");
      return;
    }
    downloadBlob(new Blob(["\ufeff", text], { type: "text/plain;charset=utf-8" }), "추출원문.txt");
  });

  document.addEventListener("click", (event) => {
    const useBtn = event.target.closest('[data-action="use-image"]');
    if (useBtn) {
      if (!state.flyer) state.flyer = normalizeFlyer(state.flyer || buildFlyerFromAnalysis());
      state.flyer.imageId = useBtn.dataset.imageId;
      state.flyer.imageCaption = truncate((getImageById(useBtn.dataset.imageId) || {}).name || "", 40);
      saveFlyer();
      showPage("flyer");
      return;
    }
    const delBtn = event.target.closest('[data-action="delete-image"]');
    if (delBtn) {
      const id = delBtn.dataset.imageId;
      state.images = state.images.filter((img) => img.id !== id);
      if (state.flyer && state.flyer.imageId === id) {
        state.flyer.imageId = state.images.length ? state.images[0].id : null;
        saveFlyer();
      }
      renderImageGallery();
      renderHomeStats();
    }
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const name = action.dataset.action;
    if (name === "build-flyer") {
      buildFlyerFromAnalysis();
      showPage("flyer");
    }
    if (name === "build-proposal") {
      if (!state.analysis) return;
      const first = state.analysis.title || "";
      if (first && !$("pNeeds").value.trim()) {
        $("pNeeds").value = truncate(`첨부자료의 「${first}」 관련 검사 항목 도입 및 운영 지원을 제안합니다.`, 120);
      }
      showPage("proposal");
      $("proposalStatus").textContent = "분석 결과가 제안서 근거 자료로 연결되었습니다. ‘제안서 초안 만들기’를 눌러 주세요.";
      $("proposalStatus").className = "status ok";
    }
  });
}

function wireFlyer() {
  $("flyerEditor").addEventListener("input", (event) => {
    const target = event.target;
    if (!state.flyer) return;
    if (syncEditorToState(target)) {
      saveFlyer();
      refreshPreview();
    }
  });

  $("flyerEditor").addEventListener("change", (event) => {
    const target = event.target;
    if (target.type === "checkbox" && syncEditorToState(target)) {
      saveFlyer();
      refreshPreview();
    }
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;
    if (!action) return;
    if (!state.flyer) state.flyer = normalizeFlyer(defaultFlyer());

    const f = state.flyer;

    if (action === "fill-from-analysis") {
      if (!state.analysis || (!state.analysis.title && !state.analysis.keyPoints.length)) {
        setStatus($("exportStatus"), "먼저 ‘자료 첨부·분석’에서 자료를 읽어 주세요.", "err");
        return;
      }
      if (!confirm("현재 홍보물 내용을 분석 결과로 다시 채웁니다. 직접 수정한 내용은 사라집니다. 계속할까요?")) return;
      buildFlyerFromAnalysis();
      renderFlyerEditorPanel();
      renderFlyerPreview();
      setStatus($("exportStatus"), "분석 결과로 홍보물을 채웠습니다.", "ok");
      return;
    }

    if (action === "fit-flyer") {
      renderFlyerPreview();
      return;
    }

    if (action === "reset-flyer") {
      if (!confirm("홍보물 내용을 모두 지우고 빈 양식으로 되돌립니다. 계속할까요?")) return;
      resetFlyer();
      state.flyer = normalizeFlyer(defaultFlyer());
      saveFlyer();
      renderFlyerEditorPanel();
      renderFlyerPreview();
      return;
    }

    if (action === "add-metric") {
      if (f.metrics.length >= 4) {
        setStatus($("exportStatus"), "지표는 최대 4개까지 넣을 수 있습니다.", "err");
        return;
      }
      f.metrics.push({ value: "", label: "" });
      saveFlyer();
      renderFlyerEditorPanel();
      renderFlyerPreview();
      return;
    }
    if (action === "add-point") {
      if (f.points.length >= 5) {
        setStatus($("exportStatus"), "포인트는 최대 5개까지 넣을 수 있습니다.", "err");
        return;
      }
      f.points.push({ icon: String(f.points.length + 1), title: "", desc: "" });
      saveFlyer();
      renderFlyerEditorPanel();
      renderFlyerPreview();
      return;
    }
    if (action === "add-info") {
      if (f.infoRows.length >= 8) {
        setStatus($("exportStatus"), "표 항목은 최대 8개까지 넣을 수 있습니다.", "err");
        return;
      }
      f.infoRows.push({ field: "", value: "" });
      saveFlyer();
      renderFlyerEditorPanel();
      renderFlyerPreview();
      return;
    }

    const removeMatch = action.match(/^remove-(metric|point|info)$/);
    if (removeMatch) {
      const key = removeMatch[1] === "metric" ? "metrics" : removeMatch[1] === "point" ? "points" : "infoRows";
      const index = Number(trigger.dataset.index);
      f[key].splice(index, 1);
      saveFlyer();
      renderFlyerEditorPanel();
      renderFlyerPreview();
      return;
    }

    if (action === "pick-image") {
      f.imageId = trigger.dataset.imageId || null;
      const img = getImageById(f.imageId);
      if (img) f.imageCaption = f.imageCaption || truncate(img.name || "", 40);
      saveFlyer();
      renderFlyerEditorPanel();
      renderFlyerPreview();
      return;
    }

    if (action === "print-flyer") {
      printFlyer(state.flyer, flyerImage, currentDense);
      return;
    }

    if (action === "export-pptx") {
      trigger.disabled = true;
      setStatus($("exportStatus"), "PPTX 파일을 만드는 중입니다…");
      exportFlyerPptx(state.flyer, flyerImage, currentDense)
        .then(() => setStatus($("exportStatus"), "PPTX 파일을 저장했습니다.", "ok"))
        .catch((error) => setStatus($("exportStatus"), `PPTX 저장 실패: ${error.message}`, "err"))
        .finally(() => { trigger.disabled = false; });
      return;
    }

    if (action === "export-png") {
      trigger.disabled = true;
      setStatus($("exportStatus"), "PNG 이미지를 만드는 중입니다…");
      exportFlyerPng(state.flyer, flyerImage, currentDense, `${slugify(f.title, "홍보물")}.png`)
        .then(() => setStatus($("exportStatus"), "PNG 파일을 저장했습니다.", "ok"))
        .catch((error) => setStatus($("exportStatus"), `PNG 저장 실패: ${error.message}`, "err"))
        .finally(() => { trigger.disabled = false; });
      return;
    }

    if (action === "export-imagepdf") {
      trigger.disabled = true;
      setStatus($("exportStatus"), "이미지 PDF를 만드는 중입니다…");
      exportFlyerImagePdf(state.flyer, flyerImage, currentDense, `${slugify(f.title, "홍보물")}.pdf`)
        .then(() => setStatus($("exportStatus"), "PDF 파일을 저장했습니다.", "ok"))
        .catch((error) => setStatus($("exportStatus"), `PDF 저장 실패: ${error.message}`, "err"))
        .finally(() => { trigger.disabled = false; });
      return;
    }

    if (action === "copy-flyer-text") {
      copyText(flyerToPlainText(state.flyer))
        .then(() => setStatus($("exportStatus"), "홍보물 내용을 클립보드에 복사했습니다.", "ok"))
        .catch((error) => setStatus($("exportStatus"), error.message, "err"));
    }
  });

  window.addEventListener("resize", debounce(() => {
    if ($("flyer").classList.contains("active")) fitScaler($("printRoot"));
  }, 200));
}

function wireProposal() {
  ["pBasePrice", "pDiscountRate"].forEach((id) => {
    $(id).addEventListener("input", updatePricingDisplay);
  });

  $("pDate").value = todayISO();
  updatePricingDisplay();

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (action === "gen-proposal") {
      const { text, proposal } = buildProposalDocument();
      state.proposal = { text, meta: proposal, generatedAt: new Date().toISOString() };
      saveProposal();
      $("proposalPreviewCard").hidden = false;
      renderProposalPreview();
      setStatus($("proposalStatus"), "A4 제안서를 만들었습니다. 미리보기를 확인해 주세요.", "ok");
      return;
    }

    if (action === "export-proposal-pdf") {
      if (!state.proposal?.text) {
        setStatus($("proposalStatus"), "먼저 ‘제안서 초안 만들기’를 눌러 주세요.", "err");
        return;
      }
      const clinic = $("pClinic").value.trim() || "제안서";
      // 폼 값을 바꾼 뒤 바로 누를 수 있으므로 내보내기 직전에 다시 조립합니다.
      const { html } = buildProposalDocument();
      trigger.disabled = true;
      setStatus($("proposalStatus"), "PDF를 만드는 중입니다. 페이지 수만큼 시간이 걸릴 수 있습니다…");
      exportProposalPdf(html, `${slugify(clinic, "제안서")}_제안서.pdf`)
        .then(() => setStatus($("proposalStatus"), "PDF 파일을 저장했습니다.", "ok"))
        .catch((error) => setStatus($("proposalStatus"), `PDF 저장 실패: ${error.message}`, "err"))
        .finally(() => { trigger.disabled = false; });
      return;
    }

    if (action === "copy-proposal") {
      if (!state.proposal?.text) {
        setStatus($("proposalStatus"), "먼저 ‘제안서 초안 만들기’를 눌러 주세요.", "err");
        return;
      }
      copyText(state.proposal.text)
        .then(() => setStatus($("proposalStatus"), "제안서 내용을 클립보드에 복사했습니다.", "ok"))
        .catch((error) => setStatus($("proposalStatus"), error.message, "err"));
      return;
    }

    if (action === "download-doc") {
      if (!state.proposal?.text) {
        setStatus($("proposalStatus"), "먼저 ‘제안서 초안 만들기’를 눌러 주세요.", "err");
        return;
      }
      const clinic = $("pClinic").value.trim() || "제안서";
      exportWord(`${clinic} 제안서`, state.proposal.text, `${slugify(clinic, "제안서")}_제안서.doc`);
      setStatus($("proposalStatus"), "Word 파일(.doc)을 저장했습니다.", "ok");
      return;
    }

    if (action === "print-proposal") {
      if (!state.proposal?.text) {
        setStatus($("proposalStatus"), "먼저 ‘제안서 초안 만들기’를 눌러 주세요.", "err");
        return;
      }
      // A4 문서 형태 그대로 인쇄합니다. (텍스트 덤프가 아님)
      const { html } = buildProposalDocument();
      printHtml(html);
      return;
    }
  });

  window.addEventListener("resize", debounce(() => {
    if ($("proposal") && $("proposal").classList.contains("active")) fitProposalScaler();
  }, 200));
}

/* ---------- 학술교육 페이지 ---------- */

/** 교육자료실 : 홍보물 · 영업화법예시 산출물 카드 */
function renderTrainingDocList() {
  const host = $("trainingDocList");
  if (!host) return;

  const f = state.flyer ? normalizeFlyer(state.flyer) : null;
  const tr = state.training ? normalizeTraining(state.training) : null;

  const docs = [
    {
      key: "flyer",
      kind: "1P 홍보물",
      title: f && f.title ? f.title : "",
      desc: "A4 1장 홍보물 · PDF · PPTX · PNG 저장",
      page: "flyer",
    },
    {
      key: "training",
      kind: "영업화법예시",
      title: tr && tr.title ? tr.title : "",
      desc: "학술교육용 5단계(0:00~5:00) 화법지 · 이미지(PNG) 추출",
      page: "training",
    },
  ];

  host.innerHTML = docs
    .map((doc) => {
      const ready = Boolean(doc.title);
      return `<article class="doc-card ${ready ? "" : "is-empty"}">
        <span class="doc-kind ${ready ? "" : "grey"}">${escapeHtml(doc.kind)}</span>
        <h4>${escapeHtml(ready ? doc.title : "아직 만들지 않았습니다")}</h4>
        <p class="doc-desc">${escapeHtml(doc.desc)}</p>
        <div class="doc-actions">
          <button type="button" class="btn small" data-page="${doc.page}">${ready ? "열기" : "만들기"} →</button>
          ${ready ? `<button type="button" class="btn ghost small" data-action="doc-export" data-doc="${doc.key}" data-format="png">이미지(PNG)</button>` : ""}
          ${ready ? `<button type="button" class="btn ghost small" data-action="doc-export" data-doc="${doc.key}" data-format="imagepdf">이미지 PDF</button>` : ""}
          ${ready && doc.key !== "training" ? `<button type="button" class="btn ghost small" data-action="doc-export" data-doc="${doc.key}" data-format="pptx">PPTX</button>` : ""}
        </div>
      </article>`;
    })
    .join("");
}

/** 학술교육 > 영업화법예시 화면 (편집기 + 미리보기) */
function renderTrainingPage() {
  if (!state.training) {
    state.training = state.analysis && (state.analysis.title || state.analysis.keyPoints.length)
      ? buildTrainingFromAnalysis(state.analysis)
      : normalizeTraining(defaultTraining());
    saveTraining();
  }
  renderTrainingEditorPanel();
  renderTrainingPreview();
}

function renderTrainingEditorPanel() {
  const host = $("trainingEditor");
  if (!host) return;
  host.innerHTML = renderTrainingEditor(state.training);
}

function renderTrainingPreview() {
  const root = $("trainingRoot");
  if (!root) return;

  const fitted = findBestFit(
    (level) => renderTrainingHtml(state.training, level),
    5,
    ".trainingsheet"
  );
  currentTrainingDense = fitted.level;

  root.innerHTML = renderTrainingHtml(state.training, currentTrainingDense);
  root.style.width = "794px";
  requestAnimationFrame(() => fitScaler(root));

  if ($("trainingPreviewStatus")) {
    const levelText = ["기본", "소폭 축소", "축소", "축소", "더 축소", "최대 축소"][currentTrainingDense] || "기본";
    setStatus(
      $("trainingPreviewStatus"),
      fitted.fitted
        ? `A4 1장에 맞춰 배치했습니다 (${levelText}). ‘이미지(PNG)로 추출’을 누르면 이 화면 그대로 이미지가 저장됩니다.`
        : `내용이 1장을 초과해 최대 축소했습니다. 문장을 줄이면 더 선명하게 저장됩니다.`,
      fitted.fitted ? "ok" : "err"
    );
  }
  renderHomeStats();
}

const refreshTrainingPreview = debounce(() => {
  renderTrainingPreview();
}, 240);

/** 편집기 입력값을 state.training에 반영합니다. */
function syncTrainingEditorToState(target) {
  const t = state.training;
  if (!t) return false;

  const singular = target.dataset.training;
  if (singular) {
    t[singular] = target.value;
    return true;
  }

  const stepIndex = Number(target.dataset.step);
  const step = t.steps[stepIndex];
  if (!step) return false;

  const stepKey = target.dataset.trainingStep;
  if (stepKey) {
    step[stepKey] = target.value;
    return true;
  }

  const index = Number(target.dataset.index);
  const listKey = target.dataset.trainingList;
  if (listKey && Array.isArray(step[listKey])) {
    step[listKey][index] = target.value;
    return true;
  }

  const itemKey = target.dataset.trainingItem;
  if (itemKey && Array.isArray(step[itemKey]) && step[itemKey][index]) {
    step[itemKey][index][target.dataset.key] = target.value;
    return true;
  }

  return false;
}

/** 학술교육 서브탭 배선 */
function wireSubnav() {
  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".subnav-btn");
    if (!btn) return;
    showSubtab(btn.dataset.subtab);
  });
}

function wireTraining() {
  const editor = $("trainingEditor");
  if (!editor) return;

  editor.addEventListener("input", (event) => {
    if (!state.training) return;
    if (syncTrainingEditorToState(event.target)) {
      saveTraining();
      refreshTrainingPreview();
    }
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;
    if (!action) return;

    /* 교육자료실 카드에서 바로 저장 */
    if (action === "doc-export") {
      const key = trigger.dataset.doc;
      const format = trigger.dataset.format;
      const html = currentSheetHtml(key);
      if (!html) {
        setStatus($("trainingStatus"), "먼저 해당 교육자료를 만들어 주세요.", "err");
        return;
      }
      const name = sheetFileName(key);
      trigger.disabled = true;
      setStatus($("trainingStatus"), "저장할 파일을 만드는 중입니다…");
      const job = format === "pptx" && key === "flyer"
        ? exportFlyerPptx(state.flyer, flyerImage, currentDense)
        : format === "pptx"
          ? Promise.reject(new Error("PPTX 저장은 1P 홍보물에서만 지원합니다."))
          : format === "imagepdf"
            ? exportHtmlImagePdf(html, `${name}.pdf`)
            : exportHtmlPng(html, `${name}.png`);
      job
        .then(() => setStatus($("trainingStatus"), `${name} 파일을 저장했습니다.`, "ok"))
        .catch((error) => setStatus($("trainingStatus"), `저장 실패: ${error.message}`, "err"))
        .finally(() => { trigger.disabled = false; });
      return;
    }

    if (!action.includes("training")) return;
    if (!state.training) state.training = normalizeTraining(defaultTraining());

    const t = state.training;

    if (action === "build-training" || action === "fill-training") {
      if (!state.analysis || (!state.analysis.title && !state.analysis.keyPoints.length)) {
        setStatus($("trainingStatus"), "먼저 ‘자료 첨부·분석’에서 자료를 읽어 주세요.", "err");
        return;
      }
      if (action === "fill-training"
        && !confirm("현재 화법지 내용을 분석 결과로 다시 채웁니다. 직접 수정한 내용은 사라집니다. 계속할까요?")) return;
      state.training = buildTrainingFromAnalysis(state.analysis);
      saveTraining();
      showSubtab("training-script");
      setStatus($("trainingStatus"), "분석 결과로 영업화법예시를 만들었습니다.", "ok");
      return;
    }

    if (action === "fit-training") {
      renderTrainingPreview();
      return;
    }

    if (action === "reset-training") {
      if (!confirm("영업화법예시 내용을 모두 지우고 빈 양식으로 되돌립니다. 계속할까요?")) return;
      resetTraining();
      state.training = normalizeTraining(defaultTraining());
      saveTraining();
      renderTrainingEditorPanel();
      renderTrainingPreview();
      renderTrainingDocList();
      return;
    }

    if (action === "add-training-item") return; // 아래 개별 추가 액션에서 처리

    const addMatch = action.match(/^add-training-(quote|question|feature|metric|script|info|pair|tag)$/);
    if (addMatch) {
      const map = {
        quote: { key: "quotes", max: 4, value: "" },
        question: { key: "questions", max: 5, value: "" },
        feature: { key: "features", max: 4, value: { head: "", body: "" } },
        metric: { key: "metrics", max: 4, value: { head: "", items: [] } },
        script: { key: "scripts", max: 4, value: "" },
        info: { key: "infoRows", max: 8, value: { field: "", value: "" } },
        pair: { key: "pairs", max: 5, value: { q: "", a: "" } },
        tag: { key: "tags", max: 4, value: "" },
      }[addMatch[1]];
      const stepIndex = Number(trigger.dataset.step);
      const step = t.steps[stepIndex];
      if (!map || !step) return;
      if (step[map.key].length >= map.max) {
        setStatus($("trainingStatus"), `최대 ${map.max}개까지 넣을 수 있습니다.`, "err");
        return;
      }
      step[map.key].push(typeof map.value === "object" ? { ...map.value } : "");
      saveTraining();
      renderTrainingEditorPanel();
      renderTrainingPreview();
      return;
    }

    if (action === "remove-training-item") {
      const stepIndex = Number(trigger.dataset.step);
      const index = Number(trigger.dataset.index);
      const kind = trigger.dataset.kind;
      const step = t.steps[stepIndex];
      if (!step || !Array.isArray(step[kind])) return;
      step[kind].splice(index, 1);
      saveTraining();
      renderTrainingEditorPanel();
      renderTrainingPreview();
      return;
    }

    if (action === "print-training") {
      printHtml(renderTrainingHtml(state.training, currentTrainingDense));
      return;
    }

    if (action === "export-training-png") {
      trigger.disabled = true;
      setStatus($("trainingPreviewStatus"), "이미지(PNG)를 만드는 중입니다…");
      exportHtmlPng(renderTrainingHtml(state.training, currentTrainingDense), `${slugify(t.title, "영업화법예시")}_화법지.png`)
        .then(() => setStatus($("trainingPreviewStatus"), "PNG 파일을 저장했습니다.", "ok"))
        .catch((error) => setStatus($("trainingPreviewStatus"), `PNG 저장 실패: ${error.message}`, "err"))
        .finally(() => { trigger.disabled = false; });
      return;
    }

    if (action === "export-training-imagepdf") {
      trigger.disabled = true;
      setStatus($("trainingPreviewStatus"), "이미지 PDF를 만드는 중입니다…");
      exportHtmlImagePdf(renderTrainingHtml(state.training, currentTrainingDense), `${slugify(t.title, "영업화법예시")}_화법지.pdf`)
        .then(() => setStatus($("trainingPreviewStatus"), "PDF 파일을 저장했습니다.", "ok"))
        .catch((error) => setStatus($("trainingPreviewStatus"), `PDF 저장 실패: ${error.message}`, "err"))
        .finally(() => { trigger.disabled = false; });
      return;
    }

    if (action === "copy-training-text") {
      copyText(trainingToPlainText(state.training))
        .then(() => setStatus($("trainingPreviewStatus"), "영업화법예시 내용을 클립보드에 복사했습니다.", "ok"))
        .catch((error) => setStatus($("trainingPreviewStatus"), error.message, "err"));
    }
  });

  window.addEventListener("resize", debounce(() => {
    if ($("training") && $("training").classList.contains("active")) fitScaler($("trainingRoot"));
  }, 200));
}

/** 교육자료실 카드용 : 현재 상태의 1P 문서 HTML을 돌려줍니다. */
function currentSheetHtml(key) {
  if (key === "flyer") {
    if (!state.flyer || !normalizeFlyer(state.flyer).title) return "";
    refreshFlyerImage();
    return renderFlyerHtml(state.flyer, flyerImage, currentDense);
  }
  if (key === "training") {
    if (!state.training || !normalizeTraining(state.training).title) return "";
    return renderTrainingHtml(state.training, currentTrainingDense);
  }
  return "";
}

function sheetFileName(key) {
  if (key === "flyer") return slugify(normalizeFlyer(state.flyer).title, "홍보물");
  return slugify(normalizeTraining(state.training).title, "영업화법예시");
}

function wireProposalPersistence() {
  const ids = ["pClinic", "pManager", "pType", "pDate", "pSituation", "pNeeds", "pAction",
    "pOfferItem", "pBasePrice", "pDiscountRate", "pOfferPeriod", "pOfferConditions", "pSupport"];
  const KEY = "busan3_proposal_form_v1";

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) {
      ids.forEach((id) => { if ($(id) && saved[id] != null) $(id).value = saved[id]; });
      if (saved.pIncludeFlyer === false) $("pIncludeFlyer").checked = false;
      if (saved.pIncludeImage === false && $("pIncludeImage")) $("pIncludeImage").checked = false;
    }
  } catch (error) { /* 무시 */ }

  const save = debounce(() => {
    const data = {};
    ids.forEach((id) => { if ($(id)) data[id] = $(id).value; });
    data.pIncludeFlyer = $("pIncludeFlyer").checked;
    if ($("pIncludeImage")) data.pIncludeImage = $("pIncludeImage").checked;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (error) { /* 무시 */ }
  }, 400);

  ids.forEach((id) => $(id) && $(id).addEventListener("input", save));
  $("pIncludeFlyer").addEventListener("change", save);
  if ($("pIncludeImage")) $("pIncludeImage").addEventListener("change", save);
}

/* ---------- 시작 ---------- */

function boot() {
  wireNavigation();
  wireSubnav();
  wireMaterials();
  wireFlyer();
  wireTraining();
  wireProposal();
  wireProposalPersistence();
  wireAging();

  loadAnalysis();
  loadFlyer();
  loadTraining();
  loadProposal();

  if (state.proposal?.text) {
    $("proposalPreviewCard").hidden = false;
    // 저장된 초안을 A4 문서로 다시 그립니다. (텍스트 덤프 대신 문서 형태 유지)
    if (state.analysis && (state.analysis.title || state.analysis.keyPoints.length)) {
      proposalHtml = renderProposalHtml(
        { ...collectProposalInput(), ...(state.proposal.meta || {}) },
        state.analysis,
        { image: proposalImage() }
      );
      renderProposalPreview();
    }
  }

  renderAnalysis();
  renderHomeStats();

  const restored = state.analysis && (state.analysis.title || state.analysis.keyPoints.length);
  if (restored) {
    setStatus(
      $("extractStatus"),
      `이전 작업 내용을 불러왔습니다. (${state.files.length}개 파일, ${formatNumber(state.analysis.charCount)}자)\n이미지는 저장되지 않으므로 필요하면 자료를 다시 읽어 주세요.`
    );
  }

  // #training 같은 주소로 바로 해당 화면을 열 수 있습니다.
  applyHashPage();
  window.addEventListener("hashchange", applyHashPage);
}

function applyHashPage() {
  const name = String(location.hash || "").replace(/^#/, "").trim();
  if (!name) return;
  const page = document.getElementById(name);
  if (page && page.classList.contains("page")) showPage(name);
}

document.addEventListener("DOMContentLoaded", boot);

/* 추출 결과를 분석 → 화면 반영합니다. (추출 경로 / 검증 페이지 공용) */
export function loadExtractedResult(result, options = {}) {
  const { analysis } = analyze(result.units || []);
  state.analysis = analysis;
  saveAnalysis();

  if (options.saveRaw && typeof options.saveRaw === "string") {
    state.rawText = options.saveRaw;
  }

  renderAnalysis();
  renderHomeStats();

  // 새 자료를 읽은 뒤 기존 홍보물도 새 검사 이미지로 연결합니다.
  // PDF 전체 페이지 렌더본은 글자 중복 방지를 위해 자동 삽입하지 않습니다.
  if (options.imagesApplied && state.flyer) {
    const selected = getBestFlyerImage();
    if (selected && selected.id !== state.flyer.imageId) {
      state.flyer.imageId = selected.id;
      state.flyer.imageCaption = truncate(selected.name || "", 40);
      saveFlyer();
    }
    // 방금 만든 개념도도 자료 화면의 추출 이미지 목록에 즉시 표시합니다.
    renderImageGallery();
    renderHomeStats();
  }

  return analysis;
}

/* 샘플 자료 불러오기 (샘플 버튼 / 검증용) */
export function loadSampleMaterials() {
  const units = sampleUnits();
  state.files = sampleFileReport();
  state.rawText = units
    .map((unit) => `--- ${unit.file} / ${unit.label} ---\n${unit.lines.map((l) => l.text).join("\n")}`)
    .join("\n\n");
  state.analysis = analyze(units).analysis;
  saveAnalysis();
  renderAnalysis();
  renderHomeStats();
  return state.analysis;
}

/* 분석 결과로 홍보물 초안을 만들고 홍보물 페이지를 엽니다. (버튼/직접 호출 공용) */
export function seedFlyerFromAnalysis() {
  if (state.analysis && (state.analysis.title || state.analysis.keyPoints.length)) {
    state.flyer = buildFlyerFromAnalysis();
    saveFlyer();
  } else if (!state.flyer) {
    state.flyer = normalizeFlyer(defaultFlyer());
    saveFlyer();
  }
  showPage("flyer");
  return state.flyer;
}

/* 분석 결과로 학술교육 영업화법예시를 만들고 화면을 엽니다. */
export function seedTrainingFromAnalysis() {
  if (state.analysis && (state.analysis.title || state.analysis.keyPoints.length)) {
    state.training = buildTrainingFromAnalysis(state.analysis);
    saveTraining();
  } else if (!state.training) {
    state.training = normalizeTraining(defaultTraining());
    saveTraining();
  }
  showPage("training");
  showSubtab("training-script");
  return state.training;
}

/* 검증용: 샘플 자료로 홍보물 페이지를 엽니다. */
export function seedSampleFlyer() {
  loadSampleMaterials();
  state.flyer = buildFlyerFromAnalysis();
  saveFlyer();
  showPage("flyer");
  return state.flyer;
}

/* 검증용: 샘플 자료로 제안서를 생성합니다. */
export function seedSampleProposal() {
  loadSampleMaterials();
  if (!state.flyer) state.flyer = buildFlyerFromAnalysis();
  showPage("proposal");
  const { text, proposal } = buildProposalText();
  state.proposal = { text, meta: proposal, generatedAt: new Date().toISOString() };
  $("proposalPreviewCard").hidden = false;
  $("proposalPreview").textContent = text;
  return text;
}
