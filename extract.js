/* =========================================================
   자료 읽기 (PDF / PPTX) — 전부 브라우저 안에서 처리
   결과: { units, rawText, images }
     units  : [{ file, index, label, lines:[{text,size}], text }]
     images : [{ id, name, dataUrl, source, width, height }]
   ========================================================= */

import { readAsDataUrl, truncate } from "./utils.js";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_IMAGES = 30;
const MIN_IMAGE_SIDE = 110;

let pdfjsPromise = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("../vendor/pdf.min.js")
      .then((lib) => {
        const pdfjs = lib.default && lib.default.getDocument ? lib.default : lib;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdf.worker.min.js", import.meta.url).href;
        return pdfjs;
      })
      .catch((error) => {
        pdfjsPromise = null;
        throw new Error("PDF 처리 모듈을 불러오지 못했습니다. " + error.message);
      });
  }
  return pdfjsPromise;
}

/* ---------- 텍스트 정리 ---------- */

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?%)\]])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .trim();
}

/**
 * 기호·붙임표 표기를 다듬고, 아이콘 글꼴의 사설 영역 글자를 불릿으로 바꿉니다.
 * 불릿을 남겨 두어야 문장 병합에서 항목이 잘못 붙지 않습니다.
 */
function polishText(value) {
  return normalizeText(value)
    .replace(/[\ue000-\uf8ff]/g, "•")   // 아이콘 폰트 사설 영역 → 불릿
    .replace(/\s*[〮‧∙・]\s*/g, "·")
    .replace(/([가-힣])\s*·\s*([가-힣])/g, "$1·$2")
    .replace(/([A-Za-z0-9])\s*-\s*([A-Za-z0-9])/g, "$1-$2")
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2")
    .replace(/,([^\d\s])/g, ", $1")     // "23,400" 같은 숫자 쉼표는 그대로 둡니다
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * PDF 텍스트 조각을 실제 좌표 간격으로 이어 붙입니다.
 * 글꼴이 바뀔 때마다 조각이 나뉘므로, 무조건 공백을 넣거나 지우면
 * "간암위험도검사" 처럼 붙거나 "ASAP 는" 처럼 잘못 띄어쓰게 됩니다.
 */
function joinPdfParts(parts) {
  let out = "";
  let prev = null;

  parts.forEach((part) => {
    const raw = String(part.text ?? "");
    if (!raw.trim()) return;

    if (!prev) {
      out = raw;
      prev = part;
      return;
    }

    const prevEnd = prev.x + (Number(prev.width) || 0);
    const gap = part.x - prevEnd;
    const em = Math.max(prev.size || 10, part.size || 10);
    const spaced = /\s$/.test(out) || /^\s/.test(raw);

    let glue = "";
    if (spaced) glue = " ";
    else if (gap > em * 2.4) glue = " | ";   // 표의 셀 구분
    else if (gap > em * 0.2) glue = " ";     // 단어 사이

    out = out.replace(/\s+$/, "") + glue + raw.replace(/^\s+/, "");
    prev = part;
  });

  return polishText(out);
}

/** 페이지 번호, 머리글·꼬리글처럼 반복되는 줄을 제거합니다. */
export function stripRepeats(units) {
  if (!units || units.length < 3) return units;
  const counter = new Map();
  units.forEach((unit) => {
    const seen = new Set();
    (unit.lines || []).forEach((line) => {
      const key = normalizeText(line.text).replace(/\d+/g, "#").toLowerCase();
      if (key.length < 3 || key.length > 90) return;
      if (seen.has(key)) return;
      seen.add(key);
      counter.set(key, (counter.get(key) || 0) + 1);
    });
  });

  const threshold = Math.max(3, Math.ceil(units.length * 0.6));
  const repeated = new Set();
  counter.forEach((count, key) => {
    if (count >= threshold) repeated.add(key);
  });

  units.forEach((unit) => {
    unit.lines = (unit.lines || []).filter((line) => {
      const text = normalizeText(line.text);
      if (!text) return false;
      if (/^(page|페이지|p\.)\s*\d+(\s*\/\s*\d+)?$/i.test(text)) return false;
      if (/^\d{1,3}$/.test(text)) return false;
      const key = text.replace(/\d+/g, "#").toLowerCase();
      return !repeated.has(key);
    });
    unit.text = unit.lines.map((line) => line.text).join("\n");
  });
  return units;
}

/** 표 헤더로 보이는 줄인지 (줄바꿈 병합에서 제외하기 위해) */
const TABLE_HEADER_HINTS = /검사\s*코드|검사\s*명|검체|검사\s*방법|검사\s*일정|보험\s*정보|검사\s*수가|검사\s*항목|소요\s*시간|결과\s*보고/;

function shouldMergeWrapped(prev, next) {
  const a = String(prev.text || "");
  const b = String(next.text || "");
  if (!a || !b) return false;
  if (a.length < 18) return false;                 // 짧은 줄(라벨·표 값)은 그대로 둡니다.
  // 불릿 항목은 한 줄씩 독립된 내용이므로 서로 합치지 않습니다.
  if (/^[•·▪■◦○]/.test(a)) return false;
  if (/[.!?。:：]$/.test(a)) return false;          // 문장이 끝난 줄
  if (TABLE_HEADER_HINTS.test(a)) return false;    // 표 헤더 줄
  if (/^[•·▪■◦○*\-–—✓✔※]/.test(b)) return false;  // 새 불릿
  // 각주·번호 항목 (1), 2,3), 1.) — 숫자 뒤 구두점 다음에 공백이 오거나 줄이 끝나야 합니다.
  // 그렇지 않으면 "84.0%로 …" 같은 소수점 시작 줄이 잘못 걸립니다.
  if (/^\d{1,3}(?:[.,]\d+)*[.)](?:\s|$)/.test(b)) return false;
  if (b.length < 6) return false;
  if (/^(?:[가-힣]+\s*){1,3}[.:]\s/.test(b)) return false; // 새 소제목
  // 제목과 본문처럼 글자 크기가 다르면 이어지는 줄이 아닙니다.
  const sa = Number(prev.size) || 0;
  const sb = Number(next.size) || 0;
  if (sa && sb && Math.max(sa, sb) > Math.min(sa, sb) * 1.25) return false;
  if (a.length + b.length > 320) return false;
  return true;
}

/**
 * PDF는 한 문장이 여러 줄로 나뉘어 추출됩니다.
 * "…특이도" + "84.0% 로 검증되었습니다." 처럼 이어지는 줄을 합쳐
 * 수치·문장을 온전하게 만듭니다.
 */
export function mergeWrappedLines(lines) {
  const out = [];
  (lines || []).forEach((line) => {
    const prev = out[out.length - 1];
    if (prev && shouldMergeWrapped(prev, line)) {
      prev.text = polishText(prev.text + " " + line.text);
      prev.size = Math.max(prev.size || 0, line.size || 0);
      return;
    }
    out.push({ ...line });
  });
  return out;
}

function unitsToRawText(units) {
  return units
    .filter((unit) => unit.text && unit.text.trim())
    .map((unit) => `--- ${unit.file} / ${unit.label} ---\n${unit.text}`)
    .join("\n\n");
}

/** 줄바꿈 병합 + 반복 줄 제거 후 unit.text를 다시 계산합니다. */
function finalizeUnits(units, options) {
  const clean = options.clean !== false;
  const merged = units.map((unit) => {
    const lines = clean ? mergeWrappedLines(unit.lines) : (unit.lines || []).map((l) => ({ ...l }));
    return { ...unit, lines };
  });
  const result = clean ? stripRepeats(merged) : merged;
  result.forEach((unit) => {
    unit.text = (unit.lines || []).map((line) => line.text).join("\n");
  });
  return result;
}

/* ---------- PDF ---------- */

/** 조각들을 실제 간격 기준으로 셀 단위로 묶습니다. (표 인식용) */
function buildCells(parts) {
  const cells = [];
  let cur = null;

  parts.forEach((part) => {
    const raw = String(part.text ?? "");
    if (!raw.trim()) return;

    if (!cur) {
      cur = { text: raw, x: part.x, width: Number(part.width) || 0, size: part.size };
      return;
    }

    const gap = part.x - (cur.x + cur.width);
    const em = Math.max(cur.size || 10, part.size || 10);
    const split = gap > Math.max(em * 0.9, 5);

    if (split) {
      cur.text = polishText(cur.text);
      cells.push(cur);
      cur = { text: raw, x: part.x, width: Number(part.width) || 0, size: part.size };
    } else {
      const space = gap > em * 0.18 ? " " : "";
      cur.text = cur.text.replace(/\s+$/, "") + space + raw.replace(/^\s+/, "");
      cur.width = part.x + (Number(part.width) || 0) - cur.x;
      cur.size = Math.max(cur.size, part.size);
    }
  });

  if (cur) {
    cur.text = polishText(cur.text);
    cells.push(cur);
  }
  return cells.filter((cell) => cell.text);
}

/** PDF.js 텍스트 조각을 좌표·크기 정보가 담긴 형태로 정규화합니다. */
function normalizePdfItems(items) {
  return (items || [])
    .filter((item) => item && typeof item.str === "string" && item.str.trim())
    .map((item) => {
      const size = Math.hypot(item.transform?.[2] || 0, item.transform?.[3] || 0) || item.height || 10;
      const text = item.str;
      const x = item.transform?.[4] || 0;
      const width = Number(item.width) || (text.length * size * 0.5);
      const y = item.transform?.[5] || 0;
      return { text, size, x, width, y };
    });
}

function groupPdfItems(items) {
  const normalized = normalizePdfItems(items);
  const rows = new Map();
  normalized.forEach((item) => {
    // 세로 위치를 3pt 단위로 묶어 같은 줄의 조각을 모읍니다.
    const key = Math.round(item.y / 3) * 3;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(item);
  });

  return Array.from(rows.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([key, parts]) => {
      const ordered = parts.sort((a, b) => a.x - b.x);
      // 조각 사이 실제 간격으로 공백 여부를 판단합니다.
      const text = joinPdfParts(ordered);
      const size = Math.max(...ordered.map((p) => p.size));
      return {
        text,
        size,
        x: Math.min(...ordered.map((p) => p.x)),
        y: key,
        cells: buildCells(ordered),
      };
    })
    .filter((line) => line.text || line.cells.length);
}

function canvasToImage(canvas, quality = 0.86) {
  return canvas.toDataURL("image/jpeg", quality);
}

/* ---------- 표 인식 (재단 1P 검사 안내서 공통 구조) ---------- */

/** 표 헤더 열 이름 → 표준 항목명 */
const TABLE_COLUMNS = [
  { re: /^검사\s*코드$|^검사\s*코드|^코드$/, field: "검사 코드" },
  { re: /^검사\s*명|^검사\s*항목|^항목명/, field: "검사명" },
  { re: /^검체$|^검체\s*종류$|^시료$/, field: "검체" },
  { re: /^검사\s*방법$|^측정\s*방법$|^방법$/, field: "검사 방법" },
  { re: /^검사\s*일정$|^검사일$|^운영\s*일정$/, field: "검사 일정" },
  { re: /^보험\s*정보$|^급여\s*정보$/, field: "보험 정보" },
  { re: /^검사\s*수가|^수가$/, field: "검사 수가" },
  { re: /^소요\s*시간$|^보고\s*시간$/, field: "소요 시간" },
  { re: /^결과\s*보고$|^결과\s*통보$/, field: "결과 보고" },
  { re: /^의뢰\s*방법$|^의뢰\s*절차$/, field: "의뢰 방법" },
  { re: /^보관\s*방법$|^검체\s*보관$|^보관$/, field: "검체 보관" },
];

/** 표 헤더 줄(값 없이 열 이름만 있는 줄)인지 — 본문에서 제거합니다. */
export function isTableHeaderLine(text) {
  const value = String(text || "").trim();
  if (value.length > 120) return false;
  if (/\d[\d,]*\s*(?:원|%)/.test(value)) return false;   // 수가·비율이 있으면 헤더가 아님
  if (/[:：]/.test(value)) return false;                  // "검체 : 위액" 같은 항목 줄
  const hits = TABLE_COLUMNS.filter((column) => column.re.test(value)).length;
  const loose = (value.match(/검사\s*(?:코드|명|방법|일정|수가)|검체|보험\s*정보|소요\s*시간|결과\s*보고|의뢰\s*방법/g) || []).length;
  return hits >= 3 || loose >= 3;
}

const TABLE_BODY_HEIGHT = 110;   // 헤더 아래로 표 본문으로 볼 최대 높이(pt)
const TABLE_ROW_BAND = 6;        // 같은 값 행으로 묶을 세로 범위

/** 열별로 값 표기를 다듬습니다. (숫자 단위 붙이기, 쉼표 유지 등) */
function tidyTableValue(field, rawValue) {
  let value = polishText(String(rawValue || "")).replace(/\s*·\s*(?=·)/g, "");
  if (!value) return "";

  // "23,400 원" → "23,400원"
  value = value.replace(/(\d)\s+(원|명|건|일|주|개월|시간|분)\b/g, "$1$2");
  // 코드는 붙여서 표기합니다. (D2420024Zetc, 누591)
  if (field === "검사 코드") value = value.replace(/\s+/g, "");
  // 검사 일정: "월 , 목 / 1 일" → "월, 목 / 1일"
  if (field === "검사 일정") {
    value = value
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s*\/\s*/g, " / ")
      .replace(/(\d)\s+(일|시간|분)/g, "$1$2");
  }
  // 수가: "23,400 원" 형태 유지, 꼬리표 정리
  if (field === "검사 수가") {
    value = value.replace(/\s*·\s*$/, "").trim();
  }
  // 중복 구분자 정리
  value = value.replace(/(?:\s*·\s*){2,}/g, " · ").replace(/^\s*·\s*|\s*·\s*$/g, "");
  return value.trim();
}

/**
 * 좌표로 표를 인식합니다.
 * 헤더 줄을 찾고, 그 아래 항목을 열 위치로 분류해 항목:값 을 만듭니다.
 */
export function detectTable(items) {
  const usable = (items || [])
    .filter((item) => item && String(item.text || "").trim() && Number.isFinite(item.x) && Number.isFinite(item.y))
    .map((item) => ({ ...item, text: String(item.text).trim() }));
  if (usable.length < 6) return null;

  // 헤더 후보: 세로로 가까운 조각들을 묶어 열 이름 개수를 셉니다.
  const bands = new Map();
  usable.forEach((item) => {
    const key = Math.round(item.y / 5) * 5;
    if (!bands.has(key)) bands.set(key, []);
    bands.get(key).push(item);
  });

  let header = null;
  Array.from(bands.entries())
    .sort((a, b) => b[0] - a[0])
    .forEach(([y, bandItems]) => {
      if (header) return;
      const columns = [];
      bandItems.forEach((item) => {
        const hit = TABLE_COLUMNS.find((column) => column.re.test(item.text));
        if (hit) columns.push({ ...item, field: hit.field });
      });
      if (columns.length >= 3) {
        header = { y, columns: columns.sort((a, b) => a.x - b.x) };
      }
    });

  if (!header) return null;

  // 열 경계 대신 "가장 가까운 열" 기준으로 배정합니다.
  // 값의 x좌표가 헤더 x좌표와 정확히 일치하지 않는 경우가 많기 때문입니다.
  header.columns.forEach((column, index) => {
    column.index = index;
  });
  const COLUMN_MAX_DISTANCE = 95; // 이보다 멀면 다른 영역(각주 등)으로 봅니다.

  // 표 본문의 하단 경계를 찾습니다.
  // 각주(*), 참고문헌, 긴 문단이 나오면 그 위까지만 표로 봅니다.
  let stopY = header.y - TABLE_BODY_HEIGHT;
  usable
    .filter((item) => item.y < header.y - 1)
    .sort((a, b) => b.y - a.y)
    .forEach((item) => {
      if (item.y <= stopY) return;
      const t = item.text;
      const isBoundary =
        /^[*※]/.test(t) ||
        /^(?:참고\s*문헌|참고\s*자료|출처|references?)\s*$/i.test(t) ||
        (t.length > 70 && !/[|·]/.test(t)) ||                      // 긴 문단·문헌
        (/^\d+[.)]\s*\S/.test(t) && t.length > 40);                // 번호 매긴 문헌
      if (isBoundary) stopY = Math.max(stopY, item.y);
    });

  // 헤더 아래 본문 수집 (PDF는 위로 갈수록 y가 큽니다)
  const body = usable.filter((item) =>
    item.y < header.y - 1 &&
    item.y > stopY &&
    !TABLE_COLUMNS.some((column) => column.re.test(item.text) && item.text.length <= 10)
  );
  if (!body.length) return null;

  // 같은 값 행(y 밴드)으로 묶고, 각 조각을 가장 가까운 열에 배정합니다.
  const rowBands = new Map();
  body.forEach((item) => {
    const key = Math.round(item.y / TABLE_ROW_BAND) * TABLE_ROW_BAND;
    if (!rowBands.has(key)) rowBands.set(key, []);
    rowBands.get(key).push(item);
  });

  // 각주(*·질가산료 …)와 참고문헌 구역은 표 값이 아니므로 통째로 제외합니다.
  Array.from(rowBands.keys()).forEach((key) => {
    const bandItems = rowBands.get(key);
    const joined = bandItems.map((entry) => entry.text).join(" ");
    const isNote = bandItems.some((entry) => /^[*※]/.test(entry.text)) ||
      /참고\s*문헌|references?|references|출처|인용/i.test(joined) ||
      bandItems.some((entry) => entry.text.length > 60);
    if (isNote) rowBands.delete(key);
  });

  const values = new Map(); // field -> [{text, y, xEnd}]
  Array.from(rowBands.entries())
    .sort((a, b) => b[0] - a[0])
    .forEach(([, rowItems]) => {
      rowItems
        .sort((a, b) => a.x - b.x)
        .forEach((item) => {
          let column = null;
          let best = Infinity;
          header.columns.forEach((candidate) => {
            const distance = Math.abs(item.x - candidate.x);
            if (distance < best) {
              best = distance;
              column = candidate;
            }
          });
          if (!column || best > COLUMN_MAX_DISTANCE) return;

          if (!values.has(column.field)) values.set(column.field, []);
          const list = values.get(column.field);
          const last = list[list.length - 1];
          // 같은 값 행에서 이어지는 조각은 붙이고, 줄이 바뀌면 새 값으로 봅니다.
          if (last && Math.abs(last.y - item.y) <= TABLE_ROW_BAND) {
            const gap = item.x - last.xEnd;
            last.text = polishText(last.text + (gap > (last.size || 10) * 0.34 ? " " : "") + item.text);
            last.xEnd = item.x + (item.width || 0);
            last.y = Math.max(last.y, item.y);
          } else {
            list.push({ text: item.text, y: item.y, xEnd: item.x + (item.width || 0), size: item.size });
          }
        });
    });

  const rows = [];
  header.columns
    .slice()
    .sort((a, b) => a.index - b.index)
    .forEach((column) => {
      const list = values.get(column.field);
      if (!list || !list.length) return;
      const value = tidyTableValue(column.field, list.map((entry) => entry.text).filter(Boolean).join(" · "));
      if (!value) return;
      rows.push({ field: column.field, value: truncate(value, 90) });
    });

  if (rows.length < 2) return null;
  return { rows, headerY: header.y, regionTop: header.y, regionBottom: stopY };
}

/** 페이지에 심어진 이미지 오브젝트를 꺼냅니다. */
async function getEmbeddedPdfImages(page, fileLabel, pageIndex, sink) {
  const pdfjs = await getPdfjs();
  const OPS = pdfjs.OPS;
  let ops;
  try {
    ops = await page.getOperatorList();
  } catch (error) {
    return;
  }

  const wanted = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject ||
        fn === OPS.paintImageMaskXObject || fn === OPS.paintInlineImageXObject) {
      const arg = ops.argsArray[i]?.[0];
      wanted.push(typeof arg === "string" ? arg : arg);
    }
  }

  const names = wanted.filter((name) => typeof name === "string").slice(0, 6);

  for (const name of names) {
    if (sink.images.length >= MAX_IMAGES) return;
    const img = await new Promise((resolve) => {
      let settled = false;
      const done = (value) => { if (!settled) { settled = true; resolve(value); } };
      try {
        page.objs.get(name, done);
      } catch (error) {
        done(null);
      }
      setTimeout(() => done(null), 4000);
    });
    if (!img || !img.width || !img.height) continue;
    if (img.width < MIN_IMAGE_SIDE || img.height < MIN_IMAGE_SIDE) continue;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      const data = img.data;
      if (!data || data.length < img.width * img.height * 3) continue;
      const imageData = ctx.createImageData(img.width, img.height);
      const channels = data.length / (img.width * img.height);
      for (let p = 0; p < img.width * img.height; p++) {
        imageData.data[p * 4] = data[p * channels];
        imageData.data[p * 4 + 1] = data[p * channels + 1];
        imageData.data[p * 4 + 2] = data[p * channels + 2];
        imageData.data[p * 4 + 3] = channels === 4 ? data[p * channels + 3] : 255;
      }
      ctx.putImageData(imageData, 0, 0);
      sink.images.push({
        id: `img_${sink.images.length + 1}`,
        name: `${fileLabel} p.${pageIndex}`,
        source: fileLabel,
        dataUrl: canvasToImage(canvas),
        width: img.width,
        height: img.height,
      });
    } catch (error) {
      /* 개별 이미지 실패는 무시하고 계속 진행합니다. */
    }
  }
}

async function extractPdf(file, options, onProgress) {
  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;
  const units = [];
  const sink = { images: [] };

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      if (onProgress) onProgress(pageNum, pdf.numPages, file.name);
      const page = await pdf.getPage(pageNum);
      let lines = [];
      let table = null;
      try {
        const content = await page.getTextContent();
        const normalized = normalizePdfItems(content.items);
        // 좌표를 살려 표를 먼저 인식합니다. (헤더 행 + 값 행 구조)
        table = detectTable(normalized);
        lines = groupPdfItems(content.items);
        if (table) {
          // 표 헤더 줄과 표 영역의 값 줄은 본문에서 제외하고,
          // 읽기 좋은 "항목 : 값" 형태로 다시 넣습니다.
          lines = lines.filter((line) => {
            if (isTableHeaderLine(line.text)) return false;
            if (typeof line.y !== "number") return true;
            return !(line.y < table.regionTop && line.y > table.regionBottom);
          });
          table.rows.forEach((row) => {
            lines.push({ text: `${row.field} : ${row.value}`, size: 11, fromTable: true });
          });
        }
      } catch (error) {
        lines = [];
      }
      if (options.images && sink.images.length < MAX_IMAGES) {
        await getEmbeddedPdfImages(page, file.name, pageNum, sink);
      }
      units.push({
        file: file.name,
        index: pageNum,
        label: `${pageNum}페이지`,
        lines,
        tableRows: table ? table.rows : [],
        text: lines.map((l) => l.text).join("\n"),
        imageCount: sink.images.length,
      });
    }

    // 페이지에 이미지가 거의 없을 때에는 페이지 전체를 그림으로 담아 둡니다.
    // (스캔본 대비용. 텍스트가 있는 문서에서는 원본 복제가 되므로
    //  fullPage 표시를 남겨 홍보물에 자동 삽입되지 않게 합니다.)
    if (options.images && sink.images.length < 3 && pdf.numPages) {
      const limit = Math.min(pdf.numPages, 6);
      for (let pageNum = 1; pageNum <= limit && sink.images.length < MAX_IMAGES; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          sink.images.push({
            id: `img_${sink.images.length + 1}`,
            name: `${file.name} ${pageNum}페이지 전체`,
            source: file.name,
            dataUrl: canvasToImage(canvas, 0.84),
            width: canvas.width,
            height: canvas.height,
            fullPage: true,
          });
        } catch (error) {
          /* 렌더 실패는 무시 */
        }
      }
    }
  } finally {
    if (typeof loadingTask.destroy === "function") {
      try { await loadingTask.destroy(); } catch (error) { /* 무시 */ }
    }
  }

  return { units, images: sink.images };
}

/* ---------- PPTX (ZIP 직접 해석) ---------- */

function readZipEntries(buffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");
  const minOffset = Math.max(0, buffer.byteLength - 65557);
  let eocd = -1;

  for (let pos = buffer.byteLength - 22; pos >= minOffset; pos--) {
    if (pos + 4 <= buffer.byteLength && view.getUint32(pos, true) === 0x06054b50) {
      eocd = pos;
      break;
    }
  }
  if (eocd < 0) throw new Error("PPTX(ZIP) 구조를 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.");

  const entryCount = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const entries = [];
  let ptr = centralOffset;

  for (let i = 0; i < entryCount; i++) {
    if (ptr + 46 > buffer.byteLength || view.getUint32(ptr, true) !== 0x02014b50) {
      throw new Error("PPTX 내부 파일 목록을 읽을 수 없습니다.");
    }
    const flags = view.getUint16(ptr + 8, true);
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const nameLength = view.getUint16(ptr + 28, true);
    const extraLength = view.getUint16(ptr + 30, true);
    const commentLength = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, ptr + 46, nameLength));
    entries.push({ name, flags, method, compressedSize, localOffset });
    ptr += 46 + nameLength + extraLength + commentLength;
  }
  return { entries, view };
}

async function inflateEntry(buffer, entry, view) {
  if (entry.flags & 1) throw new Error("암호가 설정된 파일은 처리할 수 없습니다.");
  const local = entry.localOffset;
  if (local + 30 > buffer.byteLength || view.getUint32(local, true) !== 0x04034b50) {
    throw new Error("PPTX 내부 데이터를 읽을 수 없습니다.");
  }
  const nameLength = view.getUint16(local + 26, true);
  const extraLength = view.getUint16(local + 28, true);
  const start = local + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > buffer.byteLength) throw new Error("PPTX 파일이 잘려 있습니다.");

  const compressed = new Uint8Array(buffer.slice(start, end));
  if (entry.method === 0) return compressed;
  if (entry.method !== 8) throw new Error("지원하지 않는 압축 방식입니다.");
  if (typeof DecompressionStream === "undefined") {
    throw new Error("이 브라우저는 PPTX 압축 해제를 지원하지 않습니다. 최신 Chrome 또는 Edge에서 시도해 주세요.");
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function slideNumber(name) {
  const m = String(name).match(/slide(\d+)\.xml$/i);
  return m ? Number(m[1]) : 0;
}

function mimeFromName(name) {
  const ext = String(name).split(".").pop().toLowerCase();
  const map = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    bmp: "image/bmp", webp: "image/webp", tif: "image/tiff", tiff: "image/tiff",
    emf: "image/emf", wmf: "image/wmf", svg: "image/svg+xml",
  };
  return map[ext] || "";
}

async function extractPptx(file, options, onProgress) {
  const buffer = await file.arrayBuffer();
  const { entries, view } = readZipEntries(buffer);
  const drawing = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const decoder = new TextDecoder("utf-8");

  const slides = entries
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => slideNumber(a.name) - slideNumber(b.name));
  if (!slides.length) throw new Error("PPTX 안에서 슬라이드를 찾지 못했습니다.");

  const notesByIndex = new Map();
  entries
    .filter((entry) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(entry.name))
    .forEach((entry) => notesByIndex.set(slideNumber(entry.name), entry));

  const units = [];

  for (let i = 0; i < slides.length; i++) {
    const entry = slides[i];
    onProgress && onProgress(i + 1, slides.length, file.name);
    let lines = [];
    try {
      const bytes = await inflateEntry(buffer, entry, view);
      const xml = new DOMParser().parseFromString(decoder.decode(bytes), "application/xml");
      if (!xml.getElementsByTagName("parsererror").length) {
        lines = Array.from(xml.getElementsByTagNameNS(drawing, "p"))
          .map((paragraph) => {
            const nodes = Array.from(paragraph.getElementsByTagNameNS(drawing, "t"));
            const text = normalizeText(nodes.map((node) => node.textContent || "").join(""));
            // 문단의 첫 run 크기를 글자 크기로 사용합니다. (없으면 0)
            let size = 0;
            paragraph.querySelectorAll("rPr").forEach((pr) => {
              const sz = Number(pr.getAttribute("sz") || 0);
              if (sz > size) size = sz / 100;
            });
            return { text, size: size || 18 };
          })
          .filter((line) => line.text);
      }
    } catch (error) {
      lines = [];
    }

    // 발표자 노트도 본문 뒤에 붙입니다.
    const note = notesByIndex.get(slideNumber(entry.name));
    if (note) {
      try {
        const bytes = await inflateEntry(buffer, note, view);
        const xml = new DOMParser().parseFromString(decoder.decode(bytes), "application/xml");
        const noteLines = Array.from(xml.getElementsByTagNameNS(drawing, "p"))
          .map((p) => normalizeText(Array.from(p.getElementsByTagNameNS(drawing, "t")).map((n) => n.textContent || "").join("")))
          .filter((t) => t && !/^\d+$/.test(t));
        const joined = noteLines.join("\n");
        if (joined.length > 30) lines.push({ text: joined, size: 12 });
      } catch (error) { /* 노트 없으면 무시 */ }
    }

    units.push({
      file: file.name,
      index: slideNumber(entry.name),
      label: `슬라이드 ${i + 1}`,
      lines,
      text: lines.map((l) => l.text).join("\n"),
    });
  }

  const images = [];
  if (options.images) {
    const media = entries
      .filter((entry) => /^ppt\/media\//i.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of media) {
      if (images.length >= MAX_IMAGES) break;
      const mime = mimeFromName(entry.name);
      if (!mime || /emf|wmf|tiff?/i.test(mime)) continue;
      try {
        const bytes = await inflateEntry(buffer, entry, view);
        if (bytes.byteLength < 6000) continue;
        const blob = new Blob([bytes], { type: mime });
        if (blob.size > 5 * 1024 * 1024) continue;
        const dataUrl = await readAsDataUrl(blob);
        images.push({
          id: `img_${images.length + 1}`,
          name: entry.name.split("/").pop(),
          source: file.name,
          dataUrl,
          width: 0,
          height: 0,
        });
      } catch (error) { /* 개별 미디어 실패는 무시 */ }
    }
  }

  return { units, images };
}

/* ---------- 진입점 ---------- */

export async function extractFiles(fileList, options = {}, onProgress) {
  const files = Array.from(fileList || []);
  const units = [];
  const images = [];
  const report = [];
  const failures = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const status = {
      name: file.name,
      size: file.size,
      kind: "",
      units: 0,
      chars: 0,
      images: 0,
      ok: false,
      error: "",
      restored: false,
    };

    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("파일이 50MB를 초과합니다.");
      const lower = file.name.toLowerCase();
      let result;

      if (lower.endsWith(".pdf")) {
        status.kind = "PDF";
        result = await extractPdf(file, options, (page, total) => {
          onProgress && onProgress({ fileIndex: i, fileCount: files.length, page, total, name: file.name });
        });
      } else if (lower.endsWith(".pptx")) {
        status.kind = "PPTX";
        result = await extractPptx(file, options, (slide, total) => {
          onProgress && onProgress({ fileIndex: i, fileCount: files.length, page: slide, total, name: file.name });
        });
      } else if (lower.endsWith(".ppt")) {
        throw new Error("구형 .ppt 형식은 읽을 수 없습니다. PPTX로 저장한 뒤 첨부해 주세요.");
      } else {
        throw new Error("PDF 또는 PPTX 파일만 지원합니다.");
      }

      const localUnits = (result.units || []).map((unit) => ({ ...unit, file: unit.file || file.name }));
      units.push(...localUnits);
      (result.images || []).forEach((image) => {
        if (images.length < MAX_IMAGES) images.push({ ...image, id: `img_${images.length + 1}` });
      });

      status.units = localUnits.length;
      status.chars = localUnits.reduce((sum, unit) => sum + (unit.text || "").replace(/\s+/g, "").length, 0);
      status.images = (result.images || []).length;
      status.ok = status.units > 0;
      if (!status.units) status.error = "텍스트를 찾지 못했습니다. 이미지로만 만들어진 자료일 수 있습니다.";
    } catch (error) {
      status.error = error.message || "알 수 없는 오류";
      failures.push(`${file.name}: ${status.error}`);
    }

    report.push(status);
  }

  const cleaned = finalizeUnits(units, options);
  return { units: cleaned, rawText: unitsToRawText(cleaned), images, report, failures };
}
