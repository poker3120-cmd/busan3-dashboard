/* =========================================================
   제안서 — A4 다페이지 문서 렌더러 (표지 · 그래픽 · 이미지)
   화면 미리보기와 PDF 내보내기가 같은 HTML을 사용합니다.
   ========================================================= */

import { escapeHtml, formatNumber, formatKoreanDate } from "./utils.js";

/* ---------- 제안 유형별 문구 ---------- */

export const TYPE_TITLES = {
  opening: "신규 개원 검사 의뢰 지원 제안",
  conversion: "검사 의뢰 거래 전환 제안",
  support: "거래처 운영 지원 제안",
  renewal: "기존 거래처 협력 강화 제안",
};

const TYPE_LEADS = {
  opening: "개원 초기 진료 흐름에 맞춘 검사 구성과 의뢰 절차를 함께 준비합니다.",
  conversion: "현재 의뢰 구조를 비교해 옮길 항목과 남길 항목을 구분해 제안합니다.",
  support: "거래처 운영에 필요한 지원 범위를 확인하고 실행 계획을 함께 정리합니다.",
  renewal: "현재 의뢰 현황을 점검하고 진료 특성에 맞는 추가 항목을 제안합니다.",
};

const ORG = "재단법인 씨젠의료재단 부산3지점";

/* ---------- 숫자 도우미 ---------- */

function toNumber(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** 지표 값을 0~100 비율로 바꿉니다. (0.95 → 95, 93.0% → 93) */
function ratioOf(value) {
  const raw = String(value ?? "");
  const n = toNumber(raw);
  if (n === null) return null;
  if (/%/.test(raw)) return Math.max(0, Math.min(100, n));
  if (n > 0 && n <= 1) return n * 100;
  return Math.max(0, Math.min(100, n));
}

function won(value) {
  return `${formatNumber(Number(value) || 0)}원`;
}

function safe(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

/* ---------- 공통 조각 ---------- */

function pageFoot(index, total) {
  return `<div class="pd-foot">
    <span class="pd-foot-org">${escapeHtml(ORG)}</span>
    <span class="pd-foot-page">${index + 1} / ${total}</span>
  </div>`;
}

function sectionHead(no, title, lead) {
  return `<div class="pd-head">
    <span class="pd-sec-no">${escapeHtml(no)}</span>
    <div>
      <h2 class="pd-sec-title">${escapeHtml(title)}</h2>
      ${lead ? `<p class="pd-sec-lead">${escapeHtml(lead)}</p>` : ""}
    </div>
  </div>`;
}

/** 지표 게이지 그래픽 */
function gauge(metric) {
  const ratio = ratioOf(metric.value);
  const width = ratio === null ? 0 : Math.max(3, Math.min(100, ratio));
  const label = safe(metric.label, "지표");
  const value = safe(metric.value, "-");
  return `<div class="pd-gauge">
    <div class="pd-gauge-head">
      <span class="pd-gauge-label">${escapeHtml(label)}</span>
      <b class="pd-gauge-value">${escapeHtml(value)}</b>
    </div>
    <div class="pd-gauge-track">
      <span class="pd-gauge-fill" style="width:${width}%"></span>
    </div>
  </div>`;
}

/** 단가 비교 가로 막대 */
function barRow(label, value, max, tone) {
  const ratio = max > 0 ? Math.max(2, Math.min(100, (Number(value) / max) * 100)) : 0;
  return `<div class="pd-bar-row">
    <span class="pd-bar-label">${escapeHtml(label)}</span>
    <div class="pd-bar-track">
      <span class="pd-bar-fill ${tone || ""}" style="width:${ratio}%"></span>
    </div>
    <b class="pd-bar-value">${escapeHtml(won(value))}</b>
  </div>`;
}

/* ---------- 1) 표지 ---------- */

function coverPage(input, analysis, total) {
  const clinic = safe(input.clinic, "거래처명 미입력");
  const manager = safe(input.manager, "원장님");
  const date = formatKoreanDate(input.date) || safe(input.date, "");
  const title = TYPE_TITLES[input.type] || "거래처 협력 제안";
  const lead = TYPE_LEADS[input.type] || "";

  const stats = (analysis.metrics || []).slice(0, 3);

  const statStrip = stats.length
    ? `<div class="pd-cover-stats">
        ${stats
          .map(
            (m) => `<div class="pd-cover-stat">
              <b>${escapeHtml(safe(m.value, "-"))}</b>
              <span>${escapeHtml(safe(m.label, "지표"))}</span>
            </div>`
          )
          .join("")}
      </div>`
    : "";

  return `<section class="proposal-page pd-cover">
    <div class="pd-cover-shape" aria-hidden="true"></div>
    <div class="pd-cover-dots" aria-hidden="true"></div>

    <div class="pd-cover-top">
      <img class="pd-cover-logo" src="images/ci-seegene.png" alt="재단법인 씨젠의료재단">
      <span class="pd-cover-branch">부산3지점</span>
    </div>

    <div class="pd-cover-main">
      <p class="pd-cover-kicker">PROPOSAL · 검사 의뢰 제안</p>
      <h1 class="pd-cover-title">${escapeHtml(title)}</h1>
      ${lead ? `<p class="pd-cover-lead">${escapeHtml(lead)}</p>` : ""}
      <p class="pd-cover-client">${escapeHtml(clinic)} <span>귀중</span></p>
    </div>

    ${statStrip}

    <div class="pd-cover-meta">
      <div><span>담당자</span><b>${escapeHtml(manager)}</b></div>
      <div><span>작성일</span><b>${escapeHtml(date)}</b></div>
      <div><span>제안 대상</span><b>${escapeHtml(safe(input.item, "거래처 협의 후 확정"))}</b></div>
      <div><span>적용 기간</span><b>${escapeHtml(safe(input.period, "내부 승인 후 적용"))}</b></div>
    </div>

    <div class="pd-cover-bar" aria-hidden="true"></div>
    ${pageFoot(0, total)}
  </section>`;
}

/* ---------- 2) 제안 요약 ---------- */

function summaryPage(input, analysis, index, total) {
  const situation = safe(
    input.situation,
    "현재 검사 운영, 환자 구성 및 개선 필요사항은 거래처 상담을 통해 확인합니다."
  );
  const needs = safe(
    input.needs,
    analysis.keyPoints && analysis.keyPoints.length
      ? "첨부자료에 명시된 검사 목적·임상 활용·검체 및 운영 정보를 바탕으로 거래처 적용 가능성을 검토합니다."
      : "거래처의 필요 사항을 확인한 뒤 제안 내용을 구체화합니다."
  );

  const points = (analysis.keyPoints || []).slice(0, 3);

  const pointCards = points.length
    ? `<div class="pd-points">
        ${points
          .map(
            (p, i) => `<article class="pd-point">
              <span class="pd-point-no">${i + 1}</span>
              <p class="pd-point-text">${escapeHtml(safe(p.text, ""))}</p>
              ${p.source ? `<p class="pd-point-src">출처 · ${escapeHtml(p.source)}</p>` : ""}
            </article>`
          )
          .join("")}
      </div>`
    : `<p class="pd-empty">첨부 자료에서 핵심 문장을 확인하지 못했습니다. 원문을 검토해 주세요.</p>`;

  return `<section class="proposal-page">
    ${sectionHead("01", "제안 요약", "거래처 상황과 제안 방향을 한 장으로 정리했습니다.")}

    <div class="pd-body">
      <div class="pd-block">
        <h3 class="pd-sub">거래처 상황과 검토 과제</h3>
        <p class="pd-text">${escapeHtml(situation)}</p>
      </div>

      <div class="pd-block">
        <h3 class="pd-sub">검사 도입 제안</h3>
        <p class="pd-text">${escapeHtml(needs)}</p>
      </div>

      <div class="pd-block">
        <h3 class="pd-sub">제안 근거 핵심 3가지</h3>
        ${pointCards}
      </div>
    </div>

    ${pageFoot(index, total)}
  </section>`;
}

/* ---------- 3) 확인된 근거 (그래픽 + 이미지) ---------- */

function evidencePage(analysis, options, index, total) {
  const metrics = (analysis.metrics || []).slice(0, 5);
  const sources = (analysis.sources || []).slice(0, 4);

  const gauges = metrics.length
    ? `<div class="pd-gauges">${metrics.map(gauge).join("")}</div>`
    : `<p class="pd-empty">자료에서 수치를 확인하지 못했습니다. 원문을 확인해 주세요.</p>`;

  const image = options && options.image && options.image.dataUrl ? options.image : null;

  const figure = image
    ? `<figure class="pd-figure">
        <img src="${image.dataUrl}" alt="${escapeHtml(safe(image.name, "첨부 자료 이미지"))}">
        <figcaption>${escapeHtml(safe(image.caption, safe(image.name, "첨부 자료에서 추출한 이미지")))}</figcaption>
      </figure>`
    : "";

  const sourceList = sources.length
    ? `<div class="pd-block">
        <h3 class="pd-sub">수치 출처</h3>
        <ul class="pd-sources">
          ${sources.map((s) => `<li>${escapeHtml(String(s))}</li>`).join("")}
        </ul>
      </div>`
    : "";

  return `<section class="proposal-page">
    ${sectionHead("02", "확인된 근거", "첨부 자료에 수록된 수치만 사용했습니다. 자료에 없는 효능·비교 수치는 넣지 않았습니다.")}

    <div class="pd-body">
      <div class="pd-block">
        <h3 class="pd-sub">자료 수록 수치</h3>
        ${gauges}
      </div>

      ${figure}
      ${sourceList}
    </div>

    ${pageFoot(index, total)}
  </section>`;
}

/* ---------- 4) 검사 정보 ---------- */

function specPage(analysis, index, total) {
  const rows = (analysis.infoRows || []).slice(0, 10);
  const targets = (analysis.targets || []).slice(0, 10);

  const table = rows.length
    ? `<table class="pd-table">
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
                <th>${escapeHtml(safe(r.field, "항목"))}</th>
                <td>${escapeHtml(safe(r.value, "-"))}</td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : `<p class="pd-empty">검사 정보를 확인하지 못했습니다. 원문을 확인해 주세요.</p>`;

  const chips = targets.length
    ? `<div class="pd-block">
        <h3 class="pd-sub">이런 경우 활용합니다</h3>
        <div class="pd-chips">
          ${targets.map((t) => `<span class="pd-chip">${escapeHtml(String(t))}</span>`).join("")}
        </div>
      </div>`
    : "";

  return `<section class="proposal-page">
    ${sectionHead("03", "검사 정보", "검체·일정·검사코드·수가는 내부 확인 후 최종 안내드립니다.")}

    <div class="pd-body">
      <div class="pd-block">
        <h3 class="pd-sub">기본 정보</h3>
        ${table}
      </div>
      ${chips}
    </div>

    ${pageFoot(index, total)}
  </section>`;
}

/* ---------- 5) 제안 단가 ---------- */

function pricingPage(input, index, total) {
  const hasPrice = input.proposed !== null && input.proposed !== undefined;
  const base = Number(input.basePrice) || 0;
  const discount = Number(input.discount) || 0;
  const proposed = Number(input.proposed) || 0;
  const max = Math.max(base, proposed, 1);

  const cards = `<div class="pd-price-cards">
    <div class="pd-price-card">
      <span>기준 단가</span>
      <b>${hasPrice ? escapeHtml(won(base)) : "내부 확인"}</b>
    </div>
    <div class="pd-price-card">
      <span>승인 할인율</span>
      <b>${hasPrice ? `${escapeHtml(String(input.rate))}%` : "내부 확인"}</b>
    </div>
    <div class="pd-price-card">
      <span>할인 금액</span>
      <b>${hasPrice ? escapeHtml(won(discount)) : "내부 확인"}</b>
    </div>
    <div class="pd-price-card is-strong">
      <span>제안 단가</span>
      <b>${hasPrice ? escapeHtml(won(proposed)) : "내부 확인"}</b>
    </div>
  </div>`;

  const chart = hasPrice
    ? `<div class="pd-block">
        <h3 class="pd-sub">단가 비교</h3>
        <div class="pd-bars">
          ${barRow("기준 단가", base, max, "is-base")}
          ${barRow("제안 단가", proposed, max, "is-offer")}
        </div>
      </div>`
    : "";

  const conditions = safe(input.conditions, "");
  const period = safe(input.period, "");

  const terms = [
    period ? `<div class="pd-term"><span>적용 기간</span><p>${escapeHtml(period)}</p></div>` : "",
    conditions ? `<div class="pd-term"><span>적용 조건</span><p>${escapeHtml(conditions)}</p></div>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `<section class="proposal-page">
    ${sectionHead("04", "제안 단가 및 적용 조건", "재단에서 승인된 기준 단가와 할인율만 반영했습니다.")}

    <div class="pd-body">
      <div class="pd-block">
        <h3 class="pd-sub">제안 대상</h3>
        <p class="pd-text">${escapeHtml(safe(input.item, "거래처 협의 후 확정"))}</p>
      </div>

      ${cards}
      ${chart}

      ${terms ? `<div class="pd-block"><h3 class="pd-sub">적용 조건</h3>${terms}</div>` : ""}
    </div>

    ${pageFoot(index, total)}
  </section>`;
}

/* ---------- 6) 도입 계획 ---------- */

function planPage(input, analysis, index, total) {
  const steps = [
    { title: "현황 확인", body: "거래처 진료과·환자 구성·현재 의뢰 항목을 확인합니다." },
    { title: "항목 선정", body: "활용 가능한 검사 항목과 검체·일정 조건을 함께 정리합니다." },
    { title: "절차 안내", body: "의뢰 방법, 결과 확인 절차, 담당자 연락 체계를 안내합니다." },
    { title: "도입·점검", body: "도입 후 의뢰 현황을 확인하고 필요 항목을 조정합니다." },
  ];

  const timeline = `<ol class="pd-timeline">
    ${steps
      .map(
        (s, i) => `<li>
          <span class="pd-tl-no">${i + 1}</span>
          <strong>${escapeHtml(s.title)}</strong>
          <p>${escapeHtml(s.body)}</p>
        </li>`
      )
      .join("")}
  </ol>`;

  const support = safe(
    input.support,
    "검사 목록 및 의뢰 절차 안내, 담당자 교육, 도입 후 의뢰 현황 점검을 함께 진행합니다."
  );

  const action = safe(
    input.action,
    "1) 거래처 현황 확인  2) 검사 대상·검체·의뢰 절차 안내  3) 최신 급여·수가 및 내부 승인 조건 확인  4) 도입 후 의뢰 현황 점검"
  );

  const targets = (analysis.targets || []).slice(0, 8);

  return `<section class="proposal-page">
    ${sectionHead("05", "도입 및 후속 계획", "실제 진행 순서와 지원 범위입니다.")}

    <div class="pd-body">
      <div class="pd-block">
        <h3 class="pd-sub">진행 순서</h3>
        ${timeline}
      </div>

      <div class="pd-block">
        <h3 class="pd-sub">지원 내용</h3>
        <p class="pd-text">${escapeHtml(support)}</p>
      </div>

      <div class="pd-block">
        <h3 class="pd-sub">후속 조치 및 일정</h3>
        <p class="pd-text">${escapeHtml(action)}</p>
      </div>

      ${
        targets.length
          ? `<div class="pd-block">
              <h3 class="pd-sub">적용 대상 후보</h3>
              <div class="pd-chips">
                ${targets.map((t) => `<span class="pd-chip">${escapeHtml(String(t))}</span>`).join("")}
              </div>
            </div>`
          : ""
      }
    </div>

    ${pageFoot(index, total)}
  </section>`;
}

/* ---------- 7) 참고 자료 · 유의사항 ---------- */

function closingPage(analysis, index, total) {
  const sources = (analysis.sources || []).slice(0, 10);

  const list = sources.length
    ? `<ul class="pd-sources">
        ${sources.map((s, i) => `<li><b>${i + 1}</b><span>${escapeHtml(String(s))}</span></li>`).join("")}
      </ul>`
    : `<p class="pd-empty">첨부 자료의 출처 정보를 확인하지 못했습니다.</p>`;

  const notices = [
    "자동 추출 결과는 초안입니다. 검사 항목·검체 조건·검사 일정·검사코드·수가·급여 기준은 원문과 최신 공지를 대조해 주세요.",
    "첨부 자료에 없는 효능·비교 우위·할인 조건은 임의로 만들지 않았습니다. 승인된 조건만 반영했습니다.",
    "완치·100%·부작용 없음·최고·유일과 같은 단정 표현은 사용하지 않습니다. 진단과 치료 결정은 담당 의료진의 판단에 따릅니다.",
    "환자 개인정보와 내부 단가표가 외부로 나가지 않도록 배포 대상을 확인해 주세요.",
  ];

  return `<section class="proposal-page">
    ${sectionHead("06", "참고 자료 및 유의사항", "")}

    <div class="pd-body">
      <div class="pd-block">
        <h3 class="pd-sub">참고 자료</h3>
        ${list}
      </div>

      <div class="pd-block">
        <h3 class="pd-sub">사용 시 유의사항</h3>
        <ul class="pd-notice">
          ${notices.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}
        </ul>
      </div>

      <div class="pd-sign">
        <span>${escapeHtml(ORG)}</span>
        <span class="pd-sign-line">담당자 확인</span>
      </div>
    </div>

    ${pageFoot(index, total)}
  </section>`;
}

/* ---------- 조립 ---------- */

/**
 * 제안서 A4 페이지 목록을 만듭니다.
 * @param {object} input  collectProposalInput() 결과
 * @param {object} analysis  state.analysis
 * @param {object} options  { image: {dataUrl, name, caption} | null }
 */
export function renderProposalPages(input, analysis, options = {}) {
  const a = analysis || { metrics: [], keyPoints: [], infoRows: [], targets: [], sources: [] };
  const total = 7;

  const pages = [
    coverPage(input, a, total),
    summaryPage(input, a, 1, total),
    evidencePage(a, options, 2, total),
    specPage(a, 3, total),
    pricingPage(input, 4, total),
    planPage(input, a, 5, total),
    closingPage(a, 6, total),
  ];

  return { pages, total };
}

/** 페이지 목록을 하나의 문서 HTML로 묶습니다. (미리보기 · 인쇄 공용) */
export function renderProposalHtml(input, analysis, options = {}) {
  const { pages } = renderProposalPages(input, analysis, options);
  return `<div class="proposal-doc">${pages.join("")}</div>`;
}

/** 제안서 텍스트 요약 (복사 · Word 저장용) — 기존 형식 유지 */
export function proposalToPlainText(input, analysis) {
  const a = analysis || { metrics: [], keyPoints: [], infoRows: [], targets: [], sources: [] };
  const clinic = safe(input.clinic, "거래처명 미입력");
  const manager = safe(input.manager, "원장님");
  const date = formatKoreanDate(input.date) || safe(input.date, "");

  const lines = [
    "부산3지점 맞춤형 영업 제안서",
    TYPE_TITLES[input.type] || "거래처 협력 제안",
    "",
    `거래처: ${clinic}    담당자: ${manager}    작성일: ${date}`,
    "",
    "1. 거래처 상황과 검토 과제",
    safe(input.situation, "거래처 상담을 통해 확인합니다."),
    "",
    "2. 검사 도입 제안",
    safe(input.needs, "첨부 자료의 검사 목적·임상 활용 정보를 바탕으로 검토합니다."),
    "",
    "3. 도입 검토 시 확인할 핵심 정보",
  ];

  (a.keyPoints || []).slice(0, 6).forEach((p, i) => {
    lines.push(`${i + 1}. ${safe(p.text, "")}  [출처: ${safe(p.source, "-")}]`);
  });

  if ((a.infoRows || []).length) {
    lines.push("", "[검사 정보]");
    a.infoRows.forEach((r) => lines.push(`· ${safe(r.field, "")}: ${safe(r.value, "")}`));
  }

  if ((a.metrics || []).length) {
    lines.push("", "[확인된 수치]");
    a.metrics.forEach((m) => lines.push(`· ${safe(m.label, "")}: ${safe(m.value, "")}`));
  }

  lines.push("", "4. 제안 단가 및 적용 조건");
  lines.push(`제안 대상: ${safe(input.item, "거래처 협의 후 확정")}`);
  if (input.proposed !== null && input.proposed !== undefined) {
    lines.push(`기준 단가: ${won(input.basePrice)}`);
    lines.push(`승인 할인율: ${input.rate}%`);
    lines.push(`할인 금액: ${won(input.discount)}`);
    lines.push(`계산된 제안 단가: ${won(input.proposed)}`);
  } else {
    lines.push("가격·할인 조건: 내부 승인 기준 확인 후 확정");
  }
  if (safe(input.period)) lines.push(`적용 기간: ${input.period}`);
  if (safe(input.conditions)) lines.push(`적용 조건: ${input.conditions}`);

  lines.push("", "5. 지원 및 도입 계획", safe(input.support, "검사 목록·의뢰 절차 안내 및 도입 후 점검을 진행합니다."));
  lines.push("", "6. 후속 조치 및 일정", safe(input.action, "거래처와 일정 협의 후 진행합니다."));

  if ((a.sources || []).length) {
    lines.push("", "참고 자료");
    a.sources.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }

  lines.push("");
  lines.push("※ 본 문서는 첨부 자료와 입력값을 바탕으로 자동 작성된 초안입니다.");
  lines.push("   실제 검사 가능 여부, 검체 조건, 검사 일정, 검사코드·수가·급여 기준은 최신 공지와 내부 확인 후 확정해 주세요.");

  return lines.join("\n");
}
