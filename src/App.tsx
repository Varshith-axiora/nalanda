import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn, Avatar, ToastNotification } from "./components";
import { navByRole, uid, now } from "./types";
import type { AppData, ModuleKey, User, LoginSecurity } from "./types";
// import { seedData } from "./seedData";
import { api } from "./lib/api";
import { setToastHandler } from "./toast";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import Assessments from "./pages/Assessments";
import Skills from "./pages/Skills";
import Users from "./pages/Users";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Certificates from "./pages/Certificates";
import Evaluation from "./pages/Evaluation";
import Archive from "./pages/Archive";

function ModuleGlyph({ icon, active }: { icon: string; active: boolean }) {
  const palette: Record<string, string> = {
    dashboard: "from-cyan-300 via-blue-400 to-sky-600",
    users: "from-emerald-300 via-teal-400 to-cyan-600",
    courses: "from-amber-300 via-orange-400 to-rose-500",
    assessments: "from-violet-300 via-fuchsia-400 to-indigo-600",
    skills: "from-lime-300 via-emerald-400 to-teal-600",
    reports: "from-rose-300 via-pink-400 to-violet-600",
    certificates: "from-yellow-200 via-amber-300 to-orange-500",
    evaluation: "from-red-300 via-orange-400 to-amber-500",
    archive: "from-rose-300 via-red-400 to-rose-600",
    settings: "from-slate-200 via-slate-400 to-slate-700",
    team: "from-blue-300 via-cyan-400 to-emerald-500",
    "my-learning": "from-cyan-200 via-emerald-300 to-lime-500",
  };

  return (
    <span
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
        active
          ? "border-slate-950/10 bg-slate-950/10"
          : "border-white/10 bg-white/[0.03]",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rotate-45 rounded-[0.3rem] bg-gradient-to-br shadow-lg",
          palette[icon] || palette.dashboard,
        )}
        style={{
          transform: "rotateX(54deg) rotateZ(45deg)",
          boxShadow: active
            ? "0 10px 20px rgba(15, 23, 42, 0.3)"
            : "0 10px 22px rgba(34, 211, 238, 0.16)",
        }}
      />
      <span className="absolute bottom-1.5 h-1.5 w-4 rounded-full bg-black/20 blur-[1px]" />
    </span>
  );
}

function useLocalState<T>(key: string, init: T) {
  const [val, setVal] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : init;
    } catch {
      return init;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(val));
  }, [key, val]);
  return [val, setVal] as const;
}

function normalizeData(data: AppData): AppData {
  return {
    ...data,
    users: data.users || [],
    skills: data.skills || [],
    targetSkills: data.targetSkills || [],
    chapters: data.chapters || [],
    courses: data.courses || [],
    enrollments: data.enrollments || [],
    assessments: data.assessments || [],
    attempts: data.attempts || [],
    archive: data.archive || [],
    loginSecurity: data.loginSecurity || {},
    sessionVersion: data.sessionVersion || {},
    issuedCertificates: data.issuedCertificates || [],
  };
}

export default function App() {
  const [rawData, setDataState] = useLocalState<AppData>(
    "nalanda-v3",
    { users: [], courses: [], enrollments: [], attempts: [], audit: [], skills: [], targetSkills: [], chapters: [], assessments: [], archive: [], loginSecurity: {}, sessionVersion: {}, issuedCertificates: [] } as any,
  );
  const data = normalizeData(rawData);
  const [sessionId, setSessionId] = useLocalState<string | null>(
    "nalanda-session-v3",
    null,
  );
  const [sessionVersion, setSessionVersion] = useLocalState<number | null>(
    "nalanda-session-ver",
    null,
  );
  const [module, setModule] = useState<ModuleKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const sessionRevokedRef = useRef(false);

  useEffect(() => {
    setToastHandler((msg) => {
      setToastMsg(null);
      requestAnimationFrame(() => setToastMsg(msg));
    });
  }, []);

  const currentUser =
    data.users.find((u) => u.id === sessionId && u.status === "Active") || null;
  const setData = (next: AppData) => setDataState(next);

  const signIn = (u: User) => {
    const ver = data.sessionVersion?.[u.id] || 0;
    setSessionId(u.id);
    setSessionVersion(ver);
    sessionRevokedRef.current = false;
    setData({
      ...data,
      audit: [
        {
          id: uid("AUD"),
          actorId: u.id,
          action: "Signed in",
          entity: u.id,
          at: now(),
        },
        ...data.audit,
      ],
    });
  };

  const forceSignOut = useCallback(
    (reason: string) => {
      if (sessionRevokedRef.current) return;
      sessionRevokedRef.current = true;
      setSessionId(null);
      setSessionVersion(null);
      setToastMsg(reason);
    },
    [setSessionId, setSessionVersion],
  );

  const resetDemo = () => {
    setToastMsg("Resetting is disabled in production.");
  };

  const handleUpdateSecurity = useCallback(
    (next: Record<string, LoginSecurity>) => {
      setDataState((prev) => {
        const normalized = normalizeData(prev);
        return { ...normalized, loginSecurity: next };
      });
    },
    [setDataState],
  );

  // Periodic session validation — every 5 seconds
  useEffect(() => {
    if (!sessionId) return;

    const validate = async () => {
      // 1. Fetch real data from backend
      try {
        const [usersRes, coursesRes, assignmentsRes, assessmentsRes, skillsRes, archiveRes] = await Promise.all([
          api.get("/api/users"),
          api.get("/api/courses"),
          api.get("/api/assignments"),
          api.get("/api/assessments"),
          api.get("/api/skills"),
          api.get("/api/archive")
        ]);
        
        setDataState(prev => ({
          ...prev,
          users: usersRes.data.data,
          courses: coursesRes.data.data,
          enrollments: assignmentsRes.data.data,
          assessments: assessmentsRes.data.data,
          skills: skillsRes.data.data,
          archive: archiveRes.data.data
        }));
      } catch (err) {
        console.error("Failed to fetch real data from API", err);
      }

      // 2. Validate current session against fetched data
      const freshData = normalizeData(rawData);
      const user = freshData.users.find((u) => u.id === sessionId);

      if (!user) {
        forceSignOut("Session expired — your account has been deleted.");
        return;
      }
      if (user.status !== "Active") {
        forceSignOut("Session revoked — your account has been deactivated.");
        return;
      }
      const currentVer = freshData.sessionVersion?.[sessionId] || 0;
      if (sessionVersion !== null && currentVer !== sessionVersion) {
        forceSignOut(
          "Session revoked — your access has been changed by an administrator.",
        );
        return;
      }
    };

    const interval = setInterval(validate, 5000);
    // Also validate immediately
    validate();
    return () => clearInterval(interval);
  }, [sessionId, sessionVersion, rawData, forceSignOut]);

  useEffect(() => {
    if (
      currentUser &&
      !navByRole[currentUser.role].some((n) => n.key === module)
    )
      setModule("dashboard");
  }, [currentUser, module]);

  if (!currentUser)
    return (
      <Login
        users={data.users}
        data={data}
        onLogin={signIn}
        onUpdateSecurity={handleUpdateSecurity}
      />
    );

  const nav = navByRole[currentUser.role];

  const render = () => {
    switch (module) {
      case "dashboard":
        return <Dashboard data={data} currentUser={currentUser} />;
      case "my-learning":
        return (
          <Courses
            data={{
              ...data,
              courses: data.courses.filter(
                (c) =>
                  data.enrollments.some(
                    (e) => e.userId === currentUser.id && e.courseId === c.id,
                  ) && c.approval === "Approved",
              ),
            }}
            currentUser={{ ...currentUser, role: "Employee" }}
            setData={setData}
          />
        );
      case "courses":
        return (
          <Courses data={data} currentUser={currentUser} setData={setData} />
        );
      case "assessments":
        return (
          <Assessments
            data={data}
            currentUser={currentUser}
            setData={setData}
          />
        );
      case "skills":
        return (
          <Skills data={data} currentUser={currentUser} setData={setData} />
        );
      case "users":
        return (
          <Users data={data} currentUser={currentUser} setData={setData} />
        );
      case "team":
        return <Team data={data} currentUser={currentUser} />;
      case "settings":
        return (
          <Settings data={data} currentUser={currentUser} setData={setData} />
        );
      case "reports":
        return <Reports data={data} currentUser={currentUser} />;
      case "certificates":
        return (
          <Certificates
            data={data}
            currentUser={currentUser}
            setData={setData}
          />
        );
      case "evaluation":
        return <Evaluation data={data} currentUser={currentUser} />;
      case "archive":
        return (
          <Archive data={data} currentUser={currentUser} setData={setData} />
        );
      default:
        return <Dashboard data={data} currentUser={currentUser} />;
    }
  };

  return (
    <>
      <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none fixed inset-0 bg-mesh" />
        <div className="relative z-10 flex min-h-screen">
          {/* Desktop sidebar */}
          <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-950/70 p-5 backdrop-blur-xl lg:flex lg:flex-col">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 rounded-2xl border border-cyan-200/30 bg-cyan-300/10">
                <motion.span
                  className="absolute inset-2 rounded-xl bg-cyan-300/80"
                  animate={{ scale: [1, 0.72, 1], opacity: [0.95, 0.55, 0.95] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </div>
              <div>
                <p className="font-display text-lg font-semibold text-white">
                  Nalanda
                </p>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  L&D Platform
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <Avatar name={currentUser.name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-white text-sm">
                    {currentUser.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {currentUser.role} - {currentUser.department}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setSessionId(null)}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  Sign out
                </button>
                <button
                  onClick={resetDemo}
                  className="rounded-full border border-rose-300/20 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-300/10"
                >
                  Reset
                </button>
              </div>
            </div>

            <nav className="mt-6 flex-1 space-y-1">
              {nav.map((n) => (
                <button
                  key={n.key}
                  onClick={() => setModule(n.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition",
                    module === n.key
                      ? "bg-white text-slate-950 shadow-lg"
                      : "text-slate-400 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <ModuleGlyph icon={n.icon} active={module === n.key} />
                  <span>{n.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium text-white">Nalanda v1.0</p>
              <p className="mt-1 text-xs text-slate-500 leading-5">
                Data persists in localStorage. Frontend demo with mock data.
              </p>
            </div>
          </aside>

          {/* Mobile header */}
          <div className="fixed top-0 left-0 right-0 z-40 lg:hidden">
            <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur-xl">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white"
              >
                Menu
              </button>
              <p className="font-display text-lg font-semibold text-white">
                Nalanda
              </p>
              <button
                onClick={() => setSessionId(null)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"
              >
                Sign out
              </button>
            </header>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -200 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -200 }}
                  className="absolute top-full left-0 w-64 border-r border-white/10 bg-slate-950 p-4 shadow-2xl"
                >
                  <nav className="space-y-1">
                    {nav.map((n) => (
                      <button
                        key={n.key}
                        onClick={() => {
                          setModule(n.key);
                          setSidebarOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium",
                          module === n.key
                            ? "bg-white text-slate-950"
                            : "text-slate-400",
                        )}
                      >
                        <ModuleGlyph icon={n.icon} active={module === n.key} />
                        <span>{n.label}</span>
                      </button>
                    ))}
                  </nav>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main content */}
          <section className="min-w-0 flex-1 p-4 pt-16 md:p-6 lg:p-8 lg:pt-8">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                {currentUser.role} workspace
              </p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-white">
                {nav.find((n) => n.key === module)?.label}
              </h1>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentUser.id}-${module}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                {render()}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </main>
      <ToastNotification message={toastMsg} onDone={() => setToastMsg(null)} />
    </>
  );
}
// trigger deploy
