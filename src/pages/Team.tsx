import { useMemo } from "react";
import { Panel, StatusPill, ProgressBar, Avatar, cn } from "../components";
import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { AppData, User } from "../types";

export default function Team({
  data,
  currentUser,
}: {
  data: AppData;
  currentUser: User;
}) {
  const team = useMemo(
    () =>
      data.users.filter(
        (u) => u.managerId === currentUser.id && u.status === "Active",
      ),
    [data.users, currentUser.id],
  );

  return (
    <div className="space-y-6">
      <Panel
        title="Team learning monitor"
        kicker={`${team.length} direct reports`}
      >
        {team.length === 0 ? (
          <p className="text-slate-400">No direct reports found.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {team.map((member) => {
              const enrollments = data.enrollments.filter(
                (e) => e.userId === member.id,
              );
              const avgProgress = enrollments.length
                ? Math.round(
                    enrollments.reduce((s, e) => s + e.progress, 0) /
                      enrollments.length,
                  )
                : 0;
              const completedCount = enrollments.filter(
                (e) => e.completedAt,
              ).length;
              const attempts = data.attempts.filter(
                (a) => a.userId === member.id,
              );
              const avgScore = attempts.filter((a) => a.score !== null);
              const score = avgScore.length
                ? Math.round(
                    avgScore.reduce((s, a) => s + (a.score || 0), 0) /
                      avgScore.length,
                  )
                : 0;
              const skills = data.skillRatings.filter(
                (r) => r.userId === member.id,
              );
              const radarData = [
                "Security",
                "Leadership",
                "Analytics",
                "Communication",
                "Compliance",
              ].map((s) => ({
                skill: s,
                score: skills.find((r) => r.skill === s)?.score || 0,
              }));
              const weakest = [...skills]
                .sort((a, b) => a.score - b.score)
                .slice(0, 2);

              return (
                <div
                  key={member.id}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar name={member.name} />
                    <div>
                      <p className="font-semibold text-white">{member.name}</p>
                      <p className="text-xs text-slate-500">
                        {member.designation} · {member.department}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
                    <div className="rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-slate-500">Courses</p>
                      <p className="font-semibold text-white">
                        {enrollments.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-slate-500">Done</p>
                      <p className="font-semibold text-emerald-300">
                        {completedCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-slate-500">Avg score</p>
                      <p className="font-semibold text-cyan-300">
                        {score || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Progress</span>
                      <span>{avgProgress}%</span>
                    </div>
                    <ProgressBar
                      value={avgProgress}
                      tone={avgProgress >= 75 ? "green" : "amber"}
                    />
                  </div>
                  {skills.length > 0 && (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} outerRadius={60}>
                          <PolarGrid stroke="rgba(148,163,184,0.2)" />
                          <PolarAngleAxis
                            dataKey="skill"
                            tick={{ fill: "#94a3b8", fontSize: 10 }}
                          />
                          <PolarRadiusAxis
                            tick={false}
                            axisLine={false}
                            domain={[0, 100]}
                          />
                          <Radar
                            dataKey="score"
                            stroke="#a78bfa"
                            fill="#a78bfa"
                            fillOpacity={0.25}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {weakest.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-slate-500 mb-2">
                        Development areas:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {weakest.map((w) => (
                          <StatusPill
                            key={w.skill}
                            tone={w.score < 50 ? "red" : "amber"}
                          >
                            {w.skill}: {w.score}/100
                          </StatusPill>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
