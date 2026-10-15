import type { DashboardSummary, DayBreakdown } from "@coffee/shared";
import { formatMoney } from "@coffee/shared";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api } from "../lib/api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;
type Preset = "7d" | "30d" | "month";

const BROWN = "#2b6a4b";
const DARK = "#1d4d36";
const MUTED = "#7b7266";

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

function rangeFor(preset: Preset, today: string) {
  if (preset === "7d") return { from: addDaysStr(today, -6), to: today };
  if (preset === "30d") return { from: addDaysStr(today, -29), to: today };
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function Bar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: "#e8e0d3", overflow: "hidden" }}>
      <View style={{ height: 8, width: `${pct}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: "white", borderRadius: 16, padding: 14, marginBottom: 12 }}>
      {children}
    </View>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("7d");
  // The server says what "today" is in the organization's time zone; the phone's clock may differ.
  const [today, setToday] = useState(todayStr());
  const [selectedDate, setSelectedDate] = useState("");
  const [day, setDay] = useState<DayBreakdown | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      setError(null);
      const d = await api.getDashboardSummary(rangeFor(preset, today));
      setData(d);
      setToday((t) => (t === d.today ? t : d.today));
      setSelectedDate((s) => s || d.today);
    } catch {
      setError("Couldn't load the dashboard. Check your connection and pull down to retry.");
    }
  }, [preset, today]);

  const loadDay = useCallback(async () => {
    if (!selectedDate) return;
    setDayLoading(true);
    try {
      setDay(await api.getDashboardDay(selectedDate));
    } catch {
      setDay(null);
    } finally {
      setDayLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadDay();
  }, [loadDay]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadSummary(), loadDay()]);
    setRefreshing(false);
  }

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f6f2ea", padding: 24 }}>
        {error ? <Text style={{ color: "#b73a2c", textAlign: "center" }}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const todayKg = Number(data.todayKg);
  const yesterdayKg = Number(data.yesterdayKg);
  const delta = yesterdayKg > 0 ? ((todayKg - yesterdayKg) / yesterdayKg) * 100 : null;

  const byDate = new Map(data.dailyBreakdown.map((d) => [d.date, d]));
  const days = eachDay(data.range.from, data.range.to).map((date) => ({
    date,
    kg: Number(byDate.get(date)?.totalKg ?? 0),
  }));
  const maxKg = Math.max(1, ...days.map((d) => d.kg));
  const rangeTotal = Number(data.rangeTotals.totalKg);
  const rangeSettled = Number(data.rangeTotals.settledKg);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f6f2ea" }}
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Today hero */}
      <View style={{ backgroundColor: BROWN, borderRadius: 16, padding: 18, marginBottom: 12 }}>
        <Text style={{ color: "#e4eee7", fontSize: 11, letterSpacing: 1 }}>
          TODAY · {fmtDay(data.today, true).toUpperCase()}
        </Text>
        <Text style={{ color: "white", fontSize: 38, fontWeight: "700", marginTop: 4 }}>
          {kg(todayKg)} kg
        </Text>
        <Text style={{ color: "#e4eee7", marginTop: 2 }}>
          {data.todayReceiptCount} {data.todayReceiptCount === 1 ? "delivery" : "deliveries"} from{" "}
          {data.todayFarmerCount} {data.todayFarmerCount === 1 ? "farmer" : "farmers"}
        </Text>
        <Text style={{ color: delta !== null && delta < 0 ? "#fcd34d" : "#cfe0d5", marginTop: 8, fontWeight: "600" }}>
          {delta === null
            ? yesterdayKg === 0 && todayKg > 0
              ? "First deliveries after a quiet day"
              : "No deliveries yesterday"
            : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(0)}% vs yesterday (${kg(yesterdayKg)} kg)`}
        </Text>
      </View>

      {/* Key numbers */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <View style={{ flex: 1, backgroundColor: "white", borderRadius: 16, padding: 12 }}>
          <Text style={{ color: MUTED, fontSize: 11 }}>Farmers</Text>
          <Text style={{ color: BROWN, fontSize: 22, fontWeight: "700" }}>{data.totalFarmers}</Text>
        </View>
        <View style={{ flex: 1.4, backgroundColor: "white", borderRadius: 16, padding: 12 }}>
          <Text style={{ color: MUTED, fontSize: 11 }}>All-time received</Text>
          <Text style={{ color: BROWN, fontSize: 22, fontWeight: "700" }}>{kg(data.totalKgAllTime)} kg</Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: "#f8ecc9",
          borderColor: "#fde68a",
          borderWidth: 1,
          borderRadius: 16,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "#8a6414", fontSize: 11 }}>Awaiting settlement</Text>
        <Text style={{ color: "#8a6414", fontSize: 24, fontWeight: "700" }}>
          {kg(data.unsettledKgAllTime)} kg
        </Text>
        <Text style={{ color: "#8a6414", fontSize: 12 }}>{data.unsettledReceiptCount} deliveries not fully paid</Text>
        <Text style={{ color: "#8a6414", fontSize: 15, fontWeight: "700", marginTop: 4 }}>{formatMoney(data.amountOwed)} owed</Text>
        {Number(data.unpricedKg) > 0 && (
          <Text style={{ color: "#8a6414", fontSize: 12 }}>{kg(data.unpricedKg)} kg has no price yet</Text>
        )}
        {data.unsettledFarmers.map((f) => (
          <TouchableOpacity
            key={f.farmerId}
            onPress={() => navigation.navigate("FarmerDetail", { farmerId: f.farmerId, farmerName: f.name })}
            style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 10 }}
          >
            <Text style={{ color: DARK }}>{f.name}</Text>
            <Text style={{ color: "#8a6414", fontWeight: "600" }}>{kg(f.unsettledKg)} kg · {formatMoney(f.amountOwed)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Range + chart */}
      <Card>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {([
            ["7d", "7 days"],
            ["30d", "30 days"],
            ["month", "This month"],
          ] as [Preset, string][]).map(([id, label]) => (
            <TouchableOpacity
              key={id}
              onPress={() => setPreset(id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: preset === id ? BROWN : "#f6f2ea",
              }}
            >
              <Text style={{ color: preset === id ? "white" : BROWN, fontSize: 13 }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 12 }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: BROWN, fontSize: 18, fontWeight: "700" }}>{kg(rangeTotal)} kg</Text>
            <Text style={{ color: MUTED, fontSize: 11 }}>received</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: BROWN, fontSize: 18, fontWeight: "700" }}>{data.rangeTotals.receiptCount}</Text>
            <Text style={{ color: MUTED, fontSize: 11 }}>deliveries</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: BROWN, fontSize: 18, fontWeight: "700" }}>{data.rangeTotals.farmerCount}</Text>
            <Text style={{ color: MUTED, fontSize: 11 }}>farmers</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ color: MUTED, fontSize: 11 }}>Settled {kg(rangeSettled)} kg</Text>
          <Text style={{ color: MUTED, fontSize: 11 }}>Not settled {kg(rangeTotal - rangeSettled)} kg</Text>
        </View>
        <Bar value={rangeSettled} total={rangeTotal} color="#22c55e" />

        <Text style={{ fontWeight: "600", color: DARK, marginTop: 16 }}>Daily totals</Text>
        <Text style={{ color: MUTED, fontSize: 11, marginBottom: 8 }}>
          Tap a day to see each farmer's total for it.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: 150 }}>
            {days.map((d) => {
              const selected = d.date === selectedDate;
              const barHeight = Math.max(d.kg > 0 ? 6 : 2, (d.kg / maxKg) * 110);
              return (
                <TouchableOpacity
                  key={d.date}
                  onPress={() => setSelectedDate(d.date)}
                  style={{ width: 34, alignItems: "center", justifyContent: "flex-end", height: 150 }}
                >
                  <Text style={{ fontSize: 9, color: MUTED }}>{d.kg > 0 ? kg(d.kg) : ""}</Text>
                  <View
                    style={{
                      width: 22,
                      height: barHeight,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      backgroundColor: selected ? DARK : d.kg > 0 ? "#c8962e" : "#e8e0d3",
                    }}
                  />
                  <Text style={{ fontSize: 10, marginTop: 3, color: selected ? DARK : MUTED, fontWeight: selected ? "700" : "400" }}>
                    {new Date(`${d.date}T00:00:00Z`).getUTCDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </Card>

      {/* Selected day */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <View>
            <Text style={{ fontWeight: "700", color: DARK }}>{fmtDay(selectedDate, true)}</Text>
            <Text style={{ color: MUTED, fontSize: 11 }}>Farmer by farmer</Text>
          </View>
          {day && day.farmerCount > 0 && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: BROWN, fontSize: 18, fontWeight: "700" }}>{kg(day.totalKg)} kg</Text>
              <Text style={{ color: MUTED, fontSize: 11 }}>
                {day.receiptCount} deliveries · {day.farmerCount} farmers
              </Text>
            </View>
          )}
        </View>
        {dayLoading ? (
          <ActivityIndicator />
        ) : !day || day.farmers.length === 0 ? (
          <Text style={{ color: MUTED }}>No deliveries recorded on this day.</Text>
        ) : (
          day.farmers.map((f) => {
            const fullySettled = Number(f.settledKg) >= Number(f.totalKg);
            return (
              <TouchableOpacity
                key={f.farmerId}
                onPress={() => navigation.navigate("FarmerDetail", { farmerId: f.farmerId, farmerName: f.name })}
                style={{ marginBottom: 12 }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontWeight: "600" }}>{f.name}</Text>
                  <Text>
                    <Text style={{ fontSize: 10, color: fullySettled ? "#2b6a4b" : "#8a6414" }}>
                      {fullySettled ? "Settled  " : "Not settled  "}
                    </Text>
                    <Text style={{ fontWeight: "700" }}>{kg(f.totalKg)} kg</Text>
                  </Text>
                </View>
                <Bar value={Number(f.totalKg)} total={Number(day.farmers[0].totalKg)} color="#c8962e" />
                <Text style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                  {f.receiptCount} {f.receiptCount === 1 ? "delivery" : "deliveries"}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </Card>

      {data.topFarmersInRange.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "700", color: DARK, marginBottom: 10 }}>Top farmers in this range</Text>
          {data.topFarmersInRange.map((f, i) => (
            <TouchableOpacity
              key={f.farmerId}
              onPress={() => navigation.navigate("FarmerDetail", { farmerId: f.farmerId, farmerName: f.name })}
              style={{ marginBottom: 12 }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text>
                  <Text style={{ color: MUTED }}>{i + 1}.  </Text>
                  <Text style={{ fontWeight: "600" }}>{f.name}</Text>
                </Text>
                <Text style={{ fontWeight: "700" }}>{kg(f.totalKg)} kg</Text>
              </View>
              <Bar value={Number(f.totalKg)} total={Number(data.topFarmersInRange[0].totalKg)} color={BROWN} />
            </TouchableOpacity>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
