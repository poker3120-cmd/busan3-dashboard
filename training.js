/* =========================================================
   학술교육 — 영업화법예시 (5단계 교육용 화법지)
   참고 디자인: SALES SCRIPT · 병원 원장님 1:1 · 5분 완결
   - 시간대(0:00~5:00)별 5단계로 상담 흐름을 교육합니다.
   - 사실(수치·검사 정보)은 첨부 자료에서만 가져오고,
     인사·반론·클로징은 화법 틀(template)입니다.
   ========================================================= */

import { escapeHtml, truncate, formatKoreanDate } from "./utils.js";
import { defaultTraining } from "./state.js";

export const TRAINING_DENSE_CLASSES = ["", "dense-1", "dense-2", "dense-3", "dense-4", "dense-5"];

const str = (v) => String(v ?? "").trim();
const list = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/* ---------- 정규화 ---------- */

export function normalizeTraining(training) {
  const base = { ...defaultTraining(), ...(training || {}) };

  const steps = (base.steps || [])
    .slice(0, 6)
    .map((step) => ({
      time: str(step.time),
      title: str(step.title),
      intro: str(step.intro),
      quotes: list(step.quotes).slice(0, 4),
      questions: list(step.questions).slice(0, 5),
      features: (step.features || [])
        .map((f) => ({ head: str(f.head), body: str(f.body) }))
        .filter((f) => f.head || f.body)
        .slice(0, 4),
      metrics: (step.metrics || [])
        .map((m) => ({ head: str(m.head), items: list(m.items).slice(0, 4) }))
        .filter((m) => m.head || m.items.length)
        .slice(0, 4),
      scripts: list(step.scripts).slice(0, 4),
      infoRows: (step.infoRows || [])
        .map((r) => ({ field: str(r.field), value: str(r.value) }))
        .filter((r) => r.field || r.value)
        .slice(0, 8),
      pairs: (step.pairs || [])
        .map((p) => ({ q: str(p.q), a: str(p.a) }))
        .filter((p) => p.q || p.a)
        .slice(0, 5),
      tags: list(step.tags).slice(0, 4),
    }));

  while (steps.length < 5) {
    steps.push({ time: "", title: "", intro: "", quotes: [], questions: [], features: [], metrics: [], scripts: [], infoRows: [], pairs: [], tags: [] });
  }

  return {
    ...base,
    badge: str(base.badge),
    title: str(base.title),
    meta: str(base.meta),
    sourceLabel: str(base.sourceLabel),
    footerNote: str(base.footerNote),
    steps,
  };
}

export function trainingDenseClass(level) {
  const idx = Math.max(0, Math.min(TRAINING_DENSE_CLASSES.length - 1, Number(level) || 0));
  return TRAINING_DENSE_CLASSES[idx];
}

/* ---------- 분석 결과 → 교육용 화법 조립 ---------- */

/** 같은 문장(=같은 연구)끼리 묶어 지표를 정리합니다. 다른 연구 수치가 섞이지 않게 합니다. */
function groupMetrics(metrics) {
  const groups = [];
  (metrics || []).forEach((m) => {
    const label = str(m.label);
    const value = str(m.value);
    if (!label || !value) return;
    const key = str(m.text) || label;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, head: studyLabel(key), items: [] };
      groups.push(group);
    }
    if (!group.items.some((item) => item === `${label} ${value}`)) {
      group.items.push(`${label} ${value}`);
    }
  });
  return groups.slice(0, 3);
}

/** 연구 문장에서 짧은 라벨을 만듭니다. (수치는 문장에서 가져오지 않습니다) */
function studyLabel(text) {
  const value = str(text);
  if (/미국|US\b|Hemken/i.test(value)) return "미국 연구";
  if (/국내|한국|Korean/i.test(value)) return "국내 연구";
  if (/병용|조합|combination/i.test(value)) return "병용 구성";
  if (/단독/i.test(value)) return "단독 비교";
  if (!value) return "자료 수록 수치";
  return truncate(value, 34);
}

function infoValue(infoRows, re) {
  const hit = (infoRows || []).find((r) => re.test(str(r.field)));
  return hit ? str(hit.value) : "";
}

function infoLine(infoRows, re) {
  const hit = (infoRows || []).find((r) => re.test(str(r.field)));
  return hit ? `${str(hit.field)} ${str(hit.value)}` : "";
}

/**
 * 분석 결과로 5단계 교육용 화법지를 조립합니다.
 * - 프레임(인사·질문·반론·클로징)은 화법 틀입니다.
 * - 수치·검사 정보는 첨부 자료 값만 넣고, 값이 없으면 해당 문장을 만들지 않습니다.
 */
export function buildTrainingFromAnalysis(analysis) {
  const a = analysis || {};
  const t = defaultTraining();

  const title = str(a.title);
  const infoRows = a.infoRows || [];
  const keyPoints = (a.keyPoints || []).map((p) => str(p.text)).filter(Boolean);
  const targets = (a.targets || []).map(str).filter(Boolean);
  const metricGroups = groupMetrics(a.metrics);

  const code = infoValue(infoRows, /검사\s*코드|보험\s*정보/);
  const price = infoValue(infoRows, /수가|급여|본인\s*부담/);
  const serum = infoValue(infoRows, /검체|시료/);
  const schedule = infoValue(infoRows, /검사\s*일정|검사일|운영\s*일정/);
  const method = infoValue(infoRows, /검사\s*방법|측정\s*방법/);

  t.badge = "SALES SCRIPT · 병원 원장님 1:1 · 5분 완결";
  t.title = title ? `${title} — 원장님 영업화법` : "원장님 영업화법";
  t.sourceLabel = (a.sources && a.sources[0]) ? truncate(str(a.sources[0]), 60) : "";

  // 헤더 메타 : 자료에 있는 검사 정보만 나열합니다.
  const metaParts = [];
  if (serum) metaParts.push(`검체 ${serum}`);
  if (code) metaParts.push(`검사코드 ${code}`);
  if (price) metaParts.push(`수가 ${price}`);
  if (schedule) metaParts.push(`검사일정 ${schedule}`);
  t.meta = metaParts.join(" · ");

  const steps = t.steps;

  /* ── 1단계 : 오프닝 (0:00-0:30) ── */
  steps[0].time = "0:00-0:30";
  steps[0].title = "오프닝 — 부담 없다는 신호부터";
  steps[0].quotes = [
    `"원장님, 5분만 시간 내주실 수 있겠습니까. 오늘은 환자분 시술·처방 이야기가 아니고, ${title ? `「${title}」` : "검사"} 하나만 가지고 왔습니다. 채혈은 기존 검사하실 때 같이 하시면 되고, 별도 장비나 인력은 필요 없습니다."`,
    `"먼저 결론만 말씀드리면, ${t.meta || "자료에 정리된 검사 정보"} 기준의 검사입니다. 판단만 잠깐 도와드리고 바로 나가겠습니다."`,
  ];

  /* ── 2단계 : 문제 제기 (0:30-1:30) ── */
  steps[1].time = "0:30-1:30";
  steps[1].title = "문제 제기 — 원장님이 먼저 말하게";
  steps[1].intro = keyPoints.find((p) => p.length >= 24) || "";
  steps[1].questions = [
    targets.length
      ? `추적 중이신 환자분 중 ${targets.slice(0, 2).join(", ")}에 해당하는 케이스, 최근에도 있으셨습니까?`
      : "추적 중이신 환자분 중 기존 수치만으로 판단이 애매했던 케이스, 최근에도 있으셨습니까?",
    "기존 단일 마커는 정상 범위였는데 실제로 질환이 확인된 경험, 있으십니까?",
    "지금 외래·검진에서 관련 검사는 어떤 조합으로 오더하고 계십니까?",
  ];

  /* ── 3단계 : 핵심 가치 (1:30-3:30) ── */
  steps[2].time = "1:30-3:30";
  steps[2].title = "핵심 가치 — 세 가지로만 정리";
  steps[2].features = (keyPoints.slice(0, 3).length ? keyPoints.slice(0, 3) : ["", "", ""]).map((text, i) => ({
    head: `${["①", "②", "③", "④"][i] || `${i + 1}.`} ${truncate(text, 26) || "핵심 내용"}`,
    body: text.length > 26 ? text : "",
  }));
  steps[2].metrics = metricGroups;
  steps[2].scripts = [
    `"원장님, 숫자를 이렇게 읽으시면 됩니다. ${metricGroups.length ? `자료에 ${metricGroups.map((g) => g.head).join("·")} 수치가 정리되어 있습니다 — ` : ""}이 값들이 실무에서 가장 크게 남는 부분입니다."`,
    `"운영 부담은 거의 없습니다.${method ? ` 방법은 ${method},` : ""}${serum ? ` 검체는 ${serum},` : ""} 채혈은 기존 오더에 한 줄 추가하시면 됩니다.${schedule ? ` ${schedule} 일정이라 다음 진료일에 결과를 붙여 바로 설명하실 수 있습니다.` : ""}"`,
  ];
  steps[2].infoRows = infoRows.map((r) => ({ field: str(r.field), value: str(r.value) }));

  /* ── 4단계 : 반론 대응 (3:30-4:30) ── */
  steps[3].time = "3:30-4:30";
  steps[3].title = "반론 대응 — 한 줄로 받아치기";
  const pairs = [];
  pairs.push({
    q: '"지금도 관련 수치 검사 하고 있습니다."',
    a: `"그 검사를 빼자는 말이 아닙니다.${keyPoints[0] ? ` ${truncate(keyPoints[0], 70)}` : ""} 놓치는 폭을 줄이는 게 목적입니다."`,
  });
  if (price) {
    pairs.push({
      q: '"수가가 부담스럽습니다."',
      a: `"자료 기준 ${price}${code ? `, 코드 ${code}` : ""}입니다. 자료에 있는 수치만 말씀드리고 과장은 하지 않겠습니다. 정확도 대비 비용은 원장님 기준으로 판단해 보시면 됩니다."`,
    });
  }
  pairs.push({
    q: '"바빠서 새 검사 넣을 시간이 없습니다."',
    a: `"새로 하실 일은 오더 한 줄과 채혈 한 번뿐입니다. 장비·인력 추가 없습니다.${schedule ? ` 검사일정은 ${schedule}입니다.` : ""} 결과지도 환자 특성이 반영돼 나오니 설명 시간이 늘지 않습니다."`,
  });
  if (metricGroups.length) {
    pairs.push({
      q: '"효과 근거가 확실합니까?"',
      a: `"${metricGroups.map((g) => `${g.head} ${g.items.join(" ")}`).join(", ")} 입니다. 근거 논문은 자료와 함께 남겨드리겠습니다."`,
    });
  }
  steps[3].pairs = pairs;

  /* ── 5단계 : 클로징 (4:30-5:00) ── */
  steps[4].time = "4:30-5:00";
  steps[4].title = "클로징 — 다음 약속 남기기";
  steps[4].intro = keyPoints[keyPoints.length - 1] || "";
  steps[4].scripts = [
    `"원장님, 정리하겠습니다. 오늘 결정하실 필요는 전혀 없습니다. 이번 주 환자분 5명만 놓고 '이 검사를 넣었다면 판단이 달라졌을 케이스가 있었나' 한 번만 봐주십시오. 다음 방문 때 그 5명 케이스로 다시 오겠습니다."`,
  ];
  steps[4].tags = [
    "요청사항 : 진료과 2~3곳 · 1개월 시범 적용 후 확대 검토",
    targets.length ? `적용 대상 : ${targets.slice(0, 4).join(" · ")}` : "",
  ].filter(Boolean);

  t.footerNote = `※ 사용 기준 : 본 화법의 모든 수치·검사 정보는 첨부 자료${t.sourceLabel ? ` '${t.sourceLabel}'` : ""}에 수록된 내용만 사용했습니다. 자료에 없는 효능·비교·추정 수치는 넣지 않았습니다.\n원장님 대상 설명용이며, 환자 대상 광고 문구로 전용하거나 자료에 없는 표현을 덧붙이지 마십시오. 금전·물품 등 부당 제공을 전제로 한 제안은 포함하지 않았습니다.`;

  return normalizeTraining(t);
}

/* ---------- 렌더 ---------- */

function stepBody(step) {
  const blocks = [];

  if (step.intro) {
    blocks.push(`<p class="tr-intro">${escapeHtml(step.intro)}</p>`);
  }

  step.quotes.forEach((text) => {
    blocks.push(`<div class="tr-quote">${escapeHtml(text)}</div>`);
  });

  if (step.questions.length) {
    blocks.push(`<div class="tr-questions">${step.questions
      .map((q) => `<div class="tr-q"><span class="tr-q-mark">Q</span><span>${escapeHtml(q)}</span></div>`)
      .join("")}</div>`);
  }

  if (step.features.length) {
    blocks.push(`<div class="tr-features">${step.features
      .map((f) => `<div class="tr-feature">
        ${f.head ? `<b>${escapeHtml(f.head)}</b>` : ""}
        ${f.body ? `<span>${escapeHtml(f.body)}</span>` : ""}
      </div>`)
      .join("")}</div>`);
  }

  if (step.metrics.length) {
    blocks.push(`<div class="tr-metrics">
      <div class="tr-metrics-label">EVIDENCE — 자료 수록 수치 그대로</div>
      <div class="tr-metrics-grid">${step.metrics
        .map((m) => `<div class="tr-metric">
          <div class="tr-metric-head">${escapeHtml(m.head)}</div>
          ${m.items.map((item) => `<div class="tr-metric-item">${escapeHtml(item)}</div>`).join("")}
        </div>`)
        .join("")}</div>
    </div>`);
  }

  step.scripts.forEach((text) => {
    blocks.push(`<div class="tr-script">${escapeHtml(text)}</div>`);
  });

  if (step.infoRows.length) {
    blocks.push(`<table class="tr-table"><tbody>
      <tr>${step.infoRows.map((r) => `<th>${escapeHtml(r.field)}</th>`).join("")}</tr>
      <tr>${step.infoRows.map((r) => `<td>${escapeHtml(r.value)}</td>`).join("")}</tr>
    </tbody></table>`);
  }

  if (step.pairs.length) {
    blocks.push(`<div class="tr-pairs">${step.pairs
      .map((p) => `<div class="tr-pair">
        <div class="tr-objection"><b>원장님</b><span>${escapeHtml(p.q)}</span></div>
        <div class="tr-response"><b>대응</b><span>${escapeHtml(p.a)}</span></div>
      </div>`)
      .join("")}</div>`);
  }

  if (step.tags.length) {
    blocks.push(`<div class="tr-tags">${step.tags
      .map((tag) => `<span class="tr-tag">${escapeHtml(tag)}</span>`)
      .join("")}</div>`);
  }

  return blocks.join("");
}

export function renderTrainingHtml(training, denseLevel = 0) {
  const t = normalizeTraining(training);
  const dense = trainingDenseClass(denseLevel);

  const head = `
    <div class="tr-head">
      ${t.badge ? `<div class="tr-badge">${escapeHtml(t.badge)}</div>` : ""}
      <h1 class="tr-title">${escapeHtml(t.title || "영업화법 교육자료")}</h1>
      ${t.meta ? `<p class="tr-meta">${escapeHtml(t.meta)}</p>` : ""}
    </div>`;

  const timeline = t.steps.length
    ? `<div class="tr-timeline">${t.steps
        .map((s, i) => `<div class="tr-tl-item">
          <b>${escapeHtml(s.time || `STEP ${i + 1}`)}</b>
          <span>${escapeHtml(truncate(s.title.replace(/^[^—\-]*[—-]\s*/, ""), 20))}</span>
        </div>`)
        .join("")}</div>`
    : "";

  const body = t.steps
    .map(
      (s, i) => `<section class="tr-step">
        <div class="tr-step-head">
          <span class="tr-num">${i + 1}</span>
          <h2 class="tr-step-title">${escapeHtml(s.title)}</h2>
          ${s.time ? `<span class="tr-time">${escapeHtml(s.time)}</span>` : ""}
        </div>
        <div class="tr-step-body">${stepBody(s)}</div>
      </section>`
    )
    .join("");

  const foot = t.footerNote ? `<div class="tr-foot">${escapeHtml(t.footerNote)}</div>` : "";

  return `<div class="trainingsheet ${dense}">${head}${timeline}<div class="tr-body">${body}</div>${foot}</div>`;
}

/* ---------- 텍스트 내보내기 ---------- */

export function trainingToPlainText(training) {
  const t = normalizeTraining(training);
  const out = [t.badge, t.title, t.meta, ""];
  t.steps.forEach((s, i) => {
    out.push(`【${i + 1}. ${s.title}】 ${s.time}`);
    if (s.intro) out.push(s.intro);
    s.quotes.forEach((q) => out.push(q));
    s.questions.forEach((q) => out.push(`Q. ${q}`));
    s.features.forEach((f) => out.push(`- ${f.head}${f.body ? `\n  ${f.body}` : ""}`));
    s.metrics.forEach((m) => out.push(`- ${m.head}: ${m.items.join(" / ")}`));
    s.scripts.forEach((x) => out.push(x));
    if (s.infoRows.length) {
      out.push(s.infoRows.map((r) => r.field).join(" | "));
      out.push(s.infoRows.map((r) => r.value).join(" | "));
    }
    s.pairs.forEach((p) => out.push(`원장님 ${p.q}\n대응 ${p.a}`));
    s.tags.forEach((tag) => out.push(`[${tag}]`));
    out.push("");
  });
  out.push(t.footerNote);
  return out.filter((line) => line !== undefined).join("\n");
}

/* ---------- 편집기 ---------- */

function trInput(labelText, path, opts = {}) {
  const { placeholder = "", value = "", textarea = false, rows = 2 } = opts;
  return `<label>${escapeHtml(labelText)}</label>
    ${
      textarea
        ? `<textarea data-training="${path}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
        : `<input data-training="${path}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`
    }`;
}

function trStepInput(stepIndex, labelText, key, value, opts = {}) {
  const { placeholder = "", textarea = false, rows = 2 } = opts;
  return `<label>${escapeHtml(labelText)}</label>
    ${
      textarea
        ? `<textarea data-training-step="${stepIndex}" data-key="${key}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
        : `<input data-training-step="${stepIndex}" data-key="${key}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}">`
    }`;
}

function trStringList(stepIndex, kind, values, label, placeholder, addAction) {
  return `<details class="tr-sub">
    <summary>${escapeHtml(label)} (${values.length})</summary>
    ${values
      .map(
        (value, i) => `<div class="repeat-item">
          <div class="repeat-head">
            <span>${escapeHtml(label)} ${i + 1}</span>
            <button type="button" class="btn ghost small" data-action="remove-training-item" data-kind="${kind}" data-step="${stepIndex}" data-index="${i}">삭제</button>
          </div>
          <textarea data-training-list="${kind}" data-step="${stepIndex}" data-index="${i}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
        </div>`
      )
      .join("") || `<p class="meta">항목이 없습니다.</p>`}
    <button type="button" class="btn ghost small" data-action="${addAction}" data-step="${stepIndex}">＋ 추가</button>
  </details>`;
}

function trObjectList(stepIndex, kind, values, label, keys, addAction, max) {
  return `<details class="tr-sub">
    <summary>${escapeHtml(label)} (${values.length})</summary>
    ${values
      .map(
        (item, i) => `<div class="repeat-item">
          <div class="repeat-head">
            <span>${escapeHtml(label)} ${i + 1}</span>
            <button type="button" class="btn ghost small" data-action="remove-training-item" data-kind="${kind}" data-step="${stepIndex}" data-index="${i}">삭제</button>
          </div>
          ${keys
            .map(
              (k) => `<label>${escapeHtml(k.label)}</label>
              ${
                k.textarea
                  ? `<textarea data-training-item="${kind}" data-step="${stepIndex}" data-index="${i}" data-key="${k.key}" rows="2" placeholder="${escapeHtml(k.placeholder || "")}">${escapeHtml(item[k.key])}</textarea>`
                  : `<input data-training-item="${kind}" data-step="${stepIndex}" data-index="${i}" data-key="${k.key}" value="${escapeHtml(item[k.key])}" placeholder="${escapeHtml(k.placeholder || "")}">`
              }`
            )
            .join("")}
        </div>`
      )
      .join("") || `<p class="meta">항목이 없습니다.</p>`}
    <button type="button" class="btn ghost small" data-action="${addAction}" data-step="${stepIndex}">＋ 추가 (최대 ${max}개)</button>
  </details>`;
}

export function renderTrainingEditor(training) {
  const t = normalizeTraining(training);

  const stepsHtml = t.steps
    .map(
      (s, i) => `<details class="ed-group tr-step-group">
        <summary>${i + 1}단계 · ${escapeHtml(s.title || "(제목 없음)")} <em>${escapeHtml(s.time)}</em></summary>
        ${trStepInput(i, "단계 제목", "title", s.title, { placeholder: "예: 오프닝 — 부담 없다는 신호부터" })}
        ${trStepInput(i, "시간 라벨", "time", s.time, { placeholder: "예: 0:00-0:30" })}
        ${trStepInput(i, "도입 문장 (선택)", "intro", s.intro, { textarea: true, rows: 3, placeholder: "단계 시작에 읽을 문장" })}
        ${trStringList(i, "quotes", s.quotes, "인용 멘트", "원장님께 그대로 말할 문장", "add-training-quote")}
        ${trStringList(i, "questions", s.questions, "질문", "원장님께 던질 질문", "add-training-question")}
        ${trObjectList(i, "features", s.features, "핵심 가치 카드", [
          { key: "head", label: "소제목", placeholder: "① 나이·성별 반영" },
          { key: "body", label: "설명", placeholder: "설명 문장", textarea: true },
        ], "add-training-feature", 4)}
        ${trObjectList(i, "metrics", s.metrics, "근거 수치 묶음", [
          { key: "head", label: "묶음 이름", placeholder: "예: 미국 연구" },
        ], "add-training-metric", 4)}
        ${trStringList(i, "scripts", s.scripts, "화법 멘트", "긴 화법 문장", "add-training-script")}
        ${trObjectList(i, "infoRows", s.infoRows, "검사 정보 표", [
          { key: "field", label: "항목", placeholder: "예: 검사코드" },
          { key: "value", label: "내용", placeholder: "예: 25013" },
        ], "add-training-info", 8)}
        ${trObjectList(i, "pairs", s.pairs, "반론 · 대응", [
          { key: "q", label: "원장님 반론", placeholder: '"수가가 부담스럽습니다."' },
          { key: "a", label: "대응 멘트", placeholder: "대응 문장", textarea: true },
        ], "add-training-pair", 5)}
        ${trStringList(i, "tags", s.tags, "하단 강조 태그", "예: 요청사항 : 진료과 2~3곳", "add-training-tag")}
      </details>`
    )
    .join("");

  return `
    <details class="ed-group" open>
      <summary>표지 문구</summary>
      ${trInput("상단 배지", "badge", { value: t.badge, placeholder: "예: SALES SCRIPT · 병원 원장님 1:1 · 5분 완결" })}
      ${trInput("제목", "title", { value: t.title, placeholder: "예: 간암 위험도 검사 (ASAP) — 원장님 영업화법", textarea: true, rows: 2 })}
      ${trInput("헤더 메타 (검체·코드·수가·일정)", "meta", { value: t.meta, placeholder: "자료에 있는 검사 정보만", textarea: true, rows: 2 })}
      ${trInput("자료 출처 표시", "sourceLabel", { value: t.sourceLabel, placeholder: "예: 간암 위험도 검사(ASAP) 안내문" })}
    </details>
    ${stepsHtml}
    <details class="ed-group">
      <summary>하단 사용 기준</summary>
      ${trInput("사용 기준 문구", "footerNote", { value: t.footerNote, textarea: true, rows: 5 })}
    </details>
  `;
}
