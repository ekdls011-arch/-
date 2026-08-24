import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from "recharts";
import {
  Plus, X, CalendarDays, TrendingUp, AlertTriangle, ChevronRight, Trash2, BookOpen,
  Download, Share2,
} from "lucide-react";

/* ============================================================
   연차 원장 (Leave Ledger) — 세종장애인보호작업장
   ============================================================ */

const STORAGE_KEY = "leave-ledger-data";

const uid = () => Math.random().toString(36).slice(2, 10);

const pad2 = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function tenure(hireDate, asOf) {
  let years = asOf.getFullYear() - hireDate.getFullYear();
  let months = asOf.getMonth() - hireDate.getMonth();
  let days = asOf.getDate() - hireDate.getDate();
  if (days < 0) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  const totalMonths = years * 12 + months;
  return { years, months, totalMonths };
}

// 근로기준법 제60조 기반 간이 계산 (실제 적용 시 전년도 출근율 80%, 회계연도 전환 비례계산 등
// 세부 요건을 별도 검토해야 함 — 이 도구는 개략적 추정치를 제공)
function calcAccrued(hireDateStr, asOf) {
  const hireDate = new Date(hireDateStr + "T00:00:00");
  if (hireDate > asOf) return { accrued: 0, basis: "입사 전" };
  const { years, totalMonths } = tenure(hireDate, asOf);

  if (years < 1) {
    const accrued = Math.min(totalMonths, 11);
    return { accrued, basis: `입사 ${totalMonths}개월차 · 월 1일 개근 가산` };
  }
  const extra = Math.floor((years - 1) / 2);
  const accrued = Math.min(15 + extra, 25);
  return { accrued, basis: `근속 ${years}년차 · 기본 15일 + 가산 ${extra}일` };
}

function usedDays(logs) {
  return logs.reduce((sum, l) => sum + (Number(l.days) || 0), 0);
}

const seedWorkers = () => {
  const today = new Date();
  const y = today.getFullYear();
  const mk = (name, dept, hireYearsAgo, hireMonth, hireDay) => ({
    id: uid(),
    name,
    dept,
    hireDate: `${y - hireYearsAgo}-${pad2(hireMonth)}-${pad2(hireDay)}`,
  });
  return [
    mk("김O훈", "조립1팀", 4, 3, 15),
    mk("이O영", "조립1팀", 2, 7, 1),
    mk("박O수", "포장팀", 0, today.getMonth() + 1 > 6 ? 2 : 1, 10), // 1년 미만
    mk("최O진", "조립2팀", 6, 9, 20),
    mk("정O아", "포장팀", 1, 11, 5),
    mk("한O민", "조립2팀", 3, 4, 28),
  ];
};

const seedLogs = (workers) => {
  const logs = {};
  workers.forEach((w, i) => {
    logs[w.id] = [];
  });
  // 몇 명에게만 샘플 사용 기록 부여
  if (workers[0]) logs[workers[0].id] = [
    { id: uid(), date: `${new Date().getFullYear()}-03-04`, days: 1, note: "개인 사유" },
    { id: uid(), date: `${new Date().getFullYear()}-05-02`, days: 1, note: "병원 진료" },
  ];
  if (workers[1]) logs[workers[1].id] = [
    { id: uid(), date: `${new Date().getFullYear()}-02-14`, days: 2, note: "가족 행사" },
  ];
  if (workers[3]) logs[workers[3].id] = [
    { id: uid(), date: `${new Date().getFullYear()}-01-10`, days: 1, note: "" },
    { id: uid(), date: `${new Date().getFullYear()}-04-22`, days: 1, note: "" },
    { id: uid(), date: `${new Date().getFullYear()}-06-18`, days: 1, note: "" },
  ];
  return logs;
};

export default function LeaveLedger() {
  const [workers, setWorkers] = useState(null);
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [selectedDept, setSelectedDept] = useState("전체");
  const [sharedMode, setSharedMode] = useState(false);
  const [showShareConfirm, setShowShareConfirm] = useState(false);

  const today = useMemo(() => new Date(), []);

  // 초기 로드
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setWorkers(parsed.workers || []);
          setLogs(parsed.logs || {});
        } else {
          const w = seedWorkers();
          setWorkers(w);
          setLogs(seedLogs(w));
        }
      } catch (e) {
        const w = seedWorkers();
        setWorkers(w);
        setLogs(seedLogs(w));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 저장 (workers/logs 변경 시)
  const persist = useCallback(async (nextWorkers, nextLogs, shared) => {
    try {
      const result = await window.storage.set(
        STORAGE_KEY,
        JSON.stringify({ workers: nextWorkers, logs: nextLogs }),
        shared
      );
      if (!result) setSaveError(true);
      else setSaveError(false);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && workers && logs) {
      persist(workers, logs, sharedMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers, logs, sharedMode]);

  const rows = useMemo(() => {
    if (!workers) return [];
    return workers.map((w) => {
      const { accrued, basis } = calcAccrued(w.hireDate, today);
      const used = usedDays(logs?.[w.id] || []);
      const remaining = Math.max(accrued - used, 0);
      const usageRate = accrued > 0 ? used / accrued : 0;
      const monthsLeftInYear = 12 - (today.getMonth() + 1);
      const atRisk = accrued > 0 && usageRate < 0.3 && monthsLeftInYear <= 3;
      return { ...w, accrued, basis, used, remaining, usageRate, atRisk };
    });
  }, [workers, logs, today]);

  const depts = useMemo(() => {
    const set = new Set(rows.map((r) => r.dept));
    return ["전체", ...Array.from(set)];
  }, [rows]);

  const filteredRows = useMemo(
    () => (selectedDept === "전체" ? rows : rows.filter((r) => r.dept === selectedDept)),
    [rows, selectedDept]
  );

  const totals = useMemo(() => {
    const totalAccrued = filteredRows.reduce((s, r) => s + r.accrued, 0);
    const totalUsed = filteredRows.reduce((s, r) => s + r.used, 0);
    const avgRate = filteredRows.length
      ? filteredRows.reduce((s, r) => s + r.usageRate, 0) / filteredRows.length
      : 0;
    const atRiskCount = filteredRows.filter((r) => r.atRisk).length;
    return { totalAccrued, totalUsed, avgRate, atRiskCount };
  }, [filteredRows]);

  const chartData = useMemo(
    () =>
      [...filteredRows]
        .sort((a, b) => b.remaining - a.remaining)
        .map((r) => ({ name: r.name, 잔여: r.remaining, atRisk: r.atRisk })),
    [filteredRows]
  );

  const selected = rows.find((r) => r.id === selectedId) || null;

  const addWorker = (data) => {
    const w = { id: uid(), ...data };
    const nextWorkers = [...(workers || []), w];
    const nextLogs = { ...(logs || {}), [w.id]: [] };
    setWorkers(nextWorkers);
    setLogs(nextLogs);
    setShowAddWorker(false);
  };

  const removeWorker = (id) => {
    setWorkers((workers || []).filter((w) => w.id !== id));
    const nextLogs = { ...(logs || {}) };
    delete nextLogs[id];
    setLogs(nextLogs);
    setSelectedId(null);
  };

  const addLog = (workerId, entry) => {
    const nextLogs = { ...(logs || {}) };
    nextLogs[workerId] = [...(nextLogs[workerId] || []), { id: uid(), ...entry }];
    setLogs(nextLogs);
    setShowAddLog(false);
  };

  const removeLog = (workerId, logId) => {
    const nextLogs = { ...(logs || {}) };
    nextLogs[workerId] = (nextLogs[workerId] || []).filter((l) => l.id !== logId);
    setLogs(nextLogs);
  };

  const switchMode = async (nextShared) => {
    setLoading(true);
    try {
      const res = await window.storage.get(STORAGE_KEY, nextShared);
      if (res && res.value) {
        const parsed = JSON.parse(res.value);
        setWorkers(parsed.workers || []);
        setLogs(parsed.logs || {});
      } else if (nextShared) {
        // 공유 저장소가 비어있으면 현재 데이터를 그대로 복사해 시작
        await window.storage.set(STORAGE_KEY, JSON.stringify({ workers, logs }), true);
      } else {
        const w = seedWorkers();
        setWorkers(w);
        setLogs(seedLogs(w));
      }
    } catch (e) {
      setSaveError(true);
    } finally {
      setSharedMode(nextShared);
      setLoading(false);
    }
  };

  const handleShareToggle = () => {
    if (!sharedMode) setShowShareConfirm(true);
    else switchMode(false);
  };

  const confirmShare = () => {
    setShowShareConfirm(false);
    switchMode(true);
  };

  const exportExcel = () => {
    const data = filteredRows.map((r) => ({
      이름: r.name,
      소속: r.dept,
      입사일: r.hireDate,
      부여일수: r.accrued,
      사용일수: r.used,
      잔여일수: r.remaining,
      소진율: `${Math.round(r.usageRate * 100)}%`,
      비고: r.basis,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "연차현황");
    const filename = `연차현황_${selectedDept}_${toISO(today)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  if (loading) {
    return (
      <div style={{ ...styles.wrap, ...styles.center }}>
        <div style={{ color: "var(--ink-soft)", fontFamily: "var(--font-body)" }}>
          연차 원장을 불러오는 중…
        </div>
        <StyleBlock />
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <StyleBlock />

      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BookOpen size={22} color="#EAEFEC" strokeWidth={1.75} />
          <div>
            <div style={styles.headerTitle}>연차 원장</div>
            <div style={styles.headerSub}>세종장애인보호작업장 · 연차 관리</div>
          </div>
        </div>
        <div style={styles.headerDate}>{fmtDate(today)} 기준</div>
      </header>

      {/* Summary strip */}
      <section style={styles.statGrid}>
        <StatCard label="전체 인원" value={`${rows.length}명`} />
        <StatCard label="총 부여 연차" value={`${totals.totalAccrued}일`} />
        <StatCard label="총 사용 연차" value={`${totals.totalUsed}일`} />
        <StatCard
          label="평균 소진율"
          value={`${Math.round(totals.avgRate * 100)}%`}
          accent={totals.avgRate < 0.4}
        />
      </section>

      {totals.atRiskCount > 0 && (
        <div style={styles.alertBanner}>
          <AlertTriangle size={16} color="#8A6414" strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>
            소진율이 낮아 연차 소멸이 우려되는 인원이{" "}
            <strong>{totals.atRiskCount}명</strong> 있어요. 아래 목록에서 확인하세요.
          </span>
        </div>
      )}

      {saveError && (
        <div style={{ ...styles.alertBanner, background: "#F3E4E1", color: "#7A3529" }}>
          <span>저장에 실패했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.</span>
        </div>
      )}

      {/* Controls: 부서 필터 · 엑셀 내보내기 · 공유 모드 */}
      <section style={styles.controlsRow}>
        <div style={styles.chipRow}>
          {depts.map((d) => (
            <button
              key={d}
              style={{ ...styles.chip, ...(selectedDept === d ? styles.chipActive : {}) }}
              onClick={() => setSelectedDept(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button style={styles.iconTextBtn} onClick={exportExcel}>
            <Download size={13} strokeWidth={2.5} /> 엑셀
          </button>
          <button
            style={{ ...styles.iconTextBtn, ...(sharedMode ? styles.iconTextBtnActive : {}) }}
            onClick={handleShareToggle}
          >
            <Share2 size={13} strokeWidth={2.5} /> {sharedMode ? "공유중" : "공유"}
          </button>
        </div>
      </section>

      {/* Chart */}
      <section style={styles.card}>
        <div style={styles.cardTitle}>인원별 잔여 연차</div>
        <div style={{ width: "100%", height: Math.max(rows.length * 34, 120) }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#C9D2CC" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#5B6663" }} axisLine={{ stroke: "#C9D2CC" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={54}
                tick={{ fontSize: 12, fill: "#1E2A28", fontFamily: "var(--font-body)" }}
                axisLine={{ stroke: "#C9D2CC" }}
              />
              <Tooltip
                formatter={(v) => [`${v}일`, "잔여"]}
                contentStyle={{ fontFamily: "var(--font-body)", fontSize: 12, borderRadius: 6, border: "1px solid #C9D2CC" }}
              />
              <Bar dataKey="잔여" radius={[0, 3, 3, 0]} barSize={16}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.atRisk ? "#C99A2E" : "#2F6F62"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Ledger list */}
      <section style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={styles.cardTitle}>근로자별 연차 현황</div>
          <button style={styles.addBtn} onClick={() => setShowAddWorker(true)}>
            <Plus size={14} strokeWidth={2.5} /> 인원 추가
          </button>
        </div>

        <div>
          {filteredRows.map((r) => (
            <div key={r.id} style={styles.ledgerRow} onClick={() => setSelectedId(r.id)}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={styles.rowNameLine}>
                  <span style={styles.rowName}>{r.name}</span>
                  <span style={styles.rowDept}>{r.dept}</span>
                  {r.atRisk && <span style={styles.riskTag}>소멸 임박</span>}
                </div>
                <PassbookBar used={r.used} accrued={r.accrued} />
              </div>
              <div style={styles.rowNums}>
                <div style={styles.rowRemaining}>{r.remaining}<span style={styles.rowUnit}>일 잔여</span></div>
                <div style={styles.rowSub}>{r.used}일 사용 / {r.accrued}일 부여</div>
              </div>
              <ChevronRight size={16} color="#8A968F" style={{ flexShrink: 0 }} />
            </div>
          ))}
          {filteredRows.length === 0 && (
            <div style={{ padding: "24px 4px", color: "var(--ink-soft)", fontSize: 13 }}>
              해당 조건의 인원이 없어요.
            </div>
          )}
        </div>
      </section>

      <div style={styles.footNote}>
        * 연차 부여 일수는 근로기준법 제60조를 기준으로 한 간이 계산치입니다. 전년도 출근율 80% 요건, 회계연도 전환 시 비례계산 등
        세부 사항은 실제 급여관리 자료와 대조해 확인하세요.
      </div>

      {/* Detail modal */}
      {selected && (
        <Modal onClose={() => setSelectedId(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={styles.modalTitle}>{selected.name}</div>
              <div style={styles.modalSub}>{selected.dept} · 입사 {selected.hireDate}</div>
            </div>
            <button
              style={styles.iconBtnGhost}
              onClick={() => removeWorker(selected.id)}
              aria-label="인원 삭제"
              title="인원 삭제"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div style={styles.detailStatRow}>
            <DetailStat label="부여" value={`${selected.accrued}일`} />
            <DetailStat label="사용" value={`${selected.used}일`} />
            <DetailStat label="잔여" value={`${selected.remaining}일`} strong />
          </div>
          <div style={styles.basisLine}>{selected.basis}</div>

          <PassbookBar used={selected.used} accrued={selected.accrued} big />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 6 }}>
            <div style={styles.cardTitleSmall}>사용 내역</div>
            <button style={styles.addBtnSmall} onClick={() => setShowAddLog(true)}>
              <Plus size={13} strokeWidth={2.5} /> 사용 등록
            </button>
          </div>

          <div>
            {(logs[selected.id] || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((l) => (
              <div key={l.id} style={styles.logRow}>
                <CalendarDays size={14} color="#5B6663" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.logDate}>{l.date}</div>
                  {l.note && <div style={styles.logNote}>{l.note}</div>}
                </div>
                <div style={styles.logDays}>{l.days}일</div>
                <button style={styles.iconBtnGhost} onClick={() => removeLog(selected.id, l.id)} aria-label="삭제">
                  <X size={14} />
                </button>
              </div>
            ))}
            {(logs[selected.id] || []).length === 0 && (
              <div style={{ color: "var(--ink-soft)", fontSize: 13, padding: "10px 0" }}>
                아직 사용 기록이 없어요.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add worker modal */}
      {showAddWorker && (
        <Modal onClose={() => setShowAddWorker(false)}>
          <div style={styles.modalTitle}>인원 추가</div>
          <AddWorkerForm onSubmit={addWorker} onCancel={() => setShowAddWorker(false)} />
        </Modal>
      )}

      {/* Add log modal */}
      {showAddLog && selected && (
        <Modal onClose={() => setShowAddLog(false)}>
          <div style={styles.modalTitle}>{selected.name} · 연차 사용 등록</div>
          <AddLogForm
            onSubmit={(entry) => addLog(selected.id, entry)}
            onCancel={() => setShowAddLog(false)}
          />
        </Modal>
      )}

      {/* Share mode confirm */}
      {showShareConfirm && (
        <Modal onClose={() => setShowShareConfirm(false)}>
          <div style={styles.modalTitle}>공유 모드로 전환할까요?</div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65, marginTop: 10 }}>
            공유 모드를 켜면 이 화면에 접속하는 모든 사람이 근로자 명단과 연차 사용 내역을 함께 보고
            수정할 수 있어요. 개인정보가 포함된 데이터이니, 이 링크는 신뢰할 수 있는 관리자끼리만
            공유하는 걸 권장해요.
          </p>
          <div style={styles.formActions}>
            <button style={styles.btnGhost} onClick={() => setShowShareConfirm(false)}>취소</button>
            <button style={styles.btnPrimary} onClick={confirmShare}>공유 모드 켜기</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- Sub components ---------------- */

function StatCard({ label, value, accent }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: accent ? "#C99A2E" : "#1E2A28" }}>{value}</div>
    </div>
  );
}

function DetailStat({ label, value, strong }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", fontFamily: "var(--font-body)" }}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: strong ? 22 : 18,
          fontWeight: strong ? 700 : 500,
          color: strong ? "#2F6F62" : "#1E2A28",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PassbookBar({ used, accrued, big }) {
  const pct = accrued > 0 ? Math.min((used / accrued) * 100, 100) : 0;
  return (
    <div style={{ marginTop: big ? 14 : 6 }}>
      <div
        style={{
          height: big ? 10 : 6,
          background: "#E1E7E3",
          borderRadius: 4,
          overflow: "hidden",
          border: "1px solid #C9D2CC",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "#2F6F62",
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button style={styles.modalClose} onClick={onClose} aria-label="닫기">
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

function AddWorkerForm({ onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [hireDate, setHireDate] = useState(toISO(new Date()));

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), dept: dept.trim() || "미지정", hireDate });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Field label="이름">
        <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김O훈" />
      </Field>
      <Field label="소속">
        <input style={styles.input} value={dept} onChange={(e) => setDept(e.target.value)} placeholder="예: 조립1팀" />
      </Field>
      <Field label="입사일">
        <input type="date" style={styles.input} value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
      </Field>
      <div style={styles.formActions}>
        <button style={styles.btnGhost} onClick={onCancel}>취소</button>
        <button style={styles.btnPrimary} onClick={submit}>추가</button>
      </div>
    </div>
  );
}

function AddLogForm({ onSubmit, onCancel }) {
  const [date, setDate] = useState(toISO(new Date()));
  const [days, setDays] = useState(1);
  const [note, setNote] = useState("");

  const submit = () => {
    if (!date || !days) return;
    onSubmit({ date, days: Number(days), note: note.trim() });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Field label="사용일">
        <input type="date" style={styles.input} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="일수">
        <input
          type="number"
          min="0.5"
          step="0.5"
          style={styles.input}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
      </Field>
      <Field label="메모 (선택)">
        <input style={styles.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 병원 진료" />
      </Field>
      <div style={styles.formActions}>
        <button style={styles.btnGhost} onClick={onCancel}>취소</button>
        <button style={styles.btnPrimary} onClick={submit}>등록</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4, fontFamily: "var(--font-body)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function StyleBlock() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
      :root {
        --ink: #1E2A28;
        --ink-soft: #5B6663;
        --paper: #EFF3F1;
        --line: #C9D2CC;
        --jade: #2F6F62;
        --rust: #B4553F;
        --gold: #C99A2E;
        --forest: #16302B;
        --font-display: 'Noto Serif KR', serif;
        --font-body: 'Noto Sans KR', sans-serif;
        --font-mono: 'IBM Plex Mono', monospace;
      }
    `}</style>
  );
}

/* ---------------- Styles ---------------- */

const styles = {
  wrap: {
    background: "var(--paper)",
    minHeight: "100%",
    fontFamily: "var(--font-body)",
    color: "var(--ink)",
    padding: "0 0 24px 0",
    maxWidth: 640,
    margin: "0 auto",
  },
  center: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 240 },
  header: {
    background: "var(--forest)",
    padding: "18px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "0 0 10px 10px",
  },
  headerTitle: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "#EAEFEC", letterSpacing: 0.2 },
  headerSub: { fontSize: 11.5, color: "#B9C7C1", marginTop: 2 },
  headerDate: { fontFamily: "var(--font-mono)", fontSize: 11, color: "#B9C7C1" },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, padding: "14px 16px 0" },
  statCard: {
    background: "#fff",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "12px 14px",
  },
  statLabel: { fontSize: 11.5, color: "var(--ink-soft)" },
  statValue: { fontFamily: "var(--font-mono)", fontSize: 21, fontWeight: 700, marginTop: 4 },
  alertBanner: {
    margin: "12px 16px 0",
    background: "#F5EED9",
    color: "#6E5314",
    border: "1px solid #E3D2A0",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12.5,
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    lineHeight: 1.5,
  },
  controlsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    margin: "12px 16px 0",
    flexWrap: "wrap",
  },
  chipRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: {
    fontSize: 11.5, padding: "5px 10px", borderRadius: 14,
    border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
    cursor: "pointer", fontFamily: "var(--font-body)",
  },
  chipActive: { background: "var(--forest)", color: "#EAEFEC", borderColor: "var(--forest)" },
  iconTextBtn: {
    display: "flex", alignItems: "center", gap: 4,
    fontSize: 11.5, padding: "5px 10px", borderRadius: 14,
    border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
    cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 500,
  },
  iconTextBtnActive: { background: "var(--jade)", color: "#fff", borderColor: "var(--jade)" },
  card: {
    background: "#fff",
    border: "1px solid var(--line)",
    borderRadius: 10,
    margin: "14px 16px 0",
    padding: "14px 14px 10px",
  },
  cardTitle: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, marginBottom: 10 },
  cardTitleSmall: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13.5 },
  addBtn: {
    display: "flex", alignItems: "center", gap: 4,
    background: "var(--jade)", color: "#fff", border: "none",
    borderRadius: 6, padding: "6px 10px", fontSize: 12, fontFamily: "var(--font-body)",
    cursor: "pointer", fontWeight: 500,
  },
  addBtnSmall: {
    display: "flex", alignItems: "center", gap: 3,
    background: "transparent", color: "var(--jade)", border: "1px solid var(--jade)",
    borderRadius: 6, padding: "4px 8px", fontSize: 11.5, fontFamily: "var(--font-body)",
    cursor: "pointer", fontWeight: 500,
  },
  ledgerRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "12px 4px", borderBottom: "1px solid var(--line)",
    cursor: "pointer",
  },
  rowNameLine: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  rowName: { fontWeight: 700, fontSize: 14 },
  rowDept: { fontSize: 11, color: "var(--ink-soft)" },
  riskTag: {
    fontSize: 10, background: "#F5EED9", color: "#8A6414",
    padding: "1px 6px", borderRadius: 10, fontWeight: 600,
  },
  rowNums: { textAlign: "right", flexShrink: 0 },
  rowRemaining: { fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--jade)" },
  rowUnit: { fontFamily: "var(--font-body)", fontSize: 10.5, fontWeight: 400, color: "var(--ink-soft)", marginLeft: 2 },
  rowSub: { fontSize: 10.5, color: "var(--ink-soft)", marginTop: 1 },
  footNote: { fontSize: 10.5, color: "var(--ink-soft)", padding: "12px 20px 0", lineHeight: 1.6 },

  overlay: {
    position: "fixed", inset: 0, background: "rgba(22,48,43,0.45)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50,
  },
  modal: {
    background: "#fff", width: "100%", maxWidth: 480,
    borderRadius: "16px 16px 0 0", padding: "20px 18px 24px",
    maxHeight: "85vh", overflowY: "auto", position: "relative",
    fontFamily: "var(--font-body)", color: "var(--ink)",
  },
  modalClose: {
    position: "absolute", top: 14, right: 14, background: "transparent",
    border: "none", color: "var(--ink-soft)", cursor: "pointer", padding: 4,
  },
  modalTitle: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, paddingRight: 24 },
  modalSub: { fontSize: 12, color: "var(--ink-soft)", marginTop: 3 },
  detailStatRow: {
    display: "flex", marginTop: 16, paddingTop: 12,
    borderTop: "1px solid var(--line)",
  },
  basisLine: { textAlign: "center", fontSize: 11, color: "var(--ink-soft)", marginTop: 6 },
  logRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "9px 0", borderBottom: "1px solid var(--line)",
  },
  logDate: { fontFamily: "var(--font-mono)", fontSize: 12.5 },
  logNote: { fontSize: 11, color: "var(--ink-soft)", marginTop: 1 },
  logDays: { fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--rust)" },
  iconBtnGhost: {
    background: "transparent", border: "none", color: "var(--ink-soft)",
    cursor: "pointer", padding: 4, flexShrink: 0,
  },
  input: {
    width: "100%", boxSizing: "border-box", padding: "9px 10px",
    border: "1px solid var(--line)", borderRadius: 6, fontSize: 13.5,
    fontFamily: "var(--font-body)", color: "var(--ink)", background: "#FBFAF7",
  },
  formActions: { display: "flex", gap: 8, marginTop: 14 },
  btnGhost: {
    flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--line)",
    background: "#fff", color: "var(--ink-soft)", fontFamily: "var(--font-body)",
    fontSize: 13.5, cursor: "pointer",
  },
  btnPrimary: {
    flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
    background: "var(--jade)", color: "#fff", fontFamily: "var(--font-body)",
    fontSize: 13.5, fontWeight: 600, cursor: "pointer",
  },
};
