import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Panel,
  StatusPill,
  Input,
  Metric,
  EmptyState,
  cn,
} from "../components";
import type {
  AppData,
  User,
  Course,
  Assessment,
  ArchivedRecord,
} from "../types";
import { uid, now } from "../types";
import { toast } from "../toast";

const entityColors: Record<string, "cyan" | "amber" | "violet"> = {
  User: "cyan",
  Course: "amber",
  Assessment: "violet",
};
const formatDate = (v: string) => {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-white break-all">{value}</span>
    </div>
  );
}

function EntityDetails({ record }: { record: ArchivedRecord }) {
  const d = record.entityData as any;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Entity snapshot
        </p>
        <DetailRow label="ID" value={record.entityId} />
        {d.name && <DetailRow label="Name" value={d.name} />}
        {d.title && <DetailRow label="Title" value={d.title} />}
        {d.email && <DetailRow label="Email" value={d.email} />}
        {d.role && <DetailRow label="Role" value={d.role} />}
        {d.department && <DetailRow label="Department" value={d.department} />}
        {d.description && (
          <DetailRow label="Description" value={d.description} />
        )}
        {d.skill && <DetailRow label="Skill" value={d.skill} />}
        {d.difficulty && <DetailRow label="Difficulty" value={d.difficulty} />}
        {d.type && <DetailRow label="Type" value={d.type} />}
        {d.status && <DetailRow label="Status" value={d.status} />}
        {d.approval && <DetailRow label="Approval" value={d.approval} />}

        {record.relatedData?.chapters &&
          record.relatedData.chapters.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Archived chapters ({record.relatedData.chapters.length})
              </p>
              <div className="space-y-1">
                {record.relatedData.chapters.map((ch) => (
                  <div
                    key={ch.id}
                    className="rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-xs text-slate-300"
                  >
                    Ch {ch.sequence}: {ch.title}{" "}
                    <span className="text-slate-500">
                      ({ch.contentType} · {ch.durationMinutes}m)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {record.relatedData?.assessments &&
          record.relatedData.assessments.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Archived assessments ({record.relatedData.assessments.length})
              </p>
              <div className="space-y-1">
                {record.relatedData.assessments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-xs text-slate-300"
                  >
                    {a.title}{" "}
                    <span className="text-slate-500">
                      ({a.type} · {a.questions.length} questions)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        {record.relatedData?.enrollments &&
          record.relatedData.enrollments.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Archived enrollments ({record.relatedData.enrollments.length})
              </p>
              <p className="text-xs text-slate-400">
                {record.relatedData.enrollments.length} enrollment(s) were
                archived with this record.
              </p>
            </div>
          )}
      </div>
    </motion.div>
  );
}

export default function Archive({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<
    "All" | "User" | "Course" | "Assessment"
  >("All");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data.archive || [])
      .filter((r) => typeFilter === "All" || r.entityType === typeFilter)
      .filter((r) => {
        if (!needle) return true;
        const d = r.entityData as any;
        return [
          r.entityId,
          d.name,
          d.title,
          d.email,
          r.deletedByName,
          r.deletionComment,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort(
        (a, b) =>
          new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
      );
  }, [data.archive, typeFilter, query]);

  const counts = useMemo(
    () => ({
      total: (data.archive || []).length,
      users: (data.archive || []).filter((r) => r.entityType === "User").length,
      courses: (data.archive || []).filter((r) => r.entityType === "Course")
        .length,
      assessments: (data.archive || []).filter(
        (r) => r.entityType === "Assessment",
      ).length,
    }),
    [data.archive],
  );

  const addAudit = (d: AppData, action: string, entity: string): AppData => ({
    ...d,
    audit: [
      { id: uid("AUD"), actorId: currentUser.id, action, entity, at: now() },
      ...d.audit,
    ],
  });

  const restore = async (record: ArchivedRecord) => {
    try {
      await api.post(`/api/archive/${record.id}/restore`);
      toast(`${record.entityType} restored successfully`);
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to restore record");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Total archived"
          value={String(counts.total)}
          helper="All deleted records"
          tone="amber"
        />
        <Metric
          label="Users"
          value={String(counts.users)}
          helper="Deleted user accounts"
          tone="cyan"
        />
        <Metric
          label="Courses"
          value={String(counts.courses)}
          helper="Deleted courses & content"
          tone="amber"
        />
        <Metric
          label="Assessments"
          value={String(counts.assessments)}
          helper="Deleted assessments"
          tone="violet"
        />
      </div>

      <Panel title="Deletion archive" kicker="Super Admin only">
        <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto]">
          <Input
            label="Search archive"
            value={query}
            onChange={setQuery}
            placeholder="Search by name, ID, comment, or deleted by..."
          />
          <div className="flex flex-wrap items-end gap-2">
            {(["All", "User", "Course", "Assessment"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  "rounded-full px-4 py-2.5 text-xs font-semibold transition",
                  typeFilter === t
                    ? "bg-rose-400/20 text-rose-100 border border-rose-300/30"
                    : "border border-white/10 text-slate-300 hover:bg-white/5",
                )}
              >
                {t === "All"
                  ? `All (${counts.total})`
                  : `${t}s (${counts[`${t.toLowerCase()}s` as keyof typeof counts]})`}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No archived records"
            description={
              counts.total === 0
                ? "No records have been permanently deleted yet."
                : "No records match your current filter."
            }
          />
        ) : (
          <div className="space-y-4">
            {filtered.map((record) => {
              const d = record.entityData as any;
              const displayName = d.name || d.title || record.entityId;
              const isExpanded = expandedId === record.id;
              return (
                <motion.article
                  key={record.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.75rem] border border-rose-300/10 bg-gradient-to-br from-rose-500/[0.03] to-white/[0.02] p-5 transition hover:border-rose-300/20"
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        <StatusPill
                          tone={entityColors[record.entityType] || "slate"}
                        >
                          {record.entityType}
                        </StatusPill>
                        <StatusPill tone="red">Deleted</StatusPill>
                        <StatusPill>{record.entityId}</StatusPill>
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {displayName}
                      </h3>
                      <div className="mt-3 rounded-2xl border border-rose-300/10 bg-rose-300/5 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300/70 mb-1">
                          Deletion reason
                        </p>
                        <p className="text-sm text-rose-100 leading-relaxed">
                          "{record.deletionComment}"
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
                        <span>
                          Deleted by:{" "}
                          <strong className="text-slate-200">
                            {record.deletedByName}
                          </strong>
                        </span>
                        <span>
                          Date:{" "}
                          <strong className="text-slate-200">
                            {formatDate(record.deletedAt)}
                          </strong>
                        </span>
                        {record.relatedData?.chapters && (
                          <span>
                            Chapters:{" "}
                            <strong className="text-slate-200">
                              {record.relatedData.chapters.length}
                            </strong>
                          </span>
                        )}
                        {record.relatedData?.assessments && (
                          <span>
                            Assessments:{" "}
                            <strong className="text-slate-200">
                              {record.relatedData.assessments.length}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() =>
                          setExpandedId(isExpanded ? null : record.id)
                        }
                        className="action-btn rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-200"
                      >
                        {isExpanded ? "Hide details" : "View details"}
                      </button>
                      <button
                        onClick={() => restore(record)}
                        className="action-btn rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-bold text-emerald-100"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {isExpanded && <EntityDetails record={record} />}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
