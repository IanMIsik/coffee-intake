import type { DashboardSummary, DayBreakdown } from "@coffee/shared";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

type Preset = "7d" | "30d" | "month" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

function addDaysStr(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from, i = 0; d <= to && i < 366; d = addDaysStr(d, 1), i++) days.push(d);
  return days;
}

function fmtDay(date: string, long = false): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const kg = (n: string | number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });

function rangeFor(preset: Preset, customFrom: string, customTo: string, today: string) {
  if (preset === "7d") return { from: addDaysStr(today, -6), to: today };
  if (preset === "30d") return { from: addDaysStr(today, -29), to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return { from: customFrom, to: customTo };
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-black/10 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(addDaysStr(todayStr(), -6));
  const [customTo, setCustomTo] = useState(todayStr());
  // The server says what "today" is in the organization's time zone; the device clock may differ.
  const [today, setToday] = useState(todayStr());
  const [selectedDate, setSelectedDate] = useState("");
  const [day, setDay] = useState<DayBreakdown | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const range = useMemo(
    () => rangeFor(preset, customFrom, customTo, today),
    [preset, customFrom, customTo, today]
  );

  useEffect(() => {
    if (!range.from || !range.to || range.from > range.to) return;
    setError(null);
    api
      .getDashboardSummary(range)
      .then((d) => {
        setData(d);
        setToday((t) => (t === d.today ? t : d.today));
        setSelectedDate((s) => s || d.today);
      })
      .catch(() => setError("Failed to load the dashboard."));
  }, [range]);

  useEffect(() => {
    if (!selectedDate) return;
    setDayLoading(true);
    api
      .getDashboardDay(selectedDate)
      .then(setDay)
      .catch(() => setDay(null))
      .finally(() => setDayLoading(false));
  }, [selectedDate]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-coffee-400">Loading...</p>;

  const todayKg = Number(data.todayKg);
  const yesterdayKg = Number(data.yesterdayKg);
  const delta = yesterdayKg > 0 ? ((todayKg - yesterdayKg) / yesterdayKg) * 100 : null;

  const byDate = new Map(data.dailyBreakdown.map((d) => [d.date, d]));
  const days = eachDay(data.range.from, data.range.to).map((date) => ({
    date,
    kg: Number(byDate.get(date)?.totalKg ?? 0),
    receipts: byDate.get(date)?.receiptCount ?? 0,
  }));
  const maxKg = Math.max(1, ...days.map((d) => d.kg));
  const rangeTotal = Number(data.rangeTotals.totalKg);
  const rangeSettled = Number(data.rangeTotals.settledKg);

  return (
    <div className="space-y-5">
      {/* Today hero */}
      <div className="rounded-2xl bg-coffee-700 text-white p-5 shadow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-coffee-100">
              Today · {fmtDay(data.today, true)}
            </div>
            <div className="text-4xl font-bold mt-1">{kg(todayKg)} kg</div>
            <div className="text-sm text-coffee-100 mt-1">
              {data.todayReceiptCount} {data.todayReceiptCount === 1 ? "delivery" : "deliveries"} from{" "}
              {data.todayFarmerCount} {data.todayFarmerCount === 1 ? "farmer" : "farmers"}
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="text-coffee-100">vs yesterday</div>
            {delta === null ? (
              <div className="font-semibold">{yesterdayKg === 0 && todayKg > 0 ? "First deliveries" : "—"}</div>
            ) : (
              <div className={`font-semibold ${delta >= 0 ? "text-green-300" : "text-amber-300"}`}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
              </div>
            )}
            <div className="text-xs text-coffee-100">{kg(yesterdayKg)} kg</div>
          </div>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-coffee-400">Registered farmers</div>
          <div className="text-2xl font-bold text-coffee-600">{data.totalFarmers}</div>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-coffee-400">All-time cherry received</div>
          <div className="text-2xl font-bold text-coffee-600">{kg(data.totalKgAllTime)} kg</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="text-xs text-amber-700">Awaiting settlement</div>
          <div className="text-2xl font-bold text-amber-700">{kg(data.unsettledKgAllTime)} kg</div>
          <div className="text-xs text-amber-700">{data.unsettledReceiptCount} unsettled receipts</div>
        </div>
      </div>

      {data.unsettledFarmers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-1">Who is owed</h2>
          <p className="text-xs text-coffee-400 mb-3">
            Farmers with the most unsettled cherry. Open one to mark receipts settled.
          </p>
          <div className="divide-y">
            {data.unsettledFarmers.map((f) => (
              <Link
                key={f.farmerId}
                to={`/app/farmers/${f.farmerId}`}
                className="flex items-center justify-between py-2 hover:bg-coffee-50 -mx-2 px-2 rounded"
              >
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-coffee-400">
                    {f.receiptCount} unsettled {f.receiptCount === 1 ? "receipt" : "receipts"}
                  </div>
                </div>
                <div className="font-semibold text-amber-700">{kg(f.unsettledKg)} kg</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Range picker + chart */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-full px-3 py-1 text-sm ${
                preset === p.id ? "bg-coffee-600 text-white" : "bg-coffee-50 text-coffee-600"
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-coffee-400">to</span>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div>
            <div className="text-xl font-bold text-coffee-600">{kg(rangeTotal)} kg</div>
            <div className="text-xs text-coffee-400">received</div>
          </div>
          <div>
            <div className="text-xl font-bold text-coffee-600">{data.rangeTotals.receiptCount}</div>
            <div className="text-xs text-coffee-400">deliveries</div>
          </div>
          <div>
            <div className="text-xl font-bold text-coffee-600">{data.rangeTotals.farmerCount}</div>
            <div className="text-xs text-coffee-400">farmers</div>
          </div>
        </div>
        <div className="mb-1 flex justify-between text-xs text-coffee-400">
          <span>Settled {kg(rangeSettled)} kg</span>
          <span>Not settled {kg(rangeTotal - rangeSettled)} kg</span>
        </div>
        <div className="mb-5">
          <ProgressBar value={rangeSettled} total={rangeTotal} color="bg-green-500" />
        </div>

        <h2 className="font-semibold mb-1">Daily totals</h2>
        <p className="text-xs text-coffee-400 mb-3">Tap a day to see each farmer's total for it.</p>
        <div className="flex items-end gap-1 h-44 overflow-x-auto pb-1">
          {days.map((d) => {
            const selected = d.date === selectedDate;
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                title={`${fmtDay(d.date, true)}: ${kg(d.kg)} kg, ${d.receipts} ${d.receipts === 1 ? "delivery" : "deliveries"}`}
                className="flex-1 min-w-[22px] h-full flex flex-col items-center justify-end group"
              >
                <span className="text-[10px] text-coffee-400 mb-0.5">
                  {days.length <= 14 && d.kg > 0 ? kg(d.kg) : ""}
                </span>
                <div
                  className={`w-full rounded-t transition-colors ${
                    selected ? "bg-coffee-700" : d.kg > 0 ? "bg-coffee-400 group-hover:bg-coffee-600" : "bg-coffee-100"
                  }`}
                  style={{ height: `${Math.max(d.kg > 0 ? 6 : 2, (d.kg / maxKg) * 100)}%` }}
                />
              </button>
            );
          })}
        </div>
        <div className="flex gap-1">
          {days.map((d) => (
            <div
              key={d.date}
              className={`flex-1 min-w-[22px] text-center text-[10px] ${
                d.date === selectedDate ? "font-bold text-coffee-700" : "text-coffee-400"
              }`}
            >
              {days.length <= 14
                ? new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, {
                    weekday: "short",
                    timeZone: "UTC",
                  })
                : ""}
              <div>{new Date(`${d.date}T00:00:00Z`).getUTCDate()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected day: farmer by farmer */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold">{fmtDay(selectedDate, true)}</h2>
            <p className="text-xs text-coffee-400">Farmer-by-farmer for this day</p>
          </div>
          {day && day.farmerCount > 0 && (
            <div className="text-right">
              <div className="text-xl font-bold text-coffee-600">{kg(day.totalKg)} kg</div>
              <div className="text-xs text-coffee-400">
                {day.receiptCount} deliveries · {day.farmerCount} farmers
              </div>
            </div>
          )}
        </div>
        {dayLoading ? (
          <p className="text-sm text-coffee-400">Loading...</p>
        ) : !day || day.farmers.length === 0 ? (
          <p className="text-sm text-coffee-400">No deliveries recorded on this day.</p>
        ) : (
          <div className="space-y-3">
            {day.farmers.map((f) => {
              const fullySettled = Number(f.settledKg) >= Number(f.totalKg);
              return (
                <Link key={f.farmerId} to={`/app/farmers/${f.farmerId}`} className="block hover:bg-coffee-50 -mx-2 px-2 py-1 rounded">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{f.name}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`text-[10px] rounded px-1.5 py-0.5 ${
                          fullySettled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {fullySettled ? "Settled" : "Not settled"}
                      </span>
                      <span className="font-semibold">{kg(f.totalKg)} kg</span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={Number(f.totalKg)} total={Number(day.farmers[0].totalKg)} color="bg-coffee-400" />
                  </div>
                  <div className="text-xs text-coffee-400 mt-0.5">
                    {f.receiptCount} {f.receiptCount === 1 ? "delivery" : "deliveries"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      {data.topFarmersInRange.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-3">Top farmers in this range</h2>
          <div className="space-y-3">
            {data.topFarmersInRange.map((f, i) => (
              <Link key={f.farmerId} to={`/app/farmers/${f.farmerId}`} className="block">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    <span className="text-coffee-400 mr-2">{i + 1}.</span>
                    <span className="font-medium">{f.name}</span>
                  </span>
                  <span className="font-semibold">{kg(f.totalKg)} kg</span>
                </div>
                <div className="mt-1">
                  <ProgressBar
                    value={Number(f.totalKg)}
                    total={Number(data.topFarmersInRange[0].totalKg)}
                    color="bg-coffee-600"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
