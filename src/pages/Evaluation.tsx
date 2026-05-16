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
import { Metric, Panel, StatusPill } from "../components";
import type { AppData, User } from "../types";

export default function Evaluation({
  data,
  currentUser,
}: {
  data: AppData;
  currentUser: User;
}) {
  const [team, setTeam] = useState("All");
  const [employeeId, setEmployeeId] = useState("All");
  const [courseId, setCourseId] = useState("All");
  const teams = useMemo(
    () => [
      "All",
      ...Array.from(new Set(data.users.map((user) => user.team))).sort(),
    ],
    [data.users],
  );

  const attempts = data.attempts.filter((attempt) => {
    const user = data.users.find((item) => item.id === attempt.userId);
    return (
      (team === "All" || user?.team === team) &&
      (employeeId === "All" || attempt.userId === employeeId) &&
      (courseId === "All" || attempt.courseId === courseId)
    );
  });

  const captures = attempts.flatMap((attempt) =>
    (attempt.proctorCaptures || []).map((capture) => ({ ...capture, attempt })),
  );
  const completed = attempts.filter((attempt) => attempt.submittedAt);
  const avgScore = completed.length
    ? Math.round(
        completed.reduce((sum, attempt) => sum + (attempt.score || 0), 0) /
          completed.length,
      )
    : 0;
  const warningCount = attempts.reduce(
    (sum, attempt) => sum + (attempt.tabSwitchWarnings || 0),
    0,
  );
  const autoSubmitted = attempts.filter(
    (attempt) => attempt.autoSubmittedReason,
  ).length;

  const teamChart = Array.from(
    new Set(data.users.map((user) => user.team)),
  ).map((teamName) => {
    const teamUsers = data.users
      .filter((user) => user.team === teamName)
      .map((user) => user.id);
    const teamAttempts = data.attempts.filter((attempt) =>
      teamUsers.includes(attempt.userId),
    );
    return {
      team: teamName,
      completed: teamAttempts.length,
      warnings: teamAttempts.reduce(
        (sum, attempt) => sum + (attempt.tabSwitchWarnings || 0),
        0,
      ),
    };
  });

  return (
    <div className="space-y-6">
      {currentUser.role !== "Super Admin" ? (
        <Panel title="Evaluation" kicker="Restricted">
          <p className="text-slate-400">
            Only Super Admin can access full assessment evaluation and
            proctoring evidence.
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title="Evaluation control center"
            kicker="Assessment analytics"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm text-slate-400">
                <span>Team</span>
                <select
                  value={team}
                  onChange={(event) => {
                    setTeam(event.target.value);
                    setEmployeeId("All");
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {teams.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span>Employee</span>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option>All</option>
                  {data.users
                    .filter((user) => team === "All" || user.team === team)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span>Course</span>
                <select
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option>All</option>
                  {data.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-4">
            <Metric
              label="Attempts"
              value={String(attempts.length)}
              helper="Matched submissions"
              tone="cyan"
            />
            <Metric
              label="Average"
              value={`${avgScore}%`}
              helper="Assessment score"
              tone="green"
            />
            <Metric
              label="Warnings"
              value={String(warningCount)}
              helper="Tab/fullscreen violations"
              tone="amber"
            />
            <Metric
              label="Auto submits"
              value={String(autoSubmitted)}
              helper="Anti-cheating triggers"
              tone="violet"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <Panel title="Team-wise completion" kicker="Analytics">
              <div className="h-72 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamChart}>
                    <CartesianGrid
                      stroke="rgba(148,163,184,0.12)"
                      vertical={false}
                    />
                    <XAxis dataKey="team" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 16,
                        color: "#e2e8f0",
                      }}
                    />
                    <Bar
                      dataKey="completed"
                      fill="#22d3ee"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="warnings"
                      fill="#f59e0b"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Assessment completions" kicker="Employee-wise">
              <div className="max-h-80 overflow-auto rounded-3xl border border-white/10">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Assessment</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3">Warnings</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {attempts.map((attempt) => {
                      const user = data.users.find(
                        (item) => item.id === attempt.userId,
                      );
                      const course = data.courses.find(
                        (item) => item.id === attempt.courseId,
                      );
                      const assessment = data.assessments.find(
                        (item) => item.id === attempt.assessmentId,
                      );
                      return (
                        <tr key={attempt.id} className="text-slate-300">
                          <td className="px-4 py-3">{user?.name}</td>
                          <td className="px-4 py-3">{course?.title}</td>
                          <td className="px-4 py-3">{assessment?.title}</td>
                          <td className="px-4 py-3">{attempt.score}%</td>
                          <td className="px-4 py-3">
                            {attempt.tabSwitchWarnings || 0}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill
                              tone={
                                attempt.autoSubmittedReason
                                  ? "red"
                                  : attempt.status === "Passed"
                                    ? "green"
                                    : "amber"
                              }
                            >
                              {attempt.autoSubmittedReason
                                ? "Auto submitted"
                                : attempt.status}
                            </StatusPill>
                          </td>
                        </tr>
                      );
                    })}
                    {!attempts.length && (
                      <tr>
                        <td className="px-4 py-6 text-slate-500">
                          No attempts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <Panel title="Anti-cheating evidence" kicker="Captured images">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {captures.map((capture) => {
                const user = data.users.find(
                  (item) => item.id === capture.userId,
                );
                const course = data.courses.find(
                  (item) => item.id === capture.courseId,
                );
                const assessment = data.assessments.find(
                  (item) => item.id === capture.assessmentId,
                );
                return (
                  <div
                    key={capture.id}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]"
                  >
                    <img
                      src={capture.imageDataUrl}
                      alt={`Proctor capture for ${user?.name}`}
                      className="h-48 w-full object-cover"
                    />
                    <div className="p-4">
                      <p className="font-semibold text-white">{user?.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {course?.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {assessment?.title}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(capture.capturedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!captures.length && (
                <p className="text-sm text-slate-500">
                  No camera captures yet. Captures appear after employees
                  complete proctored attempts.
                </p>
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
