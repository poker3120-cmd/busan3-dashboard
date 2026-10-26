/* 공통 유틸 */

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString("ko-KR");
}

export function formatKoreanDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return String(value);
  return `${y}. ${Number(m)}. ${Number(d)}.`;
}

export function todayISO() {
  const now = new Date();
  const off = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - off).toISOString().slice(0, 10);
}

export function debounce(fn, wait = 220) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function truncate(value, max) {
  const text = String(value ?? "").trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export function slugify(value, fallback = "file") {
  const base = String(value ?? "").trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
  return base || fallback;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadUrl(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

export function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("파일을 읽을 수 없습니다."));
    reader.readAsText(file, "utf-8");
  });
}

/** 외부 스크립트를 필요할 때만 불러옵니다. */
const scriptCache = new Map();
export function loadScript(src) {
  if (scriptCache.has(src)) return scriptCache.get(src);
  const promise = new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.onload = () => resolve(true);
    tag.onerror = () => {
      scriptCache.delete(src);
      reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`));
    };
    document.head.appendChild(tag);
  });
  scriptCache.set(src, promise);
  return promise;
}

export async function copyText(text) {
  const value = String(text ?? "");
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    area.remove();
    if (!ok) throw new Error("복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.");
    return true;
  }
}
