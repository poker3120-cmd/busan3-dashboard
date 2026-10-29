/* =========================================================
   숙성항목 — 거래처 월별 검사 항목·건수 비교
   Excel(.xlsx) / CSV 파일은 브라우저 안에서만 처리합니다.
   ========================================================= */

import { $, escapeHtml, formatNumber, downloadBlob, loadScript } from "./utils.js";

const JSZIP_SRC = "./jszip.min.js?v=20261027j";
const CLIENT_ALIASES = [
  "거래처명", "거래처", "병원명", "의원명", "요양기관명",
  "의료기관명", "의료기관", "거래처코드", "거래처번호", "병원코드",
];
const ITEM_ALIASES = [
  "검사항목", "검사 항목", "검사명", "검사항목명", "항목명",
  "검사종목", "검사코드", "검사 코드", "항목코드", "항목", "처방명", "품목명",
];
const COUNT_ALIASES = [
  "검사건수", "의뢰건수", "청구건수", "총건수", "건수", "검사량",
  "의뢰수", "검체수", "수량", "횟수", "실적", "건", "count",
];

let parsedFiles = [];
let comparedRows = [];
let comparisonMonths = [];
let monthlyOverview = [];
let comparisonMode = "monthly"; // "annual-vs-current" compares prior-year annual history with the latest selected period
let wired = false;

function normalized(value) {
  return String(value ?? "").toLowerCase().replace(/[\s\u00a0\-_.()（）\[\]【】:：/\\]/g, "");
}

function cleanCell(value) {
  return String(value ?? "").replace(/\u0000/g, "").trim();
}

function columnIndex(reference) {
  const letters = String(reference || "").match(/^[A-Z]+/i)?.[0];
  if (!letters) return -1;
  let result = 0;
  for (const ch of letters.toUpperCase()) result = result * 26 + ch.charCodeAt(0) - 64;
  return result - 1;
}

function firstText(node, localName) {
  const found = node?.getElementsByTagNameNS("*", localName)?.[0];
  return found ? found.textContent || "" : "";
}

function allText(node, localName) {
  return Array.from(node?.getElementsByTagNameNS("*", localName) || [])
    .map((item) => item.textContent || "").join("");
}

function parseXml(text, label) {
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) {
    throw new Error(label + " XML을 읽을 수 없습니다. 파일이 손상되었을 수 있습니다.");
  }
  return xml;
}

function parsePeriodFromName(name) {
  const text = String(name || "");
  // Full date range, e.g. 2025-01-01 ~ 2025-12-31
  const range = text.match(/(20\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\s*(?:~|～|〜|–|—|至)\s*(20\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  if (range) {
    const pad = (v) => String(Number(v)).padStart(2, "0");
    const start = range[1] + "-" + pad(range[2]) + "-" + pad(range[3]);
    const end = range[4] + "-" + pad(range[5]) + "-" + pad(range[6]);
    const startYear = Number(range[1]), startMonth = Number(range[2]), startDay = Number(range[3]);
    const endYear = Number(range[4]), endMonth = Number(range[5]), endDay = Number(range[6]);
    const isAnnual = startYear === endYear && startMonth === 1 && startDay === 1 &&
      endMonth === 12 && endDay === 31;
    const isWholeMonth = startYear === endYear && startMonth === endMonth &&
      startDay === 1 && new Date(endYear, endMonth, 0).getDate() === endDay;
    return {
      period: end.slice(0, 7),
      periodStart: start,
      periodEnd: end,
      periodType: isAnnual ? "annual" : (isWholeMonth ? "month" : "range"),
      periodLabel: start + " ~ " + end + (isAnnual ? " (연간)" : ""),
    };
  }

  // Month in filename, e.g. 2026-08 or 2026년 8월
  const m = text.match(/(20\d{2})\s*[년._\-/ ]?\s*(0?[1-9]|1[0-2])\s*월?/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const mm = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const start = year + "-" + mm + "-01";
    const end = year + "-" + mm + "-" + String(lastDay).padStart(2, "0");
    return {
      period: year + "-" + mm,
      periodStart: start,
      periodEnd: end,
      periodType: "month",
      periodLabel: year + "-" + mm,
    };
  }
  return { period: "", periodStart: "", periodEnd: "", periodType: "unknown", periodLabel: "" };
}

function monthLabel(file) {
  return file.periodLabel || file.period || file.name.replace(/\.(xlsx|csv)$/i, "");
}

// 거래처별로 저장된 보고서는 파일명에서 거래처명을 가져옵니다.
function customerFromFilename(name) {
  let base = String(name || "").replace(/\.(xlsx|csv)$/i, "").trim();
  base = base.replace(/\s*[（(]\s*검사항목별\s*[）)]/gi, " ").trim();
  const dateIndex = base.search(/20\d{2}\s*(?:[-._년]\s*)\d{1,2}/);
  if (dateIndex >= 0) base = base.slice(0, dateIndex);
  base = base.replace(/[\s_\-~～]+$/g, "").trim();
  if (!base || /^(검사항목별|검사실적|월간실적|거래처별|검사내역)$/i.test(base)) return "";
  return base;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') { value += '"'; i++; }
        else quoted = false;
      } else value += ch;
    } else if (ch === '"' && value === "") quoted = true;
    else if (ch === ",") { row.push(value); value = ""; }
    else if (ch === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cleanCell(cell))) rows.push(row);
      row = []; value = "";
    } else value += ch;
  }
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cleanCell(cell))) rows.push(row);
  return { sheetName: "CSV", rows };
}

async function parseXlsx(file) {
  await loadScript(JSZIP_SRC);
  const JSZip = window.JSZip;
  if (!JSZip?.loadAsync) throw new Error("Excel 읽기 모듈을 불러오지 못했습니다. 페이지를 새로고침해 주세요.");

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const workbookFile = zip.file("xl/workbook.xml");
  if (!workbookFile) throw new Error("XLSX 통합 문서 정보를 찾지 못했습니다.");
  const workbook = parseXml(await workbookFile.async("string"), "통합 문서");

  let sharedStrings = [];
  const stringsFile = zip.file("xl/sharedStrings.xml");
  if (stringsFile) {
    const stringsXml = parseXml(await stringsFile.async("string"), "공유 문자열");
    sharedStrings = Array.from(stringsXml.getElementsByTagNameNS("*", "si"))
      .map((si) => allText(si, "t"));
  }

  const relsFile = zip.file("xl/_rels/workbook.xml.rels");
  const rels = new Map();
  if (relsFile) {
    const relsXml = parseXml(await relsFile.async("string"), "시트 연결 정보");
    Array.from(relsXml.getElementsByTagNameNS("*", "Relationship")).forEach((rel) => {
      rels.set(rel.getAttribute("Id"), rel.getAttribute("Target"));
    });
  }

  const sheets = Array.from(workbook.getElementsByTagNameNS("*", "sheet"));
  if (!sheets.length) throw new Error("통합 문서에서 시트를 찾지 못했습니다.");

  const sheetDefs = sheets.map((sheet) => {
    const rid = sheet.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"
    ) || sheet.getAttribute("r:id");
    let target = rels.get(rid) || "worksheets/sheet1.xml";
    target = target.replace(/^\//, "");
    if (!target.startsWith("xl/")) target = "xl/" + target.replace(/^\.\//, "");
    target = target.replace(/(^|\/)\.\//g, "$1");
    return { name: sheet.getAttribute("name") || "Sheet", target };
  });

  for (const sheet of sheetDefs) {
    const sheetFile = zip.file(sheet.target);
    if (!sheetFile) continue;
    const xml = parseXml(await sheetFile.async("string"), "워크시트");
    const rows = [];
    Array.from(xml.getElementsByTagNameNS("*", "row")).forEach((rowNode) => {
      const row = [];
      Array.from(rowNode.getElementsByTagNameNS("*", "c")).forEach((cell) => {
        const index = columnIndex(cell.getAttribute("r"));
        if (index < 0) return;
        const type = cell.getAttribute("t") || "";
        let value = "";
        if (type === "s") {
          const n = Number(firstText(cell, "v"));
          value = Number.isInteger(n) ? (sharedStrings[n] ?? "") : "";
        } else if (type === "inlineStr") {
          value = allText(cell, "t");
        } else {
          value = firstText(cell, "v");
        }
        row[index] = cleanCell(value);
      });
      rows.push(row.map((cell) => cell ?? ""));
    });
    const useful = rows.filter((row) => row.some((cell) => cleanCell(cell)));
    if (useful.length) return { sheetName: sheet.name, rows: useful };
  }
  throw new Error("읽을 수 있는 데이터가 있는 시트를 찾지 못했습니다.");
}

function findColumn(headers, aliases) {
  const values = headers.map((header) => normalized(header));
  for (const alias of aliases) {
    const wanted = normalized(alias);
    const exact = values.findIndex((value) => value === wanted);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases.filter((a) => normalized(a).length > 2)) {
    const wanted = normalized(alias);
    const partial = values.findIndex((value) => value.includes(wanted));
    if (partial >= 0) return partial;
  }
  return -1;
}

function detectHeader(matrix) {
  let best = null;
  const max = Math.min(matrix.length, 35);
  for (let index = 0; index < max; index++) {
    const row = (matrix[index] || []).map(cleanCell);
    const nonempty = row.filter(Boolean);
    if (nonempty.length < 2) continue;
    const client = findColumn(row, CLIENT_ALIASES);
    // 사용자가 내려받는 양식은 C열=검사명, D열=건수로 고정되어 있습니다.
    const item = row.length > 2 ? 2 : -1;
    const count = row.length > 3 ? 3 : -1;
    let score = (client >= 0 ? 6 : 0) + (item >= 0 ? 2 : 0) + (count >= 0 ? 2 : 0);
    if (client >= 0 && item >= 0 && count >= 0) score += 2;
    const itemHeader = !!row[2] && ITEM_ALIASES.some((alias) => normalized(row[2]) === normalized(alias));
    const countHeader = !!row[3] && COUNT_ALIASES.some((alias) => normalized(row[3]) === normalized(alias));
    if (itemHeader) score += 3;
    if (countHeader) score += 3;
    if (nonempty.some((v) => /거래처|병원|의원/.test(v))) score += 1;
    if (score > (best?.score ?? -1)) best = { index, headers: row, client, item, count, score };
  }
  if (!best || best.score < 5) {
    // 첫 행을 사용자 지정 매핑에서 살릴 수 있도록 낮은 점수라도 보관합니다.
    const index = Math.min(Math.max(matrix.findIndex((row) => row.some((v) => cleanCell(v))), 0), Math.max(matrix.length - 1, 0));
    const headers = (matrix[index] || []).map(cleanCell);
    best = { index, headers, client: -1, item: headers.length > 2 ? 2 : -1, count: headers.length > 3 ? 3 : -1, score: 0 };
  }
  return {
    headerRow: best.index,
    headers: best.headers,
    detectedClient: best.client,
    detectedItem: best.item,
    detectedCount: best.count,
    // matrix 전달 전에 시트 첫 행을 제외하므로, 헤더 바로 다음 행부터 데이터입니다.
    rows: matrix.slice(best.index + 1).filter((row) => row.some((cell) => cleanCell(cell))),
  };
}

function selectHtml(options, selected) {
  return options.map((option) => (
    '<option value="' + escapeHtml(String(option.value)) + '"' +
      (String(option.value) === String(selected) ? " selected" : "") + ">" +
      escapeHtml(option.label) + "</option>"
  )).join("");
}

function renderMappings() {
  const host = $("agingMappings");
  if (!host) return;
  if (!parsedFiles.length) {
    host.innerHTML = "";
    host.hidden = true;
    $("agingCompareButton").disabled = true;
    return;
  }
  host.hidden = false;
  host.innerHTML = `
    <h3>2. 거래처 열 확인</h3>
    <p class="meta">검사명은 C열, 건수는 D열로 고정했습니다. 거래처 열이 없는 거래처별 보고서는 파일명에서 거래처명을 자동 적용합니다. 자동 인식이 잘못된 파일은 거래처 열을 직접 바꿀 수 있습니다.</p>
    <div class="table-wrap">
      <table class="aging-map-table">
        <thead><tr><th>파일 / 시트</th><th>인식한 기간</th><th>거래처 열</th><th>검사명</th><th>건수</th></tr></thead>
        <tbody>${parsedFiles.map((file, index) => {
          const headers = file.headers.map((value, idx) => ({ value: idx, label: value || `열 ${idx + 1}` }));
          const filenameOption = file.customerFromFilename
            ? [{ value: -2, label: "파일명 사용: " + file.customerFromFilename }]
            : [];
          const colOptions = [{ value: -1, label: "선택 안 함" }, ...filenameOption, ...headers];
          return `<tr>
            <td><strong>${escapeHtml(file.name)}</strong><div class="meta">${escapeHtml(file.sheetName)} · ${file.rows.length}개 데이터 행</div></td>
            <td><strong>${escapeHtml(file.periodLabel || file.period || "기간 미인식")}</strong><div class="meta">${file.periodType === "annual" ? "전년 연간 기준자료" : file.periodType === "month" ? "월간 자료" : "기간 확인"}</div></td>
            <td><select data-aging-map="client" data-aging-index="${index}">${selectHtml(colOptions, file.mapping.client)}</select></td>
            <td><span class="aging-fixed-column">C열 고정</span><div class="meta">${escapeHtml(file.headers[2] || "검사명")}</div></td>
            <td><span class="aging-fixed-column">D열 고정</span><div class="meta">${escapeHtml(file.headers[3] || "건수")}</div></td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
    <div class="toolbar mt-12">
      <button type="button" class="btn" id="agingCompareButton">월별 비교 실행</button>
      <button type="button" class="btn secondary" id="agingResetMapping">거래처 열 자동 재설정</button>
    </div>
  `;
  $("agingCompareButton").disabled = parsedFiles.length < 2;
  $("agingCompareButton").addEventListener("click", runComparison);
  $("agingResetMapping").addEventListener("click", () => {
    parsedFiles.forEach((file) => {
      file.mapping = { client: file.detectedClient >= 0 ? file.detectedClient : (file.customerFromFilename ? -2 : -1), item: 2, count: 3 };
    });
    renderMappings();
    runComparison();
  });
}

function setStatus(message, kind = "") {
  const el = $("agingStatus");
  if (!el) return;
  el.className = "status" + (kind ? " " + kind : "");
  el.textContent = message;
}

function numberFromCell(value) {
  const text = cleanCell(value).replace(/,/g, "").replace(/[\s원건회]/g, "");
  if (!text || text === "-" || text === "—") return null;
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function isSummaryText(value) {
  return /^(합계|총계|소계|전체합계|전체|총합|grandtotal|subtotal)$/i.test(normalized(value));
}

function normalizeMonth(file, index) {
  return {
    key: file.periodStart && file.periodEnd ? file.periodStart + "|" + file.periodEnd : (file.period || "file-" + index),
    label: monthLabel(file),
    period: file.period,
    periodStart: file.periodStart || "",
    periodEnd: file.periodEnd || "",
    periodType: file.periodType || "unknown",
    fileName: file.name,
    uploadIndex: index,
  };
}

function makeMonthData(file, monthIndex) {
  const clientIndex = Number(file.mapping.client);
  const useFilenameCustomer = clientIndex === -2 && !!file.customerFromFilename;
  const itemIndex = 2;  // 고정: C열 검사명
  const countIndex = 3; // 고정: D열 건수
  if (!useFilenameCustomer && (!Number.isInteger(clientIndex) || clientIndex < 0 || !file.headers[clientIndex])) {
    throw new Error(file.name + "의 거래처 열을 지정해 주세요.");
  }
  if (file.headers.length <= countIndex) {
    throw new Error(file.name + "에 D열(건수)이 없습니다. 내려받은 원본 엑셀 양식인지 확인해 주세요.");
  }

  const entries = new Map();
  let lastClient = ""; // 거래처명이 셀 병합으로 한 번만 표시되는 엑셀 형식 보완
  const add = (clientName, itemName, quantity) => {
    const clientText = cleanCell(clientName);
    const itemText = cleanCell(itemName);
    if (!clientText || !itemText || isSummaryText(clientText) || isSummaryText(itemText)) return;
    if (itemText.length > 160 || clientText.length > 160) return;
    const key = clientText + "\u001f" + itemText;
    if (!entries.has(key)) entries.set(key, { client: clientText, item: itemText, count: 0 });
    entries.get(key).count += quantity;
  };

  for (const row of file.rows) {
    const rawClient = useFilenameCustomer ? file.customerFromFilename : cleanCell(row[clientIndex]);
    if (rawClient && isSummaryText(rawClient)) continue;
    if (rawClient) lastClient = rawClient;
    const clientName = rawClient || lastClient;
    if (!clientName) continue;
    const itemName = cleanCell(row[itemIndex]);
    if (!itemName || isSummaryText(itemName)) continue;
    const quantity = numberFromCell(row[countIndex]);
    if (quantity !== null && quantity > 0) add(clientName, itemName, quantity);
  }
  return { month: normalizeMonth(file, monthIndex), entries };
}

function statusFor(current, previous) {
  if (previous === 0 && current > 0) return "신규";
  if (previous > 0 && current === 0) return "중단";
  if (current > previous) return "증가";
  if (current < previous) return "감소";
  return "유지";
}

function statusOrder(status) {
  return ({
    "신규 항목": 0, 신규: 0,
    "기존 항목": 1,
    "전년만 있음": 2,
    중단: 3, 증가: 4, 감소: 5, 유지: 6,
  })[status] ?? 7;
}

function runComparison() {
  if (parsedFiles.length < 2) {
    setStatus("비교하려면 월별 엑셀을 2개 이상 첨부해 주세요.", "err");
    return;
  }
  try {
    parsedFiles.forEach((file, index) => {
      document.querySelectorAll('[data-aging-index="' + index + '"]').forEach((select) => {
        file.mapping[select.dataset.agingMap] = select.value;
      });
    });

    const datasets = parsedFiles.map((file, index) => makeMonthData(file, index));
    const rangeKeys = datasets.map((dataset) => dataset.month.key);
    if (rangeKeys.every(Boolean) && new Set(rangeKeys).size < rangeKeys.length) {
      setStatus("같은 기간의 파일이 중복 첨부되어 있습니다. 파일을 확인해 주세요.", "err");
      return;
    }
    datasets.sort((a, b) => {
      const ap = a.month.periodEnd || a.month.period || "";
      const bp = b.month.periodEnd || b.month.period || "";
      if (ap && bp) return ap.localeCompare(bp);
      if (ap && !bp) return -1;
      if (!ap && bp) return 1;
      return a.month.uploadIndex - b.month.uploadIndex;
    });

    comparisonMonths = datasets.map((dataset) => dataset.month);
    const allKeys = new Set();
    datasets.forEach((dataset) => dataset.entries.forEach((_, key) => allKeys.add(key)));
    const lastIndex = datasets.length - 1;
    const prevIndex = Math.max(0, lastIndex - 1);
    const currentPeriod = datasets[lastIndex]?.month;
    const annualCandidates = datasets.map((dataset, index) => ({ dataset, index }))
      .filter(({ dataset, index }) => index !== lastIndex &&
        dataset.month.periodType === "annual" &&
        currentPeriod?.periodStart &&
        dataset.month.periodEnd < currentPeriod.periodStart);
    const annualBaselineIndex = annualCandidates.length
      ? annualCandidates[annualCandidates.length - 1].index
      : -1;
    comparisonMode = annualBaselineIndex >= 0 && currentPeriod?.periodType !== "annual"
      ? "annual-vs-current"
      : "monthly";

    comparedRows = Array.from(allKeys).map((key) => {
      const parts = key.split("\u001f");
      const client = parts[0];
      const item = parts.slice(1).join("\u001f");
      const counts = datasets.map((dataset) => dataset.entries.get(key)?.count || 0);
      const previous = comparisonMode === "annual-vs-current"
        ? (counts[annualBaselineIndex] || 0)
        : (counts[prevIndex] || 0);
      const current = counts[lastIndex] || 0;
      let status;
      if (comparisonMode === "annual-vs-current") {
        status = current > 0
          ? (previous > 0 ? "기존 항목" : "신규 항목")
          : (previous > 0 ? "전년만 있음" : "유지");
      } else {
        status = statusFor(current, previous);
      }
      return {
        client, item, counts, previous, current,
        delta: comparisonMode === "annual-vs-current" ? null : current - previous,
        status,
      };
    }).filter((row) => row.counts.some((count) => count > 0))
      .sort((a, b) => statusOrder(a.status) - statusOrder(b.status) ||
        (comparisonMode === "monthly" ? Math.abs(b.delta || 0) - Math.abs(a.delta || 0) : 0) ||
        a.client.localeCompare(b.client, "ko") ||
        a.item.localeCompare(b.item, "ko"));

    monthlyOverview = datasets.map((dataset) => {
      const clients = new Set();
      let itemPairs = 0;
      let totalCount = 0;
      dataset.entries.forEach((entry) => {
        if (entry.count > 0) {
          clients.add(entry.client);
          itemPairs++;
          totalCount += entry.count;
        }
      });
      return { month: dataset.month, clients: clients.size, itemPairs, totalCount };
    });
    renderComparison();
    const last = comparisonMonths[comparisonMonths.length - 1];
    setStatus(
      `${parsedFiles.length}개 월별 파일 비교 완료 · ${comparedRows.length.toLocaleString("ko-KR")}개 거래처-항목 조합 · 최신 비교 기준: ${last.label}`,
      "ok"
    );
  } catch (error) {
    setStatus(error.message || "비교 분석 중 오류가 발생했습니다.", "err");
  }
}

function renderComparison() {
  const resultCard = $("agingResults");
  resultCard.hidden = false;
  $("agingExportCsv").disabled = false;
  const latestOverview = monthlyOverview[monthlyOverview.length - 1] || { clients: 0, itemPairs: 0, totalCount: 0 };
  const previousOverview = monthlyOverview[Math.max(0, monthlyOverview.length - 2)] || { clients: 0, itemPairs: 0, totalCount: 0 };
  const countDelta = latestOverview.totalCount - previousOverview.totalCount;

  if (comparisonMode === "annual-vs-current") {
    const newlyAppeared = comparedRows.filter((row) => row.status === "신규 항목").length;
    const existing = comparedRows.filter((row) => row.status === "기존 항목").length;
    const notAppearedThisPeriod = comparedRows.filter((row) => row.status === "전년만 있음").length;
    const currentItems = comparedRows.filter((row) => row.current > 0).length;
    const baseline = comparisonMonths.find((month) => month.periodType === "annual");
    const current = comparisonMonths[comparisonMonths.length - 1];
    $("agingSummary").innerHTML = `
      <div class="grid grid4 aging-kpis">
        <div class="card aging-kpi"><p>올해 해당 기간 검사 항목</p><strong>${formatNumber(currentItems)}개</strong><span>${escapeHtml(current?.label || "선택 기간")} 기준</span></div>
        <div class="card aging-kpi"><p>전년 연간 대비 신규 등장</p><strong>${formatNumber(newlyAppeared)}개</strong><span>전년 연간 자료에는 없던 항목</span></div>
        <div class="card aging-kpi"><p>전년 이력 있는 항목</p><strong>${formatNumber(existing)}개</strong><span>전년 중 한 번 이상 의뢰</span></div>
        <div class="card aging-kpi"><p>전년 이력만 있는 항목</p><strong>${formatNumber(notAppearedThisPeriod)}개</strong><span>올해 선택 기간에는 미발생</span></div>
      </div>
      <p class="meta mt-12">비교 기준: ${escapeHtml(baseline?.label || "전년 연간 자료")}의 거래처-검사 항목 이력과 ${escapeHtml(current?.label || "올해 선택 기간")}의 검사 항목을 비교했습니다. 연간 건수와 월간 건수는 기간 길이가 다르므로 증감량으로 직접 비교하지 않습니다. 신규/기존은 해당 거래처의 검사 항목이 전년 연간 자료에 있었는지를 기준으로 합니다.</p>
    `;
  } else {
    const added = comparedRows.filter((row) => row.status === "신규").length;
    const stopped = comparedRows.filter((row) => row.status === "중단").length;
    const increased = comparedRows.filter((row) => row.status === "증가").length;
    const decreased = comparedRows.filter((row) => row.status === "감소").length;
    $("agingSummary").innerHTML = `
      <div class="grid grid4 aging-kpis">
        <div class="card aging-kpi"><p>최신 월 거래처 수</p><strong>${formatNumber(latestOverview.clients)}곳</strong><span>전월 ${formatNumber(previousOverview.clients)}곳</span></div>
        <div class="card aging-kpi"><p>검사 의뢰 건수 합계</p><strong>${formatNumber(latestOverview.totalCount)}</strong><span>${countDelta >= 0 ? "+" : ""}${formatNumber(countDelta)}건 · 전월 대비</span></div>
        <div class="card aging-kpi"><p>신규 / 중단 항목</p><strong>${formatNumber(added)} / ${formatNumber(stopped)}</strong><span>거래처별 검사 조합 기준</span></div>
        <div class="card aging-kpi"><p>증가 / 감소 항목</p><strong>${formatNumber(increased)} / ${formatNumber(decreased)}</strong><span>최신 월과 직전 월 비교</span></div>
      </div>
      <p class="meta mt-12">변화 표시는 ${escapeHtml(comparisonMonths[Math.max(0, comparisonMonths.length - 2)]?.label || "이전 월")} 대비 ${escapeHtml(comparisonMonths[comparisonMonths.length - 1]?.label || "최신 월")} 기준입니다. 건수 합계는 선택한 건수 열의 숫자를 합산합니다.</p>
    `;
  }

  $("agingOverviewTable").innerHTML = `
    <table class="aging-table">
      <thead><tr><th>기간</th><th>거래처 수</th><th>거래처-항목 조합</th><th>건수 합계</th></tr></thead>
      <tbody>${monthlyOverview.map((row) => `
        <tr><td><strong>${escapeHtml(row.month.label)}</strong></td><td>${formatNumber(row.clients)}</td><td>${formatNumber(row.itemPairs)}</td><td>${formatNumber(row.totalCount)}</td></tr>
      `).join("")}</tbody>
    </table>
  `;

  const clientFilter = $("agingClientFilter");
  const previousValue = clientFilter.value;
  const clients = Array.from(new Set(comparedRows.map((row) => row.client))).sort((a, b) => a.localeCompare(b, "ko"));
  clientFilter.innerHTML = selectHtml([
    { value: "", label: "전체 거래처" },
    ...clients.map((client) => ({ value: client, label: client })),
  ], clients.includes(previousValue) ? previousValue : "");

  const statusFilter = $("agingStatusFilter");
  const previousStatus = statusFilter.value;
  const statusOptions = comparisonMode === "annual-vs-current"
    ? [
        { value: "", label: "전체 구분" },
        { value: "신규 항목", label: "신규 항목" },
        { value: "기존 항목", label: "기존 항목" },
        { value: "전년만 있음", label: "전년만 있음" },
      ]
    : [
        { value: "", label: "전체 상태" },
        { value: "신규", label: "신규" },
        { value: "중단", label: "중단" },
        { value: "증가", label: "증가" },
        { value: "감소", label: "감소" },
        { value: "유지", label: "유지" },
      ];
  statusFilter.innerHTML = selectHtml(statusOptions,
    statusOptions.some((option) => option.value === previousStatus) ? previousStatus : "");

  $("agingCompareTable").innerHTML = `
    <table class="aging-table aging-detail-table">
      <thead><tr><th>구분</th><th>거래처</th><th>검사 항목</th>${comparisonMonths.map((month) => `<th class="num">${escapeHtml(month.label)}</th>`).join("")}${comparisonMode === "monthly" ? '<th class="num">전월 대비</th>' : ""}</tr></thead>
      <tbody>${buildDetailRows()}</tbody>
    </table>
  `;
  const inputs = ["agingClientFilter", "agingItemFilter", "agingStatusFilter"];
  inputs.forEach((id) => {
    const el = $(id);
    if (el && !el.dataset.wired) {
      el.addEventListener(id === "agingItemFilter" ? "input" : "change", renderDetailOnly);
      el.dataset.wired = "1";
    }
  });
}

function buildDetailRows() {
  const client = $("agingClientFilter")?.value || "";
  const itemQuery = normalized($("agingItemFilter")?.value || "");
  const status = $("agingStatusFilter")?.value || "";
  const filtered = comparedRows.filter((row) =>
    (!client || row.client === client) &&
    (!itemQuery || normalized(row.item).includes(itemQuery)) &&
    (!status || row.status === status)
  );
  const extraColumns = comparisonMode === "monthly" ? 1 : 0;
  if (!filtered.length) return '<tr><td colspan="' + (3 + comparisonMonths.length + extraColumns) + '" class="meta">조건에 맞는 비교 항목이 없습니다.</td></tr>';
  return filtered.map((row) => {
    const cls = row.status === "신규" || row.status === "신규 항목" ? "is-new" :
      row.status === "중단" || row.status === "전년만 있음" ? "is-stopped" :
      row.status === "증가" || row.status === "기존 항목" ? "is-up" :
      row.status === "감소" ? "is-down" : "";
    const deltaText = row.delta === null ? "" : (row.delta > 0 ? "+" : "") + formatNumber(row.delta);
    return `<tr>
      <td><span class="aging-status-badge ${cls}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.client)}</td><td>${escapeHtml(row.item)}</td>
      ${row.counts.map((count) => `<td class="num">${count ? formatNumber(count) : "—"}</td>`).join("")}
      ${comparisonMode === "monthly" ? `<td class="num ${row.delta > 0 ? "aging-positive" : row.delta < 0 ? "aging-negative" : ""}">${deltaText}</td>` : ""}
    </tr>`;
  }).join("");
}

function renderDetailOnly() {
  const table = $("agingCompareTable");
  if (!table) return;
  table.innerHTML = `
    <table class="aging-table aging-detail-table">
      <thead><tr><th>구분</th><th>거래처</th><th>검사 항목</th>${comparisonMonths.map((month) => `<th class="num">${escapeHtml(month.label)}</th>`).join("")}${comparisonMode === "monthly" ? '<th class="num">전월 대비</th>' : ""}</tr></thead>
      <tbody>${buildDetailRows()}</tbody>
    </table>
  `;
}

function exportComparisonCsv() {
  if (!comparedRows.length) {
    setStatus("먼저 월별 비교를 실행해 주세요.", "err");
    return;
  }
  const escapeCsv = (value) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const header = ["구분", "거래처", "검사 항목", ...comparisonMonths.map((month) => month.label), ...(comparisonMode === "monthly" ? ["전월 대비"] : [])];
  const rows = comparedRows.map((row) => [
    row.status, row.client, row.item, ...row.counts, ...(comparisonMode === "monthly" ? [row.delta] : []),
  ]);
  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), comparisonMode === "annual-vs-current" ? "숙성항목_전년연간대비_올해기간.csv" : "숙성항목_월별비교.csv");
  setStatus(comparisonMode === "annual-vs-current" ? "전년 연간 대비 올해 기간의 신규·기존 항목 CSV를 저장했습니다." : "비교 결과 CSV 파일을 저장했습니다.", "ok");
}

async function readFiles() {
  const input = $("agingFiles");
  const files = Array.from(input?.files || []);
  if (files.length < 2) {
    setStatus("비교할 월별 엑셀 파일을 2개 이상 선택해 주세요.", "err");
    return;
  }
  const btn = $("agingReadButton");
  btn.disabled = true;
  parsedFiles = [];
  comparedRows = [];
  comparisonMonths = [];
  monthlyOverview = [];
  $("agingResults").hidden = true;
  $("agingMappings").hidden = true;
  setStatus("엑셀 파일을 브라우저 안에서 읽는 중입니다…");
  try {
    for (const file of files) {
      const lower = file.name.toLowerCase();
      let workbook;
      if (lower.endsWith(".xlsx")) {
        workbook = await parseXlsx(file);
      } else if (lower.endsWith(".csv")) {
        workbook = parseCsv(await file.text());
      } else {
        throw new Error(file.name + "은 지원하지 않는 형식입니다. .xlsx 또는 .csv 파일로 첨부해 주세요. 구형 .xls는 .xlsx로 다시 저장해 주세요.");
      }
      const filenameCustomer = customerFromFilename(file.name);
      const isCustomerItemReport = /검사항목별/i.test(file.name) && !!filenameCustomer;
      let detected;
      if (isCustomerItemReport) {
        // 씨젠 '검사항목별' 보고서는 첫 두 행이 여유/안내 행이고 데이터는 3행부터입니다.
        // 거래처명은 파일명에 있으므로 거래처 열을 찾지 않고 C열=검사명, D열=건수로 읽습니다.
        detected = {
          headerRow: -1,
          headers: ["열 1", "열 2", "검사명", "건수"],
          rows: workbook.rows.slice(2).filter((row) => row.some((cell) => cleanCell(cell))),
          detectedClient: -2,
          detectedItem: 2,
          detectedCount: 3,
        };
      } else {
        // 일반 양식은 첫 행을 여유 레코드로 제외한 뒤 헤더 자동 인식합니다.
        detected = detectHeader(workbook.rows.slice(1));
      }
      const initialClientMapping = isCustomerItemReport
        ? -2
        : (detected.detectedClient >= 0
          ? detected.detectedClient
          : (filenameCustomer ? -2 : -1));
      parsedFiles.push({
        name: file.name,
        ...parsePeriodFromName(file.name),
        sheetName: workbook.sheetName,
        headers: detected.headers,
        headerRow: detected.headerRow,
        rows: detected.rows,
        detectedClient: detected.detectedClient,
        detectedItem: detected.detectedItem,
        detectedCount: detected.detectedCount,
        customerFromFilename: filenameCustomer,
        mapping: {
          client: initialClientMapping,
          item: 2,   // C열 고정: 검사명
          count: 3,  // D열 고정: 건수
        },
      });
    }
    renderMappings();
    const ready = parsedFiles.every((file) => Number(file.mapping.client) >= 0 || (Number(file.mapping.client) === -2 && !!file.customerFromFilename));
    if (ready) runComparison();
    else setStatus("파일을 읽었습니다. 거래처 열을 지정한 뒤 월별 비교를 실행해 주세요.", "ok");
  } catch (error) {
    setStatus(error.message || "파일을 읽지 못했습니다.", "err");
  } finally {
    btn.disabled = false;
  }
}

function clearComparison() {
  parsedFiles = [];
  comparedRows = [];
  comparisonMonths = [];
  monthlyOverview = [];
  $("agingFiles").value = "";
  $("agingFileNames").textContent = "선택된 파일이 없습니다.";
  $("agingMappings").hidden = true;
  $("agingResults").hidden = true;
  $("agingExportCsv").disabled = true;
  setStatus("월별 파일을 선택해 주세요.");
}

export function wireAging() {
  if (wired) return;
  wired = true;
  const input = $("agingFiles");
  if (!input) return;

  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    $("agingFileNames").textContent = files.length
      ? files.map((file) => file.name).join(" · ")
      : "선택된 파일이 없습니다.";
    setStatus(files.length < 2 ? "비교하려면 엑셀 파일을 2개 이상 선택해 주세요." : files.length + "개 파일이 선택되었습니다. 월별 비교를 실행해 주세요.");
  });
  $("agingReadButton").addEventListener("click", readFiles);
  $("agingClearButton").addEventListener("click", clearComparison);
  $("agingExportCsv").addEventListener("click", exportComparisonCsv);
  $("agingCompareButton")?.addEventListener("click", runComparison);
}
