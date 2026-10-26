/* =========================================================
   1P 홍보물 — 렌더 / 편집기 / 자동 맞춤
   ========================================================= */

import { escapeHtml, truncate, formatKoreanDate } from "./utils.js";
import { defaultFlyer } from "./state.js";

export const DENSE_CLASSES = ["", "dense-1", "dense-2", "dense-3"];
export const A4_HEIGHT = 1123;

/* ---------- 정규화 ---------- */

export function normalizeFlyer(flyer) {
  const base = { ...defaultFlyer(), ...(flyer || {}) };
  const str = (v) => String(v ?? "").trim();

  const metrics = (base.metrics || [])
    .map((m) => ({ value: str(m.value), label: str(m.label) }))
    .filter((m) => m.value || m.label)
    .slice(0, 4);

  const points = (base.points || [])
    .map((p) => ({ icon: str(p.icon), title: str(p.title), desc: str(p.desc) }))
    .filter((p) => p.title || p.desc)
    .slice(0, 5);

  const infoRows = (base.infoRows || [])
    .map((r) => ({ field: str(r.field), value: str(r.value) }))
    .filter((r) => r.value)
    .slice(0, 8);

  const targets = (base.targets || []).map((t) => str(t)).filter(Boolean).slice(0, 12);

  return {
    ...base,
    kicker: str(base.kicker),
    title: str(base.title),
    subtitle: str(base.subtitle),
    note: str(base.note),
    imageCaption: str(base.imageCaption),
    footerOrg: str(base.footerOrg),
    footerContact: str(base.footerContact),
    footerNote: str(base.footerNote),
    metrics,
    points,
    infoRows,
    targets,
  };
}

/** 넘칠 때 자동으로 축소 단계를 올립니다. */
export function autoDense(level) {
  const idx = Math.max(0, Math.min(DENSE_CLASSES.length - 1, Number(level) || 0));
  return DENSE_CLASSES[idx];
}

/* ---------- 렌더 ---------- */

export function renderFlyerHtml(flyer, image, denseLevel = 0) {
  const f = normalizeFlyer(flyer);
  const dense = autoDense(denseLevel);
  const hasImage = Boolean(image && image.dataUrl);

  const title = f.title || "홍보물 제목을 입력하세요";
  const titleClass = title.length > 30 ? "xs" : title.length > 20 ? "sm" : "";

  const head = `
    <div class="fl-head">
      <div class="fl-head-top">
        <img class="fl-logo" src="images/ci-seegene.png" alt="재단법인 씨젠의료재단 로고">
        ${f.kicker ? `<span class="fl-kicker">${escapeHtml(f.kicker)}</span>` : ""}
      </div>
      <h1 class="fl-title ${titleClass}">${escapeHtml(title)}</h1>
      ${f.subtitle ? `<p class="fl-sub">${escapeHtml(f.subtitle)}</p>` : ""}
    </div>`;

  const metrics = f.metrics.length
    ? `<div class="fl-metrics">${f.metrics
        .map(
          (m) => `<div class="fl-metric">
            <div class="v">${escapeHtml(m.value)}</div>
            ${m.label ? `<div class="l">${escapeHtml(m.label)}</div>` : ""}
          </div>`
        )
        .join("")}</div>`
    : "";

  const points = f.points.length
    ? `<div class="fl-points">${f.points
        .map(
          (p, i) => `<div class="fl-point">
            <div class="ico">${escapeHtml(p.icon || String(i + 1))}</div>
            <div class="tx">
              ${p.title ? `<b>${escapeHtml(p.title)}</b>` : ""}
              ${p.desc ? `<span>${escapeHtml(p.desc)}</span>` : ""}
            </div>
          </div>`
        )
        .join("")}</div>`
    : `<div class="fl-points"><div class="fl-point"><div class="ico">✓</div><div class="tx"><b>핵심 내용을 입력하세요</b><span>왼쪽 편집기에서 내용을 채우면 이곳에 표시됩니다.</span></div></div></div>`;

  const figure = hasImage
    ? `<figure class="fl-figure">
        <div class="fl-img" role="img" aria-label="${escapeHtml(image.name || "첨부 이미지")}"
             style="background-image:url('${image.dataUrl}')"></div>
        ${f.imageCaption || image.name ? `<figcaption>${escapeHtml(f.imageCaption || truncate(image.name || "", 40))}</figcaption>` : ""}
      </figure>`
    : "";

  const infoTable = f.infoRows.length
    ? `<div>
        <div class="fl-sec-title">검사 정보</div>
        <table class="fl-table">
          <tbody>
            ${f.infoRows
              .map(
                (r) => `<tr><th>${escapeHtml(r.field)}</th><td class="v">${escapeHtml(r.value)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`
    : "";

  const targets = f.targets.length
    ? `<div>
        <div class="fl-sec-title">이런 경우 활용합니다</div>
        <div class="fl-targets">
          ${f.targets.map((t) => `<span class="fl-target">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>`
    : "";

  const note = f.note
    ? `<div class="fl-note">${escapeHtml(f.note)}</div>`
    : "";

  const body = `
    <div class="fl-body">
      ${metrics}
      <div class="fl-zone ${hasImage ? "" : "no-img"}">
        ${points}
        ${figure}
      </div>
      ${infoTable}
      ${targets}
      ${note}
    </div>`;

  const footer = `
    <div class="fl-foot">
      <div class="contact">
        ${f.footerOrg ? `<b>${escapeHtml(f.footerOrg)}</b>` : ""}
        ${f.footerContact ? `<span>${escapeHtml(f.footerContact)}</span>` : ""}
      </div>
      ${f.footerNote ? `<div class="disclaimer">${escapeHtml(f.footerNote)}</div>` : ""}
    </div>`;

  return `<div class="flyer ${dense}">${head}${body}${footer}</div>`;
}

/* ---------- 자동 맞춤 ---------- */

let measureHost = null;

function ensureMeasureHost() {
  if (measureHost && measureHost.isConnected) return measureHost;
  measureHost = document.createElement("div");
  measureHost.setAttribute("aria-hidden", "true");
  measureHost.style.cssText =
    "position:fixed;left:-20000px;top:0;width:794px;visibility:hidden;pointer-events:none;z-index:-1;";
  document.body.appendChild(measureHost);
  return measureHost;
}

/** 홍보물의 실제 내용 높이를 측정합니다. (높이 auto 기준) */
export function measureFlyerHeight(flyer, image, denseLevel) {
  const host = ensureMeasureHost();
  host.innerHTML = renderFlyerHtml(flyer, image, denseLevel);
  const el = host.querySelector(".flyer");
  if (!el) return A4_HEIGHT;
  el.style.height = "auto";
  const height = Math.ceil(el.getBoundingClientRect().height);
  host.innerHTML = "";
  return height;
}

/** 1장에 들어가는 최소 축소 단계를 찾습니다. */
export function findBestDense(flyer, image, maxLevel = 3) {
  for (let level = 0; level <= maxLevel; level++) {
    const height = measureFlyerHeight(flyer, image, level);
    if (height <= A4_HEIGHT - 4) return { level, height, fitted: true };
  }
  const height = measureFlyerHeight(flyer, image, maxLevel);
  return { level: maxLevel, height, fitted: false };
}

/* ---------- 범용 높이 측정 (다른 1P 문서에서 공용) ---------- */

/** 임의의 HTML 문자열을 화면 밖에서 실제 크기로 재고 내용 높이를 돌려줍니다. */
export function measureHtmlHeight(html, selector = ".flyer") {
  const host = ensureMeasureHost();
  host.innerHTML = html;
  const el = host.querySelector(selector);
  if (!el) {
    host.innerHTML = "";
    return A4_HEIGHT;
  }
  el.style.height = "auto";
  const height = Math.ceil(el.getBoundingClientRect().height);
  host.innerHTML = "";
  return height;
}

/** render(level) 로 만든 1P 문서가 A4 한 장에 들어가는 최소 축소 단계를 찾습니다. */
export function findBestFit(render, maxLevel = 3, selector = ".flyer") {
  for (let level = 0; level <= maxLevel; level++) {
    const height = measureHtmlHeight(render(level), selector);
    if (height <= A4_HEIGHT - 4) return { level, height, fitted: true };
  }
  const height = measureHtmlHeight(render(maxLevel), selector);
  return { level: maxLevel, height, fitted: false };
}

/* ---------- 텍스트 내보내기용 ---------- */

export function flyerToPlainText(flyer) {
  const f = normalizeFlyer(flyer);
  return [
    f.kicker ? `[${f.kicker}]` : "",
    f.title,
    f.subtitle,
    "",
    f.metrics.length
      ? f.metrics.map((m) => `· ${m.value}${m.label ? ` (${m.label})` : ""}`).join("\n")
      : "",
    "",
    f.points.length
      ? f.points.map((p, i) => `${i + 1}. ${p.title}${p.desc ? `\n   ${p.desc}` : ""}`).join("\n")
      : "",
    "",
    f.infoRows.length ? f.infoRows.map((r) => `${r.field}: ${r.value}`).join("\n") : "",
    f.targets.length ? `\n적용 대상: ${f.targets.join(", ")}` : "",
    f.note ? `\n${f.note}` : "",
    "",
    f.footerOrg,
    f.footerContact,
    f.footerNote,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/* ---------- 편집기 ---------- */

function inputRow(labelText, path, opts = {}) {
  const { placeholder = "", value = "", textarea = false, rows = 2, type = "text" } = opts;
  const attr = `data-flyer="${path}"`;
  return `<label>${escapeHtml(labelText)}</label>
    ${
      textarea
        ? `<textarea ${attr} rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
        : `<input ${attr} type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`
    }`;
}

function repeatBlock(kind, index, fields, removeLabel = "삭제") {
  return `<div class="repeat-item">
    <div class="repeat-head">
      <span>${escapeHtml(kind === "metric" ? `지표 ${index + 1}` : kind === "point" ? `포인트 ${index + 1}` : `항목 ${index + 1}`)}</span>
      <button type="button" class="btn ghost small" data-action="remove-${kind}" data-index="${index}">${removeLabel}</button>
    </div>
    ${fields
      .map(
        (field) => `<label>${escapeHtml(field.label)}</label>
      ${
        field.textarea
          ? `<textarea data-flyer-list="${kind}" data-index="${index}" data-key="${field.key}" rows="2" placeholder="${escapeHtml(field.placeholder || "")}">${escapeHtml(field.value)}</textarea>`
          : `<input data-flyer-list="${kind}" data-index="${index}" data-key="${field.key}" value="${escapeHtml(field.value)}" placeholder="${escapeHtml(field.placeholder || "")}">`
      }`
      )
      .join("")}
  </div>`;
}

export function renderFlyerEditor(flyer, images) {
  const f = normalizeFlyer(flyer);
  const list = images || [];

  const thumbs = list.length
    ? `<div class="thumb-row">
        <button type="button" class="btn ghost small ${f.imageId ? "" : "sel"}" data-action="pick-image" data-image-id="">없음</button>
        ${list
          .map(
            (img) => `<button type="button" title="${escapeHtml(img.name || "")}"
              class="${f.imageId === img.id ? "sel" : ""}"
              data-action="pick-image" data-image-id="${escapeHtml(img.id)}"
              style="background-image:url('${img.dataUrl}')"></button>`
          )
          .join("")}
      </div>`
    : `<p class="meta">추출된 이미지가 없습니다. ‘자료 첨부·분석’에서 이미지 추출을 켜고 다시 읽어 주세요.</p>`;

  return `
    <details class="ed-group" open>
      <summary>기본 문구</summary>
      ${inputRow("상단 분류 표시", "kicker", { value: f.kicker, placeholder: "예: 신규 검사 안내" })}
      ${inputRow("제목", "title", { value: f.title, placeholder: "홍보물 큰 제목", textarea: true, rows: 2 })}
      ${inputRow("부제 / 한 줄 요약", "subtitle", { value: f.subtitle, placeholder: "핵심 한 줄", textarea: true, rows: 2 })}
    </details>

    <details class="ed-group" open>
      <summary>상단 강조 지표 (${f.metrics.length})</summary>
      ${f.metrics
        .map((m, i) => repeatBlock("metric", i, [
          { key: "value", label: "값", value: m.value, placeholder: "예: 95.2%" },
          { key: "label", label: "설명", value: m.label, placeholder: "예: 민감도 (연구 기준)" },
        ]))
        .join("") || `<p class="meta">지표가 없습니다. ‘자료에서 자동 채우기’를 누르거나 아래 버튼으로 추가하세요.</p>`}
      <button type="button" class="btn ghost small" data-action="add-metric">＋ 지표 추가</button>
    </details>

    <details class="ed-group" open>
      <summary>핵심 포인트 (${f.points.length})</summary>
      ${f.points
        .map((p, i) =>
          repeatBlock("point", i, [
            { key: "icon", label: "번호/기호", value: p.icon, placeholder: "1" },
            { key: "title", label: "소제목", value: p.title, placeholder: "예: 한 번의 검체로 동시 검출" },
            { key: "desc", label: "설명", value: p.desc, placeholder: "짧은 설명 (1~2줄)", textarea: true },
          ])
        )
        .join("") || `<p class="meta">포인트가 없습니다. ‘자료에서 자동 채우기’를 누르거나 아래 버튼으로 추가하세요.</p>`}
      <button type="button" class="btn ghost small" data-action="add-point">＋ 포인트 추가</button>
    </details>

    <details class="ed-group">
      <summary>검사 정보 표 (${f.infoRows.length})</summary>
      ${f.infoRows
        .map((r, i) =>
          repeatBlock("info", i, [
            { key: "field", label: "항목", value: r.field, placeholder: "예: 검체" },
            { key: "value", label: "내용", value: r.value, placeholder: "예: 전혈 3mL" },
          ])
        )
        .join("") || `<p class="meta">표에 넣을 항목이 없습니다.</p>`}
      <button type="button" class="btn ghost small" data-action="add-info">＋ 항목 추가</button>
    </details>

    <details class="ed-group">
      <summary>적용 대상</summary>
      ${inputRow("대상 (쉼표로 구분)", "targetsText", {
        value: f.targets.join(", "),
        placeholder: "예: 고위험군, 가족력 있는 대상, 40세 이상",
      })}
    </details>

    <details class="ed-group">
      <summary>이미지</summary>
      ${thumbs}
      ${inputRow("이미지 설명(캡션)", "imageCaption", { value: f.imageCaption, placeholder: "예: 검사 구성 모식도" })}
    </details>

    <details class="ed-group">
      <summary>강조 안내 문구</summary>
      ${inputRow("안내 문구", "note", { value: f.note, placeholder: "예: 검체 채취 후 당일 결과 보고", textarea: true, rows: 3 })}
    </details>

    <details class="ed-group">
      <summary>하단 연락처 · 유의사항</summary>
      ${inputRow("기관명", "footerOrg", { value: f.footerOrg })}
      ${inputRow("담당자 · 연락처", "footerContact", { value: f.footerContact, placeholder: "예: 부산3지점 김○○ 051-000-0000" })}
      ${inputRow("유의사항", "footerNote", { value: f.footerNote, textarea: true, rows: 4 })}
    </details>
  `;
}

export { defaultFlyer, formatKoreanDate };
