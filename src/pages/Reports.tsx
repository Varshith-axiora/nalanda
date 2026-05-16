import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, Select, Metric, StatusPill } from "../components";
import type { AppData, User } from "../types";
import { isAdminRole } from "../types";

type ReportType =
  | "Audit trail"
  | "Employee master"
  | "Learning progress"
  | "Assessment outcomes"
  | "Skill coverage"
  | "Course feedback";
type Scope = "Organization" | "User" | "Team" | "Department";

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export default function Reports({
  data,
  currentUser,
}: {
  data: AppData;
  currentUser: User;
}) {
  const earliestDate =
    data.users.map((user) => user.joinedAt).sort()[0] ||
    new Date().toISOString().slice(0, 10);
  const [reportType, setReportType] = useState<ReportType>("Audit trail");
  const [scope, setScope] = useState<Scope>("Organization");
  const [target, setTarget] = useState("All");
  const [startDate, setStartDate] = useState(earliestDate);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const teams = useMemo(
    () => Array.from(new Set(data.users.map((user) => user.team))).sort(),
    [data.users],
  );
  const departments = useMemo(
    () => Array.from(new Set(data.users.map((user) => user.department))).sort(),
    [data.users],
  );

  const targetUsers = useMemo(() => {
    if (!isAdminRole(currentUser.role) && currentUser.role !== "Manager")
      return [currentUser];
    return data.users.filter((user) => {
      if (scope === "Organization" || target === "All") return true;
      if (scope === "User") return user.id === target;
      if (scope === "Team") return user.team === target;
      return user.department === target;
    });
  }, [currentUser, data.users, scope, target]);

  const targetIds = targetUsers.map((user) => user.id);
  const inPeriod = (date: string | null | undefined) => {
    if (!date) return false;
    const value = new Date(date).getTime();
    return (
      value >= new Date(`${startDate}T00:00:00`).getTime() &&
      value <= new Date(`${endDate}T23:59:59`).getTime()
    );
  };

  const rows = useMemo(() => {
    if (reportType === "Audit trail") {
      return data.audit
        .filter(
          (item) =>
            inPeriod(item.at) &&
            (targetIds.includes(item.actorId) ||
              targetIds.some((id) => item.entity.includes(id))),
        )
        .map((item) => {
          const actor = data.users.find((user) => user.id === item.actorId);
          return {
            Actor: actor?.name || item.actorId,
            EmployeeID: item.actorId,
            Action: item.action,
            Entity: item.entity,
            Date: new Date(item.at).toLocaleString(),
          };
        });
    }
    if (reportType === "Employee master") {
      return targetUsers
        .filter((user) => inPeriod(user.joinedAt))
        .map((user) => ({
          EmployeeID: user.id,
          Name: user.name,
          Email: user.email,
          DOJ: user.joinedAt,
          Department: user.department,
          Team: user.team,
          Designation: user.designation,
          Role: user.role,
          Manager:
            data.users.find((item) => item.id === user.managerId)?.name ||
            "None",
          Status: user.status,
        }));
    }
    if (reportType === "Learning progress") {
      return data.enrollments
        .filter(
          (item) => targetIds.includes(item.userId) && inPeriod(item.startedAt),
        )
        .map((item) => {
          const user = data.users.find(
            (candidate) => candidate.id === item.userId,
          );
          const course = data.courses.find(
            (courseItem) => courseItem.id === item.courseId,
          );
          return {
            Employee: user?.name,
            Team: user?.team,
            Course: course?.title,
            Skill: course?.skill,
            Progress: `${item.progress}%`,
            TimeMinutes: item.timeSpentMinutes,
            DueDate: item.dueAt || "None",
            CompletedAt: item.completedAt || "Pending",
          };
        });
    }
    if (reportType === "Assessment outcomes") {
      return data.attempts
        .filter(
          (item) => targetIds.includes(item.userId) && inPeriod(item.startedAt),
        )
        .map((item) => {
          const user = data.users.find(
            (candidate) => candidate.id === item.userId,
          );
          const assessment = data.assessments.find(
            (assessmentItem) => assessmentItem.id === item.assessmentId,
          );
          return {
            Employee: user?.name,
            Team: user?.team,
            Assessment: assessment?.title,
            Status: item.status,
            Score: item.score ?? "Pending",
            MaxScore: item.maxScore,
            SubmittedAt: item.submittedAt || "Pending",
          };
        });
    }
    if (reportType === "Skill coverage") {
      return targetUsers.flatMap((user) =>
        data.skills.map((skill) => {
          const rating = data.skillRatings.find(
            (item) => item.userId === user.id && item.skill === skill.name,
          );
          const mandated = data.targetSkills.some(
            (targetSkill) =>
              targetSkill.skillId === skill.id &&
              (targetSkill.department === `Team:${user.team}` ||
                targetSkill.department === user.department ||
                targetSkill.scope === "Organization"),
          );
          return {
            Employee: user.name,
            Team: user.team,
            Skill: skill.name,
            Mandatory: mandated ? "Yes" : "No",
            Score: rating?.score ?? 0,
            Trend: rating?.trend || "none",
            LastUpdated: rating?.lastUpdated
              ? new Date(rating.lastUpdated).toLocaleDateString()
              : "Never",
          };
        }),
      );
    }
    return data.chapterFeedbacks
      .filter(
        (item) => targetIds.includes(item.userId) && inPeriod(item.submittedAt),
      )
      .map((item) => {
        const user = data.users.find(
          (candidate) => candidate.id === item.userId,
        );
        const chapter = data.chapters.find(
          (chapterItem) => chapterItem.id === item.chapterId,
        );
        const course = data.courses.find(
          (courseItem) => courseItem.id === item.courseId,
        );
        return {
          Employee: user?.name,
          Team: user?.team,
          Course: course?.title,
          Chapter: chapter?.title,
          Rating: item.rating,
          Clarity: item.clarity,
          Relevance: item.relevance,
          Comments: item.comments,
          SubmittedAt: new Date(item.submittedAt).toLocaleString(),
        };
      });
  }, [data, reportType, targetIds, targetUsers, startDate, endDate]);

  const chart = useMemo(() => {
    const grouped = rows.reduce<Record<string, number>>((acc, row) => {
      const key = String(
        row.Team || row.Action || row.Status || row.Mandatory || "Records",
      );
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [rows]);

  const targetOptions =
    scope === "Organization"
      ? ["All"]
      : scope === "User"
        ? data.users.map((user) => user.id)
        : scope === "Team"
          ? teams
          : departments;
  const headers = rows[0] ? Object.keys(rows[0]) : ["No data"];

  const exportCsv = () => {
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((header) => csvEscape(row[header])).join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nalanda-${reportType.toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Report generator"
        kicker="Audit-ready data"
        action={
          <button
            onClick={exportCsv}
            className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-bold text-slate-950"
          >
            Export CSV
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-5">
          <Select
            label="Report"
            value={reportType}
            values={[
              "Audit trail",
              "Employee master",
              "Learning progress",
              "Assessment outcomes",
              "Skill coverage",
              "Course feedback",
            ]}
            onChange={setReportType}
          />
          <Select
            label="Scope"
            value={scope}
            values={["Organization", "User", "Team", "Department"]}
            onChange={(value) => {
              setScope(value);
              setTarget("All");
            }}
          />
          <label className="space-y-2 text-sm text-slate-400">
            <span>Target</span>
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            >
              {targetOptions.map((option) => (
                <option key={option} value={option}>
                  {scope === "User"
                    ? data.users.find((user) => user.id === option)?.name ||
                      option
                    : option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-400">
            <span>From</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-400">
            <span>To</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            />
          </label>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Rows"
          value={String(rows.length)}
          helper="Matched records"
          tone="cyan"
        />
        <Metric
          label="Users"
          value={String(targetUsers.length)}
          helper="In selected scope"
          tone="green"
        />
        <Metric
          label="From"
          value={startDate}
          helper="Account creation onward"
          tone="amber"
        />
        <Metric
          label="To"
          value={endDate}
          helper="Current audit window"
          tone="violet"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Report mix" kicker="Summary chart">
          <div className="h-72 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid
                  stroke="rgba(148,163,184,0.12)"
                  vertical={false}
                />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    color: "#e2e8f0",
                  }}
                />
                <Bar dataKey="value" fill="#22d3ee" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Structured report" kicker={reportType}>
          <div className="max-h-[520px] overflow-auto rounded-3xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.slice(0, 80).map((row, index) => (
                  <tr key={index} className="text-slate-300">
                    {headers.map((header) => (
                      <td key={header} className="px-4 py-3">
                        {String(row[header] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="px-4 py-6 text-slate-500">
                      No records found for this report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 80 && (
            <p className="mt-3 text-sm text-slate-500">
              Showing first 80 rows. Export CSV for the full report.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Audit readiness" kicker="Coverage">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <StatusPill tone="green">Account lifecycle</StatusPill>
            <p className="mt-3 text-sm text-slate-400">
              Employee creation, updates, activation state, role and reporting
              structure are available in Employee master and Audit trail.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <StatusPill tone="cyan">Learning evidence</StatusPill>
            <p className="mt-3 text-sm text-slate-400">
              Assignments, progress, assessment attempts, feedback and skill
              coverage can be exported by user, team or department.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <StatusPill tone="violet">Period control</StatusPill>
            <p className="mt-3 text-sm text-slate-400">
              Reports can run from the earliest account creation date through
              the current date or any custom audit window.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
