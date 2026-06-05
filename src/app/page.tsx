"use client";

import { useState, useMemo } from "react";

const CONTRACT_DAYS = 180;

const PLANS = [
  {
    key: "uiux-portfolio",
    label: "產品設計【UIUX 作品班】舊約",
    price: 46800,
    mentorTotal: 14,
  },
  {
    key: "uiux-project",
    label: "產品設計【UIUX 專案班】舊約",
    price: 96800,
    mentorTotal: 26,
  },
  {
    key: "new-portfolio-2026",
    label: "產品設計【作品班】新約 2026/06",
    price: 96800,
    mentorTotal: 14,
  },
  {
    key: "new-project-2026",
    label: "產品設計【專案班】新約 2026/06",
    price: 148000,
    mentorTotal: 26,
  },
] as const;

type PlanKey = (typeof PLANS)[number]["key"];
type PaymentMethod = "onetime" | "installment";

interface CalcResult {
  elapsedDays: number;
  periodPct: number;
  usedPct: number;
  effectivePct: number;
  rule: string;
  ruleDetail: string;
  refundRate: number;
  refundBase: number;
  penalty: number;
}

function calcBase(
  startDate: Date,
  requestDate: Date,
  usedSessions: number,
  mentorTotal: number,
  price: number,
  isFault: boolean
): CalcResult {
  const msPerDay = 1000 * 60 * 60 * 24;
  const elapsedDays = Math.max(
    0,
    Math.floor((requestDate.getTime() - startDate.getTime()) / msPerDay)
  );
  const periodPct = (elapsedDays / CONTRACT_DAYS) * 100;
  const usedPct = (usedSessions / mentorTotal) * 100;
  const effectivePct = Math.max(periodPct, usedPct);

  let rule = "", ruleDetail = "", refundRate = 0;

  if (elapsedDays <= 7 && usedSessions === 0) {
    rule = "規則一"; ruleDetail = "契約生效後 7 日內且未使用任何 Mentor 次數 → 全額退還"; refundRate = 1;
  } else if (effectivePct <= 10) {
    rule = "規則二"; ruleDetail = "使用比例未逾 10% → 全額退還"; refundRate = 1;
  } else if (effectivePct <= 30) {
    rule = "規則三"; ruleDetail = "使用比例逾 10% 未逾 30% → 退還 80%"; refundRate = 0.8;
  } else if (effectivePct <= 50) {
    rule = "規則四"; ruleDetail = "使用比例逾 30% 未逾 50% → 退還 50%"; refundRate = 0.5;
  } else {
    rule = "規則五"; ruleDetail = "使用比例逾 50% → 不退款"; refundRate = 0;
  }

  const refundBase = Math.round(price * refundRate);
  // 違約金 = 應退金額 × 20%（僅部分退款且可歸責時）
  const penalty = isFault && refundRate > 0 && refundRate < 1 ? Math.round(refundBase * 0.2) : 0;

  return { elapsedDays, periodPct, usedPct, effectivePct, rule, ruleDetail, refundRate, refundBase, penalty };
}

function fmtNum(n: number) {
  return Math.abs(n).toLocaleString("zh-TW");
}
function fmtDate(s: string) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${y} 年 ${m} 月 ${d} 日`;
}

function generateReceiptHTML(data: {
  studentName: string;
  planLabel: string;
  startDate: string;
  requestDate: string;
  elapsedDays: number;
  periodPct: number;
  usedSessions: number;
  mentorTotal: number;
  usedPct: number;
  price: number;
  paymentMethod: PaymentMethod;
  installmentAmount: number;
  paidPeriods: number;
  thirdPartyPenalty: number;
  rule: string;
  ruleDetail: string;
  refundRate: number;
  refundBase: number;
  penalty: number;
  isFault: boolean;
  resultLabel: string;
  resultAmount: number;
  remarks: string;
  today: string;
}) {
  const paidAmount = data.installmentAmount * data.paidPeriods;
  const refundPct = Math.round(data.refundRate * 100);

  const rows = (label: string, value: string, bold = false) =>
    `<tr><td class="label">${label}</td><td class="${bold ? "value bold" : "value"}">${value}</td></tr>`;

  const installmentRows = data.paymentMethod === "installment" ? `
    ${rows("每期金額", `NT$ ${data.installmentAmount.toLocaleString("zh-TW")}`)}
    ${rows("已繳期數", `${data.paidPeriods} 期`)}
    ${rows("已繳金額", `NT$ ${paidAmount.toLocaleString("zh-TW")}`)}
    ${data.thirdPartyPenalty > 0 ? rows("第三方金流違約金", `NT$ ${data.thirdPartyPenalty.toLocaleString("zh-TW")}`) : ""}
  ` : "";

  const penaltyRow = data.penalty > 0
    ? rows("違約金（應退金額 × 20%）", `NT$ ${data.penalty.toLocaleString("zh-TW")}`)
    : "";

  const isStudentPays = data.resultLabel === "學員須補繳金額";

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>退課費用確認書</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 40px; max-width: 720px; margin: 0 auto; }
  .company { text-align: center; font-size: 11px; color: #666; margin-bottom: 4px; letter-spacing: 1px; }
  .title { text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 6px; letter-spacing: 2px; }
  .subtitle { text-align: center; font-size: 11px; color: #888; margin-bottom: 28px; }
  .divider { border: none; border-top: 1.5px solid #222; margin: 18px 0 12px; }
  .divider-light { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
  .section-title { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #555; text-transform: uppercase; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  .label { width: 42%; color: #555; padding: 5px 0; vertical-align: top; }
  .value { padding: 5px 0; font-weight: 500; }
  .bold { font-weight: 700; }
  .result-box { border: 2px solid #222; border-radius: 8px; padding: 20px 24px; margin: 20px 0; text-align: center; }
  .result-label { font-size: 13px; color: #555; margin-bottom: 8px; }
  .result-amount { font-size: 36px; font-weight: 800; letter-spacing: 1px; }
  .result-amount.pay { color: #c0392b; }
  .result-amount.refund { color: #1a56db; }
  .remarks-box { border: 1px solid #ccc; border-radius: 6px; min-height: 60px; padding: 10px 12px; color: #333; font-size: 13px; white-space: pre-wrap; margin-top: 8px; }
  .footer { margin-top: 32px; border-top: 1.5px solid #222; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .footer-left { font-size: 11px; color: #888; line-height: 1.8; }
  .footer-right { text-align: right; }
  .footer-company { font-size: 14px; font-weight: 700; }
  .footer-date { font-size: 11px; color: #888; margin-top: 4px; }
  .sign-line { border-top: 1px solid #999; width: 160px; margin-top: 32px; }
  .sign-label { font-size: 10px; color: #888; margin-top: 4px; }
  @media print {
    body { padding: 20px; }
    @page { margin: 15mm 15mm 15mm 15mm; }
  }
</style>
</head>
<body>
  <div class="company">晨皓教育股份有限公司</div>
  <div class="title">退課費用確認書</div>
  <div class="subtitle">Trial Calculation — For Reference Only</div>

  <hr class="divider">

  <div class="section-title">學員與課程資訊</div>
  <table>
    ${rows("學員姓名", data.studentName || "（未填寫）", true)}
    ${rows("課程方案", data.planLabel)}
    ${rows("合約開始日期", fmtDate(data.startDate))}
    ${rows("退課申請日期", fmtDate(data.requestDate))}
  </table>

  <hr class="divider-light">
  <div class="section-title">使用情況</div>
  <table>
    ${rows("已使用天數", `${data.elapsedDays} 天（期間比例 ${data.periodPct.toFixed(1)}%）`)}
    ${rows("已使用 Mentor 次數", `${data.usedSessions} / ${data.mentorTotal} 次（次數比例 ${data.usedPct.toFixed(1)}%）`)}
    ${rows("採計比例（取較高值）", `${Math.max(data.periodPct, data.usedPct).toFixed(1)}%`, true)}
    ${rows("適用退費規則", `${data.rule}　${data.ruleDetail}`)}
    ${rows("可歸責學員", data.isFault ? "是" : "否")}
  </table>

  <hr class="divider-light">
  <div class="section-title">費用計算</div>
  <table>
    ${rows("課程總價", `NT$ ${data.price.toLocaleString("zh-TW")}`)}
    ${rows("付款方式", data.paymentMethod === "onetime" ? "一次付清" : "分期付款")}
    ${installmentRows}
    ${rows(`公司應退金額（${refundPct}%）`, `NT$ ${data.refundBase.toLocaleString("zh-TW")}`)}
    ${penaltyRow}
  </table>

  <div class="result-box">
    <div class="result-label">${data.resultLabel}</div>
    <div class="result-amount ${isStudentPays ? "pay" : "refund"}">NT$ ${fmtNum(data.resultAmount)}</div>
  </div>

  <div class="section-title">備註</div>
  <div class="remarks-box">${data.remarks || "（無）"}</div>

  <div class="footer">
    <div class="footer-left">
      本試算結果僅供參考，實際退費金額<br>
      依合約條款及相關法規為最終依據。
    </div>
    <div class="footer-right">
      <div class="footer-company">晨皓教育股份有限公司</div>
      <div class="footer-date">試算日期：${fmtDate(data.today)}</div>
      <div style="display:flex; gap:32px; justify-content:flex-end; margin-top:24px;">
        <div>
          <div class="sign-line"></div>
          <div class="sign-label">公司代表人</div>
        </div>
        <div>
          <div class="sign-line"></div>
          <div class="sign-label">學員確認簽名</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default function Page() {
  const today = new Date().toISOString().split("T")[0];

  const [planKey, setPlanKey] = useState<PlanKey>(PLANS[0].key);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("onetime");
  const [studentName, setStudentName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [requestDate, setRequestDate] = useState(today);
  const [usedSessions, setUsedSessions] = useState(0);
  const [price, setPrice] = useState<number>(PLANS[0].price);
  const [isFault, setIsFault] = useState(false);
  const [installmentAmount, setInstallmentAmount] = useState<number>(0);
  const [paidPeriods, setPaidPeriods] = useState<number>(0);
  const [thirdPartyPenalty, setThirdPartyPenalty] = useState<number>(0);
  const [remarks, setRemarks] = useState("");

  const plan = PLANS.find((p) => p.key === planKey)!;

  function handlePlanChange(key: PlanKey) {
    const selected = PLANS.find((p) => p.key === key)!;
    setPlanKey(key);
    setPrice(selected.price);
    setUsedSessions(0);
  }

  const base = useMemo<CalcResult | null>(() => {
    if (!startDate || !requestDate) return null;
    const s = new Date(startDate);
    const r = new Date(requestDate);
    if (isNaN(s.getTime()) || isNaN(r.getTime()) || r < s) return null;
    return calcBase(s, r, usedSessions, plan.mentorTotal, price, isFault);
  }, [startDate, requestDate, usedSessions, plan.mentorTotal, price, isFault]);

  // 結算邏輯
  const settlementInfo = useMemo<{ label: string; amount: number } | null>(() => {
    if (!base) return null;
    if (paymentMethod === "onetime") {
      // 一次付清：公司退還 = 應退金額 − 違約金
      return { label: "應退學員金額", amount: base.refundBase - base.penalty };
    }
    // 分期付款：差額 = 學員應付費用 − 已繳金額
    // 學員應付費用 = (課程總價 − 公司應退金額) + 第三方金流違約金 + 違約金
    const paidAmount = installmentAmount * paidPeriods;
    const studentOwes = (price - base.refundBase) + thirdPartyPenalty + base.penalty;
    const diff = studentOwes - paidAmount;
    if (diff > 0) return { label: "學員須補繳金額", amount: diff };
    return { label: "公司應退學員", amount: -diff };
  }, [base, paymentMethod, price, installmentAmount, paidPeriods, thirdPartyPenalty]);

  function handlePrint() {
    if (!base || !settlementInfo) return;
    const html = generateReceiptHTML({
      studentName,
      planLabel: plan.label,
      startDate,
      requestDate,
      elapsedDays: base.elapsedDays,
      periodPct: base.periodPct,
      usedSessions,
      mentorTotal: plan.mentorTotal,
      usedPct: base.usedPct,
      price,
      paymentMethod,
      installmentAmount,
      paidPeriods,
      thirdPartyPenalty,
      rule: base.rule,
      ruleDetail: base.ruleDetail,
      refundRate: base.refundRate,
      refundBase: base.refundBase,
      penalty: base.penalty,
      isFault,
      resultLabel: settlementInfo.label,
      resultAmount: settlementInfo.amount,
      remarks,
      today,
    });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  const ruleColor: Record<string, string> = {
    規則一: "bg-green-50 border-green-400 text-green-800",
    規則二: "bg-green-50 border-green-400 text-green-800",
    規則三: "bg-yellow-50 border-yellow-400 text-yellow-800",
    規則四: "bg-orange-50 border-orange-400 text-orange-800",
    規則五: "bg-red-50 border-red-400 text-red-800",
  };

  const isStudentPays = settlementInfo?.label === "學員須補繳金額";

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">退課費用試算系統</h1>
          <p className="text-sm text-gray-500 mt-1">晨皓教育股份有限公司・合約期間 6 個月（180 天）</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">

          {/* 學員姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">學員姓名</label>
            <input type="text" value={studentName} placeholder="請輸入學員姓名"
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* 課程方案 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">課程方案</label>
            <div className="space-y-2">
              {PLANS.map((p) => (
                <label key={p.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    planKey === p.key ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="plan" value={p.key} checked={planKey === p.key}
                    onChange={() => handlePlanChange(p.key)} className="mt-0.5 accent-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{p.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      定價 NT$ {p.price.toLocaleString("zh-TW")}・Mentor {p.mentorTotal} 次
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 付款方式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">付款方式</label>
            <div className="flex gap-6">
              {(["onetime", "installment"] as PaymentMethod[]).map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="payment" value={m} checked={paymentMethod === m}
                    onChange={() => setPaymentMethod(m)} className="accent-blue-500" />
                  <span className="text-sm text-gray-700">{m === "onetime" ? "一次付清" : "分期付款"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 分期付款欄位 */}
          {paymentMethod === "installment" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">每期金額（元）</label>
                <input type="number" value={installmentAmount || ""} min={0} placeholder="輸入每期金額"
                  onChange={(e) => setInstallmentAmount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">已繳納期數</label>
                <input type="number" value={paidPeriods || ""} min={0} placeholder="輸入已繳期數"
                  onChange={(e) => setPaidPeriods(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                {installmentAmount > 0 && paidPeriods > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    已繳金額：NT$ {(installmentAmount * paidPeriods).toLocaleString("zh-TW")}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">第三方金流違約金（元）</label>
                <input type="number" value={thirdPartyPenalty || ""} min={0} placeholder="0"
                  onChange={(e) => setThirdPartyPenalty(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <p className="text-xs text-gray-400 mt-1">請向金流公司確認後填入</p>
              </div>
            </div>
          )}

          {/* 日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">合約開始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">提出退課日期</label>
            <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* Mentor 次數 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              已使用 Mentor 次數（共 {plan.mentorTotal} 次）
            </label>
            <div className="flex items-center gap-4">
              <input type="range" min={0} max={plan.mentorTotal} value={usedSessions}
                onChange={(e) => setUsedSessions(Number(e.target.value))}
                className="flex-1 accent-blue-500" />
              <span className="w-8 text-center font-semibold text-gray-800">{usedSessions}</span>
            </div>
          </div>

          {/* 課程總價 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              課程總價（元）
              <span className="ml-1 text-xs font-normal text-gray-400">可依實際付款金額修改</span>
            </label>
            <input type="number" value={price} min={0} onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* 可歸責學員 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input type="checkbox" id="isFault" checked={isFault}
              onChange={(e) => setIsFault(e.target.checked)} className="w-4 h-4 accent-blue-500" />
            <label htmlFor="isFault" className="text-sm text-gray-700 leading-snug">
              可歸責學員（退費可扣除違約金 = 應退金額 × 20%）
            </label>
          </div>
        </div>

        {/* 試算結果 */}
        {base && settlementInfo && (
          <div className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3">試算結果</h2>

            <div className="grid grid-cols-2 gap-3">
              <Metric label="已過天數" value={`${base.elapsedDays} 天`} sub={`期間比例 ${base.periodPct.toFixed(1)}%`} />
              <Metric label="已使用次數" value={`${usedSessions} / ${plan.mentorTotal} 次`} sub={`次數比例 ${base.usedPct.toFixed(1)}%`} />
            </div>

            <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-lg py-2">
              採用較高比例計算：
              <span className="font-semibold text-gray-800"> {base.effectivePct.toFixed(1)}%</span>
            </div>

            <div className={`rounded-lg border-l-4 px-4 py-3 text-sm font-medium ${ruleColor[base.rule] ?? "bg-gray-50 border-gray-400 text-gray-800"}`}>
              <div className="font-bold mb-0.5">{base.rule}</div>
              <div className="font-normal opacity-80">{base.ruleDetail}</div>
            </div>

            <div className="space-y-2">
              <Row label="課程總價" value={`NT$ ${fmtNum(price)}`} />
              <Row label={`公司應退金額（${Math.round(base.refundRate * 100)}%）`} value={`NT$ ${fmtNum(base.refundBase)}`} />

              {paymentMethod === "installment" && (
                <>
                  <Row
                    label={`已繳金額（${paidPeriods} 期 × NT$ ${fmtNum(installmentAmount)}）`}
                    value={`NT$ ${fmtNum(installmentAmount * paidPeriods)}`} />
                  {thirdPartyPenalty > 0 && (
                    <Row label="第三方金流違約金" value={`NT$ ${fmtNum(thirdPartyPenalty)}`} red />
                  )}
                </>
              )}

              {base.penalty > 0 && (
                <Row label="違約金（應退金額 × 20%）" value={`NT$ ${fmtNum(base.penalty)}`} red />
              )}

              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-base font-bold text-gray-800">{settlementInfo.label}</span>
                <span className={`text-2xl font-bold ${isStudentPays ? "text-red-500" : "text-blue-600"}`}>
                  NT$ {fmtNum(settlementInfo.amount)}
                </span>
              </div>
            </div>

            {/* 備註 + 產生收據 */}
            <div className="pt-1 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註（選填，會出現在收據上）</label>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  rows={2} placeholder="例如：已簽署退課同意書、退款帳戶資訊…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>
              <button onClick={handlePrint}
                className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-900 text-white font-medium py-3 rounded-xl text-sm transition-colors">
                產生退課收據（可列印 / 儲存 PDF）
              </button>
            </div>
          </div>
        )}

        {!startDate && (
          <p className="text-center text-gray-400 text-sm mt-6">請填入合約開始日期以開始試算</p>
        )}

        <details className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <summary className="text-sm font-medium text-gray-600 cursor-pointer">退費規則說明</summary>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            {[
              "規則一：契約生效後 7 日內，且未使用任何 Mentor 次數 → 全額退還",
              "規則二：使用比例（期間或次數）未逾 10% → 全額退還",
              "規則三：逾 10% 未逾 30% → 退還 80%（可歸責學員另扣違約金）",
              "規則四：逾 30% 未逾 50% → 退還 50%（可歸責學員另扣違約金）",
              "規則五：逾 50% → 不退款",
            ].map((r, i) => <li key={i} className="leading-relaxed">{r}</li>)}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            使用比例取「期間比例」與「次數比例」兩者較高者。違約金 = 應退金額 × 20%。
          </p>
        </details>

        <p className="text-center text-xs text-gray-400 mt-6 mb-4">
          本試算結果僅供參考，實際退費依合約及法規為準。
        </p>
      </div>
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-800 mt-0.5">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function Row({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={red ? "text-red-500 font-medium" : "text-gray-800 font-medium"}>{value}</span>
    </div>
  );
}
