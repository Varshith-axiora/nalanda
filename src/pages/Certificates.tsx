import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Panel,
  Input,
  Select,
  Metric,
  StatusPill,
  EmptyState,
} from "../components";
import type { AppData, User, IssuedCertificate } from "../types";
import { isAdminRole, now, uid } from "../types";
import { toast } from "../toast";

type Template = "Executive" | "Classic" | "Modern" | "Minimal";

const templates: Record<
  Template,
  { accent: string; border: string; font: string; pattern: string }
> = {
  Executive: {
    accent: "#0f766e",
    border: "double",
    font: "Georgia, serif",
    pattern:
      "linear-gradient(135deg, rgba(15,118,110,.12), transparent 35%, rgba(245,158,11,.12))",
  },
  Classic: {
    accent: "#b45309",
    border: "solid",
    font: "Georgia, serif",
    pattern:
      "radial-gradient(circle at center, rgba(180,83,9,.10), transparent 55%)",
  },
  Modern: {
    accent: "#2563eb",
    border: "solid",
    font: "Inter, Arial, sans-serif",
    pattern:
      "linear-gradient(120deg, rgba(37,99,235,.12), rgba(34,211,238,.10))",
  },
  Minimal: {
    accent: "#334155",
    border: "solid",
    font: "Arial, sans-serif",
    pattern: "linear-gradient(180deg, #fff, #f8fafc)",
  },
};

function buildCertificateHTML(
  employee: User,
  courseTitle: string,
  title: string,
  subtitle: string,
  footer: string,
  duration: string,
  accent: string,
  templateStyle: typeof templates.Executive,
  issuedByName: string,
) {
  return `<!doctype html>
<html>
<head>
  <title>${title} - ${employee.name}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    body { margin: 0; background: #e2e8f0; font-family: ${templateStyle.font}; }
    .sheet { box-sizing: border-box; width: 297mm; height: 210mm; padding: 18mm; background: ${templateStyle.pattern}; }
    .certificate { box-sizing: border-box; display: flex; min-height: 100%; flex-direction: column; align-items: center; justify-content: center; border: 6px ${templateStyle.border} ${accent}; background: rgba(255,255,255,.92); padding: 18mm; text-align: center; color: #0f172a; }
    .kicker { color: ${accent}; font-size: 13px; letter-spacing: 6px; text-transform: uppercase; }
    h1 { margin: 16px 0 18px; font-size: 44px; color: ${accent}; }
    .subtitle { font-size: 18px; color: #475569; }
    .name { margin: 18px 0; font-size: 54px; font-weight: 800; border-bottom: 2px solid ${accent}; padding: 0 24px 12px; }
    .course { font-size: 25px; font-weight: 700; max-width: 850px; }
    .meta { display: flex; gap: 28px; margin-top: 28px; color: #475569; font-size: 15px; }
    .signatures { display: flex; justify-content: space-between; width: 78%; margin-top: 36px; font-size: 14px; color: #334155; }
    .line { border-top: 1px solid #64748b; padding-top: 8px; min-width: 180px; }
    .footer { margin-top: 24px; max-width: 760px; color: #475569; font-size: 16px; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="certificate">
      <div class="kicker">Nalanda Enterprise Training Platform</div>
      <h1>${title}</h1>
      <div class="subtitle">${subtitle}</div>
      <div class="name">${employee.name}</div>
      <div class="subtitle">for completing</div>
      <div class="course">${courseTitle}</div>
      <div class="meta">
        <span>Employee ID: ${employee.id}</span>
        <span>Duration: ${duration}</span>
        <span>Date: ${new Date().toLocaleDateString()}</span>
      </div>
      <p class="footer">${footer}</p>
      <div class="signatures">
        <div class="line">Issued by ${issuedByName}</div>
        <div class="line">Learning Authority</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function openPrintWindow(html: string) {
  const printHtml = html.replace(
    "</body>",
    "<script>window.onload = () => { window.print(); };</script></body>",
  );
  const win = window.open("", "_blank");
  win?.document.write(printHtml);
  win?.document.close();
}

// ──────────────────────────────────────────────
// Admin/Super Admin certificate builder
// ──────────────────────────────────────────────
function CertificateBuilder({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  const completed = data.enrollments.filter(
    (enrollment) => enrollment.progress >= 100 || enrollment.completedAt,
  );
  const defaultEnrollment = completed[0] || data.enrollments[0];
  const [employeeId, setEmployeeId] = useState(
    defaultEnrollment?.userId || data.users[0]?.id || "",
  );
  const [courseId, setCourseId] = useState(
    defaultEnrollment?.courseId || data.courses[0]?.id || "",
  );
  const [duration, setDuration] = useState("6 hours");
  const [template, setTemplate] = useState<Template>("Executive");
  const [title, setTitle] = useState("Certificate of Completion");
  const [subtitle, setSubtitle] = useState(
    "This certificate is proudly awarded to",
  );
  const [footer, setFooter] = useState(
    "For successfully completing the learning program with Nalanda.",
  );
  const [accent, setAccent] = useState(templates.Executive.accent);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const employee =
    data.users.find((user) => user.id === employeeId) || data.users[0];
  const course =
    data.courses.find((item) => item.id === courseId) || data.courses[0];
  const enrollment = data.enrollments.find(
    (item) => item.userId === employeeId && item.courseId === courseId,
  );
  const templateStyle = templates[template];

  const eligibleEmployees = useMemo(() => {
    const ids = new Set(completed.map((item) => item.userId));
    return data.users.filter((user) => ids.has(user.id));
  }, [completed, data.users]);

  const issuedCount = (data.issuedCertificates || []).length;

  const getCertHtml = () => {
    if (!employee || !course) return "";
    return buildCertificateHTML(
      employee,
      course.title,
      title,
      subtitle,
      footer,
      duration,
      accent,
      templateStyle,
      currentUser.name,
    );
  };

  const generatePDF = () => {
    const html = getCertHtml();
    if (!html) return;
    openPrintWindow(html);
  };

  const sendToEmployee = () => {
    if (!employee || !course) return;
    const html = getCertHtml();

    const cert: IssuedCertificate = {
      id: uid("CERT"),
      employeeId: employee.id,
      courseId: course.id,
      title,
      template,
      accent,
      duration,
      subtitle,
      footer,
      issuedBy: currentUser.id,
      issuedByName: currentUser.name,
      issuedAt: now(),
      htmlSnapshot: html,
    };

    setData({
      ...data,
      issuedCertificates: [cert, ...(data.issuedCertificates || [])],
      audit: [
        {
          id: uid("AUD"),
          actorId: currentUser.id,
          action: `Issued certificate to ${employee.name} for "${course.title}"`,
          entity: cert.id,
          at: now(),
        },
        ...data.audit,
      ],
    });

    setSendSuccess(employee.name);
    toast(`Certificate sent to ${employee.name}'s account`);
    setTimeout(() => setSendSuccess(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Eligible"
          value={String(eligibleEmployees.length)}
          helper="Completed courses"
          tone="green"
        />
        <Metric
          label="Templates"
          value="4"
          helper="Executive, Classic, Modern, Minimal"
          tone="cyan"
        />
        <Metric
          label="Issued"
          value={String(issuedCount)}
          helper="Certificates sent to employees"
          tone="violet"
        />
        <Metric
          label="Format"
          value="PDF"
          helper="Generate or send to employee"
          tone="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel
          title="Certificate builder"
          kicker="Admin only — Award setup"
          action={
            <div className="flex gap-2">
              <button
                onClick={generatePDF}
                className="action-btn rounded-full bg-gradient-to-r from-amber-300 to-cyan-300 px-4 py-2 text-sm font-bold text-slate-950"
              >
                Generate PDF
              </button>
              <button
                onClick={sendToEmployee}
                className="action-btn rounded-full bg-gradient-to-r from-emerald-300 to-teal-400 px-4 py-2 text-sm font-bold text-slate-950"
              >
                Send to Employee
              </button>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-400">
              <span>Employee</span>
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
              >
                {data.users
                  .filter((u) => u.status === "Active")
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.id})
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
                {data.courses
                  .filter((c) => c.approval === "Approved")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>
            <Input label="Duration" value={duration} onChange={setDuration} />
            <Select
              label="Template"
              value={template}
              values={["Executive", "Classic", "Modern", "Minimal"]}
              onChange={(value) => {
                setTemplate(value);
                setAccent(templates[value].accent);
              }}
            />
            <Input
              label="Certificate title"
              value={title}
              onChange={setTitle}
            />
            <Input label="Subtitle" value={subtitle} onChange={setSubtitle} />
            <Input label="Footer note" value={footer} onChange={setFooter} />
            <label className="space-y-2 text-sm text-slate-400">
              <span>Accent color</span>
              <input
                type="color"
                value={accent}
                onChange={(event) => setAccent(event.target.value)}
                className="h-[50px] w-full rounded-2xl border border-white/10 bg-slate-900 p-2"
              />
            </label>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <StatusPill
                tone={
                  enrollment?.progress && enrollment.progress >= 100
                    ? "green"
                    : "amber"
                }
              >
                {enrollment?.progress ?? 0}% complete
              </StatusPill>
              {sendSuccess && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs font-semibold text-emerald-300"
                >
                  ✓ Sent to {sendSuccess}
                </motion.span>
              )}
            </div>
            <p className="mt-3 text-slate-400">
              Generate PDF opens a print dialog. "Send to Employee" delivers the
              certificate to the employee's account for download.
            </p>
          </div>
        </Panel>

        <Panel title="Live certificate preview" kicker={template}>
          <div className="rounded-3xl border border-white/10 bg-slate-200 p-4">
            <div
              className="aspect-[1.414/1] rounded-2xl p-6 text-center text-slate-900"
              style={{
                background: templateStyle.pattern,
                fontFamily: templateStyle.font,
              }}
            >
              <div
                className="flex h-full flex-col items-center justify-center border-4 p-6"
                style={{
                  borderColor: accent,
                  borderStyle: templateStyle.border,
                }}
              >
                <p
                  className="text-xs uppercase tracking-[0.35em]"
                  style={{ color: accent }}
                >
                  Nalanda
                </p>
                <h2
                  className="mt-3 text-3xl font-bold"
                  style={{ color: accent }}
                >
                  {title}
                </h2>
                <p className="mt-4 text-sm text-slate-600">{subtitle}</p>
                <p
                  className="mt-3 border-b px-6 pb-2 text-4xl font-extrabold"
                  style={{ borderColor: accent }}
                >
                  {employee?.name}
                </p>
                <p className="mt-4 text-sm text-slate-600">for completing</p>
                <p className="mt-2 max-w-xl text-xl font-bold">
                  {course?.title}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
                  <span>{employee?.id}</span>
                  <span>{duration}</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <p className="mt-5 max-w-lg text-sm text-slate-600">{footer}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Issued certificates log */}
      {(data.issuedCertificates || []).length > 0 && (
        <Panel
          title="Issued certificates"
          kicker={`${(data.issuedCertificates || []).length} total`}
        >
          <div className="overflow-x-auto">
            <table className="min-w-[800px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Issued by</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(data.issuedCertificates || []).map((cert) => {
                  const emp = data.users.find((u) => u.id === cert.employeeId);
                  const crs = data.courses.find((c) => c.id === cert.courseId);
                  return (
                    <tr key={cert.id} className="text-slate-300">
                      <td className="px-4 py-4">
                        <span className="font-medium text-white">
                          {emp?.name || cert.employeeId}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {cert.employeeId}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {crs?.title || cert.courseId}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill tone="cyan">{cert.template}</StatusPill>
                      </td>
                      <td className="px-4 py-4">{cert.issuedByName}</td>
                      <td className="px-4 py-4 text-xs">
                        {new Date(cert.issuedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openPrintWindow(cert.htmlSnapshot)}
                          className="action-btn rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Employee / Manager view — "My Certificates"
// ──────────────────────────────────────────────
function MyCertificates({
  data,
  currentUser,
}: {
  data: AppData;
  currentUser: User;
}) {
  const myCerts = useMemo(() => {
    return (data.issuedCertificates || []).filter(
      (cert) => cert.employeeId === currentUser.id,
    );
  }, [data.issuedCertificates, currentUser.id]);

  // If manager, also show team certificates
  const teamCerts = useMemo(() => {
    if (currentUser.role !== "Manager") return [];
    const teamIds = new Set(
      data.users.filter((u) => u.managerId === currentUser.id).map((u) => u.id),
    );
    return (data.issuedCertificates || []).filter((cert) =>
      teamIds.has(cert.employeeId),
    );
  }, [data.issuedCertificates, data.users, currentUser]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label="My Certificates"
          value={String(myCerts.length)}
          helper="Earned and issued to you"
          tone="green"
        />
        {currentUser.role === "Manager" && (
          <Metric
            label="Team Certificates"
            value={String(teamCerts.length)}
            helper="Issued to your team"
            tone="cyan"
          />
        )}
        <Metric
          label="Format"
          value="PDF"
          helper="Download anytime"
          tone="violet"
        />
      </div>

      <Panel
        title="My earned certificates"
        kicker="Certificates awarded to you"
      >
        {myCerts.length === 0 ? (
          <EmptyState
            title="No certificates yet"
            description="You haven't received any certificates yet. Complete courses and assessments to earn certificates issued by your administrator."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {myCerts.map((cert) => {
              const crs = data.courses.find((c) => c.id === cert.courseId);
              const tplStyle =
                templates[cert.template as Template] || templates.Executive;
              return (
                <motion.div
                  key={cert.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-amber-500/[0.04] to-white/[0.02] p-5 transition hover:border-amber-300/20"
                >
                  {/* Mini preview */}
                  <div className="mb-4 rounded-2xl border border-white/10 bg-slate-200 p-3">
                    <div
                      className="aspect-[1.414/1] rounded-xl p-3 text-center text-slate-900"
                      style={{
                        background: tplStyle.pattern,
                        fontFamily: tplStyle.font,
                        fontSize: "6px",
                      }}
                    >
                      <div
                        className="flex h-full flex-col items-center justify-center border-2 p-2"
                        style={{
                          borderColor: cert.accent,
                          borderStyle: tplStyle.border,
                        }}
                      >
                        <p
                          className="text-[5px] uppercase tracking-[0.3em]"
                          style={{ color: cert.accent }}
                        >
                          Nalanda
                        </p>
                        <p
                          className="mt-1 text-[9px] font-bold"
                          style={{ color: cert.accent }}
                        >
                          {cert.title}
                        </p>
                        <p className="mt-1 text-[7px] text-slate-500">
                          {cert.subtitle}
                        </p>
                        <p
                          className="mt-1 text-[12px] font-extrabold border-b pb-0.5"
                          style={{ borderColor: cert.accent }}
                        >
                          {currentUser.name}
                        </p>
                        <p className="mt-1 text-[5px] text-slate-500">
                          for completing
                        </p>
                        <p className="mt-0.5 text-[8px] font-bold max-w-[80%]">
                          {crs?.title || cert.courseId}
                        </p>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-white">
                    {cert.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {crs?.title || cert.courseId}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone="amber">{cert.template}</StatusPill>
                    <StatusPill tone="green">Earned</StatusPill>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                    <span>
                      Duration:{" "}
                      <strong className="text-slate-300">
                        {cert.duration}
                      </strong>
                    </span>
                    <span>
                      Issued:{" "}
                      <strong className="text-slate-300">
                        {new Date(cert.issuedAt).toLocaleDateString()}
                      </strong>
                    </span>
                    <span>
                      By:{" "}
                      <strong className="text-slate-300">
                        {cert.issuedByName}
                      </strong>
                    </span>
                  </div>

                  <button
                    onClick={() => openPrintWindow(cert.htmlSnapshot)}
                    className="action-btn mt-4 w-full rounded-full bg-gradient-to-r from-amber-300 to-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 transition hover:shadow-lg hover:shadow-amber-300/20"
                  >
                    Download PDF
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Manager team view */}
      <AnimatePresence>
        {currentUser.role === "Manager" && teamCerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Panel
              title="Team certificates"
              kicker={`${teamCerts.length} issued to your team`}
            >
              <div className="overflow-x-auto">
                <table className="min-w-[700px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {teamCerts.map((cert) => {
                      const emp = data.users.find(
                        (u) => u.id === cert.employeeId,
                      );
                      const crs = data.courses.find(
                        (c) => c.id === cert.courseId,
                      );
                      return (
                        <tr key={cert.id} className="text-slate-300">
                          <td className="px-4 py-4 font-medium text-white">
                            {emp?.name || cert.employeeId}
                          </td>
                          <td className="px-4 py-4">
                            {crs?.title || cert.courseId}
                          </td>
                          <td className="px-4 py-4 text-xs">
                            {new Date(cert.issuedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => openPrintWindow(cert.htmlSnapshot)}
                              className="action-btn rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                            >
                              View PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main export — route by role
// ──────────────────────────────────────────────
export default function Certificates({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  if (isAdminRole(currentUser.role)) {
    return (
      <CertificateBuilder
        data={data}
        currentUser={currentUser}
        setData={setData}
      />
    );
  }
  return <MyCertificates data={data} currentUser={currentUser} />;
}
