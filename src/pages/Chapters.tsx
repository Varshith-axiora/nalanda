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
} from "../components";
import type { AppData, User, Chapter } from "../types";
import { isAdminRole } from "../types";
import { now, uid } from "../types";

export default function Chapters({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    courseId: "",
    title: "",
    description: "",
    contentType: "Rich Text" as Chapter["contentType"],
    body: "",
    url: "",
    fileName: "",
    durationMinutes: "20",
  });

  const addAudit = (d: AppData, action: string, entity: string): AppData => ({
    ...d,
    audit: [
      { id: uid("AUD"), actorId: currentUser.id, action, entity, at: now() },
      ...d.audit,
    ],
  });

  const visibleCourses = data.courses.filter(
    (c) => isAdminRole(currentUser.role) || c.ownerId === currentUser.id,
  );

  const save = (e: FormEvent) => {
    e.preventDefault();
    const courseChapters = data.chapters.filter(
      (c) => c.courseId === form.courseId,
    );
    if (courseChapters.length >= 99) return;
    const ch: Chapter = {
      id: uid("CH"),
      courseId: form.courseId,
      sequence: courseChapters.length + 1,
      title: form.title,
      description: form.description,
      contentType: form.contentType,
      body: form.body,
      url: form.url || undefined,
      fileName: form.fileName || undefined,
      durationMinutes: Number(form.durationMinutes),
    };
    setData(
      addAudit(
        { ...data, chapters: [...data.chapters, ch] },
        "Created chapter",
        ch.id,
      ),
    );
    setCreateOpen(false);
    setForm({
      courseId: "",
      title: "",
      description: "",
      contentType: "Rich Text",
      body: "",
      url: "",
      fileName: "",
      durationMinutes: "20",
    });
  };

  const grouped = visibleCourses.map((c) => ({
    course: c,
    chapters: data.chapters
      .filter((ch) => ch.courseId === c.id)
      .sort((a, b) => a.sequence - b.sequence),
  }));

  return (
    <div className="space-y-6">
      <Panel
        title="Chapter builder"
        kicker="Content management"
        action={
          currentUser.role !== "Employee" ? (
            <button
              onClick={() => {
                setForm({ ...form, courseId: visibleCourses[0]?.id || "" });
                setCreateOpen(true);
              }}
              className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-bold text-slate-950"
            >
              Add chapter
            </button>
          ) : null
        }
      >
        {grouped.length === 0 ? (
          <EmptyState title="No courses" description="Create a course first." />
        ) : (
          <div className="space-y-6">
            {grouped.map(({ course, chapters }) => (
              <div
                key={course.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <StatusPill tone="cyan">{course.id}</StatusPill>
                  <h3 className="text-lg font-semibold text-white">
                    {course.title}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {chapters.length}/99 chapters
                  </span>
                </div>
                {chapters.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">
                    No chapters yet
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {chapters.map((ch) => {
                      const assessment = data.assessments.find(
                        (a) => a.chapterId === ch.id,
                      );
                      return (
                        <div
                          key={ch.id}
                          className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-bold text-cyan-300">
                            {ch.sequence}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">
                              {ch.title}
                            </p>
                            <p className="text-xs text-slate-500">
                              {ch.contentType} · {ch.durationMinutes}m
                            </p>
                          </div>
                          <StatusPill tone={assessment ? "green" : "red"}>
                            {assessment ? "Assessment ✓" : "No assessment"}
                          </StatusPill>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <AnimatePresence>
        {createOpen && (
          <Modal title="Add chapter" onClose={() => setCreateOpen(false)}>
            <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-400">
                <span>Course</span>
                <select
                  value={form.courseId}
                  onChange={(e) =>
                    setForm({ ...form, courseId: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  {visibleCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} (
                      {
                        data.chapters.filter((ch) => ch.courseId === c.id)
                          .length
                      }
                      /99)
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Chapter title"
                value={form.title}
                onChange={(v) => setForm({ ...form, title: v })}
              />
              <Select
                label="Content type"
                value={form.contentType}
                values={["Rich Text", "PDF", "Video Link"]}
                onChange={(v) => setForm({ ...form, contentType: v })}
              />
              <Input
                label="Duration (min)"
                value={form.durationMinutes}
                onChange={(v) => setForm({ ...form, durationMinutes: v })}
                type="number"
              />
              {form.contentType.includes("Video") && (
                <Input
                  label="Video URL"
                  value={form.url}
                  onChange={(v) => setForm({ ...form, url: v })}
                />
              )}
              {form.contentType === "PDF" && (
                <Input
                  label="File name"
                  value={form.fileName}
                  onChange={(v) => setForm({ ...form, fileName: v })}
                />
              )}
              <label className="space-y-2 text-sm text-slate-400 md:col-span-2">
                <span>Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="min-h-16 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />
              </label>
              <label className="space-y-2 text-sm text-slate-400 md:col-span-2">
                <span>Content body</span>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                />
              </label>
              <button className="rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950 md:col-span-2">
                Save chapter
              </button>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
