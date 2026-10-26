/* 앱 상태 + 로컬 저장소 */

import { todayISO, unique } from "./utils.js";

const KEY_ANALYSIS = "busan3_analysis_v1";
const KEY_FLYER = "busan3_flyer_v1";
const KEY_TRAINING = "busan3_training_v1";
const KEY_PROPOSAL = "busan3_proposal_v1";

export const state = {
  files: [],          // [{name, size, kind, units, chars, ok, error}]
  rawText: "",
  analysis: null,
  images: [],         // 세션 전용: [{id, name, dataUrl, source}]
  flyer: null,
  training: null,     // 학술교육 — 영업화법예시(5단계 교육용 화법지)
  proposal: null,
};

export function emptyAnalysis() {
  return {
    title: "",
    subtitle: "",
    keyPoints: [],
    metrics: [],
    infoRows: [],
    targets: [],
    sources: [],
    charCount: 0,
    generatedAt: "",
  };
}

/* ---------- 저장 ---------- */

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function saveAnalysis() {
  if (!state.analysis) return;
  return safeSet(KEY_ANALYSIS, {
    analysis: state.analysis,
    // 원문은 40만 자까지만 보관합니다.
    rawText: state.rawText.slice(0, 400000),
    fileNames: state.files.map((f) => f.name),
  });
}

export function loadAnalysis() {
  const saved = safeGet(KEY_ANALYSIS);
  if (!saved || !saved.analysis) return false;
  state.analysis = { ...emptyAnalysis(), ...saved.analysis };
  state.rawText = saved.rawText || "";
  state.files = (saved.fileNames || []).map((name) => ({ name, size: 0, kind: "", units: 0, chars: 0, ok: true, restored: true }));
  return true;
}

export function saveFlyer() {
  if (!state.flyer) return;
  return safeSet(KEY_FLYER, state.flyer);
}

export function loadFlyer() {
  const saved = safeGet(KEY_FLYER);
  if (!saved) return false;
  state.flyer = saved;
  return true;
}

export function saveTraining() {
  if (!state.training) return;
  return safeSet(KEY_TRAINING, state.training);
}

export function loadTraining() {
  const saved = safeGet(KEY_TRAINING);
  if (!saved) return false;
  state.training = saved;
  return true;
}

export function resetTraining() {
  state.training = null;
  try { localStorage.removeItem(KEY_TRAINING); } catch (e) { /* 무시 */ }
}

export function saveProposal() {
  if (!state.proposal) return;
  return safeSet(KEY_PROPOSAL, state.proposal);
}

export function loadProposal() {
  const saved = safeGet(KEY_PROPOSAL);
  if (!saved) return false;
  state.proposal = saved;
  return true;
}

export function clearMaterials() {
  state.files = [];
  state.rawText = "";
  state.analysis = emptyAnalysis();
  state.images = [];
  try { localStorage.removeItem(KEY_ANALYSIS); } catch (e) { /* 무시 */ }
}

export function resetFlyer() {
  state.flyer = null;
  try { localStorage.removeItem(KEY_FLYER); } catch (e) { /* 무시 */ }
}

/* ---------- 홍보물 기본값 ---------- */

export function defaultFlyer() {
  return {
    kicker: "신규 검사 안내",
    title: "",
    subtitle: "",
    metrics: [
      { value: "", label: "" },
      { value: "", label: "" },
      { value: "", label: "" },
    ],
    points: [
      { icon: "1", title: "", desc: "" },
      { icon: "2", title: "", desc: "" },
      { icon: "3", title: "", desc: "" },
    ],
    infoRows: [],
    targets: [],
    note: "",
    imageId: null,
    imageCaption: "",
    footerOrg: "재단법인 씨젠의료재단 부산3지점",
    footerContact: "담당자 · 연락처를 입력하세요",
    footerNote: "본 자료는 첨부 자료를 바탕으로 작성한 안내용 초안입니다.\n검사 가능 여부·수가·급여 기준은 내부 확인 후 안내합니다.",
  };
}

/* ---------- 학술교육 — 영업화법예시 기본값 ---------- */

export function defaultTraining() {
  return {
    badge: "SALES SCRIPT · 병원 원장님 1:1 · 5분 완결",
    title: "",
    meta: "",
    sourceLabel: "",
    steps: [
      { time: "0:00-0:30", title: "오프닝 — 부담 없다는 신호부터", intro: "", quotes: [], questions: [], features: [], metrics: [], scripts: [], infoRows: [], pairs: [], tags: [] },
      { time: "0:30-1:30", title: "문제 제기 — 원장님이 먼저 말하게", intro: "", quotes: [], questions: [], features: [], metrics: [], scripts: [], infoRows: [], pairs: [], tags: [] },
      { time: "1:30-3:30", title: "핵심 가치 — 세 가지로만 정리", intro: "", quotes: [], questions: [], features: [], metrics: [], scripts: [], infoRows: [], pairs: [], tags: [] },
      { time: "3:30-4:30", title: "반론 대응 — 한 줄로 받아치기", intro: "", quotes: [], questions: [], features: [], metrics: [], scripts: [], infoRows: [], pairs: [], tags: [] },
      { time: "4:30-5:00", title: "클로징 — 다음 약속 남기기", intro: "", quotes: [], questions: [], features: [], metrics: [], scripts: [], infoRows: [], pairs: [], tags: [] },
    ],
    footerNote: "※ 사용 기준 : 본 화법의 모든 수치·검사 정보는 첨부 자료에 수록된 내용만 사용했습니다. 자료에 없는 효능·비교·추정 수치는 넣지 않았습니다. 원장님 대상 설명용이며, 환자 대상 광고 문구로 전용하지 마십시오.",
  };
}

/* ---------- 공통 ---------- */

export function uniqueSources(sources) {
  return unique(sources || []).slice(0, 10);
}

export function currentDate() {
  return todayISO();
}
