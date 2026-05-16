import { Panel, StarRating, cn } from "../components";
import type { AppData, User, UserPreferences } from "../types";
import { now, uid } from "../types";

export default function Settings({
  data,
  currentUser,
  setData,
}: {
  data: AppData;
  currentUser: User;
  setData: (d: AppData) => void;
}) {
  const prefs = currentUser.preferences;
  const updatePrefs = (p: Partial<UserPreferences>) => {
    setData({
      ...data,
      users: data.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, preferences: { ...u.preferences, ...p } }
          : u,
      ),
      audit: [
        {
          id: uid("AUD"),
          actorId: currentUser.id,
          action: "Updated settings",
          entity: currentUser.id,
          at: now(),
        },
        ...data.audit,
      ],
    });
  };

  return (
    <div className="space-y-6">
      <Panel title="Profile" kicker="Your account">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200/20 bg-gradient-to-br from-cyan-400/20 to-violet-400/20 text-2xl font-bold text-white">
                {currentUser.avatar}
              </div>
              <div>
                <p className="text-xl font-semibold text-white">
                  {currentUser.name}
                </p>
                <p className="text-sm text-slate-400">{currentUser.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">ID</p>
                <p className="text-white">{currentUser.id}</p>
              </div>
              <div>
                <p className="text-slate-500">Role</p>
                <p className="text-white">{currentUser.role}</p>
              </div>
              <div>
                <p className="text-slate-500">Department</p>
                <p className="text-white">{currentUser.department}</p>
              </div>
              <div>
                <p className="text-slate-500">Designation</p>
                <p className="text-white">{currentUser.designation}</p>
              </div>
              <div>
                <p className="text-slate-500">Joined</p>
                <p className="text-white">{currentUser.joinedAt}</p>
              </div>
              <div>
                <p className="text-slate-500">Last active</p>
                <p className="text-white">{currentUser.lastActive}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Appearance
              </h3>
              <div className="space-y-4">
                <label className="flex items-center justify-between text-sm text-slate-300">
                  <span>Theme</span>
                  <select
                    value={prefs.theme}
                    onChange={(e) =>
                      updatePrefs({ theme: e.target.value as any })
                    }
                    className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white text-sm"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                    <option value="system">System</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-sm text-slate-300">
                  <span>Font size</span>
                  <select
                    value={prefs.fontSize}
                    onChange={(e) =>
                      updatePrefs({ fontSize: e.target.value as any })
                    }
                    className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white text-sm"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>
                <label className="flex items-center justify-between text-sm text-slate-300">
                  <span>Language</span>
                  <select
                    value={prefs.language}
                    onChange={(e) =>
                      updatePrefs({ language: e.target.value as any })
                    }
                    className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-white text-sm"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="ta">Tamil</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Notifications" kicker="Preferences">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="space-y-5">
            {(
              [
                [
                  "emailNotifications",
                  "Email notifications",
                  "Receive course updates via email",
                ],
                [
                  "pushNotifications",
                  "Push notifications",
                  "Browser push alerts for deadlines",
                ],
                [
                  "weeklyDigest",
                  "Weekly digest",
                  "Summary of your learning progress",
                ],
                [
                  "courseReminders",
                  "Course reminders",
                  "Reminders for incomplete courses",
                ],
              ] as const
            ).map(([key, label, desc]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => updatePrefs({ [key]: e.target.checked })}
                  className="h-5 w-5 accent-cyan-300"
                />
              </label>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Accessibility" kicker="Inclusive design">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Reduced motion</p>
                <p className="text-xs text-slate-500">
                  Minimize animations throughout the UI
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefs.reducedMotion}
                onChange={(e) =>
                  updatePrefs({ reducedMotion: e.target.checked })
                }
                className="h-5 w-5 accent-cyan-300"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">High contrast</p>
                <p className="text-xs text-slate-500">
                  Increase text and UI contrast
                </p>
              </div>
              <input
                type="checkbox"
                checked={prefs.highContrast}
                onChange={(e) =>
                  updatePrefs({ highContrast: e.target.checked })
                }
                className="h-5 w-5 accent-cyan-300"
              />
            </label>
          </div>
        </div>
      </Panel>
    </div>
  );
}
