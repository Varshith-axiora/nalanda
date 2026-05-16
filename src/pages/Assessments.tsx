import { useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Panel,
  Modal,
  StatusPill,
  Input,
  Select,
  EmptyState,
  DeleteConfirmModal,
  cn,
} from "../components";
import type {
  AppData,
  User,
  Assessment,
  AssessmentType,
  Question,
  ArchivedRecord,
} from "../types";
import { isAdminRole } from "../types";
import { now, uid } from "../types";
import { toast } from "../toast";

type BulkQuestion = {
  prompt: string;
  type: "MCQ" | "Descriptive";
  options: string[];
  answer: number;
  points: number;
};

const emptyForm = {
  title: "",
  skillId: "",
  courseId: "",
  chapterId: "",
  type: "MCQ" as AssessmentType,
  durationMinutes: "15",
  passScore: "70",
  questionLimit: "10",
  prompt: "",
  optA: "",
  optB: "",
  optC: "",
  optD: "",
  answer: "0",
  points: "25",
};

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : "-";
const cloneQuestion = (question: Question): Question => ({
  ...question,
  options: question.options ? [...question.options] : undefined,
});

const ensureQuestionBank = (questions: Question[], questionLimit: number) => {
  const required = Math.max(questionLimit * 3, questionLimit);
  if (questions.length >= required) return questions;
  const source = questions.length
    ? questions
    : [
        {
          id: uid("Q"),
          type: "MCQ" as const,
          prompt: "Placeholder question",
          options: ["Option A", "Option B", "Option C", "Option D"],
          answer: 0,
          points: 10,
        },
      ];
  const expanded = [...questions];
  while (expanded.length < required) {
    const base = source[expanded.length % source.length];
    expanded.push({
      ...cloneQuestion(base),
      id: uid("Q"),
      prompt: `${base.prompt} (Variant ${expanded.length + 1})`,
    });
  }
  return expanded;
};

export default function Assessments({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editMeta, setEditMeta] = useState({
    title: "",
    courseId: "",
    chapterId: "",
    durationMinutes: "15",
    passScore: "70",
    questionLimit: "10",
    difficulty: "Beginner" as Assessment["difficulty"],
  });
  const [editQuestions, setEditQuestions] = useState<Question[]>([]);
  const [bulkQuestions, setBulkQuestions] = useState<BulkQuestion[]>([]);
  const [uploadMode, setUploadMode] = useState(false);
  const [skillFilter, setSkillFilter] = useState("All");
  const [deleteTarget, setDeleteTarget] = useState<Assessment | null>(null);

  const addAudit = (d: AppData, a: string, e: string): AppData => ({
    ...d,
    audit: [
      {
        id: uid("AUD"),
        actorId: currentUser.id,
        action: a,
        entity: e,
        at: now(),
      },
      ...d.audit,
    ],
  });

  const ownedCourses = data.courses.filter(
    (course) =>
      isAdminRole(currentUser.role) || course.ownerId === currentUser.id,
  );
  const skillOptions = data.skills.filter((skill) => skill.status === "Active");
  const createSkillOptions = skillOptions.filter((skill) =>
    ownedCourses.some(
      (course) =>
        course.skillIds?.includes(skill.id) || course.skill === skill.name,
    ),
  );
  const visible =
    currentUser.role === "Employee"
      ? []
      : data.assessments
          .filter(
            (assessment) =>
              isAdminRole(currentUser.role) ||
              assessment.ownerId === currentUser.id ||
              assessment.approval === "Approved",
          )
          .filter((assessment) => {
            if (skillFilter === "All") return true;
            const course = data.courses.find(
              (item) => item.id === assessment.courseId,
            );
            const skill = data.skills.find((item) => item.id === skillFilter);
            return (
              !!course &&
              (course.skillIds?.includes(skillFilter) ||
                course.skill === skill?.name)
            );
          })
          .sort((a, b) => {
            const aCourse = data.courses.find((item) => item.id === a.courseId);
            const bCourse = data.courses.find((item) => item.id === b.courseId);
            const aSkill =
              data.skills.find(
                (item) =>
                  aCourse?.skillIds?.includes(item.id) ||
                  item.name === aCourse?.skill,
              )?.name || "";
            const bSkill =
              data.skills.find(
                (item) =>
                  bCourse?.skillIds?.includes(item.id) ||
                  item.name === bCourse?.skill,
              )?.name || "";
            return (
              aSkill.localeCompare(bSkill) || a.title.localeCompare(b.title)
            );
          });

  const coursesForSkill = ownedCourses.filter(
    (course) =>
      !form.skillId ||
      course.skillIds?.includes(form.skillId) ||
      data.skills.find((skill) => skill.id === form.skillId)?.name ===
        course.skill,
  );
  const chaptersForCourse = data.chapters.filter(
    (chapter) => chapter.courseId === form.courseId,
  );
  const editChaptersForCourse = data.chapters.filter(
    (chapter) => chapter.courseId === editMeta.courseId,
  );

  const seedSelection = () => {
    const skill = createSkillOptions[0];
    const course = skill
      ? ownedCourses.find(
          (item) =>
            item.skillIds?.includes(skill.id) || item.skill === skill.name,
        )
      : ownedCourses[0];
    const chapter = course
      ? data.chapters.find((item) => item.courseId === course.id)
      : undefined;
    setForm({
      ...emptyForm,
      skillId: skill?.id || "",
      courseId: course?.id || "",
      chapterId: chapter?.id || "",
    });
    setBulkQuestions([]);
    setUploadMode(false);
  };

  const openCreate = () => {
    setEditing(null);
    seedSelection();
    setCreateOpen(true);
  };

  const openEditPage = (assessment: Assessment) => {
    const course = data.courses.find((item) => item.id === assessment.courseId);
    setEditing(assessment);
    setEditMeta({
      title: assessment.title,
      courseId: assessment.courseId,
      chapterId: assessment.chapterId,
      durationMinutes: String(assessment.durationMinutes),
      passScore: String(assessment.passScore),
      questionLimit: String(assessment.questionLimit || 10),
      difficulty: assessment.difficulty || course?.difficulty || "Beginner",
    });
    setEditQuestions(assessment.questions.map(cloneQuestion));
  };

  const buildQuestions = () => {
    if (bulkQuestions.length > 0) {
      return bulkQuestions.map((bq) =>
        bq.type === "Descriptive"
          ? {
              id: uid("Q"),
              type: "Descriptive" as const,
              prompt: bq.prompt,
              points: bq.points,
            }
          : {
              id: uid("Q"),
              type: "MCQ" as const,
              prompt: bq.prompt,
              options: bq.options,
              answer: bq.answer,
              points: bq.points,
            },
      );
    }
    return form.type === "Descriptive"
      ? [
          {
            id: uid("Q"),
            type: "Descriptive" as const,
            prompt: form.prompt,
            points: Number(form.points),
          },
        ]
      : [
          {
            id: uid("Q"),
            type: "MCQ" as const,
            prompt: form.prompt,
            options: [form.optA, form.optB, form.optC, form.optD],
            answer: Number(form.answer),
            points: Number(form.points),
          },
        ];
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const chapter = data.chapters.find((item) => item.id === form.chapterId);
    if (!chapter) return;
    try {
      await api.post("/api/assessments", {
        title: form.title,
        chapterId: form.chapterId,
        type: form.type,
        durationMinutes: Number(form.durationMinutes),
        passScore: Number(form.passScore),
        questions: buildQuestions(),
      });
      setCreateOpen(false);
      setBulkQuestions([]);
      setUploadMode(false);
      toast("Assessment created successfully");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to create assessment");
    }
  };

  const saveEdit = () => {
    if (!editing) return;
    const chapter = data.chapters.find(
      (item) => item.id === editMeta.chapterId,
    );
    if (!chapter) return;
    const updated: Assessment = {
      ...editing,
      title: editMeta.title,
      courseId: chapter.courseId,
      chapterId: editMeta.chapterId,
      difficulty: editMeta.difficulty,
      durationMinutes: Number(editMeta.durationMinutes),
      passScore: Number(editMeta.passScore),
      questionLimit: Number(editMeta.questionLimit) || 10,
      questions: ensureQuestionBank(
        editQuestions,
        Number(editMeta.questionLimit) || 10,
      ),
      updatedAt: now(),
    };
    const assessments = data.assessments.map((item) =>
      item.id === editing.id ? updated : item,
    );
    setData(
      addAudit({ ...data, assessments }, "Updated assessment", editing.id),
    );
    setEditing(updated);
    toast("Assessment saved successfully");
  };

  const updateQuestion = (questionId: string, patch: Partial<Question>) => {
    setEditQuestions((questions) =>
      questions.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question,
      ),
    );
  };

  const updateQuestionOption = (
    questionId: string,
    index: number,
    value: string,
  ) => {
    setEditQuestions((questions) =>
      questions.map((question) => {
        if (question.id !== questionId) return question;
        const options = [...(question.options || ["", "", "", ""])];
        options[index] = value;
        return { ...question, options };
      }),
    );
  };

  const addQuestion = (type: "MCQ" | "Descriptive") => {
    setEditQuestions((questions) => [
      ...questions,
      type === "MCQ"
        ? {
            id: uid("Q"),
            type: "MCQ",
            prompt: "",
            options: ["", "", "", ""],
            answer: 0,
            points: 10,
          }
        : { id: uid("Q"), type: "Descriptive", prompt: "", points: 10 },
    ]);
  };

  const handleExcelUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const parsed = lines
        .slice(1)
        .map((line) => {
          const cols = line
            .split(/[,\t]/)
            .map((col) => col.trim().replace(/^"|"$/g, ""));
          const type = (cols[0] || "MCQ").toUpperCase().includes("DESC")
            ? "Descriptive"
            : "MCQ";
          return {
            type: type as "MCQ" | "Descriptive",
            prompt: cols[1] || "",
            options: [
              cols[2] || "",
              cols[3] || "",
              cols[4] || "",
              cols[5] || "",
            ],
            answer: parseInt(cols[6] || "0") || 0,
            points: parseInt(cols[7] || "25") || 25,
          };
        })
        .filter((question) => question.prompt);
      setBulkQuestions(parsed);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv =
      "Type,Question,OptionA,OptionB,OptionC,OptionD,CorrectAnswer(0-3),Points\nMCQ,What is 2+2?,1,2,3,4,3,25\nDescriptive,Explain your approach to problem solving,,,,,,20";
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "assessment-template.csv";
    link.click();
  };

  const approve = async (id: string) => {
    try {
      await api.patch(`/api/assessments/${id}/approval`, { approval: "Approved" });
      toast("Assessment approved successfully");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to approve assessment");
    }
  };
  const reject = async (id: string) => {
    try {
      await api.patch(`/api/assessments/${id}/approval`, { approval: "Rejected" });
      toast("Assessment rejected");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to reject assessment");
    }
  };

  const toggleAssessmentStatus = (assessment: Assessment) => {
    const newStatus =
      (assessment.status || "Active") === "Active" ? "Inactive" : "Active";
    setData(
      addAudit(
        {
          ...data,
          assessments: data.assessments.map((a) =>
            a.id === assessment.id
              ? { ...a, status: newStatus as any, updatedAt: now() }
              : a,
          ),
        },
        newStatus === "Inactive"
          ? "Deactivated assessment"
          : "Activated assessment",
        assessment.id,
      ),
    );
    toast(
      newStatus === "Inactive"
        ? "Assessment deactivated successfully"
        : "Assessment activated successfully",
    );
  };

  const handleDeleteAssessment = (comment: string) => {
    if (!deleteTarget) return;
    const archived: ArchivedRecord = {
      id: uid("ARC"),
      entityType: "Assessment",
      entityId: deleteTarget.id,
      entityData: { ...deleteTarget },
      deletedBy: currentUser.id,
      deletedByName: currentUser.name,
      deletionComment: comment,
      deletedAt: now(),
    };
    setData(
      addAudit(
        {
          ...data,
          assessments: data.assessments.filter((a) => a.id !== deleteTarget.id),
          archive: [archived, ...(data.archive || [])],
        },
        "Permanently deleted assessment",
        deleteTarget.id,
      ),
    );
    setDeleteTarget(null);
    toast("Assessment deleted successfully");
  };

  if (currentUser.role === "Employee") {
    return (
      <Panel title="Assessments" kicker="Notice">
        <p className="text-slate-400">
          Assessments are accessed through your course chapters. Open a course
          to take chapter assessments.
        </p>
      </Panel>
    );
  }

  if (editing) {
    const course = data.courses.find((item) => item.id === editMeta.courseId);
    const skill = data.skills.find(
      (item) =>
        course?.skillIds?.includes(item.id) || item.name === course?.skill,
    );
    return (
      <div className="space-y-6">
        <Panel
          title="Edit assessment"
          kicker={editing.id}
          action={
            <button
              onClick={() => setEditing(null)}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/5"
            >
              Back to list
            </button>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Assessment title"
                value={editMeta.title}
                onChange={(v) => setEditMeta({ ...editMeta, title: v })}
              />
              <label className="space-y-2 text-sm text-slate-400">
                <span>Course</span>
                <select
                  value={editMeta.courseId}
                  onChange={(e) => {
                    const courseId = e.target.value;
                    const chapter = data.chapters.find(
                      (item) => item.courseId === courseId,
                    );
                    const nextCourse = data.courses.find(
                      (item) => item.id === courseId,
                    );
                    setEditMeta({
                      ...editMeta,
                      courseId,
                      chapterId: chapter?.id || "",
                      difficulty: nextCourse?.difficulty || editMeta.difficulty,
                    });
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {ownedCourses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span>Chapter</span>
                <select
                  value={editMeta.chapterId}
                  onChange={(e) =>
                    setEditMeta({ ...editMeta, chapterId: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {editChaptersForCourse.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </option>
                  ))}
                </select>
              </label>
              <Select
                label="Difficulty"
                value={editMeta.difficulty || "Beginner"}
                values={["Beginner", "Intermediate", "Advanced"]}
                onChange={(v) => setEditMeta({ ...editMeta, difficulty: v })}
              />
              <Input
                label="Duration (min)"
                value={editMeta.durationMinutes}
                onChange={(v) =>
                  setEditMeta({ ...editMeta, durationMinutes: v })
                }
                type="number"
              />
              <Input
                label="Pass score (%)"
                value={editMeta.passScore}
                onChange={(v) => setEditMeta({ ...editMeta, passScore: v })}
                type="number"
              />
              <Input
                label="Questions shown to employee"
                value={editMeta.questionLimit}
                onChange={(v) => setEditMeta({ ...editMeta, questionLimit: v })}
                type="number"
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone="cyan">
                  {skill?.name || "Skill mapped by course"}
                </StatusPill>
                <StatusPill>{editing.type}</StatusPill>
                <StatusPill
                  tone={
                    editing.approval === "Approved"
                      ? "green"
                      : editing.approval === "Rejected"
                        ? "red"
                        : "amber"
                  }
                >
                  {editing.approval}
                </StatusPill>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Created: {formatDate(editing.createdAt)}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Last modified: {formatDate(editing.updatedAt)}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Required bank: {(Number(editMeta.questionLimit) || 10) * 3}{" "}
                questions
              </p>
            </div>
          </div>
        </Panel>

        <Panel
          title="Questions"
          kicker="Form builder"
          action={
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => addQuestion("MCQ")}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-cyan-100 hover:bg-white/5"
              >
                Add MCQ
              </button>
              <button
                onClick={() => addQuestion("Descriptive")}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-violet-100 hover:bg-white/5"
              >
                Add descriptive
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {editQuestions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="cyan">Question {index + 1}</StatusPill>
                    <StatusPill>{question.type}</StatusPill>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    <span>Score</span>
                    <input
                      type="number"
                      value={question.points}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          points: Number(e.target.value),
                        })
                      }
                      className="w-24 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white"
                    />
                  </label>
                </div>
                <label className="space-y-2 text-sm text-slate-400">
                  <span>Question</span>
                  <textarea
                    value={question.prompt}
                    onChange={(e) =>
                      updateQuestion(question.id, { prompt: e.target.value })
                    }
                    className="min-h-20 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                  />
                </label>
                {question.type === "MCQ" && (
                  <div className="mt-4 grid gap-3">
                    {(question.options || ["", "", "", ""]).map(
                      (option, optionIndex) => (
                        <label
                          key={optionIndex}
                          className={cn(
                            "grid gap-3 rounded-2xl border p-3 md:grid-cols-[auto_1fr]",
                            question.answer === optionIndex
                              ? "border-cyan-300/50 bg-cyan-300/10"
                              : "border-white/10 bg-slate-900/50",
                          )}
                        >
                          <input
                            type="radio"
                            name={`answer-${question.id}`}
                            checked={question.answer === optionIndex}
                            onChange={() =>
                              updateQuestion(question.id, {
                                answer: optionIndex,
                              })
                            }
                            className="mt-3 accent-cyan-300"
                          />
                          <Input
                            label={`Option ${String.fromCharCode(65 + optionIndex)}`}
                            value={option}
                            onChange={(v) =>
                              updateQuestionOption(question.id, optionIndex, v)
                            }
                          />
                        </label>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={saveEdit}
            className="mt-6 rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950"
          >
            Save assessment
          </button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Panel
        title="Assessment governance"
        kicker="Assessments"
        action={
          <button
            onClick={openCreate}
            className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-bold text-slate-950"
          >
            Create assessment
          </button>
        }
      >
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setSkillFilter("All")}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold transition",
              skillFilter === "All"
                ? "bg-white text-slate-950"
                : "border border-white/10 text-slate-300 hover:bg-white/5",
            )}
          >
            All skills
          </button>
          {skillOptions.map((skill) => (
            <button
              key={skill.id}
              onClick={() => setSkillFilter(skill.id)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-semibold transition",
                skillFilter === skill.id
                  ? "bg-cyan-300 text-slate-950"
                  : "border border-white/10 text-slate-300 hover:bg-white/5",
              )}
            >
              {skill.name}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No assessments"
            description="Create one for a chapter."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visible.map((assessment) => {
              const chapter = data.chapters.find(
                (item) => item.id === assessment.chapterId,
              );
              const course = data.courses.find(
                (item) => item.id === assessment.courseId,
              );
              const skill = data.skills.find(
                (item) =>
                  course?.skillIds?.includes(item.id) ||
                  item.name === course?.skill,
              );
              const attempts = data.attempts.filter(
                (attempt) =>
                  attempt.assessmentId === assessment.id &&
                  attempt.score !== null,
              );
              const avg = attempts.length
                ? Math.round(
                    attempts.reduce(
                      (sum, attempt) => sum + (attempt.score || 0),
                      0,
                    ) / attempts.length,
                  )
                : 0;
              return (
                <article
                  key={assessment.id}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="mb-3 flex flex-wrap gap-2">
                    <StatusPill tone="cyan">{assessment.id}</StatusPill>
                    <StatusPill
                      tone={
                        assessment.approval === "Approved"
                          ? "green"
                          : assessment.approval === "Rejected"
                            ? "red"
                            : "amber"
                      }
                    >
                      {assessment.approval}
                    </StatusPill>
                    {skill && (
                      <StatusPill tone="violet">{skill.name}</StatusPill>
                    )}
                    <StatusPill>
                      {assessment.difficulty ||
                        course?.difficulty ||
                        "Beginner"}
                    </StatusPill>
                    {assessment.status === "Inactive" && (
                      <StatusPill tone="red">Inactive</StatusPill>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {assessment.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Course: {course?.title || assessment.courseId}
                  </p>
                  <p className="text-xs text-slate-500">
                    Chapter: {chapter?.title || assessment.chapterId}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                    <div className="rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-slate-500">Created</p>
                      <p className="font-semibold text-white">
                        {formatDate(assessment.createdAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-slate-500">Modified</p>
                      <p className="font-semibold text-white">
                        {formatDate(assessment.updatedAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-slate-500">Avg score</p>
                      <p className="font-semibold text-white">{avg || "-"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 p-2">
                      <p className="text-xs text-slate-500">Bank / shown</p>
                      <p className="font-semibold text-white">
                        {assessment.questions.length}/
                        {assessment.questionLimit || 10}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => openEditPage(assessment)}
                      className="action-btn rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                    >
                      Edit
                    </button>
                    {isAdminRole(currentUser.role) && (
                      <button
                        onClick={() => toggleAssessmentStatus(assessment)}
                        className={cn(
                          "action-btn rounded-full border px-3 py-2 text-xs font-semibold",
                          (assessment.status || "Active") === "Active"
                            ? "border-amber-300/30 text-amber-200"
                            : "border-emerald-300/30 text-emerald-200",
                        )}
                      >
                        {(assessment.status || "Active") === "Active"
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    )}
                    {isAdminRole(currentUser.role) &&
                      assessment.approval === "Pending" && (
                        <>
                          <button
                            onClick={() => approve(assessment.id)}
                            className="action-btn rounded-full bg-emerald-300 px-3 py-2 text-xs font-bold text-slate-950"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => reject(assessment.id)}
                            className="action-btn rounded-full bg-rose-300 px-3 py-2 text-xs font-bold text-slate-950"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    {currentUser.role === "Super Admin" && (
                      <button
                        onClick={() => setDeleteTarget(assessment)}
                        className="action-btn rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-200"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <AnimatePresence>
        {createOpen && (
          <Modal title="Create assessment" onClose={() => setCreateOpen(false)}>
            <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
              <Input
                label="Title"
                value={form.title}
                onChange={(v) => setForm({ ...form, title: v })}
              />
              <Select
                label="Type"
                value={form.type}
                values={["MCQ", "Descriptive", "Mixed"]}
                onChange={(v) => setForm({ ...form, type: v })}
              />
              <label className="space-y-2 text-sm text-slate-400">
                <span>Skill</span>
                <select
                  value={form.skillId}
                  onChange={(e) => {
                    const skillId = e.target.value;
                    const course = ownedCourses.find(
                      (item) =>
                        item.skillIds?.includes(skillId) ||
                        data.skills.find((skill) => skill.id === skillId)
                          ?.name === item.skill,
                    );
                    const chapter = course
                      ? data.chapters.find(
                          (item) => item.courseId === course.id,
                        )
                      : undefined;
                    setForm({
                      ...form,
                      skillId,
                      courseId: course?.id || "",
                      chapterId: chapter?.id || "",
                    });
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {createSkillOptions.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span>Course</span>
                <select
                  value={form.courseId}
                  onChange={(e) => {
                    const courseId = e.target.value;
                    const chapter = data.chapters.find(
                      (item) => item.courseId === courseId,
                    );
                    setForm({
                      ...form,
                      courseId,
                      chapterId: chapter?.id || "",
                    });
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {coursesForSkill.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-400">
                <span>Chapter</span>
                <select
                  value={form.chapterId}
                  onChange={(e) =>
                    setForm({ ...form, chapterId: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {chaptersForCourse.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.title} (Ch {chapter.sequence})
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Duration (min)"
                value={form.durationMinutes}
                onChange={(v) => setForm({ ...form, durationMinutes: v })}
                type="number"
              />
              <Input
                label="Pass score (%)"
                value={form.passScore}
                onChange={(v) => setForm({ ...form, passScore: v })}
                type="number"
              />
              <Input
                label="Questions shown to employee"
                value={form.questionLimit}
                onChange={(v) => setForm({ ...form, questionLimit: v })}
                type="number"
              />
              <Input
                label="Points (per question)"
                value={form.points}
                onChange={(v) => setForm({ ...form, points: v })}
                type="number"
              />
              <div className="flex items-center gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setUploadMode(false)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    !uploadMode
                      ? "bg-cyan-300 text-slate-950"
                      : "border border-white/10 text-slate-300",
                  )}
                >
                  Manual entry
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode(true)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    uploadMode
                      ? "bg-cyan-300 text-slate-950"
                      : "border border-white/10 text-slate-300",
                  )}
                >
                  Upload CSV
                </button>
              </div>
              {uploadMode ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 md:col-span-2">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-white">
                      Upload questions from CSV
                    </h4>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-white/5"
                    >
                      Download template
                    </button>
                  </div>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/50 p-6 transition hover:border-cyan-300/40">
                    <span className="text-sm text-slate-400">
                      Click to upload .csv file
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleExcelUpload(f);
                      }}
                    />
                  </label>
                  {bulkQuestions.length > 0 && (
                    <p className="mt-3 text-sm font-semibold text-emerald-300">
                      {bulkQuestions.length} questions imported. Required bank:{" "}
                      {(Number(form.questionLimit) || 10) * 3}.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <label className="space-y-2 text-sm text-slate-400 md:col-span-2">
                    <span>Question prompt</span>
                    <textarea
                      value={form.prompt}
                      onChange={(e) =>
                        setForm({ ...form, prompt: e.target.value })
                      }
                      className="min-h-20 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                    />
                  </label>
                  {form.type !== "Descriptive" && (
                    <>
                      <Input
                        label="Option A"
                        value={form.optA}
                        onChange={(v) => setForm({ ...form, optA: v })}
                      />
                      <Input
                        label="Option B"
                        value={form.optB}
                        onChange={(v) => setForm({ ...form, optB: v })}
                      />
                      <Input
                        label="Option C"
                        value={form.optC}
                        onChange={(v) => setForm({ ...form, optC: v })}
                      />
                      <Input
                        label="Option D"
                        value={form.optD}
                        onChange={(v) => setForm({ ...form, optD: v })}
                      />
                      <label className="space-y-2 text-sm text-slate-400 md:col-span-2">
                        <span>Correct answer</span>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {[
                            {
                              key: "0",
                              label: `A. ${form.optA || "Option A"}`,
                            },
                            {
                              key: "1",
                              label: `B. ${form.optB || "Option B"}`,
                            },
                            {
                              key: "2",
                              label: `C. ${form.optC || "Option C"}`,
                            },
                            {
                              key: "3",
                              label: `D. ${form.optD || "Option D"}`,
                            },
                          ].map((option) => (
                            <label
                              key={option.key}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border p-3 text-sm transition",
                                form.answer === option.key
                                  ? "border-cyan-300/50 bg-cyan-300/10 text-white"
                                  : "border-white/10 bg-slate-900 text-slate-300",
                              )}
                            >
                              <input
                                type="radio"
                                name="correct-answer"
                                checked={form.answer === option.key}
                                onChange={() =>
                                  setForm({ ...form, answer: option.key })
                                }
                                className="accent-cyan-300"
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </label>
                    </>
                  )}
                </>
              )}
              <button className="rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950 md:col-span-2">
                Save assessment{" "}
                {!isAdminRole(currentUser.role) ? "(→ Pending)" : ""}
              </button>
            </form>
          </Modal>
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            entityType="Assessment"
            entityName={deleteTarget.title}
            entityId={deleteTarget.id}
            onConfirm={handleDeleteAssessment}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
