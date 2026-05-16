import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Panel,
  StatusPill,
  ProgressBar,
  Input,
  Select,
  Modal,
  cn,
} from "../components";
import type { AppData, Skill, SkillLevel, TargetSkill, User } from "../types";
import { isAdminRole } from "../types";
import { now, uid } from "../types";

const levels: SkillLevel[] = ["Beginner", "Intermediate", "Advanced", "Expert"];
const categories: Skill["category"][] = [
  "Technical",
  "Functional",
  "Leadership",
  "Compliance",
  "Behavioral",
];

function targetApplies(target: TargetSkill, user: User) {
  if (target.scope === "Organization") return true;
  if (target.scope === "Department")
    return target.department === user.department;
  if (target.scope === "Role") return target.designation === user.designation;
  return target.userId === user.id;
}

function getSkillGap(
  data: AppData,
  user: User,
  skillId: string,
  targetScore: number,
) {
  const skill = data.skills.find((item) => item.id === skillId);
  const rating = data.skillRatings.find(
    (item) => item.userId === user.id && item.skill === skill?.name,
  );
  const current = rating?.score || 0;
  return { current, gap: Math.max(0, targetScore - current), rating };
}

export default function Skills({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  const [skillOpen, setSkillOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [skillForm, setSkillForm] = useState({
    name: "",
    category: "Technical" as Skill["category"],
    description: "",
  });
  const [targetForm, setTargetForm] = useState({
    skillId: data.skills[0]?.id || "",
    scope: "Department" as TargetSkill["scope"],
    department: "Engineering",
    designation: "Software Engineer",
    userId: data.users.find((u) => u.role === "Employee")?.id || "",
    targetLevel: "Intermediate" as SkillLevel,
    targetScore: "80",
    priority: "High" as TargetSkill["priority"],
  });

  const selectedUser = currentUser;
  const applicableTargets = data.targetSkills.filter((target) =>
    targetApplies(target, selectedUser),
  );
  const ratings = data.skillRatings.filter((r) => r.userId === selectedUser.id);

  const radarData = useMemo(
    () =>
      data.skills
        .filter((skill) => skill.status === "Active")
        .map((skill) => {
          const r = ratings.find((item) => item.skill === skill.name);
          return { skill: skill.name, score: r?.score || 0, fullMark: 100 };
        }),
    [data.skills, ratings],
  );

  const suggestions = useMemo(() => {
    return applicableTargets
      .map((target) => {
        const skill = data.skills.find((item) => item.id === target.skillId);
        if (!skill) return null;
        const { current, gap, rating } = getSkillGap(
          data,
          selectedUser,
          skill.id,
          target.targetScore,
        );
        const courses = data.courses.filter(
          (course) =>
            (course.skillIds?.includes(skill.id) ||
              course.skill === skill.name) &&
            course.approval === "Approved" &&
            course.status === "Active",
        );
        const nextCourse = courses.find(
          (course) =>
            !data.enrollments.some(
              (enrollment) =>
                enrollment.userId === selectedUser.id &&
                enrollment.courseId === course.id,
            ),
        );
        const priority =
          gap >= 25 || target.priority === "High"
            ? "High"
            : gap >= 10
              ? "Medium"
              : "Low";
        return {
          skill,
          target,
          current,
          gap,
          rating,
          priority,
          nextCourse,
          text:
            gap > 0
              ? `${selectedUser.name} is ${gap} points below the ${skill.name} target. ${nextCourse ? `Assign ${nextCourse.title}.` : "Create or approve a mapped course."}`
              : `${selectedUser.name} has met the ${skill.name} target. Consider advanced practice or mentoring.`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.gap || 0) - (a?.gap || 0));
  }, [applicableTargets, data, selectedUser]);

  const addAudit = (d: AppData, action: string, entity: string): AppData => ({
    ...d,
    audit: [
      { id: uid("AUD"), actorId: currentUser.id, action, entity, at: now() },
      ...d.audit,
    ],
  });

  const saveSkill = (event: FormEvent) => {
    event.preventDefault();
    if (!skillForm.name.trim()) return;
    const skill: Skill = {
      id: uid("SKILL"),
      name: skillForm.name.trim(),
      category: skillForm.category,
      description: skillForm.description,
      status: "Active",
      createdAt: now(),
    };
    setData(
      addAudit(
        { ...data, skills: [skill, ...data.skills] },
        "Created skill",
        skill.id,
      ),
    );
    setSkillForm({ name: "", category: "Technical", description: "" });
    setSkillOpen(false);
  };

  const saveTarget = (event: FormEvent) => {
    event.preventDefault();
    const target: TargetSkill = {
      id: uid("TS"),
      skillId: targetForm.skillId,
      scope: targetForm.scope,
      department:
        targetForm.scope === "Department" ? targetForm.department : undefined,
      designation:
        targetForm.scope === "Role" ? targetForm.designation : undefined,
      userId: targetForm.scope === "Employee" ? targetForm.userId : undefined,
      targetLevel: targetForm.targetLevel,
      targetScore: Number(targetForm.targetScore),
      priority: targetForm.priority,
    };
    setData(
      addAudit(
        { ...data, targetSkills: [target, ...data.targetSkills] },
        "Created target skill",
        target.id,
      ),
    );
    setTargetOpen(false);
  };

  const toggleSkill = (skillId: string) => {
    setData(
      addAudit(
        {
          ...data,
          skills: data.skills.map((skill) =>
            skill.id === skillId
              ? {
                  ...skill,
                  status: skill.status === "Active" ? "Inactive" : "Active",
                }
              : skill,
          ),
        },
        "Updated skill status",
        skillId,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {isAdminRole(currentUser.role) && (
        <>
          <Panel
            title="Skill master"
            kicker="Admin framework"
            action={
              <button
                onClick={() => setSkillOpen(true)}
                className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-bold text-slate-950"
              >
                Add skill
              </button>
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {data.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill
                          tone={skill.status === "Active" ? "green" : "red"}
                        >
                          {skill.status}
                        </StatusPill>
                        <StatusPill tone="cyan">{skill.category}</StatusPill>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white">
                        {skill.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {skill.description}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleSkill(skill.id)}
                      className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-white/5"
                    >
                      {skill.status === "Active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Target skill rules"
            kicker="Organization readiness"
            action={
              <button
                onClick={() => setTargetOpen(true)}
                className="rounded-full bg-gradient-to-r from-emerald-300 to-teal-500 px-4 py-2 text-sm font-bold text-slate-950"
              >
                Add target
              </button>
            }
          >
            <div className="grid gap-3">
              {data.targetSkills.map((target) => {
                const skill = data.skills.find(
                  (item) => item.id === target.skillId,
                );
                const scopeLabel =
                  target.department ||
                  target.designation ||
                  data.users.find((u) => u.id === target.userId)?.name ||
                  "Entire organization";
                return (
                  <div
                    key={target.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {skill?.name || "Unknown skill"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {target.scope}: {scopeLabel}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill
                          tone={
                            target.priority === "High"
                              ? "red"
                              : target.priority === "Medium"
                                ? "amber"
                                : "slate"
                          }
                        >
                          {target.priority}
                        </StatusPill>
                        <StatusPill tone="violet">
                          {target.targetLevel}
                        </StatusPill>
                        <StatusPill tone="cyan">
                          Target {target.targetScore}/100
                        </StatusPill>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}

      {!isAdminRole(currentUser.role) && (
        <>
          <Panel title="Skill analysis" kicker="Competency profile">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">
                  Competency radar
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius={90}>
                      <PolarGrid stroke="rgba(148,163,184,0.22)" />
                      <PolarAngleAxis
                        dataKey="skill"
                        tick={{ fill: "#cbd5e1", fontSize: 12 }}
                      />
                      <PolarRadiusAxis
                        tick={false}
                        axisLine={false}
                        domain={[0, 100]}
                      />
                      <Radar
                        dataKey="score"
                        stroke="#22d3ee"
                        fill="#22d3ee"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="mb-4 text-lg font-semibold text-white">
                  Skill scores
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ratings.map((r) => ({
                        skill: r.skill,
                        score: r.score,
                      }))}
                      layout="vertical"
                      margin={{ left: 60 }}
                    >
                      <CartesianGrid
                        stroke="rgba(148,163,184,0.12)"
                        horizontal={false}
                      />
                      <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" />
                      <YAxis
                        type="category"
                        dataKey="skill"
                        stroke="#94a3b8"
                        width={90}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#020617",
                          border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 16,
                          color: "#e2e8f0",
                        }}
                      />
                      <Bar
                        dataKey="score"
                        fill="#a78bfa"
                        radius={[0, 8, 8, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            title="Development areas & suggestions"
            kicker="Target skill gaps"
          >
            <div className="grid gap-4">
              {suggestions.map(
                (item) =>
                  item && (
                    <div
                      key={item.target.id}
                      className={cn(
                        "rounded-2xl border p-5",
                        item.priority === "High"
                          ? "border-rose-300/20 bg-rose-300/5"
                          : item.priority === "Medium"
                            ? "border-amber-300/20 bg-amber-300/5"
                            : "border-white/10 bg-white/[0.03]",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-lg font-semibold text-white">
                            {item.skill.name}
                          </h4>
                          <StatusPill
                            tone={
                              item.priority === "High"
                                ? "red"
                                : item.priority === "Medium"
                                  ? "amber"
                                  : "green"
                            }
                          >
                            {item.priority} priority
                          </StatusPill>
                          <StatusPill tone="violet">
                            {item.target.targetLevel}
                          </StatusPill>
                        </div>
                        <span className="text-2xl font-bold text-white">
                          {item.current}
                          <span className="text-sm text-slate-500">
                            /{item.target.targetScore}
                          </span>
                        </span>
                      </div>
                      <div className="mt-3">
                        <ProgressBar
                          value={item.current}
                          tone={
                            item.current >= item.target.targetScore
                              ? "green"
                              : item.current >= 50
                                ? "amber"
                                : "violet"
                          }
                        />
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{item.text}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Based on {item.rating?.assessmentsBased || 0}{" "}
                        assessment(s)
                      </p>
                    </div>
                  ),
              )}
              {suggestions.length === 0 && (
                <p className="text-sm text-slate-400">
                  No target skills apply yet. Admin can add department, role,
                  employee, or organization targets above.
                </p>
              )}
            </div>
          </Panel>
        </>
      )}

      <AnimatePresence>
        {skillOpen && (
          <Modal title="Add skill" onClose={() => setSkillOpen(false)}>
            <form onSubmit={saveSkill} className="grid gap-4 md:grid-cols-2">
              <Input
                label="Skill name"
                value={skillForm.name}
                onChange={(v) => setSkillForm({ ...skillForm, name: v })}
              />
              <Select
                label="Category"
                value={skillForm.category}
                values={categories}
                onChange={(v) => setSkillForm({ ...skillForm, category: v })}
              />
              <label className="space-y-2 text-sm text-slate-400 md:col-span-2">
                <span>Description</span>
                <textarea
                  value={skillForm.description}
                  onChange={(e) =>
                    setSkillForm({ ...skillForm, description: e.target.value })
                  }
                  className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </label>
              <button className="rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950 md:col-span-2">
                Save skill
              </button>
            </form>
          </Modal>
        )}

        {targetOpen && (
          <Modal title="Add target skill" onClose={() => setTargetOpen(false)}>
            <form onSubmit={saveTarget} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-400">
                <span>Skill</span>
                <select
                  value={targetForm.skillId}
                  onChange={(e) =>
                    setTargetForm({ ...targetForm, skillId: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {data.skills
                    .filter((skill) => skill.status === "Active")
                    .map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                </select>
              </label>
              <Select
                label="Scope"
                value={targetForm.scope}
                values={["Organization", "Department", "Role", "Employee"]}
                onChange={(v) => setTargetForm({ ...targetForm, scope: v })}
              />
              {targetForm.scope === "Department" && (
                <Input
                  label="Department"
                  value={targetForm.department}
                  onChange={(v) =>
                    setTargetForm({ ...targetForm, department: v })
                  }
                />
              )}
              {targetForm.scope === "Role" && (
                <Input
                  label="Designation"
                  value={targetForm.designation}
                  onChange={(v) =>
                    setTargetForm({ ...targetForm, designation: v })
                  }
                />
              )}
              {targetForm.scope === "Employee" && (
                <label className="space-y-2 text-sm text-slate-400">
                  <span>Employee</span>
                  <select
                    value={targetForm.userId}
                    onChange={(e) =>
                      setTargetForm({ ...targetForm, userId: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                  >
                    {data.users
                      .filter((user) => user.role === "Employee")
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <Select
                label="Target level"
                value={targetForm.targetLevel}
                values={levels}
                onChange={(v) =>
                  setTargetForm({ ...targetForm, targetLevel: v })
                }
              />
              <Input
                label="Target score"
                value={targetForm.targetScore}
                onChange={(v) =>
                  setTargetForm({ ...targetForm, targetScore: v })
                }
                type="number"
              />
              <Select
                label="Priority"
                value={targetForm.priority}
                values={["Low", "Medium", "High"]}
                onChange={(v) => setTargetForm({ ...targetForm, priority: v })}
              />
              <button className="rounded-full bg-emerald-300 px-5 py-3 font-bold text-slate-950 md:col-span-2">
                Save target rule
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
