"use client";

import { useState, useMemo } from "react";

const CONTRACT_DAYS = 180;

const PLANS = [
  {
    key: "uiux-portfolio",
    label: "產品設計【UIUX 作品班】",
    price: 46800,
    mentorTotal: 14,
  },
  {
    key: "uiux-project",
    label: "產品設計【UIUX 專案班】",
    price: 96800,
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
  refundBase: number;    // 公司應退金額（退費比例 × 總價）
  penalty: number;       // 違約金（應退金額 × 20%）
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

  let rule = "";
  let ruleDetail = "";
  let refundRate = 0;

  if (elapsedDays <= 7 && usedSessions === 0) {
    rule = "規則一";
    ruleDetail = "契約生效後 7 日內且未使用任何 Mentor 次數 → 全額退還";
    refundRate = 1;
  } else if (effectivePct <= 10) {
    rule = "規則二";
    ruleDetail = "使用比例未逾 10% → 全額退還";
    refundRate = 1;
  } else if (effectivePct <= 30) {
    rule = "規則三";
    ruleDetail = "使用比例逾 10% 未逾 30% → 退還 80%";
    refundRate = 0.8;
  } else if (effectivePct <= 50) {
    rule = "規則四";
    ruleDetail = "使用比例逾 30% 未逾 50% → 退還 50%";
    refundRate = 0.5;
  } else {
    rule = "規則五";
    ruleDetail = "使用比例逾 50% → 不退款";
    refundRate = 0;
  }

  const refundBase = Math.round(price * refundRate);
  // 違約金 = 應退金額 × 20%（僅在部分退款 + 可歸責時適用）
  const penalty =
    isFault && refundRate > 0 && refundRate < 1
      ? Math.round(refundBase * 0.2)
      : 0;

  return {
    elapsedDays, periodPct, usedPct, effectivePct,
    rule, ruleDetail, refundRate, refundBase, penalty,
  };
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("zh-TW");
}

export default function Page() {
  const today = new Date().toISOString().split("T")[0];

  const [planKey, setPlanKey] = useState<PlanKey>(PLANS[0].key);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("onetime");
  const [startDate, setStartDate] = useState("");
  const [requestDate, setRequestDate] = useState(today);
  const [usedSessions, setUsedSessions] = useState(0);
  const [price, setPrice] = useState<number>(PLANS[0].price);
  const [isFault, setIsFault] = useState(false);

  // 分期付款欄位
  const [installmentAmount, setInstallmentAmount] = useState<number>(0);
  const [paidPeriods, setPaidPeriods] = useState<number>(0);
  const [thirdPartyPenalty, setThirdPartyPenalty] = useState<number>(0);

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

  // 最終結算數字
  const settlement = useMemo(() => {
    if (!base) return null;
    if (paymentMethod === "onetime") {
      return base.refundBase - base.penalty; // 公司退還學員
    }
    const paidAmount = installmentAmount * paidPeriods;
    return base.refundBase - paidAmount - thirdPartyPenalty - base.penalty;
  }, [base, paymentMethod, installmentAmount, paidPeriods, thirdPartyPenalty]);

  const ruleColor: Record<string, string> = {
    規則一: "bg-green-50 border-green-400 text-green-800",
    規則二: "bg-green-50 border-green-400 text-green-800",
    規則三: "bg-yellow-50 border-yellow-400 text-yellow-800",
    規則四: "bg-orange-50 border-orange-400 text-orange-800",
    規則五: "bg-red-50 border-red-400 text-red-800",
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">退課費用試算系統</h1>
          <p className="text-sm text-gray-500 mt-1">合約期間 6 個月（180 天）</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          {/* 課程方案 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              課程方案
            </label>
            <div className="space-y-2">
              {PLANS.map((p) => (
                <label
                  key={p.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    planKey === p.key
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={p.key}
                    checked={planKey === p.key}
                    onChange={() => handlePlanChange(p.key)}
                    className="mt-0.5 accent-blue-500"
                  />
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              付款方式
            </label>
            <div className="flex gap-4">
              {(["onetime", "installment"] as PaymentMethod[]).map((m) => (
                <label key={m} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payment"
                    value={m}
                    checked={paymentMethod === m}
                    onChange={() => setPaymentMethod(m)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    {m === "onetime" ? "一次付清" : "分期付款"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 分期付款額外欄位 */}
          {paymentMethod === "installment" && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  每期金額（元）
                </label>
                <input
                  type="number"
                  value={installmentAmount || ""}
                  min={0}
                  placeholder="輸入每期金額"
                  onChange={(e) => setInstallmentAmount(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  已繳納期數
                </label>
                <input
                  type="number"
                  value={paidPeriods || ""}
                  min={0}
                  placeholder="輸入已繳期數"
                  onChange={(e) => setPaidPeriods(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {installmentAmount > 0 && paidPeriods > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    已繳金額：NT$ {(installmentAmount * paidPeriods).toLocaleString("zh-TW")}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  第三方金流違約金（元）
                </label>
                <input
                  type="number"
                  value={thirdPartyPenalty || ""}
                  min={0}
                  placeholder="0"
                  onChange={(e) => setThirdPartyPenalty(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-gray-400 mt-1">請向金流公司確認後填入</p>
              </div>
            </div>
          )}

          {/* 日期 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              合約開始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              提出退課日期
            </label>
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Mentor 次數 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              已使用 Mentor 次數（共 {plan.mentorTotal} 次）
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={plan.mentorTotal}
                value={usedSessions}
                onChange={(e) => setUsedSessions(Number(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="w-8 text-center font-semibold text-gray-800">
                {usedSessions}
              </span>
            </div>
          </div>

          {/* 課程總價 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              課程總價（元）
              <span className="ml-1 text-xs font-normal text-gray-400">
                可依實際付款金額修改
              </span>
            </label>
            <input
              type="number"
              value={price}
              min={0}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* 可歸責學員 */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="isFault"
              checked={isFault}
              onChange={(e) => setIsFault(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="isFault" className="text-sm text-gray-700 leading-snug">
              可歸責學員（退費可扣除違約金）
            </label>
          </div>
        </div>

        {/* 試算結果 */}
        {base && settlement !== null && (
          <div className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-3">
              試算結果
            </h2>

            {/* 比例卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="已過天數"
                value={`${base.elapsedDays} 天`}
                sub={`期間比例 ${base.periodPct.toFixed(1)}%`}
              />
              <Metric
                label="已使用次數"
                value={`${usedSessions} / ${plan.mentorTotal} 次`}
                sub={`次數比例 ${base.usedPct.toFixed(1)}%`}
              />
            </div>

            <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-lg py-2">
              採用較高比例計算：
              <span className="font-semibold text-gray-800">
                {" "}{base.effectivePct.toFixed(1)}%
              </span>
            </div>

            {/* 適用規則 */}
            <div
              className={`rounded-lg border-l-4 px-4 py-3 text-sm font-medium ${
                ruleColor[base.rule] ?? "bg-gray-50 border-gray-400 text-gray-800"
              }`}
            >
              <div className="font-bold mb-0.5">{base.rule}</div>
              <div className="font-normal opacity-80">{base.ruleDetail}</div>
            </div>

            {/* 金額明細 */}
            <div className="space-y-2">
              <Row label="課程總價" value={`NT$ ${fmt(price)}`} />
              <Row
                label={`公司應退金額（${Math.round(base.refundRate * 100)}%）`}
                value={`NT$ ${fmt(base.refundBase)}`}
              />

              {paymentMethod === "installment" && (
                <>
                  <Row
                    label={`已繳金額（${paidPeriods} 期 × NT$ ${fmt(installmentAmount)}）`}
                    value={`− NT$ ${fmt(installmentAmount * paidPeriods)}`}
                    red
                  />
                  {thirdPartyPenalty > 0 && (
                    <Row
                      label="第三方金流違約金"
                      value={`− NT$ ${fmt(thirdPartyPenalty)}`}
                      red
                    />
                  )}
                </>
              )}

              {base.penalty > 0 && (
                <Row
                  label={`違約金（應退金額 × 20%）`}
                  value={`− NT$ ${fmt(base.penalty)}`}
                  red
                />
              )}

              {/* 最終結算 */}
              <div className="border-t pt-3">
                {settlement >= 0 ? (
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-gray-800">
                      公司退還學員
                    </span>
                    <span className="text-2xl font-bold text-blue-600">
                      NT$ {fmt(settlement)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-base font-bold text-gray-800">
                      學員須補繳公司
                    </span>
                    <span className="text-2xl font-bold text-red-500">
                      NT$ {fmt(settlement)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!startDate && (
          <p className="text-center text-gray-400 text-sm mt-6">
            請填入合約開始日期以開始試算
          </p>
        )}

        {/* 規則說明 */}
        <details className="mt-5 bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <summary className="text-sm font-medium text-gray-600 cursor-pointer">
            退費規則說明
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            {[
              "規則一：契約生效後 7 日內，且未使用任何 Mentor 次數 → 全額退還",
              "規則二：使用比例（期間或次數）未逾 10% → 全額退還",
              "規則三：逾 10% 未逾 30% → 退還 80%（可歸責學員另扣違約金）",
              "規則四：逾 30% 未逾 50% → 退還 50%（可歸責學員另扣違約金）",
              "規則五：逾 50% → 不退款",
            ].map((r, i) => (
              <li key={i} className="leading-relaxed">{r}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            使用比例取「期間比例」與「次數比例」兩者較高者計算。
            違約金 = 應退金額 × 20%。
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
      <span className={red ? "text-red-500 font-medium" : "text-gray-800 font-medium"}>
        {value}
      </span>
    </div>
  );
}
