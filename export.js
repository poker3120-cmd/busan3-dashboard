/* =========================================================
   내보내기 — 인쇄(PDF) / PNG / 이미지 PDF / PPTX / Word
   ========================================================= */

import { $, downloadBlob, downloadUrl, loadScript, slugify, formatKoreanDate } from "./utils.js";
import { renderFlyerHtml, normalizeFlyer, A4_HEIGHT } from "./flyer.js";

/* 1P 문서(홍보물 · 교육자료) 공통 선택자 */
export const SHEET_SELECTOR = ".flyer, .trainingsheet";

const A4_PX_WIDTH = 794;

/* ---------- 화면 → A4 스케일 ---------- */

export function fitScaler(host) {
  if (!host) return;
  const scaler = host.closest(".flyer-scaler, .sheet-scaler");
  if (!scaler) return;
  const available = scaler.clientWidth || A4_PX_WIDTH;
  const scale = Math.min(1, Math.max(0.28, available / A4_PX_WIDTH));
  scaler.style.setProperty("--scale", String(scale));
  // 스케일된 만큼 아래 여백을 잡아 레이아웃이 겹치지 않게 합니다.
  const root = scaler.querySelector("#printRoot, #trainingRoot") || scaler.firstElementChild;
  const height = root ? root.getBoundingClientRect().height : A4_HEIGHT;
  scaler.style.height = `${Math.round(height)}px`;
}

/* ---------- 이미지 캡처 ---------- */

async function captureCanvas(element, scale = 2) {
  await loadScript("vendor/html2canvas.min.js");
  if (typeof window.html2canvas !== "function") {
    throw new Error("이미지 변환 모듈을 불러오지 못했습니다.");
  }
  return window.html2canvas(element, {
    scale,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
}

/** 캡처를 위해 화면 밖에 실제 크기(794px) 사본을 만듭니다. */
function stage(html) {
  const host = $("printStage");
  host.innerHTML = html;
  host.style.display = "block";
  host.style.position = "fixed";
  host.style.left = "-20000px";
  host.style.top = "0";
  host.style.width = `${A4_PX_WIDTH}px`;
  const el = host.querySelector(".flyer");
  if (el) {
    el.style.transform = "none";
    el.style.width = `${A4_PX_WIDTH}px`;
  }
  return { host, el };
}

function unstage(host) {
  host.innerHTML = "";
  host.style.display = "none";
}

/* ---------- 범용 1P 문서 내보내기 (화법지 등에서 공용) ---------- */

/** HTML 문자열을 A4 크기로 화면 밖에 올립니다. */
function stageHtml(html) {
  const host = $("printStage");
  host.innerHTML = html;
  host.style.display = "block";
  host.style.position = "fixed";
  host.style.left = "-20000px";
  host.style.top = "0";
  host.style.width = `${A4_PX_WIDTH}px`;
  const el = host.querySelector(SHEET_SELECTOR);
  if (el) {
    el.style.transform = "none";
    el.style.width = `${A4_PX_WIDTH}px`;
  }
  return { host, el };
}

/** 현재 화면의 인쇄용 스테이지에 HTML을 넣고 브라우저 인쇄 창을 엽니다. */
export function printHtml(html) {
  const host = $("printStage");
  host.innerHTML = `<div class="print-doc">${html}</div>`;
  host.style.display = "block";
  host.style.position = "static";
  host.style.left = "0";

  const cleanup = () => {
    host.innerHTML = "";
    host.style.display = "none";
    host.style.position = "fixed";
    host.style.left = "-20000px";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1500);
  }, 120);
}

/** HTML → PNG 파일 */
export async function exportHtmlPng(html, filename) {
  const { host, el } = stageHtml(html);
  try {
    if (!el) throw new Error("내보낼 내용을 만들지 못했습니다.");
    const canvas = await captureCanvas(el, 2);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("이미지 생성에 실패했습니다.");
    downloadBlob(blob, filename || "document.png");
  } finally {
    unstage(host);
  }
}

/** HTML → 이미지 기반 A4 PDF 파일 */
export async function exportHtmlImagePdf(html, filename) {
  await loadScript("vendor/jspdf.umd.min.js");
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error("PDF 생성 모듈을 불러오지 못했습니다.");

  const { host, el } = stageHtml(html);
  try {
    if (!el) throw new Error("내보낼 내용을 만들지 못했습니다.");
    const canvas = await captureCanvas(el, 2);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    pdf.save(filename || "document.pdf");
  } finally {
    unstage(host);
  }
}

/* ---------- 제안서 : A4 다페이지 이미지 PDF ---------- */

/**
 * 여러 장의 A4 문서를 한 번에 PDF로 만듭니다.
 * 화면 밖에서 페이지마다 캡처해 jsPDF 페이지로 붙입니다.
 */
export async function exportProposalPdf(html, filename) {
  await loadScript("vendor/html2canvas.min.js");
  await loadScript("vendor/jspdf.umd.min.js");

  const html2canvas = window.html2canvas;
  const jsPDF = window.jspdf?.jsPDF;
  if (typeof html2canvas !== "function") throw new Error("이미지 변환 모듈을 불러오지 못했습니다.");
  if (!jsPDF) throw new Error("PDF 생성 모듈을 불러오지 못했습니다.");

  const host = $("printStage");
  host.innerHTML = html;
  host.style.display = "block";
  host.style.position = "fixed";
  host.style.left = "-20000px";
  host.style.top = "0";
  host.style.width = `${A4_PX_WIDTH}px`;

  const pages = [...host.querySelectorAll(".proposal-page")];
  if (!pages.length) {
    unstage(host);
    throw new Error("내보낼 제안서 페이지를 찾지 못했습니다.");
  }

  try {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

    for (let i = 0; i < pages.length; i++) {
      const el = pages[i];
      el.style.boxShadow = "none";

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }

    pdf.save(filename || "제안서.pdf");
  } finally {
    unstage(host);
  }
}

/* ---------- 인쇄 (브라우저 ‘PDF로 저장’) ---------- */

export function printFlyer(flyer, image, denseLevel) {
  const host = $("printStage");
  host.innerHTML = `<div class="print-doc">${renderFlyerHtml(flyer, image, denseLevel)}</div>`;
  host.style.display = "block";
  host.style.position = "static";
  host.style.left = "0";

  const cleanup = () => {
    host.innerHTML = "";
    host.style.display = "none";
    host.style.position = "fixed";
    host.style.left = "-20000px";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1500);
  }, 120);
}

export function printDocument(title, text) {
  const host = $("printStage");
  host.innerHTML = `<article class="doc-print"><h1>${escapeForPrint(title)}</h1><pre>${escapeForPrint(text)}</pre></article>`;
  host.style.display = "block";
  host.style.position = "static";
  host.style.left = "0";

  const cleanup = () => {
    host.innerHTML = "";
    host.style.display = "none";
    host.style.position = "fixed";
    host.style.left = "-20000px";
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1500);
  }, 120);
}

function escapeForPrint(value) {
  return String(value ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
}

/* ---------- PNG / 이미지 PDF ---------- */

export async function exportFlyerPng(flyer, image, denseLevel, filename) {
  const { host, el } = stage(renderFlyerHtml(flyer, image, denseLevel));
  try {
    const canvas = await captureCanvas(el, 2);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("이미지 생성에 실패했습니다.");
    downloadBlob(blob, filename || `${slugify(flyer.title, "flyer")}.png`);
  } finally {
    unstage(host);
  }
}

export async function exportFlyerImagePdf(flyer, image, denseLevel, filename) {
  await loadScript("vendor/jspdf.umd.min.js");
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) throw new Error("PDF 생성 모듈을 불러오지 못했습니다.");

  const { host, el } = stage(renderFlyerHtml(flyer, image, denseLevel));
  try {
    const canvas = await captureCanvas(el, 2);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    pdf.save(filename || `${slugify(flyer.title, "flyer")}.pdf`);
  } finally {
    unstage(host);
  }
}

/* ---------- PPTX (1슬라이드) ---------- */

export async function exportFlyerPptx(flyer, image, denseLevel, contact = {}) {
  await loadScript("vendor/pptxgen.bundle.js");
  const PptxGenJS = window.PptxGenJS;
  if (!PptxGenJS) throw new Error("PPTX 생성 모듈을 불러오지 못했습니다.");

  const f = normalizeFlyer(flyer);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4P", width: 8.27, height: 11.69 });
  pptx.layout = "A4P";
  pptx.author = contact.org || "재단법인 씨젠의료재단 부산3지점";
  pptx.title = f.title || "1P 홍보물";

  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  const ACCENT = "C41230";
  const DARK = "7F1024";
  const SOFT = "FDF0F2";

  // 상단 헤더
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 8.27, h: 1.55, fill: { color: DARK } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 3.1, h: 1.55, fill: { color: ACCENT } });

  if (f.kicker) {
    slide.addText(f.kicker, {
      x: 5.0, y: 0.22, w: 3.1, h: 0.3, fontSize: 10, bold: true, color: "FFFFFF", align: "right",
    });
  }
  slide.addText(f.title || "홍보물 제목", {
    x: 0.4, y: 0.52, w: 7.5, h: 0.9, fontSize: f.title.length > 26 ? 22 : 27, bold: true,
    color: "FFFFFF", valign: "middle", lineSpacingMultiple: 0.95,
  });
  if (f.subtitle) {
    slide.addText(f.subtitle, {
      x: 0.42, y: 1.2, w: 7.5, h: 0.32, fontSize: 10.5, color: "FFE3E8",
    });
  }

  let y = 1.75;

  // 지표
  if (f.metrics.length) {
    const count = Math.min(f.metrics.length, 4);
    const gap = 0.14;
    const w = (7.47 - gap * (count - 1)) / count;
    f.metrics.slice(0, count).forEach((m, i) => {
      const x = 0.4 + i * (w + gap);
      slide.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.78, fill: { color: SOFT }, line: { color: "EADFE2", width: 0.5 } });
      slide.addShape(pptx.ShapeType.rect, { x, y, w, h: 0.05, fill: { color: ACCENT } });
      slide.addText(m.value, { x: x + 0.08, y: y + 0.1, w: w - 0.16, h: 0.32, fontSize: 15, bold: true, color: DARK });
      slide.addText(m.label || "", { x: x + 0.08, y: y + 0.42, w: w - 0.16, h: 0.3, fontSize: 8.5, color: "6B5B60" });
    });
    y += 0.94;
  }

  // 포인트 + 이미지
  const hasImage = Boolean(image && image.dataUrl);
  const leftW = hasImage ? 4.2 : 7.47;
  let leftY = y;

  f.points.slice(0, 5).forEach((p, i) => {
    const h = p.desc ? 0.86 : 0.52;
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: leftY, w: leftW, h: h - 0.06, fill: { color: "FFFFFF" }, line: { color: "ECDFE3", width: 0.75 },
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0.4, y: leftY, w: 0.42, h: h - 0.06, fill: { color: ACCENT } });
    slide.addText(p.icon || String(i + 1), {
      x: 0.4, y: leftY, w: 0.42, h: h - 0.06, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle",
    });
    slide.addText(p.title || "", {
      x: 0.92, y: leftY + 0.06, w: leftW - 0.6, h: 0.28, fontSize: 11, bold: true, color: "1F1B22",
    });
    if (p.desc) {
      slide.addText(p.desc, { x: 0.92, y: leftY + 0.34, w: leftW - 0.6, h: 0.42, fontSize: 9, color: "6B6068", valign: "top" });
    }
    leftY += h;
  });

  if (hasImage) {
    try {
      const data = String(image.dataUrl);
      const ext = data.slice(5, data.indexOf(";")).split("/")[1].replace("jpg", "jpeg");
      slide.addImage({ data, x: 4.85, y, w: 3.02, h: Math.min(3.2, leftY - y), sizing: { type: "contain", w: 3.02, h: Math.min(3.2, leftY - y) } });
    } catch (error) { /* 이미지 실패는 무시 */ }
  }

  let ty = Math.max(leftY, y) + 0.14;

  // 검사 정보 표
  if (f.infoRows.length && ty < 9.1) {
    slide.addText("검사 정보", { x: 0.4, y: ty, w: 3, h: 0.26, fontSize: 11, bold: true, color: DARK });
    ty += 0.3;
    const rows = f.infoRows.slice(0, Math.max(2, Math.floor((9.3 - ty) / 0.3)));
    const body = rows.map((r) => ([
      { text: r.field, options: { bold: true, color: DARK, fill: { color: SOFT }, fontSize: 9 } },
      { text: r.value, options: { color: "2F2A31", fontSize: 9 } },
    ]));
    slide.addTable(body, {
      x: 0.4, y: ty, w: 7.47, colW: [1.5, 5.97],
      border: { type: "solid", color: "E8DCE0", pt: 0.5 },
      rowH: 0.28, valign: "middle", autoPage: false,
    });
    ty += rows.length * 0.3 + 0.12;
  }

  // 적용 대상
  if (f.targets.length && ty < 9.55) {
    slide.addText(`적용 대상 : ${f.targets.slice(0, 8).join("  ·  ")}`, {
      x: 0.4, y: ty, w: 7.47, h: 0.3, fontSize: 9.5, color: DARK, bold: true,
      fill: { color: "FBF6F7" }, line: { color: "E8DCE0", width: 0.5 },
    });
    ty += 0.42;
  }

  // 안내 문구
  if (f.note && ty < 9.8) {
    slide.addText(f.note, {
      x: 0.4, y: ty, w: 7.47, h: 0.5, fontSize: 9, color: "4B444A",
      fill: { color: "FBF6F7" }, valign: "middle",
    });
  }

  // 하단
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 10.55, w: 8.27, h: 1.14, fill: { color: "FCF8F9" }, line: { color: ACCENT, width: 1 } });
  slide.addText(f.footerOrg || "", { x: 0.4, y: 10.68, w: 4.4, h: 0.3, fontSize: 11.5, bold: true, color: DARK });
  slide.addText(f.footerContact || "", { x: 0.4, y: 10.98, w: 4.4, h: 0.5, fontSize: 9.5, color: "4B444A" });
  slide.addText(f.footerNote || "", {
    x: 4.9, y: 10.66, w: 3.0, h: 0.85, fontSize: 6.8, color: "8A7F84", align: "right", valign: "top",
  });

  await pptx.writeFile({ fileName: `${slugify(f.title, "flyer")}.pptx` });
}

/* ---------- Word (.doc) ---------- */

export function exportWord(title, text, filename) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>${escapeForPrint(title)}</title>
    <style>
      @page { size: A4; margin: 20mm 18mm; }
      body { font-family: "Malgun Gothic", sans-serif; font-size: 11pt; line-height: 1.8; }
      h1 { font-size: 17pt; color: #7f1024; border-bottom: 2px solid #c41230; padding-bottom: 6pt; }
      pre { font-family: "Malgun Gothic", sans-serif; white-space: pre-wrap; font-size: 10.5pt; line-height: 1.75; }
    </style></head>
    <body><h1>${escapeForPrint(title)}</h1><pre>${escapeForPrint(text)}</pre></body></html>`;

  downloadBlob(new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" }),
    filename || `${slugify(title, "proposal")}.doc`);
}

export { formatKoreanDate, downloadUrl };
