import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Panel,
  Metric,
  ProgressBar,
  StatusPill,
  Avatar,
  cn,
} from "../components";
import type { AppData, User } from "../types";
import { isAdminRole } from "../types";
import { colors } from "../types";

export default function Dashboard({
  data,
  currentUser,
}: {
  data: AppData;
  currentUser: User;
}) {
  const teamIds = useMemo(
    () =>
      data.users.filter((u) => u.managerId === currentUser.id).map((u) => u.id),
    [data.users, currentUser.id],
  );
  const visibleIds = isAdminRole(currentUser.role)
    ? data.users.map((u) => u.id)
    : currentUser.role === "Manager"
      ? [currentUser.id, ...teamIds]
      : [currentUser.id];
  const vis = data.enrollments.filter((e) => visibleIds.includes(e.userId));
  const completion = vis.length
    ? Math.round(vis.reduce((s, e) => s + e.progress, 0) / vis.length)
    : 0;
  const approved = data.courses.filter(
    (c) => c.approval === "Approved" && c.status === "Active",
  ).length;
  const pending =
    data.courses.filter((c) => c.approval === "Pending").length +
    data.assessments.filter((a) => a.approval === "Pending").length;
  const avgScore = data.attempts.filter(
    (a) => visibleIds.includes(a.userId) && a.score !== null,
  );
  const score = avgScore.length
    ? Math.round(
        avgScore.reduce((s, a) => s + (a.score || 0), 0) / avgScore.length,
      )
    : 0;

  const monthly = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"].map((m, i) => ({
    month: m,
    completions: 430 + i * 160,
    hours: 900 + i * 290,
    score: Math.min(96, 70 + i * 4),
  }));
  const skillRows = [
    "Security",
    "Leadership",
    "Analytics",
    "Communication",
    "Compliance",
  ].map((s) => ({
    name: s,
    value:
      data.skillRatings
        .filter((r) => r.skill === s && visibleIds.includes(r.userId))
        .reduce((a, r) => a + r.score, 0) || 10,
  }));
  const radar = [
    "Security",
    "Analytics",
    "Leadership",
    "Compliance",
    "Communication",
  ].map((s) => {
    const r = data.skillRatings.find(
      (x) => x.userId === currentUser.id && x.skill === s,
    );
    return { skill: s, score: r?.score || 40 };
  });

  const recentEnrollments = vis.slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] p-8">
        <motion.div
          aria-hidden
          className="absolute right-[-8rem] top-[-10rem] h-80 w-80 rounded-full border border-cyan-200/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-cyan-100/70">
              Nalanda L&D Suite
            </p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">
              {isAdminRole(currentUser.role)
                ? "Enterprise training control plane"
                : currentUser.role === "Manager"
                  ? "Team learning cockpit"
                  : "Your learning workspace"}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              {isAdminRole(currentUser.role)
                ? "Manage users, courses, chapters, assessments, and analytics."
                : currentUser.role === "Manager"
                  ? "Create courses, assign learning, and close skill gaps."
                  : "Complete courses, take assessments, and grow your skills."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              label={
                currentUser.role === "Employee" ? "My progress" : "Active users"
              }
              value={
                currentUser.role === "Employee"
                  ? `${completion}%`
                  : String(
                      data.users.filter((u) => u.status === "Active").length,
                    )
              }
              helper="Platform engagement"
            />
            <Metric
              label="Avg completion"
              value={`${completion}%`}
              helper="Across enrollments"
              tone="green"
            />
            <Metric
              label="Approved courses"
              value={String(approved)}
              helper="Ready for assignment"
              tone="violet"
            />
            <Metric
              label="Pending actions"
              value={String(pending)}
              helper="Awaiting approval"
              tone="amber"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Learning velocity" kicker="Analytics">
          <div className="h-72 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthly}
                margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="lg1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="rgba(148,163,184,0.12)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#020617",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 16,
                    color: "#e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={currentUser.role === "Employee" ? "score" : "hours"}
                  stroke="#22d3ee"
                  strokeWidth={3}
                  fill="url(#lg1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title={
            currentUser.role === "Employee"
              ? "Strength profile"
              : "Skill demand"
          }
          kicker="Insights"
        >
          <div className="h-72 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            {currentUser.role === "Employee" ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius={90}>
                  <PolarGrid stroke="rgba(148,163,184,0.22)" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                  />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar
                    dataKey="score"
                    stroke="#a78bfa"
                    fill="#a78bfa"
                    fillOpacity={0.35}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skillRows}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                  >
                    {skillRows.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 16,
                      color: "#e2e8f0",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {recentEnrollments.length > 0 && (
        <Panel title="Recent activity" kicker="Enrollments">
          <div className="grid gap-3 md:grid-cols-2">
            {recentEnrollments.map((e) => {
              const course = data.courses.find((c) => c.id === e.courseId);
              const user = data.users.find((u) => u.id === e.userId);
              return (
                <div
                  key={e.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={user?.name || "?"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">
                        {user?.name}
                      </p>
                      <p className="text-xs text-slate-500">{course?.title}</p>
                    </div>
                    <StatusPill tone={e.progress >= 100 ? "green" : "amber"}>
                      {e.progress}%
                    </StatusPill>
                  </div>
                  <div className="mt-3">
                    <ProgressBar
                      value={e.progress}
                      tone={e.progress >= 100 ? "green" : "cyan"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
