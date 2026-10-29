/* =========================================================
   제안서 — A4 다페이지 문서 렌더러 (표지 · 그래픽 · 이미지)
   화면 미리보기와 PDF 내보내기가 같은 HTML을 사용합니다.
   ========================================================= */

import { escapeHtml, formatNumber, formatKoreanDate, truncate } from "./utils.js";

/* ---------- 제안 유형별 문구 ---------- */

export const TYPE_TITLES = {
  opening: "개원 검사 운영 지원",
  conversion: "검사 의뢰 전환",
  support: "거래처 운영 지원",
  renewal: "협력 강화",
};

const TYPE_LEADS = {
  opening: "개원 초기 진료 흐름에 맞춘 검사 구성과 의뢰 절차를 함께 준비합니다.",
  conversion: "현재 의뢰 구조를 비교해 옮길 항목과 남길 항목을 구분해 제안합니다.",
  support: "거래처 운영에 필요한 지원 범위를 확인하고 실행 계획을 함께 정리합니다.",
  renewal: "현재 의뢰 현황을 점검하고 진료 특성에 맞는 추가 항목을 제안합니다.",
};

const ORG = "재단법인 씨젠의료재단 부산3지점";

/* 신규 개원·타사 전환 영업은 검사 설명보다 운영 가치와 전환 실행에 초점을 둡니다. */
const SALES_PROFILES = {
  opening: {
    heroTitle: "개원 일정에 맞춘 검사 운영 준비",
    lead: "개원 일정에 맞춰 검사 의뢰부터 결과 확인까지 필요한 운영 준비를 함께 점검합니다.",
    situation: "개원 일정과 진료 흐름에 맞춘 운영 준비가 필요합니다.",
    needs: "개원 준비부터 직원 안내와 초기 운영 점검까지 필요한 절차를 함께 준비합니다.",
    item: "개원 검사 운영 지원",
    support: "운영시간, 수거 동선, 의뢰·결과 확인 방식과 담당자 연락 체계를 사전에 확인합니다.",
    action: "개원 예정일과 운영 조건을 확인한 뒤 준비 일정과 담당자를 협의합니다.",
    valueTitle: "개원 준비부터 초기 운영까지",
    valueLead: "필요한 준비를 미리 확인하고, 개원 후 업무 흐름이 자리 잡도록 지원합니다.",
    points: [
      { title: "개원 일정에 맞춘 준비", body: "운영시간·수거 동선·결과 확인 절차를 사전에 협의합니다." },
      { title: "직원 업무 안내", body: "의뢰 절차와 문의 연락 체계를 정리해 현장 혼선을 줄입니다." },
      { title: "초기 운영 점검", body: "개원 후 문의와 업무상 불편을 확인하고 필요한 조치를 연결합니다." }
    ],
    checks: ["수거 일정", "결과 확인", "직원 안내"],
    steps: [
      { time: "개원 전", title: "운영 조건 확인", body: "개원일, 운영시간과 검체 수거 동선을 확인합니다." },
      { time: "준비 단계", title: "업무 절차 안내", body: "검사 의뢰와 결과 확인 방법, 문의 연락 체계를 안내합니다." },
      { time: "개원일", title: "서비스 시작", body: "협의된 일정과 운영 조건에 맞춰 검사업무를 시작합니다." },
      { time: "초기 운영", title: "운영 점검", body: "초기 문의와 현장 불편을 확인하고 필요한 조치를 협의합니다." }
    ]
  },
  support: {
    heroTitle: "현장 요청을 확인하고 조치까지 연결",
    lead: "현장의 요청을 확인하고 필요한 지원을 연결해 업무 불편을 줄이겠습니다.",
    situation: "운영 중 발생하는 불편과 지원 요청을 확인합니다.",
    needs: "문의 접수에서 끝나지 않고 조치 상황과 결과를 공유하는 지원을 제공합니다.",
    item: "거래처 운영 지원",
    support: "수거·결과 확인·전산 연계·직원 안내 등 거래처의 요청을 확인하고 적용 가능한 지원을 연결합니다.",
    action: "다음 방문에서 불편사항과 지원 요청을 확인하고 조치 결과를 공유합니다.",
    valueTitle: "필요한 지원을 빠르게 연결",
    valueLead: "요청사항을 확인하고 해결 여부까지 후속 관리합니다.",
    points: [
      { title: "현장 요청 확인", body: "반복되는 불편과 필요한 지원을 파악합니다." },
      { title: "담당자 연결", body: "관련 담당자와 조치 범위를 확인하고 진행 상황을 공유합니다." },
      { title: "조치 결과 확인", body: "완료 여부와 추가로 필요한 사항을 확인합니다." }
    ],
    checks: ["수거 일정", "문의 대응", "결과 확인"],
    steps: [
      { time: "방문", title: "요청사항 확인", body: "수거·결과 확인·전산 연계 등 실제 불편을 정리합니다." },
      { time: "확인", title: "지원 범위 협의", body: "담당 부서와 적용 가능 범위 및 일정을 확인합니다." },
      { time: "조치", title: "결과 공유", body: "진행 상황과 조치 결과를 거래처 담당자에게 안내합니다." },
      { time: "후속", title: "완료 여부 점검", body: "현장에서 개선 여부를 확인하고 추가 요청을 정리합니다." }
    ]
  },
  renewal: {
    heroTitle: "거래 흐름을 점검하고 개선 기회 발굴",
    lead: "거래 흐름과 현장의 의견을 살펴 지속적인 협력과 개선 기회를 찾습니다.",
    situation: "거래 현황과 현장의 요구를 주기적으로 확인합니다.",
    needs: "거래 변화와 요청사항을 바탕으로 운영 개선과 추가 협력 기회를 검토합니다.",
    item: "거래처 협력 강화",
    support: "거래 흐름, 주요 담당자 의견과 운영상 불편을 확인하고 실제 필요한 지원을 협의합니다.",
    action: "거래 변화와 요청사항을 검토하고 다음 관리 일정과 개선 과제를 협의합니다.",
    valueTitle: "지속적인 협력과 개선",
    valueLead: "거래처의 변화와 필요에 맞춰 관리 과제를 구체화합니다.",
    points: [
      { title: "거래 흐름 점검", body: "월별 의뢰 변화와 주요 항목을 확인합니다." },
      { title: "담당자 소통", body: "원장님과 실무 담당자의 의견 및 요청을 확인합니다." },
      { title: "개선 기회 발굴", body: "운영상 불편과 추가 협력 필요성을 검토합니다." }
    ],
    checks: ["거래 흐름", "담당자 의견", "개선 과제"],
    steps: [
      { time: "정기 점검", title: "거래 현황 확인", body: "월별 의뢰 흐름과 주요 검사 항목의 변화를 확인합니다." },
      { time: "과제 선정", title: "개선 항목 협의", body: "원장님과 실무 담당자의 의견을 바탕으로 우선 과제를 정합니다." },
      { time: "지원 진행", title: "후속 조치", body: "합의한 개선 과제와 지원 사항을 관련 담당자와 진행합니다." },
      { time: "재점검", title: "변화 확인", body: "진행 결과와 추가로 필요한 지원을 함께 점검합니다." }
    ]
  },
  conversion: {
    heroTitle: "수거부터 결과 확인까지 단계적 전환",
    lead: "검체 수거, 결과 확인과 전산 연계 등 실제 운영 조건을 확인하고 원활한 전환을 준비합니다.",
    situation: "현재 이용 중인 서비스와 운영 조건을 확인해 전환 범위와 일정을 협의합니다.",
    needs: "1일 2회 수거, 조직병리 자체 운영 등 거래처에 필요한 서비스 강점을 중심으로 전환 조건을 협의합니다.",
    item: "검사 의뢰 전환",
    support: "현재 수거·의뢰·결과 확인 흐름을 확인하고, 전환 범위와 적용 조건은 관련 부서와 협의해 확정합니다.",
    action: "현재 운영 조건과 개선 희망사항을 확인하고 전환 범위 및 시작 일정을 협의합니다.",
    valueTitle: "씨젠의 서비스와 운영 지원",
    valueLead: "거래처에 필요한 조건을 확인하고 실제 적용 가능한 범위부터 함께 준비합니다.",
    points: [
      { title: "검체 수거", body: "거래처 운영시간과 동선에 맞춰 수거 조건을 협의합니다." },
      { title: "결과 확인·전산 연계", body: "현재 결과 확인 방식과 전산 연계 가능 범위를 확인합니다." },
      { title: "전환 초기 지원", body: "적용 일정과 연락 체계를 정리하고 초기 운영을 점검합니다." }
    ],
    checks: ["수거 일정", "결과 확인", "전산 연계"],
    steps: [
      { time: "사전 협의", title: "현재 운영 확인", body: "현재 의뢰 항목, 수거 일정, 결과 확인과 전산 연계를 확인합니다." },
      { time: "범위 확정", title: "전환 조건 협의", body: "전환할 항목, 적용 일정과 필요한 사전 준비를 합의합니다." },
      { time: "전환 시작", title: "서비스 적용", body: "확정된 범위부터 순차 적용하고 담당자 연락 체계를 운영합니다." },
      { time: "초기 운영", title: "결과 확인", body: "초기 의뢰 과정의 문의와 불편을 확인해 필요한 조정을 협의합니다." }
    ]
  }
};
function isAcquisitionType(type) {
  return type === "opening" || type === "conversion";
}

function isOnePageProposalType(type) {
  return ["opening", "conversion", "support", "renewal"].includes(type);
}

function salesProfile(type) {
  return SALES_PROFILES[type] || SALES_PROFILES.opening;
}

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
      <img class="pd-cover-logo" src="ci-seegene.png" alt="재단법인 씨젠의료재단">
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

/* ---------- 신규 개원·타사 전환 영업 제안서: 1~2페이지 ---------- */

function businessOnePage(input) {
  const profile = salesProfile(input.type);
  const title = TYPE_TITLES[input.type] || "검사서비스 안내";
  const clinic = safe(input.clinic, "거래처명 미입력");
  const manager = safe(input.manager, "");
  const date = formatKoreanDate(input.date) || safe(input.date, "");

  const valueCards = profile.points.slice(0, 3).map((point, index) =>
    '<article class="pd-onepage-value">' +
      '<span class="pd-onepage-value-no">' + (index + 1) + '</span>' +
      '<h3>' + escapeHtml(point.title) + '</h3>' +
      '<p>' + escapeHtml(truncate(point.body, 78)) + '</p>' +
    '</article>'
  ).join("");

  const steps = profile.steps.slice(0, 4).map((step, index) =>
    '<article class="pd-onepage-flow-item">' +
      '<span>' + String(index + 1).padStart(2, "0") + '</span>' +
      '<b>' + escapeHtml(step.title) + '</b>' +
    '</article>'
  ).join("");

  const terms = [];
  if (safe(input.period)) terms.push({ label: "적용 기간", value: safe(input.period) });
  if (safe(input.conditions)) terms.push({ label: "협의 조건", value: safe(input.conditions) });
  if (input.proposed !== null && input.proposed !== undefined && input.hasBase && input.hasRate) {
    terms.push({ label: "제안 단가", value: won(input.proposed) });
  }
  const termHtml = terms.length
    ? '<div class="pd-onepage-terms">' + terms.map((term) =>
        '<div class="pd-onepage-term"><span>' + escapeHtml(term.label) + '</span><b>' + escapeHtml(term.value) + '</b></div>'
      ).join("") + '</div>'
    : "";

  const needs = safe(input.needs, profile.needs);
  const support = truncate(safe(input.support, profile.support), 125);
  const action = truncate(safe(input.action, profile.action), 105);

  return '<section class="proposal-page pd-business-onepage">' +
    '<div class="pd-onepage-accent" aria-hidden="true"></div>' +
    '<header class="pd-onepage-header">' +
      '<img class="pd-onepage-logo" src="ci-seegene.png" alt="재단법인 씨젠의료재단">' +
      '<div class="pd-onepage-header-meta"><span>BUSAN BRANCH 3</span></div>' +
    '</header>' +
    '<div class="pd-onepage-titleblock">' +
      '<h1>' + escapeHtml(title) + '</h1>' +
      '<p class="pd-onepage-lead">' + escapeHtml(profile.lead) + '</p>' +
      '<div class="pd-onepage-client"><strong>' + escapeHtml(clinic) + '</strong><span>귀중</span></div>' +
    '</div>' +
    '<div class="pd-onepage-proposition"><p>' + escapeHtml(needs) + '</p></div>' +
    '<section class="pd-onepage-section">' +
      '<div class="pd-onepage-sectionhead"><span>01</span><div><h2>' + escapeHtml(profile.valueTitle) + '</h2></div></div>' +
      '<div class="pd-onepage-values">' + valueCards + '</div>' +
    '</section>' +
    '<section class="pd-onepage-section pd-onepage-steps-section">' +
      '<div class="pd-onepage-sectionhead"><span>02</span><div><h2>진행 순서</h2></div></div>' +
      '<div class="pd-onepage-flow">' + steps + '</div>' +
    '</section>' +
    '<div class="pd-onepage-bottom">' +
      '<div class="pd-onepage-bottomcard"><span>지원 내용</span><p>' + escapeHtml(support) + '</p></div>' +
      '<div class="pd-onepage-bottomcard"><span>다음 단계</span><p>' + escapeHtml(action) + '</p></div>' +
    '</div>' +
    termHtml +
    '<footer class="pd-onepage-footer">' +
      '<span>재단법인 씨젠의료재단 부산3지점</span>' +
      '<span>' + escapeHtml([manager, date].filter(Boolean).join(" · ")) + '</span>' +
    '</footer>' +
  '</section>';
}

function businessCoverPage(input, total, options = {}) {
  const profile = salesProfile(input.type);
  const title = TYPE_TITLES[input.type] || "거래처 협력 제안";
  const clinic = safe(input.clinic, "거래처명 미입력");
  const manager = safe(input.manager, "담당자");
  const date = formatKoreanDate(input.date) || safe(input.date, "");
  const image = options.image && options.image.dataUrl ? options.image : null;
  const focusCards = profile.points.slice(0, 3).map((point, index) =>
    '<div class="pd-cover-stat"><b><i>' + String(index + 1).padStart(2, "0") + '</i> ' + escapeHtml(point.title) + '</b><span>' + escapeHtml(point.body) + '</span></div>'
  ).join("");
  const heroImage = image
    ? '<figure class="pd-business-hero-figure"><img src="' + escapeHtml(image.dataUrl) + '" alt="' + escapeHtml(safe(image.name, "첨부 검사자료 이미지")) + '"><figcaption>' + escapeHtml(safe(image.caption, "첨부 검사자료")) + '</figcaption></figure>'
    : '<div class="pd-business-hero-art" aria-hidden="true"><span>SEEGENE</span><b>검사 운영<br>파트너십</b><i>BUSAN BRANCH 3</i></div>';
  const situation = safe(input.situation, "");
  const situationCard = situation
    ? '<div class="pd-business-brief-card"><span>협의가 필요한 운영 조건</span><p>' + escapeHtml(situation) + '</p></div>'
    : "";
  return '<section class="proposal-page pd-cover pd-business-cover">' +
    '<div class="pd-cover-shape" aria-hidden="true"></div><div class="pd-cover-dots" aria-hidden="true"></div>' +
    '<div class="pd-cover-top"><img class="pd-cover-logo" src="ci-seegene.png" alt="재단법인 씨젠의료재단"><span class="pd-cover-branch">부산3지점</span></div>' +
    '<div class="pd-cover-main"><p class="pd-cover-kicker">BUSINESS PROPOSAL · CUSTOMER SOLUTION</p>' +
    '<h1 class="pd-cover-title">' + escapeHtml(title) + '</h1>' +
    '<p class="pd-cover-lead">' + escapeHtml(profile.lead) + '</p>' +
    '<p class="pd-cover-client">' + escapeHtml(clinic) + ' <span>귀중</span></p></div>' +
    '<div class="pd-business-hero">' +
      '<div class="pd-business-hero-copy"><span class="pd-business-eyebrow">PROPOSED VALUE</span><h2>' + escapeHtml(profile.heroTitle || "현장 운영에 맞춘 실행 가능한 제안") + '</h2>' +
      '<p>' + escapeHtml(safe(input.needs, profile.needs)) + '</p></div>' +
      heroImage +
    '</div>' +
    (situationCard ? '<div class="pd-business-brief">' + situationCard + '</div>' : '') +
    '<div class="pd-cover-section-label">이번 제안에서 제공할 가치</div><div class="pd-cover-stats">' + focusCards + '</div>' +
    '<div class="pd-cover-meta">' +
      '<div><span>담당</span><b>' + escapeHtml(manager) + '</b></div>' +
      '<div><span>작성일</span><b>' + escapeHtml(date) + '</b></div>' +
      '<div><span>제안 범위</span><b>' + escapeHtml(safe(input.item, profile.item)) + '</b></div>' +
      '<div><span>적용 기간</span><b>' + escapeHtml(safe(input.period, "협의 후 확정")) + '</b></div>' +
    '</div><div class="pd-cover-bar" aria-hidden="true"></div>' + pageFoot(0, total) +
  '</section>';
}

function businessValuePage(input, analysis, index, total) {
  const profile = salesProfile(input.type);
  const a = analysis || { keyPoints: [], infoRows: [], metrics: [], targets: [], sources: [] };
  const points = profile.points.map((point, i) =>
    '<article class="pd-business-value"><span class="pd-business-value-no">' + String(i + 1).padStart(2, "0") + '</span>' +
      '<div><h3>' + escapeHtml(point.title) + '</h3><p>' + escapeHtml(point.body) + '</p></div></article>'
  ).join("");
  const facts = (a.keyPoints || []).filter((p) => safe(p && p.text)).slice(0, 4);
  const metrics = (a.metrics || []).filter((m) => safe(m && m.value)).slice(0, 4);
  const rows = (a.infoRows || []).filter((r) => safe(r && r.field) && safe(r && r.value)).slice(0, 8);
  const targets = (a.targets || []).filter((v) => safe(v)).slice(0, 8);
  const factHtml = facts.length
    ? '<div class="pd-business-source-points">' + facts.map((p, i) =>
        '<article><span>' + String(i + 1).padStart(2, "0") + '</span><div><p>' + escapeHtml(p.text) + '</p>' +
        (p.source ? '<small>출처: ' + escapeHtml(p.source) + '</small>' : '') + '</div></article>'
      ).join("") + '</div>'
    : '<p class="pd-business-empty-note">검사 항목별 적용 범위와 세부 조건은 자료 확인 및 상담을 거쳐 안내드립니다.</p>';
  const metricHtml = metrics.length
    ? '<div class="pd-business-metrics">' + metrics.map((m) =>
        '<article><span>' + escapeHtml(safe(m.label, "자료 수치")) + '</span><b>' + escapeHtml(m.value) + '</b></article>'
      ).join("") + '</div>'
    : "";
  const tableHtml = rows.length
    ? '<div class="pd-business-info-table">' + rows.map((r) =>
        '<div><span>' + escapeHtml(r.field) + '</span><b>' + escapeHtml(r.value) + '</b></div>'
      ).join("") + '</div>'
    : "";
  const targetHtml = targets.length
    ? '<div class="pd-business-targets">' + targets.map((v) => '<span>' + escapeHtml(String(v)) + '</span>').join("") + '</div>'
    : "";
  const checks = profile.checks.map((item) => '<span class="pd-business-chip">' + escapeHtml(item) + '</span>').join("");
  return '<section class="proposal-page pd-business-detail-page">' +
    sectionHead("01", "운영 가치와 검사자료 핵심", "현장 운영을 개선하는 지원 방향과 첨부 자료에서 확인한 내용을 함께 정리했습니다.") +
    '<div class="pd-body pd-business-detail-body">' +
      '<div class="pd-business-grid">' + points + '</div>' +
      (metricHtml ? '<div class="pd-business-data-block"><h3>자료에 명시된 주요 수치</h3>' + metricHtml + '</div>' : '') +
      '<div class="pd-business-data-block"><h3>검사자료 핵심 내용</h3>' + factHtml + '</div>' +
      (tableHtml ? '<div class="pd-business-data-block"><h3>검사 정보</h3>' + tableHtml + '</div>' : '') +
      (targetHtml ? '<div class="pd-business-data-block"><h3>자료에 기재된 적용 대상</h3>' + targetHtml + '</div>' : '') +
      '<div class="pd-business-callout"><span>거래처 운영 조건 확인</span><p>' + escapeHtml("수거 일정 · 검사 의뢰 절차 · 결과 확인 방식 · 전산 연계 범위") + '</p>' +
      '<div class="pd-business-chips">' + checks + '</div></div>' +
      (a.sources && a.sources.length ? '<p class="pd-business-source-list">참고: ' + escapeHtml(a.sources.slice(0, 3).join(" · ")) + '</p>' : '') +
    '</div>' + pageFoot(index, total) + '</section>';
}

function businessActionPage(input, index, total) {
  const profile = salesProfile(input.type);
  const hasPrice = input.proposed !== null && input.proposed !== undefined && input.hasBase && input.hasRate;
  const steps = profile.steps.map((step, i) =>
    '<li><span class="pd-tl-no">' + (i + 1) + '</span><div class="pd-business-step-main">' +
      '<div class="pd-business-step-top"><strong>' + escapeHtml(step.title) + '</strong><span>' + escapeHtml(step.time) + '</span></div>' +
      '<p>' + escapeHtml(step.body) + '</p></div></li>'
  ).join("");

  const scopeCards = [
    {label:"제안 범위", value:safe(input.item, profile.item)},
    {label:"적용 기간", value:safe(input.period, "협의 후 확정")},
    {label:"적용 조건", value:safe(input.conditions, "세부 운영 조건 협의 후 확정")}
  ];
  if (hasPrice) {
    scopeCards.unshift({label:"기준 단가",value:won(input.basePrice)});
    scopeCards.push({label:"승인 할인율 / 제안 단가",value:String(input.rate) + "% / " + won(input.proposed)});
  }
  const conditionCards = scopeCards.map((item) =>
    '<div class="pd-business-term"><span>' + escapeHtml(item.label) + '</span><b>' + escapeHtml(item.value) + '</b></div>'
  ).join("");
  const support = safe(input.support, profile.support);
  const action = safe(input.action, profile.action);

  return '<section class="proposal-page pd-business-action-page">' +
    sectionHead("02", "도입부터 안정화까지", "운영 조건을 확인하고 합의한 범위부터 단계적으로 적용합니다.") +
    '<div class="pd-body pd-business-action-body">' +
      '<div class="pd-block"><h3 class="pd-sub">진행 일정</h3><ol class="pd-timeline pd-business-timeline">' + steps + '</ol></div>' +
      '<div class="pd-block"><h3 class="pd-sub">적용 범위와 협의 조건</h3><div class="pd-business-terms">' + conditionCards + '</div></div>' +
      '<div class="pd-business-action-grid">' +
        '<div class="pd-business-action-card"><h3>담당 지원</h3><p>' + escapeHtml(support) + '</p></div>' +
        '<div class="pd-business-action-card"><h3>다음 단계</h3><p>' + escapeHtml(action) + '</p></div>' +
      '</div>' +
      '<div class="pd-business-close-banner"><b>현장에 맞는 검사 운영을 함께 준비하겠습니다.</b><span>재단법인 씨젠의료재단 부산3지점</span></div>' +
    '</div>' + pageFoot(index, total) + '</section>';
}

/* ---------- 2) 제안 요약 ---------- */

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

  if (isOnePageProposalType(input?.type)) {
    const total = 3;
    const pages = [
      businessCoverPage(input, total, options),
      businessValuePage(input, a, 1, total),
      businessActionPage(input, 2, total),
    ];
    return { pages, total };
  }

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
function legacyProposalToPlainText(input, analysis) {
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


function acquisitionProposalToPlainText(input, analysis) {
  const profile = salesProfile(input.type);
  const a = analysis || { keyPoints: [], infoRows: [], metrics: [], targets: [], sources: [] };
  const clinic = safe(input.clinic, "거래처명 미입력");
  const manager = safe(input.manager, "");
  const date = formatKoreanDate(input.date) || safe(input.date, "");
  const lines = [
    "재단법인 씨젠의료재단 부산3지점",
    TYPE_TITLES[input.type] || "검사서비스 안내",
    clinic + " 귀중",
    ...([manager, date].filter(Boolean).length ? ["담당자·작성일: " + [manager, date].filter(Boolean).join(" / ")] : []),
    "",
    "제안 핵심",
    safe(input.needs, profile.needs),
    "",
    profile.valueTitle
  ];
  profile.points.slice(0, 3).forEach((point, index) => {
    lines.push((index + 1) + ". " + point.title + " — " + point.body);
  });
  const metrics = (a.metrics || []).filter((m) => safe(m && m.value)).slice(0, 4);
  if (metrics.length) {
    lines.push("", "자료에 명시된 수치");
    metrics.forEach((m) => lines.push("· " + safe(m.label, "자료 수치") + ": " + safe(m.value)));
  }
  const keyPoints = (a.keyPoints || []).filter((point) => safe(point && point.text)).slice(0, 4);
  if (keyPoints.length) {
    lines.push("", "검사자료 핵심 내용");
    keyPoints.forEach((point, index) => lines.push((index + 1) + ". " + safe(point.text) + (point.source ? " [출처: " + point.source + "]" : "")));
  }
  const infoRows = (a.infoRows || []).filter((row) => safe(row && row.field) && safe(row && row.value)).slice(0, 8);
  if (infoRows.length) {
    lines.push("", "검사 정보");
    infoRows.forEach((row) => lines.push("· " + safe(row.field) + ": " + safe(row.value)));
  }
  if ((a.targets || []).length) {
    lines.push("", "자료에 기재된 적용 대상");
    (a.targets || []).slice(0, 8).forEach((target) => lines.push("· " + String(target)));
  }
  lines.push("", "진행 순서: " + profile.steps.map((step) => step.title).join(" → "));
  lines.push("", "지원 내용: " + safe(input.support, profile.support));
  lines.push("다음 단계: " + safe(input.action, profile.action));
  if (safe(input.period)) lines.push("적용 기간: " + safe(input.period));
  if (safe(input.conditions)) lines.push("협의 조건: " + safe(input.conditions));
  if (input.proposed !== null && input.proposed !== undefined && input.hasBase && input.hasRate) {
    lines.push("제안 단가: " + won(input.proposed));
  }
  if ((a.sources || []).length) {
    lines.push("", "참고 자료");
    (a.sources || []).slice(0, 5).forEach((source, index) => lines.push((index + 1) + ". " + String(source)));
  }
  return lines.join("\n");
}

export function proposalToPlainText(input, analysis) {
  if (isOnePageProposalType(input?.type)) return acquisitionProposalToPlainText(input, analysis);
  return legacyProposalToPlainText(input, analysis);
}
