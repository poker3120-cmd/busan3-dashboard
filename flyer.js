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
    .slice(0, 4);

  const infoRows = (base.infoRows || [])
    .map((r) => ({ field: str(r.field), value: str(r.value) }))
    .filter((r) => r.value)
    .slice(0, 8);

  const targets = (base.targets || []).map((t) => str(t)).filter(Boolean).slice(0, 6);
  const references = (base.references || []).map((r) => str(r)).filter(Boolean).slice(0, 4);

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
    references,
  };
}

/** 넘칠 때 자동으로 축소 단계를 올립니다. */
export function autoDense(level) {
  const idx = Math.max(0, Math.min(DENSE_CLASSES.length - 1, Number(level) || 0));
  return DENSE_CLASSES[idx];
}

/* ---------- 렌더 ---------- */

const FLYER_LOGO_DATA = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAU8AAAAyCAMAAADr2KlrAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyZpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDcuMi1jMDAwIDc5LjFiNjVhNzliNCwgMjAyMi8wNi8xMy0yMjowMTowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDIzLjUgKFdpbmRvd3MpIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkI0NzhFQzAwNUU4ODExRUY4NDZCQTEwQTA4MTdEMDdDIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkI0NzhFQzAxNUU4ODExRUY4NDZCQTEwQTA4MTdEMDdDIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6QjQ3OEVCRkU1RTg4MTFFRjg0NkJBMTBBMDgxN0QwN0MiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6QjQ3OEVCRkY1RTg4MTFFRjg0NkJBMTBBMDgxN0QwN0MiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7ODjt/AAADAFBMVEVxamjidXuGgH+qpaQ6MC3i4OCEfn2SjYvWOkLVNj/88PFVTUorIR7V09Lqmp4mGxjGw8L43d7ULjfv7u7tpalbU1F3cG7dW2Lb2dguJCFuZ2VBODV9dnRiWljYREyopKL0zM7KAg0oHRualZT32dszKCb+/PxeVlPX1dWdmJZ4cnBSSUeinZwkGRZkXFrtqa3c2tlNREL99PTSJS6IgoBEOjjkfYOVkI7++vrplZraTlZgWFY3LSqMh4X54eLur7LmhovbUlpfV1SwrKtqYmB+eHbywsX65eZGPTvga3GmoqAxJiTMChX77e5lXVv21dcjGBXojpPnio84LivQHijfZGvLBxLMDBbPGCI7MS/KAAtnYF1MQ0A+NDGDfXuRi4qsqKfj4uIwJiN1bmzIxcSempi6t7bx8fBZUU/W1NP8/Pzh39/6+vn19PT9/f3s6+v8+/uXkZD08/Pp5+fNysrp6Ojq6eng3t6gm5qzr675+fnS0M/7+vrCv756c3L29vaXkpGloaDy8fFMQ0He3dxJQD3n5uVANzRTS0itqahXTkzLyciLhYOBe3nt7OzAvbzr6uq/vLv4+PjDwL81Kyg/NjO7t7eUj43HxMP29fWLhoTz8vK5trW3tLPZ19fBvr3Oy8u3s7JKQT7PzMy+u7p7dHPu7e2PiYiwrauOiId2b221sbC2srG9ubi9urn66OnMCBPQzs3Y1tZYUE7Rz84/NTKkoJ/KyMdsZWNpYV/zxshIPzz98/TDwMCTjozl5OOfmpn++flwaWdPRkTT0dChnJv54+TMysnf3d2uqqn39/dLQj/76utQR0XjeX/319nKx8bd3NtrY2FzbGqyrq2QiomYk5KZlJOCfHpHPjz10dPeYGfQzc3RIyzm5eTw8O/gaG/vsrXrn6PLAw6blpW8uLe4tbTxvcD76+zzxMdvaGbokJW0sK/k4+ProKT1ztDOFR/hcHZ0bWv99vbNDxnxu77lgof20tSvq6r66er87/DywMPcV15YT03RISv///8ctBrcAAABAHRSTlP///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AU/cHJQAADDNJREFUeNrsnHd8VEUewAMEAbMQIMQjAUQCCwYIPWIJcscdXhTFp0GQ3WU3m7LpFQiBQBJC771JkSqhVwWpoiAiniXenaeoV/D6fc7zeh/nN/PKzHszW7LcwR/5/cHuTKbt9838fr/5zTwikFnyj9W+PtieoCgZCwY09+WgJglFIkzpKdVjFFaiYxdtaqLUWJ7r+ylWsXuaJmmjeHZerIjF3qIJVOg8N0Sr+F6+J3v3lLyq9i2aR2lZsZObUIXGM6cbJTdx31zmz+XXYmn22vZNrELhOXkepTm70FziUwo64aCwfqWTSMMBVOJ0VqJqpxNnPkEzndA4zh7BlIdsrD0Owadm6MogQb/WZxqy50JnmokbdboR2qbWNaR4V8/R8ZnD0tnFc4grVeKUyIeelXqVu5j8hq6VRSSzldvtbqUNroQWnJG439QMA2Eby3NqF2CWdFc5B+tP3yUfvkhi6etFPDNVhdAFeRUlE01SFJzpUjMz8HecncuUh2zMxgOfmplzQoJ+dXN6O2EKycSNKi6EstS6mpS+8rJaLqlbWz03myvlVaTSR6/i4v9wQu90kjY4Ly24z9IIAyGL4VlHmly7hkN17ifjHR3fg2/LR5FfN0vAsx4/RvdYRYky8ayG/KUWnquhIY+cZ19+uM398Jy8kHXrPCHzTJDxVDbLeI4KludYyFgwjSP1q449HA7HvdTHJ78zrkCiNPYBI55nDvOLGJ45Ks/m8Jlv5ZnJD/eHcp50RRkyOlSeipRnuYynK0ieZAzr5nOMhrR2gPxXTY6GIoNnCHEW476r/PDskp2tPYkYaKYMq0R2gjA8l6RrchYyr8p5niC/J7K6bO/YBPK1hYhnUbpInkjjeNZna7IM8scgvzzjPYwIeRbAgOxv8ZC+RXA6bmi70Aao00rIczosdwAX61sr4onFp6amQeIKQvH4I0XA03hGoLPjSqU8F5Fm9xLreZH4IGNyBDwl4hL0SHaHkP+If54tJUbE4EkM+Aq+SDuK87Mj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";

/* ---------- 리디자인: 책자형 정보 계층의 A4 1P 홍보물 ---------- */
export function renderFlyerHtml(flyer, image, denseLevel = 0) {
  const f = normalizeFlyer(flyer);
  const dense = autoDense(denseLevel);
  const hasImage = Boolean(image && image.dataUrl);
  const title = f.title || "홍보물 제목을 입력하세요";
  const titleClass = title.length > 30 ? "xs" : title.length > 20 ? "sm" : "";
  const logo = '<img class="fl-logo" src="' + FLYER_LOGO_DATA + '" alt="재단법인 씨젠의료재단 로고">';

  const heroVisual = hasImage
    ? '<figure class="fl-hero-art">' +
        '<div class="fl-hero-art-top"><span>SEEGene · VISUAL GUIDE</span><b>01</b></div>' +
        '<img class="fl-hero-image" src="' + escapeHtml(image.dataUrl) + '" alt="' + escapeHtml(image.name || "검사 관련 이미지") + '">' +
        ((f.imageCaption || image.name) ? '<figcaption>' + escapeHtml(f.imageCaption || truncate(image.name || "", 40)) + '</figcaption>' : '') +
      '</figure>'
    : '<div class="fl-hero-art fl-hero-art-empty" aria-label="씨젠의료재단 검사 안내 그래픽">' +
        '<div class="fl-empty-mark">S</div><span>MEDICAL LABORATORY</span><b>검사 정보를 한눈에</b>' +
      '</div>';

  const head = '<header class="fl-brochure-header">' +
    '<div class="fl-brand-lockup">' + logo +
      '<div class="fl-brand-divider"></div>' +
      '<div class="fl-brand-name"><b>MEDICAL FOUNDATION</b><span>BUSAN BRANCH 3</span></div>' +
    '</div>' +
    '<div class="fl-publication-label"><span></span>' + escapeHtml(f.kicker || "검사 안내") + '</div>' +
  '</header>' +
  '<section class="fl-hero">' +
    '<div class="fl-hero-copy">' +
      '<p class="fl-hero-eyebrow">LABORATORY SERVICE · INFORMATION</p>' +
      '<h1 class="fl-title ' + titleClass + '">' + escapeHtml(title) + '</h1>' +
      (f.subtitle ? '<p class="fl-sub">' + escapeHtml(f.subtitle) + '</p>' : '') +
      '<div class="fl-hero-rule"><span></span><span></span><span></span></div>' +
    '</div>' +
    heroVisual +
    '<div class="fl-hero-corner" aria-hidden="true"></div>' +
  '</section>';

  const points = f.points.length
    ? '<section class="fl-points-section">' +
        '<div class="fl-section-heading"><div class="fl-section-number">01</div><div>' +
          '<span>TEST HIGHLIGHTS</span><h2>검사 핵심 특징</h2></div></div>' +
        '<div class="fl-points">' + f.points.map((p, i) =>
          '<article class="fl-point">' +
            '<span class="fl-point-index">' + (p.icon || String(i + 1).padStart(2, "0")) + '</span>' +
            '<div class="tx">' +
              (p.title ? '<h3>' + escapeHtml(p.title) + '</h3>' : '') +
              (p.desc ? '<p>' + escapeHtml(p.desc) + '</p>' : '') +
            '</div>' +
          '</article>'
        ).join("") + '</div>' +
      '</section>'
    : '';

  const supportingImages = (image && Array.isArray(image.extraImages) ? image.extraImages : [])
    .filter((item) => item && item.dataUrl)
    .slice(0, 2);
  const supportingVisuals = supportingImages.length
    ? '<section class="fl-supporting-visuals">' +
        '<div class="fl-section-heading"><div class="fl-section-number">02</div><div>' +
          '<span>FROM ATTACHED MATERIALS</span><h2>첨부 자료의 주요 도식 · 그래프</h2></div></div>' +
        '<div class="fl-supporting-visual-grid">' + supportingImages.map((item, index) =>
          '<figure><img src="' + escapeHtml(item.dataUrl) + '" alt="첨부 자료 속 도식 또는 그래프 ' + (index + 1) + '">' +
          '<figcaption>' + escapeHtml(truncate(String(item.name || "").replace(/\.(png|jpe?g|gif|webp)$/i, ""), 34) || ("첨부 자료 그림 " + (index + 1))) + '</figcaption></figure>'
        ).join("") + '</div></section>'
    : '';

  const metrics = f.metrics.length
    ? '<section class="fl-evidence-section">' +
        '<div class="fl-section-heading"><div class="fl-section-number">02</div><div>' +
          '<span>SUPPORTING EVIDENCE</span><h2>자료에서 확인한 주요 수치</h2></div></div>' +
        '<div class="fl-metrics" aria-label="자료에 기재된 핵심 지표">' + f.metrics.slice(0, 4).map((m, i) =>
          '<div class="fl-metric"><span class="fl-metric-no">' + String(i + 1).padStart(2, "0") + '</span>' +
            '<div><div class="v">' + escapeHtml(m.value || "—") + '</div>' +
            (m.label ? '<div class="l">' + escapeHtml(m.label) + '</div>' : '') +
            '</div></div>'
        ).join("") + '</div>' +
      '</section>'
    : '';

  const infoRows = f.infoRows.slice(0, 7);
  const infoTable = infoRows.length
    ? '<section class="fl-info-panel">' +
        '<div class="fl-section-heading"><div class="fl-section-number">03</div><div>' +
          '<span>TEST INFORMATION</span><h2>검사 정보</h2></div></div>' +
        '<div class="fl-spec-table-wrap"><table class="fl-spec-table"><thead><tr>' +
          infoRows.map((r) => '<th>' + escapeHtml(r.field || "항목") + '</th>').join("") +
        '</tr></thead><tbody><tr>' +
          infoRows.map((r) => '<td>' + escapeHtml(r.value) + '</td>').join("") +
        '</tr></tbody></table></div>' +
      '</section>'
    : '';

  const targets = f.targets.length
    ? '<section class="fl-target-panel">' +
        '<div class="fl-section-heading"><div class="fl-section-number">04</div><div>' +
          '<span>APPLICATION</span><h2>활용 대상 · 임상적 고려사항</h2></div></div>' +
        '<div class="fl-targets">' + f.targets.map((t) =>
          '<span class="fl-target"><i aria-hidden="true"></i>' + escapeHtml(t) + '</span>'
        ).join("") + '</div>' +
      '</section>'
    : '';

  const lower = (infoTable || targets)
    ? '<section class="fl-lower-content">' + targets + infoTable + '</section>'
    : '';

  const note = f.note
    ? '<aside class="fl-note"><span class="fl-note-symbol">!</span><div><b>CHECK POINT</b><p>' + escapeHtml(f.note) + '</p></div></aside>'
    : '';

  const references = f.references.length
    ? '<section class="fl-citations"><div class="fl-citations-head"><span>REFERENCE</span><b>참고문헌</b></div><ol>' +
        f.references.slice(0, 3).map((reference) => '<li>' + escapeHtml(truncate(reference, 170)) + '</li>').join("") +
      '</ol></section>'
    : '';

  const footer = '<footer class="fl-brochure-footer">' +
    '<div class="fl-footer-brand"><span class="fl-footer-redline"></span><div>' +
      (f.footerOrg ? '<b>' + escapeHtml(f.footerOrg) + '</b>' : '') +
      (f.footerContact ? '<span>' + escapeHtml(f.footerContact) + '</span>' : '') +
    '</div></div>' +
    (f.footerNote ? '<div class="fl-footer-disclaimer">' + escapeHtml(f.footerNote) + '</div>' : '') +
    '</footer>';

  return '<div class="flyer fl-brochure ' + dense + '">' +
    '<div class="fl-top-accent"></div>' + head +
    '<div class="fl-content">' + points + supportingVisuals + metrics + lower + note + references + '</div>' +
    footer +
  '</div>';
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
    f.targets.length ? `\n활용 대상: ${f.targets.join(", ")}` : "",
    f.note ? `\n유의사항: ${f.note}` : "",
    f.references.length ? `\n참고문헌\n${f.references.map((r, i) => (i + 1) + ". " + r).join("\n")}` : "",
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
      ${inputRow("참고문헌 (한 줄에 하나)", "referencesText", { value: f.references.join("\n"), placeholder: "첨부 자료의 문헌만 입력", textarea: true, rows: 3 })}
    </details>
  `;
}

export { defaultFlyer, formatKoreanDate };
