/* =========================================================
   분석 엔진 — 추출된 원문을 홍보물·제안서 재료로 정리
   ========================================================= */

import { unique, truncate, formatNumber } from "./utils.js";
import { emptyAnalysis } from "./state.js";

/* ---------- 문장 분리 / 정리 ---------- */

const BULLET_RE = /^[\s•·▪■□◦○*\-–—✓✔※▶►♦]+\s*/;
const NOISE_RE = /^(목차|contents|table of contents|감사합니다|thank you|q\s*&\s*a|질문|참고\s*자료|별첨|끝\.?)$/i;
const HEADER_BREAK = /^---\s*(.*?)\s*---$/;

export function cleanLine(value) {
  return String(value ?? "")
    .replace(BULLET_RE, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?%)\]])/g, "$1")
    .trim();
}

/** 원문을 { text, source, size } 후보 목록으로 바꿉니다. */
export function collectSegments(units) {
  const out = [];
  const seen = new Set();

  (units || []).forEach((unit) => {
    const source = unit.file || "첨부 자료";
    const label = unit.label || "";
    (unit.lines || []).forEach((line) => {
      const cleaned = cleanLine(line.text);
      if (cleaned.length < 4) return;
      if (NOISE_RE.test(cleaned)) return;

      const pieces = cleaned
        .split(/(?<=[.!?。])\s+|(?<=다)\s+(?=[가-힣])|\s*;\s*/)
        .map((part) => cleanLine(part))
        .filter((part) => part.length >= 4);

      (pieces.length ? pieces : [cleaned]).forEach((piece) => {
        const text = truncate(piece, 300);
        const key = text.replace(/\s+/g, "").toLowerCase();
        if (seen.has(key)) return;
        // 숫자만 있는 조각, 목차 숫자 등은 제외합니다.
        if (/^[\d\s.,%()~\-–—/]+$/.test(text)) return;
        seen.add(key);
        out.push({ text, source, label, size: Number(line.size) || 0 });
      });
    });
  });

  return out;
}

/* ---------- 제목 추정 ---------- */

const TITLE_HINTS = /검사|진단|선별|스크리닝|패널|프로필|안내|가이드|제안|소개|프로그램|서비스|항목|검출|분석|키트|플랫폼/i;
const TITLE_BAD = /^(목차|개요|서론|서비스\s*소개|문의|연락처|감사|질문|요약)$/i;

function scoreCandidateTitle(segment, order, maxSize) {
  const text = segment.text;
  let score = 0;
  if (segment.size && maxSize) score += (segment.size / maxSize) * 40;
  score += Math.max(0, 18 - order * 0.4);
  if (text.length >= 6 && text.length <= 44) score += 16;
  else if (text.length <= 60) score += 6;
  else score -= 24;
  if (TITLE_HINTS.test(text)) score += 16;
  if (TITLE_BAD.test(text)) score -= 30;
  if (/[.?!]$/.test(text)) score -= 12;
  if (/^[\d.\-)\s]/.test(text)) score -= 8;
  if (/\d{4}\s*년|\d+\s*월\s*\d+\s*일/.test(text)) score -= 10;
  return score;
}

export function guessTitle(segments) {
  if (!segments.length) return "";
  const maxSize = Math.max(...segments.map((s) => s.size || 0));

  let best = null;
  segments.slice(0, 120).forEach((segment, index) => {
    const score = scoreCandidateTitle(segment, index, maxSize);
    if (!best || score > best.score) best = { score, text: segment.text };
  });

  // 파일명에서 뽑은 후보도 함께 비교합니다.
  const fromNames = unique(segments.map((s) => s.source))
    .map((name) => name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " ").trim())
    .filter((name) => name.length >= 4 && name.length <= 44 && !/^\d+$/.test(name));

  if (best && best.score >= 26) return trimTitle(best.text);
  if (fromNames.length) return trimTitle(fromNames[0]);
  if (best) return trimTitle(best.text);
  return "";
}

function trimTitle(text) {
  return cleanLine(text)
    .replace(/^(제목|title)\s*[:：]\s*/i, "")
    .replace(/\s*[-–—|]\s*$/, "")
    .slice(0, 60)
    .trim();
}

/* ---------- 수치 · 근거 ---------- */

const METRIC_PATTERNS = [
  { label: "민감도", re: /민감도[^0-9]{0,12}(\d{1,3}(?:\.\d+)?)\s*%/i },
  { label: "특이도", re: /특이도[^0-9]{0,12}(\d{1,3}(?:\.\d+)?)\s*%/i },
  { label: "정확도", re: /정확도[^0-9]{0,12}(\d{1,3}(?:\.\d+)?)\s*%/i },
  { label: "AUC", re: /\bAUC\b[^0-9]{0,12}(0?\.\d{2,4})/i },
  { label: "양성일치율", re: /양성\s*일치율[^0-9]{0,12}(\d{1,3}(?:\.\d+)?)\s*%/i },
  { label: "음성일치율", re: /음성\s*일치율[^0-9]{0,12}(\d{1,3}(?:\.\d+)?)\s*%/i },
  { label: "검출률", re: /검출률[^0-9]{0,12}(\d{1,3}(?:\.\d+)?)\s*%/i },
  { label: "소요시간", re: /(\d{1,3})\s*(?:분|시간)\s*이내|소요\s*(?:시간|기간)[^0-9]{0,10}(\d{1,3})\s*(?:분|시간|일)/i },
  { label: "검사수가", re: /수가[^0-9]{0,14}(\d[\d,]{3,})\s*원/ },
  { label: "본인부담", re: /본인\s*부담[^0-9]{0,14}(\d[\d,]{3,})\s*원/ },
  { label: "검사코드", re: /(?:검사\s*코드|보험\s*코드|EDI\s*코드|코드번호)\s*[:：]?\s*([A-Z]{0,2}\s*\d{3,6}|[A-Z]{2,}\d{2,})/i },
];

export function extractMetrics(segments) {
  // 문장별로 어떤 지표가 나오는지 먼저 모읍니다.
  const perSegment = [];
  segments.forEach((segment, index) => {
    const hits = [];
    METRIC_PATTERNS.forEach((pattern) => {
      const match = segment.text.match(pattern.re);
      if (!match) return;
      const raw = match.slice(1).find((value) => value != null && value !== "") || "";
      if (!raw) return;
      hits.push({ label: pattern.label, raw, pattern });
    });
    if (hits.length) perSegment.push({ segment, index, hits });
  });

  // 지표가 여러 개 함께 있는 문장을 먼저 사용합니다.
  // 지표를 따로따로 찾으면 서로 다른 연구의 수치가 한 세트로 섞여
  // 사실과 다른 조합(예: A연구 민감도 + B연구 특이도)이 만들어집니다.
  perSegment.sort((a, b) => (b.hits.length - a.hits.length) || (a.index - b.index));

  const found = [];
  const usedLabels = new Set();

  perSegment.forEach((entry) => {
    entry.hits.forEach((hit) => {
      if (usedLabels.has(hit.label)) return;
      usedLabels.add(hit.label);
      const isPercent = hit.pattern.re.source.includes("%");
      const value = isPercent
        ? `${hit.raw}%`
        : /수가|부담/.test(hit.label)
          ? `${formatNumber(String(hit.raw).replace(/,/g, ""))}원`
          : String(hit.raw).replace(/\s+/g, "");
      // text: 이 지표가 나온 원문 문장 (다른 영역과의 중복 제거에 사용)
      found.push({ label: hit.label, value, source: entry.segment.source, text: entry.segment.text });
    });
  });

  // 패턴에 안 걸린 일정·보고 관련 표현을 보조 지표로 담습니다.
  const fallback = [
    { label: "검사 일정", re: /(?:월|화|수|목|금|토)\s*(?:[~\-–,]\s*(?:월|화|수|목|금|토)){1,3}[^.\n]{0,26}/ },
    { label: "결과 보고", re: /결과\s*(?:보고|통보)[^.\n]{0,20}\d[^.\n]{0,16}/ },
  ];
  fallback.forEach((pattern) => {
    if (found.some((item) => item.label === pattern.label)) return;
    const hit = segments.find((segment) => pattern.re.test(segment.text));
    if (!hit) return;
    const match = hit.text.match(pattern.re);
    if (!match) return;
    found.push({ label: pattern.label, value: truncate(cleanLine(match[0]), 60), source: hit.source });
  });

  return found.slice(0, 8);
}

/* ---------- 검사 정보 표 ---------- */

/**
 * "항목 : 내용" 형태를 우선 인식합니다.
 * (문장 중간의 단어를 항목명으로 잘못 잡는 문제를 줄입니다.)
 */
const FIELD_ALIASES = [
  { field: "검체", keys: ["검체", "시료", "검체종류", "검체량", "sample"] },
  { field: "검사 방법", keys: ["검사방법", "측정방법", "방법", "플랫폼", "장비", "분석법", "검사법"] },
  { field: "검사 일정", keys: ["검사일정", "검사일", "시행일", "운영일", "검사요일", "시행요일"] },
  { field: "소요 시간", keys: ["소요시간", "소요기간", "보고시간", "결과소요시간", "turnaround"] },
  { field: "검사 코드", keys: ["검사코드", "보험코드", "edi코드", "코드번호", "코드"] },
  { field: "수가·급여", keys: ["수가", "급여", "보험", "본인부담", "본인부담금", "급여기준"] },
  { field: "결과 보고", keys: ["결과보고", "결과통보", "결과확인", "보고방법"] },
  { field: "의뢰 방법", keys: ["의뢰방법", "의뢰절차", "접수방법", "수거방법", "운송방법"] },
  { field: "보관·유의", keys: ["보관", "보관방법", "검체보관", "유의사항", "주의사항", "금기", "참고사항"] },
];

const LABEL_BLOCKLIST = /^(문의|담당|담당자|연락|연락처|참고|비고|작성|작성일|일자|날짜|페이지|쪽|출처|구분|no|번호|tel|fax|e-?mail|적용대상|대상|검사|시행|실시|개요|요약|목차|제목)$/i;

function normalizeLabel(value) {
  return String(value || "")
    .replace(BULLET_RE, "")
    .replace(/[\s()[\]:：.\-·/]/g, "")
    .toLowerCase();
}

function fieldForLabel(label) {
  const key = normalizeLabel(label);
  if (!key || key.length > 14) return "";
  const hit = FIELD_ALIASES.find((alias) => alias.keys.some((candidate) => key === candidate || key === normalizeLabel(candidate)));
  if (hit) return hit.field;
  // 사전에 없는 짧은 라벨도 항목명으로 인정합니다. (예: 검출 항목)
  if (LABEL_BLOCKLIST.test(key)) return "";
  if (key.length > 10) return "";
  if (!/[가-힣a-z]/.test(key)) return "";
  if (/\d/.test(key)) return "";
  return String(label).replace(BULLET_RE, "").replace(/\s+/g, " ").trim();
}

/** "항목 : 내용" 형태만 항목명·내용으로 나눕니다. */
function splitLabeled(text) {
  const match = String(text).match(/^(.{1,16}?)\s*[:：]\s*(\S.*)$/);
  if (!match) return null;
  const rawLabel = match[1];
  const field = fieldForLabel(rawLabel);
  if (!field) return null;
  const value = cleanLine(match[2]);
  if (value.length < 2) return null;

  // 사전에 정의된 항목명이 아니면, 표에 넣기 좋은 짧은 값만 받습니다.
  const isKnown = FIELD_ALIASES.some((alias) =>
    alias.keys.some((candidate) => normalizeLabel(candidate) === normalizeLabel(rawLabel))
  );
  if (!isKnown) {
    if (value.length > 40) return null;
    if (/[.!?]$/.test(value)) return null;
    if (/[,、]/.test(value) && value.length > 26) return null;
  }

  return { field, value };
}

export function extractInfoRows(segments, tableRows = []) {
  const rows = [];
  const used = new Set();

  // 0순위: 좌표로 인식한 표 (재단 1P 검사 안내서의 실제 구조).
  //         "항목 : 내용" 형태보다 훨씬 정확합니다.
  (tableRows || []).forEach((row) => {
    if (!row || !row.field || !row.value) return;
    const key = normalizeLabel(row.field) || row.field;
    if (used.has(key)) return;
    used.add(key);
    rows.push({
      field: row.field,
      value: truncate(row.value, 90),
      source: truncate(row.source || "", 34),
      text: row.text || "",
    });
  });

  // 1순위: "항목 : 내용" 형태를 문서 순서대로 수집합니다.
  segments.forEach((segment) => {
    const parsed = splitLabeled(segment.text);
    if (!parsed) return;
    const key = normalizeLabel(parsed.field) || parsed.field;
    if (used.has(key)) return;
    if (parsed.value.length > 100) return;
    used.add(key);
    rows.push({
      field: parsed.field,
      value: truncate(parsed.value, 90),
      source: truncate(segment.source, 34),
      text: segment.text, // 핵심 포인트와의 중복 제거에 사용
    });
  });

  // 2순위: 구조가 명확한 항목은 문장에서 직접 찾습니다.
  const fallbackFields = [
    { field: "검사 코드", re: /(?:검사\s*코드|보험\s*코드|보험코드|EDI\s*코드)\s*[:：]?\s*([A-Z]{0,2}\s*\d{3,6}|[A-Z]{2,}\d{2,})/i },
    { field: "검사 일정", re: /(?:검사\s*일정|검사일|시행일|운영일)[^\w가-힣]{0,4}((?:월|화|수|목|금|토|일)[^\n.]{0,40})/ },
  ];
  fallbackFields.forEach((field) => {
    if (used.has(normalizeLabel(field.field) || field.field)) return;   // 표에서 이미 채운 항목은 건너뜁니다.
    const hit = segments.find((segment) => field.re.test(segment.text));
    if (!hit) return;
    const match = hit.text.match(field.re);
    if (!match || !match[1]) return;
    used.add(normalizeLabel(field.field) || field.field);
    rows.push({
      field: field.field,
      value: truncate(cleanLine(match[1]), 60),
      source: truncate(hit.source, 34),
      text: hit.text,
    });
  });

  return rows.slice(0, 8);
}

/* ---------- 적용 대상 ---------- */

const TARGET_PATTERNS = [
  { label: "고위험군", re: /고위험\s*(?:군|환자|대상)/ },
  { label: "가족력 있는 대상", re: /가족력/ },
  { label: "40세 이상", re: /40\s*세\s*이상/ },
  { label: "중년·장년층", re: /중년|장년/ },
  { label: "만성질환자", re: /만성\s*(?:간질환|신장|폐질환|질환자)/ },
  // "증상이 거의 없어" 같은 설명문이 대상으로 잡히지 않도록 목적격 표현을 요구합니다.
  { label: "증상 호소 환자", re: /증상을?\s*(?:호소|보이는|가진|동반)|\S+증상\s*(?:환자|대상)/ },
  { label: "수술·시술 전 검사", re: /수술\s*전|시술\s*전|입원\s*전/i },
  { label: "정기 추적 관찰", re: /추적\s*(?:관찰|검사)|경과\s*관찰|모니터링/ },
  { label: "감염 의심 환자", re: /감염\s*(?:의심|환자|대상)|항생제\s*내성|내성\s*확인/ },
  { label: "건강검진 수검자", re: /건강\s*검진|종합\s*검진|검진\s*수검/ },
  { label: "소아·청소년", re: /소아|영유아|청소년|신생아/ },
  { label: "여성 건강", re: /임신|산전|부인과|자궁|난소|유방/ },
];

export function extractTargets(segments) {
  const found = [];
  TARGET_PATTERNS.forEach((pattern) => {
    const hit = segments.find((segment) => pattern.re.test(segment.text));
    if (hit) found.push({ label: pattern.label, source: hit.source });
  });
  return found.slice(0, 8);
}

/* ---------- 핵심 문장 선별 ---------- */

const KEY_SIGNALS = [
  { re: /민감도|특이도|정확도|AUC|일치율/, w: 26 },
  { re: /가이드라인|권고|학회|진료지침|근거/, w: 24 },
  { re: /검출|진단|조기\s*발견|선별|스크리닝/, w: 20 },
  { re: /검체|소요\s*(?:시간|기간)|검사\s*일정|의뢰|결과\s*보고/, w: 18 },
  { re: /수가|급여|보험|본인\s*부담|검사\s*코드/, w: 16 },
  { re: /대상|적응증|환자|고위험/, w: 14 },
  { re: /\d+\s*(?:%|배|분|시간|일|원)/, w: 12 },
  { re: /신속|동시|한\s*번|편리|간편|동시\s*검출/, w: 10 },
];

const KEY_PENALTY = [
  { re: /(주)|(주)$|㈜|대표자|사업자\s*등록/, w: -18 },
  { re: /저작권|무단\s*복제|copyright|all rights reserved/i, w: -40 },
  { re: /주소|전화|팩스|이메일|@|홈페이지|www\./i, w: -20 },
  { re: /목차|contents|index/i, w: -30 },
  { re: /^\s*\d+\s*$/, w: -40 },
  { re: /본\s*자료는\s*(?:검사\s*안내용|안내용)|진단과\s*치료\s*결정은|담당\s*의료진의\s*판단/, w: -45 },
];

/** 같은 취지의 문장인지 비교하기 위한 서명을 만듭니다. */
function sentenceKey(text) {
  return String(text || "").replace(/[\s.,%()~·\-–—:/]/g, "").toLowerCase();
}

/** 앞부분이 겹치면 사실상 같은 문장으로 봅니다. */
function isSameSentence(a, b) {
  const ka = sentenceKey(a);
  const kb = sentenceKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const short = ka.length <= kb.length ? ka : kb;
  const long = ka.length <= kb.length ? kb : ka;
  if (short.length >= 16 && long.startsWith(short.slice(0, Math.max(16, Math.floor(short.length * 0.8))))) return true;
  return false;
}

export function pickKeyPoints(segments, limit = 6, exclude = []) {
  const scored = segments.map((segment, index) => {
    let score = 0;
    const text = segment.text;
    KEY_SIGNALS.forEach((signal) => { if (signal.re.test(text)) score += signal.w; });
    KEY_PENALTY.forEach((signal) => { if (signal.re.test(text)) score += signal.w; });
    if (text.length >= 18 && text.length <= 130) score += 14;
    else if (text.length <= 180) score += 4;
    else score -= 14;
    if (/^[-•·]/.test(text)) score -= 4;
    score -= index * 0.35;
    return { ...segment, score };
  });

  const picked = [];
  const usedSource = new Map();
  const blocked = (exclude || []).filter(Boolean);

  const isExcluded = (text) =>
    blocked.some((item) => isSameSentence(text, item)) ||
    picked.some((p) => isSameSentence(p.text, text));

  scored
    .filter((item) => item.score > 8)
    .sort((a, b) => b.score - a.score)
    .forEach((item) => {
      if (picked.length >= limit) return;
      // 같은 파일에서 지나치게 많이 뽑지 않습니다.
      const count = usedSource.get(item.source) || 0;
      if (count >= 3) return;
      if (isExcluded(item.text)) return;
      usedSource.set(item.source, count + 1);
      picked.push(item);
    });

  if (picked.length < 3) {
    scored
      .filter((item) => item.score > -10 && item.text.length >= 14)
      .sort((a, b) => b.score - a.score)
      .forEach((item) => {
        if (picked.length >= Math.min(limit, 4)) return;
        if (isExcluded(item.text)) return;
        picked.push(item);
      });
  }

  return picked;
}

/* ---------- 부제 / 요약 ---------- */

/** 서술형 문장(부제로 어울리는 문장)인지 봅니다. */
function isSentenceLike(text) {
  if (text.length < 20) return false;
  // "검체 : 위액 1mL", "임상 활용 : ..." 처럼 라벨로 시작하면 부제로 쓰지 않습니다.
  const leadingLabel = text.match(/^(.{1,10}?)\s*[:：]\s*\S/);
  if (leadingLabel) return false;
  return /[다요습니다임됨음함음]\s*[.!?]?$/.test(text) || text.length >= 38;
}

export function makeSubtitle(segments, keyPoints, title, exclude = []) {
  const blocked = [title, ...(exclude || [])].filter(Boolean);
  const isBlocked = (text) => blocked.some((item) => isSameSentence(text, item));

  // 1) 핵심 포인트 중 서술형 문장을 우선 사용합니다.
  const fromPoints = (keyPoints || [])
    .map((point) => point.text)
    .filter((text) => text && !isBlocked(text) && isSentenceLike(text));
  if (fromPoints.length) return truncate(fromPoints[0], 110);

  // 2) 원문에서 서술형 문장을 찾습니다.
  const descriptive = segments
    .map((segment) => segment.text)
    .find((text) => !isBlocked(text) && isSentenceLike(text) && !/^\d+[.)]?$/.test(text));
  if (descriptive) return truncate(descriptive, 110);

  // 3) 그래도 없으면 짧은 설명 문구라도 사용합니다. (빈 부제 방지)
  const fallback = (keyPoints || [])
    .map((point) => point.text)
    .concat(segments.map((segment) => segment.text))
    .find((text) => text && !isBlocked(text) && text.length >= 12);
  return truncate(fallback || "", 110);
}

/* ---------- 진입점 ---------- */

export function analyze(units) {
  const segments = collectSegments(units);
  const analysis = emptyAnalysis();

  // 좌표로 인식한 표 결과(재단 1P 안내서)를 모읍니다.
  const tableRows = [];
  (units || []).forEach((unit) => {
    (unit.tableRows || []).forEach((row) => {
      tableRows.push({ ...row, source: unit.file || "첨부 자료" });
    });
  });

  if (!segments.length && !tableRows.length) {
    return { analysis, segments, tableRows };
  }

  analysis.title = guessTitle(segments);
  const infoRows = extractInfoRows(segments, tableRows);

  // 검사 정보 표에 이미 있는 항목(검사코드·수가 등)은 상단 지표에서 뺍니다.
  // 같은 값이 지표 카드와 표에 두 번 나오면 홍보물이 지저분해집니다.
  const infoLabels = infoRows.map((row) => normalizeLabel(row.field));
  const metrics = extractMetrics(segments).filter((metric) => {
    const key = normalizeLabel(metric.label);
    if (infoLabels.some((label) => label && (key === label || label.includes(key) || key.includes(label)))) return false;
    return true;
  });

  // 상단 지표 카드와 검사 정보 표로 이미 보여 주는 문장은 본문 포인트에서 뺍니다.
  // (같은 내용이 지표/표/포인트에 여러 번 반복되는 것을 막습니다.)
  const metricTexts = metrics.map((metric) => metric.text).filter(Boolean);
  const infoTexts = infoRows.map((row) => row.text).filter(Boolean);

  // 부제를 먼저 고르고, 포인트는 부제·지표·표와 겹치지 않는 문장에서 뽑습니다.
  const preliminary = pickKeyPoints(segments, 6, [analysis.title, ...metricTexts, ...infoTexts]);
  analysis.subtitle = makeSubtitle(
    segments,
    preliminary.map((item) => ({ text: item.text })),
    analysis.title,
    metricTexts
  );

  analysis.keyPoints = pickKeyPoints(segments, 6, [
    analysis.title,
    analysis.subtitle,
    ...metricTexts,
    ...infoTexts,
  ]).map((item) => ({
    text: item.text,
    source: truncate(item.source, 40),
  }));

  analysis.metrics = metrics;
  analysis.infoRows = infoRows;
  analysis.targets = extractTargets(segments).map((item) => item.label);
  analysis.sources = unique(segments.map((segment) => segment.source)).slice(0, 12);
  analysis.charCount = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  analysis.generatedAt = new Date().toISOString();

  return { analysis, segments, tableRows };
}
