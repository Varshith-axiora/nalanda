import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Panel,
  Modal,
  StatusPill,
  Input,
  Select,
  Avatar,
  Metric,
  DeleteConfirmModal,
  cn,
} from "../components";
import type { AppData, User, Role, Status, ArchivedRecord } from "../types";
import { isAdminRole, now, uid } from "../types";
import { toast } from "../toast";

type Tab = "employees" | "hierarchy" | "skills" | "bulk" | "access";
type EmployeeForm = {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  team: string;
  designation: string;
  managerId: string;
  status: Status;
  password: string;
  dateOfJoining: string;
};

const roles: Role[] = ["Super Admin", "Admin", "Manager", "Employee"];
const permissionLabels = [
  "View all employees",
  "Create employees",
  "Edit employee data",
  "Activate or deactivate users",
  "Edit organization hierarchy",
  "Bulk upload users",
  "View audit analytics",
  "Manage access permissions",
  "Approve learning content",
  "Assign team learning",
  "View own learning",
];

const uploadColumns = [
  "employeeId",
  "name",
  "email",
  "doj",
  "department",
  "team",
  "designation",
  "role",
  "reportingTo",
  "status",
];
const sampleRows = [
  [
    "EMP-2001",
    "Riya Kapoor",
    "riya@nalanda.local",
    "2026-05-07",
    "Engineering",
    "Platform",
    "Frontend Engineer",
    "Employee",
    "EMP-1003",
    "Active",
  ],
  [
    "EMP-2002",
    "Sameer Khan",
    "sameer@nalanda.local",
    "2026-05-07",
    "Sales",
    "Enterprise Sales",
    "Account Executive",
    "Employee",
    "EMP-1002",
    "Active",
  ],
];

const defaultPermissions: Record<Role, string[]> = {
  "Super Admin": permissionLabels,
  Admin: permissionLabels.filter(
    (item) => item !== "Manage access permissions",
  ),
  Manager: [
    "Assign team learning",
    "View audit analytics",
    "View own learning",
  ],
  Employee: ["View own learning"],
};

const blankForm = (managerId = ""): EmployeeForm => ({
  employeeId: "",
  name: "",
  email: "",
  role: "Employee",
  department: "Engineering",
  team: "Platform",
  designation: "",
  managerId,
  status: "Active",
  password: "Password@123",
  dateOfJoining: new Date().toISOString().slice(0, 10),
});

function toForm(user: User): EmployeeForm {
  return {
    employeeId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    team: user.team,
    designation: user.designation,
    managerId: user.managerId || "",
    status: user.status,
    password: user.password,
    dateOfJoining: user.joinedAt,
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function managerName(users: User[], managerId: string | null) {
  if (!managerId) return "None";
  return users.find((user) => user.id === managerId)?.name || "Unknown";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function Users({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  const [tab, setTab] = useState<Tab>("employees");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const managers = data.users.filter(
    (user) => user.role === "Manager" || isAdminRole(user.role),
  );
  const [form, setForm] = useState<EmployeeForm>(
    blankForm(managers[0]?.id || ""),
  );
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState<"All" | Status>("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkFileName, setBulkFileName] = useState("");
  const [skillTeam, setSkillTeam] = useState(data.users[0]?.team || "");
  const [targetLevel, setTargetLevel] = useState<
    "Beginner" | "Intermediate" | "Advanced" | "Expert"
  >("Intermediate");
  const [targetScore, setTargetScore] = useState("80");
  const [permissions, setPermissions] = useState(defaultPermissions);

  const departments = useMemo(
    () => Array.from(new Set(data.users.map((user) => user.department))).sort(),
    [data.users],
  );
  const teams = useMemo(
    () => Array.from(new Set(data.users.map((user) => user.team))).sort(),
    [data.users],
  );

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.users.filter((user) => {
      const matchesText =
        !needle ||
        [
          user.id,
          user.name,
          user.email,
          user.department,
          user.team,
          user.designation,
          user.role,
          managerName(data.users, user.managerId),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return (
        matchesText &&
        (statusFilter === "All" || user.status === statusFilter) &&
        (departmentFilter === "All" || user.department === departmentFilter) &&
        (teamFilter === "All" || user.team === teamFilter)
      );
    });
  }, [data.users, departmentFilter, query, statusFilter, teamFilter]);

  const teamUsers = data.users.filter((user) => user.team === skillTeam);
  const mandatedSkills = data.targetSkills.filter(
    (target) =>
      target.scope === "Department" &&
      target.department === `Team:${skillTeam}`,
  );

  const addAudit = (d: AppData, action: string, entity: string): AppData => ({
    ...d,
    audit: [
      { id: uid("AUD"), actorId: currentUser.id, action, entity, at: now() },
      ...d.audit,
    ],
  });

  const saveEmployee = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.employeeId.trim() || !form.name.trim() || !form.email.trim())
      return;

    try {
      if (editing) {
        const response = await api.patch(`/api/users/${editing.id}`, {
          name: form.name,
          department: form.department,
          role: form.role,
          managerId: form.managerId || null,
          status: form.status,
        });
        toast("Employee updated successfully");
      } else {
        await api.post("/api/users", {
          name: form.name,
          email: form.email,
          department: form.department,
          role: form.role,
          managerId: form.managerId || null,
          password: form.password,
        });
        toast("Employee created successfully");
      }
      setOpen(false);
      setEditing(null);
      setForm(blankForm(managers[0]?.id || ""));
      // Trigger a re-fetch of all data in App.tsx by updating a dummy state or relying on the interval
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to save employee");
    }
  };

  const editEmployee = (user: User) => {
    setEditing(user);
    setForm(toForm(user));
    setOpen(true);
  };

  const patch = async (
    id: string,
    patchData: Partial<User>,
    action = "Updated employee",
  ) => {
    try {
      await api.patch(`/api/users/${id}`, patchData);
      if (action.includes("Deactivated"))
        toast("Employee deactivated — active sessions revoked");
      else if (action.includes("Activated"))
        toast("Employee activated successfully");
      else
        toast("Employee updated successfully");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to update employee");
    }
  };

  const handleDeleteUser = async (comment: string) => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/users/${deleteTarget.id}`, { data: { deletionComment: comment } });
      setDeleteTarget(null);
      toast("User deleted — all sessions revoked");
    } catch (err: any) {
      toast(err.response?.data?.error || "Failed to delete user");
    }
  };

  const downloadSample = () => {
    const cells = [uploadColumns, ...sampleRows]
      .map(
        (row) =>
          `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${cell}</Data></Cell>`).join("")}</Row>`,
      )
      .join("");
    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Employees"><Table>${cells}</Table></Worksheet>
</Workbook>`;
    const url = URL.createObjectURL(
      new Blob([workbook], { type: "application/vnd.ms-excel" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "nalanda-employee-upload-sample.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseDelimitedRows = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return lines
      .slice(1)
      .map((line) => line.split(",").map((cell) => cell.trim()));
  };

  const parseExcelRows = (text: string) => {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const rows = Array.from(doc.getElementsByTagName("Row"));
    return rows
      .slice(1)
      .map((row) =>
        Array.from(row.getElementsByTagName("Data")).map(
          (cell) => cell.textContent?.trim() || "",
        ),
      );
  };

  const importRows = (rows: string[][]) => {
    const existingIds = new Set(data.users.map((user) => user.id));
    const created: User[] = [];
    const skipped: string[] = [];

    rows.forEach(
      ([
        employeeId,
        name,
        email,
        doj,
        department,
        team,
        designation,
        role,
        reportingTo,
        status,
      ]) => {
        if (!employeeId || !name || !email || existingIds.has(employeeId)) {
          skipped.push(employeeId || name || "blank row");
          return;
        }
        const safeRole = roles.includes(role as Role)
          ? (role as Role)
          : "Employee";
        const safeStatus = status === "Inactive" ? "Inactive" : "Active";
        created.push({
          id: employeeId,
          name,
          email,
          password: "Password@123",
          avatar: initials(name),
          role: safeRole,
          department: department || "Unassigned",
          team: team || "Unassigned",
          designation: designation || "Employee",
          managerId: reportingTo || null,
          status: safeStatus,
          joinedAt: doj || new Date().toISOString().slice(0, 10),
          lastActive: "Never",
          preferences: {
            theme: "dark",
            language: "en",
            emailNotifications: true,
            pushNotifications: true,
            weeklyDigest: true,
            courseReminders: true,
            fontSize: "medium",
            reducedMotion: false,
            highContrast: false,
          },
        });
        existingIds.add(employeeId);
      },
    );

    if (created.length) {
      setData(
        addAudit(
          { ...data, users: [...created, ...data.users] },
          "Bulk uploaded employees",
          `${created.length} users`,
        ),
      );
    }
    setBulkMessage(
      `${created.length} employees imported${skipped.length ? `, ${skipped.length} skipped (${skipped.join(", ")})` : ""}.`,
    );
  };

  const handleBulkFile = (file: File | null) => {
    if (!file) return;
    setBulkFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows =
        file.name.toLowerCase().endsWith(".xls") || text.includes("<Workbook")
          ? parseExcelRows(text)
          : parseDelimitedRows(text);
      if (!rows.length) {
        setBulkMessage(
          "No employee rows found. Use the sample sheet format and upload again.",
        );
        return;
      }
      importRows(rows);
    };
    reader.onerror = () => setBulkMessage("Could not read the uploaded sheet.");
    reader.readAsText(file);
  };

  const togglePermission = (role: Role, permission: string) => {
    setPermissions((current) => {
      const selected = current[role].includes(permission);
      return {
        ...current,
        [role]: selected
          ? current[role].filter((item) => item !== permission)
          : [...current[role], permission],
      };
    });
  };

  const toggleTeamSkill = (skillId: string) => {
    const existing = data.targetSkills.find(
      (target) =>
        target.scope === "Department" &&
        target.department === `Team:${skillTeam}` &&
        target.skillId === skillId,
    );
    const nextTargets = existing
      ? data.targetSkills.filter((target) => target.id !== existing.id)
      : [
          {
            id: uid("TS"),
            skillId,
            scope: "Department" as const,
            department: `Team:${skillTeam}`,
            targetLevel,
            targetScore: Number(targetScore) || 80,
            priority: "High" as const,
          },
          ...data.targetSkills,
        ];
    setData(
      addAudit(
        { ...data, targetSkills: nextTargets },
        existing
          ? "Removed mandatory team skill"
          : "Added mandatory team skill",
        `${skillTeam}:${skillId}`,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Employees"
          value={String(data.users.length)}
          helper="Total organization records"
          tone="cyan"
        />
        <Metric
          label="Active"
          value={String(
            data.users.filter((user) => user.status === "Active").length,
          )}
          helper="Currently enabled"
          tone="green"
        />
        <Metric
          label="Inactive"
          value={String(
            data.users.filter((user) => user.status === "Inactive").length,
          )}
          helper="Disabled access"
          tone="amber"
        />
        <Metric
          label="Departments"
          value={String(departments.length)}
          helper={`${teams.length} teams mapped`}
          tone="violet"
        />
      </div>

      <Panel
        title="Advanced user management"
        kicker="Employee data control"
        action={
          <button
            onClick={() => {
              setEditing(null);
              setForm(blankForm(managers[0]?.id || ""));
              setOpen(true);
            }}
            className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-sm font-bold text-slate-950"
          >
            Add employee
          </button>
        }
      >
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            ["employees", "Employee data"],
            ["hierarchy", "Organization hierarchy"],
            ["skills", "Skill management"],
            ["bulk", "Bulk upload"],
            ["access", "Access management"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold",
                tab === key
                  ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 text-slate-300 hover:bg-white/5",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "employees" && (
          <div className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
              <Input
                label="Search employees"
                value={query}
                onChange={setQuery}
                placeholder="Name, ID, email, team, manager"
              />
              <Field label="Status">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "All" | Status)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option>All</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </Field>
              <Field label="Department">
                <select
                  value={departmentFilter}
                  onChange={(event) => setDepartmentFilter(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option>All</option>
                  {departments.map((department) => (
                    <option key={department}>{department}</option>
                  ))}
                </select>
              </Field>
              <Field label="Team">
                <select
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option>All</option>
                  {teams.map((team) => (
                    <option key={team}>{team}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1220px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">DOJ</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Designation</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Reporting to</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="text-slate-300">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} size="sm" />
                          <div>
                            <p className="font-medium text-white">
                              {user.name}
                            </p>
                            <p className="text-xs text-slate-500">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{user.email}</td>
                      <td className="px-4 py-4">{user.joinedAt}</td>
                      <td className="px-4 py-4">{user.department}</td>
                      <td className="px-4 py-4">{user.team}</td>
                      <td className="px-4 py-4">{user.designation}</td>
                      <td className="px-4 py-4">
                        <StatusPill
                          tone={
                            isAdminRole(user.role)
                              ? "violet"
                              : user.role === "Manager"
                                ? "cyan"
                                : "slate"
                          }
                        >
                          {user.role}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-4">
                        {managerName(data.users, user.managerId)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill
                          tone={user.status === "Active" ? "green" : "red"}
                        >
                          {user.status}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => editEmployee(user)}
                            className="action-btn rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-cyan-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              patch(
                                user.id,
                                {
                                  status:
                                    user.status === "Active"
                                      ? "Inactive"
                                      : "Active",
                                },
                                user.status === "Active"
                                  ? "Deactivated employee"
                                  : "Activated employee",
                              )
                            }
                            className="action-btn rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200"
                          >
                            {user.status === "Active"
                              ? "Deactivate"
                              : "Activate"}
                          </button>
                          {currentUser.role === "Super Admin" &&
                            user.id !== currentUser.id && (
                              <button
                                onClick={() => setDeleteTarget(user)}
                                className="action-btn rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-200"
                              >
                                Delete
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "hierarchy" && (
          <div className="space-y-4">
            {data.users
              .filter((user) => !user.managerId)
              .map((leader) => (
                <div
                  key={leader.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={leader.name} />
                      <div>
                        <p className="font-semibold text-white">
                          {leader.name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {leader.designation} · {leader.department} ·{" "}
                          {leader.team}
                        </p>
                      </div>
                    </div>
                    <StatusPill tone="violet">{leader.role}</StatusPill>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {data.users
                      .filter((user) => user.managerId === leader.id)
                      .map((report) => (
                        <div
                          key={report.id}
                          className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">
                                {report.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {report.id} · {report.designation}
                              </p>
                            </div>
                            <button
                              onClick={() => editEmployee(report)}
                              className="rounded-full border border-white/10 px-3 py-2 text-xs text-cyan-100"
                            >
                              Edit
                            </button>
                          </div>
                          <Field label="Reporting to">
                            <select
                              value={report.managerId || ""}
                              onChange={(event) =>
                                patch(
                                  report.id,
                                  { managerId: event.target.value || null },
                                  "Updated hierarchy",
                                )
                              }
                              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                            >
                              <option value="">None</option>
                              {managers
                                .filter((manager) => manager.id !== report.id)
                                .map((manager) => (
                                  <option key={manager.id} value={manager.id}>
                                    {manager.name}
                                  </option>
                                ))}
                            </select>
                          </Field>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === "bulk" && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <p className="font-semibold text-white">
                  Excel employee import
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  Download the sample, fill employee rows in Excel, then upload
                  the completed sheet.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={downloadSample}
                    className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-bold text-cyan-100 hover:bg-cyan-300/15"
                  >
                    Download sample Excel
                  </button>
                  <label className="cursor-pointer rounded-full bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950">
                    Upload filled sheet
                    <input
                      type="file"
                      accept=".xls,.csv,.txt"
                      onChange={(event) =>
                        handleBulkFile(event.target.files?.[0] || null)
                      }
                      className="hidden"
                    />
                  </label>
                </div>
                {bulkFileName && (
                  <p className="mt-4 text-sm text-slate-400">
                    Selected: <span className="text-white">{bulkFileName}</span>
                  </p>
                )}
              </div>
              {bulkMessage && (
                <p className="text-sm text-cyan-100">{bulkMessage}</p>
              )}
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
              <p className="font-semibold text-white">Sample columns</p>
              <p className="mt-3 text-slate-400">{uploadColumns.join(", ")}</p>
              <p className="mt-4 text-slate-500">
                Use employee IDs in the reportingTo column to wire the
                organization hierarchy during import.
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="py-2">Field</th>
                      <th className="py-2">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {uploadColumns.map((column, index) => (
                      <tr key={column}>
                        <td className="py-2 text-slate-300">{column}</td>
                        <td className="py-2 text-white">
                          {sampleRows[0][index]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "skills" && (
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="font-semibold text-white">Team skill mandate</p>
              <div className="mt-4 space-y-4">
                <Field label="Team">
                  <select
                    value={skillTeam}
                    onChange={(event) => setSkillTeam(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                  >
                    {teams.map((team) => (
                      <option key={team}>{team}</option>
                    ))}
                  </select>
                </Field>
                <Select
                  label="Target level"
                  value={targetLevel}
                  values={["Beginner", "Intermediate", "Advanced", "Expert"]}
                  onChange={setTargetLevel}
                />
                <Input
                  label="Target score"
                  value={targetScore}
                  onChange={setTargetScore}
                  type="number"
                />
              </div>
              <div className="mt-5 grid gap-3">
                <Metric
                  label="Team members"
                  value={String(teamUsers.length)}
                  helper="Will be monitored by selected skills"
                  tone="cyan"
                />
                <Metric
                  label="Mandatory skills"
                  value={String(mandatedSkills.length)}
                  helper="Active for this team"
                  tone="green"
                />
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="font-semibold text-white">
                Choose mandatory skills
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {data.skills
                  .filter((skill) => skill.status === "Active")
                  .map((skill) => {
                    const target = mandatedSkills.find(
                      (item) => item.skillId === skill.id,
                    );
                    const average = teamUsers.length
                      ? Math.round(
                          teamUsers.reduce(
                            (sum, user) =>
                              sum +
                              (data.skillRatings.find(
                                (rating) =>
                                  rating.userId === user.id &&
                                  rating.skill === skill.name,
                              )?.score || 0),
                            0,
                          ) / teamUsers.length,
                        )
                      : 0;
                    return (
                      <label
                        key={skill.id}
                        className={cn(
                          "rounded-2xl border p-4",
                          target
                            ? "border-cyan-300/35 bg-cyan-300/10"
                            : "border-white/10 bg-slate-950/40",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(target)}
                            onChange={() => toggleTeamSkill(skill.id)}
                            className="mt-1 h-5 w-5"
                          />
                          <div>
                            <p className="font-medium text-white">
                              {skill.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {skill.category} - team avg {average}%
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              {skill.description}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {tab === "access" && (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Permission</th>
                  {roles.map((role) => (
                    <th key={role} className="px-4 py-3">
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {permissionLabels.map((permission) => (
                  <tr key={permission} className="text-slate-300">
                    <td className="px-4 py-4 font-medium text-white">
                      {permission}
                    </td>
                    {roles.map((role) => (
                      <td key={role} className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={permissions[role].includes(permission)}
                          onChange={() => togglePermission(role, permission)}
                          className="h-5 w-5"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AnimatePresence>
        {open && (
          <Modal
            title={editing ? "Edit employee information" : "Add employee"}
            onClose={() => {
              setOpen(false);
              setEditing(null);
            }}
            wide
          >
            <form onSubmit={saveEmployee} className="grid gap-4 md:grid-cols-2">
              <Input
                label="Employee ID *"
                value={form.employeeId}
                onChange={(value) => setForm({ ...form, employeeId: value })}
                placeholder="e.g. EMP-2001"
              />
              <Input
                label="Full name *"
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
              />
              <Input
                label="Email *"
                value={form.email}
                onChange={(value) => setForm({ ...form, email: value })}
              />
              <Field label="Date of joining">
                <input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(event) =>
                    setForm({ ...form, dateOfJoining: event.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300"
                />
              </Field>
              <Input
                label="Department"
                value={form.department}
                onChange={(value) => setForm({ ...form, department: value })}
              />
              <Input
                label="Team"
                value={form.team}
                onChange={(value) => setForm({ ...form, team: value })}
              />
              <Input
                label="Designation"
                value={form.designation}
                onChange={(value) => setForm({ ...form, designation: value })}
              />
              <Select
                label="Role"
                value={form.role}
                values={roles}
                onChange={(value) => setForm({ ...form, role: value })}
              />
              <Field label="Reporting to">
                <select
                  value={form.managerId}
                  onChange={(event) =>
                    setForm({ ...form, managerId: event.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="">None</option>
                  {managers
                    .filter((manager) => manager.id !== form.employeeId)
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Select
                label="Status"
                value={form.status}
                values={["Active", "Inactive"]}
                onChange={(value) => setForm({ ...form, status: value })}
              />
              <Input
                label="Temporary password"
                value={form.password}
                onChange={(value) => setForm({ ...form, password: value })}
              />
              <button className="rounded-full bg-cyan-300 px-5 py-3 font-bold text-slate-950 md:col-span-2">
                Save employee information
              </button>
            </form>
          </Modal>
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            entityType="User"
            entityName={deleteTarget.name}
            entityId={deleteTarget.id}
            onConfirm={handleDeleteUser}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
