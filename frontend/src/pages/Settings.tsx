import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Bell,
  Shield,
  Palette,
  Info,
  ChevronRight,
  Check,
  LogOut,
} from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();

  // Notification settings
  const [alertNotifications, setAlertNotifications] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [callReminders, setCallReminders] = useState(true);
  const [reportNotifications, setReportNotifications] = useState(false);

  // Appearance
  const [theme, setTheme] = useState("Light");

  return (
    <div className="min-h-screen bg-[#f6f2e8]">

      {/* ================= HEADER ================= */}
      <header className="bg-[#064E3B] px-5 py-5 text-white sm:px-8">

        {/* BACK BUTTON */}
        <button
          onClick={() => navigate("/")}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-white transition hover:text-emerald-200"
        >
          <ArrowLeft size={21} strokeWidth={2.5} />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-semibold sm:text-3xl">
          Settings
        </h1>

        <p className="mt-1 text-sm text-emerald-100">
          Manage your CALL-E preferences
        </p>
      </header>


      {/* ================= MAIN CONTENT ================= */}
      <main className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">


        {/* ================= PROFILE ================= */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <User
                size={20}
                className="text-emerald-700"
              />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">
                Profile
              </h2>

              <p className="text-xs text-gray-500">
                Your account information
              </p>
            </div>

          </div>


          <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">

            <div className="flex items-center gap-4">

              <img
                src="https://i.pravatar.cc/100?img=47"
                alt="Profile"
                className="h-14 w-14 rounded-full object-cover ring-2 ring-emerald-100"
              />

              <div>
                <h3 className="font-semibold text-gray-800">
                  JS healthcare
                </h3>

                <p className="text-sm text-gray-500">
                  Care Team
                </p>
              </div>

            </div>


            <button
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
            >
              Edit Profile
            </button>

          </div>

        </section>


        {/* ================= NOTIFICATIONS ================= */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <Bell
                size={20}
                className="text-emerald-700"
              />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">
                Notifications
              </h2>

              <p className="text-xs text-gray-500">
                Choose which notifications you receive
              </p>
            </div>

          </div>


          <div className="divide-y divide-gray-100">

            {/* Alert Notifications */}
            <SettingToggle
              title="Patient alert notifications"
              description="Receive notifications when patients trigger an alert."
              enabled={alertNotifications}
              onChange={() =>
                setAlertNotifications(!alertNotifications)
              }
            />


            {/* Critical Alerts */}
            <SettingToggle
              title="Critical risk alerts"
              description="Get notified when a patient becomes high risk."
              enabled={criticalAlerts}
              onChange={() =>
                setCriticalAlerts(!criticalAlerts)
              }
            />


            {/* Call Reminders */}
            <SettingToggle
              title="Call reminders"
              description="Receive reminders for scheduled patient calls."
              enabled={callReminders}
              onChange={() =>
                setCallReminders(!callReminders)
              }
            />


            {/* Reports */}
            <SettingToggle
              title="Report notifications"
              description="Receive notifications when new reports are available."
              enabled={reportNotifications}
              onChange={() =>
                setReportNotifications(!reportNotifications)
              }
            />

          </div>

        </section>


        {/* ================= APPEARANCE ================= */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <Palette
                size={20}
                className="text-emerald-700"
              />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">
                Appearance
              </h2>

              <p className="text-xs text-gray-500">
                Customize how CALL-E looks
              </p>
            </div>

          </div>


          <div className="px-5 py-5 sm:px-6">

            <p className="mb-3 text-sm font-medium text-gray-700">
              Theme
            </p>


            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

              {["Light", "System", "Dark"].map((option) => (

                <button
                  key={option}
                  onClick={() => setTheme(option)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition ${
                    theme === option
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
                  }`}
                >

                  <span>{option}</span>

                  {theme === option && (
                    <Check size={17} />
                  )}

                </button>

              ))}

            </div>

          </div>

        </section>


        {/* ================= SECURITY ================= */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <Shield
                size={20}
                className="text-emerald-700"
              />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">
                Security & Privacy
              </h2>

              <p className="text-xs text-gray-500">
                Manage your account security
              </p>
            </div>

          </div>


          <div className="divide-y divide-gray-100">

            <SettingsLink
              title="Change password"
              description="Update your account password"
            />

            <SettingsLink
              title="Session management"
              description="Review active sessions"
            />

          </div>

        </section>


        {/* ================= ABOUT ================= */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
              <Info
                size={20}
                className="text-emerald-700"
              />
            </div>

            <div>
              <h2 className="font-semibold text-gray-800">
                About CALL-E
              </h2>

              <p className="text-xs text-gray-500">
                Application information
              </p>
            </div>

          </div>


          <div className="space-y-3 px-5 py-5 sm:px-6">

            <div className="flex items-center justify-between">

              <span className="text-sm text-gray-600">
                Application
              </span>

              <span className="text-sm font-medium text-gray-800">
                CALL-E
              </span>

            </div>


            <div className="flex items-center justify-between">

              <span className="text-sm text-gray-600">
                Version
              </span>

              <span className="text-sm font-medium text-gray-800">
                1.0.0
              </span>

            </div>


            <div className="flex items-center justify-between">

              <span className="text-sm text-gray-600">
                System
              </span>

              <span className="text-sm font-medium text-gray-800">
                AI Post-Discharge Monitoring
              </span>

            </div>

          </div>

        </section>


        {/* ================= SIGN OUT ================= */}
        <section className="rounded-xl border border-red-100 bg-white shadow-sm">

          <button
            onClick={() => navigate("/login")}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-red-50 sm:px-6"
          >

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <LogOut
                  size={19}
                  className="text-red-600"
                />
              </div>

              <div>

                <h2 className="text-sm font-semibold text-red-600">
                  Sign out
                </h2>

                <p className="text-xs text-gray-500">
                  Sign out of your CALL-E account
                </p>

              </div>

            </div>


            <ChevronRight
              size={19}
              className="text-gray-400"
            />

          </button>

        </section>


        {/* FOOTER */}
        <div className="pb-4 pt-2 text-center">

          <p className="text-xs text-gray-400">
            CALL-E Post-Discharge Monitoring System
          </p>

        </div>

      </main>

    </div>
  );
}


/* =========================================================
   TOGGLE COMPONENT
========================================================= */

interface SettingToggleProps {
  title: string;
  description: string;
  enabled: boolean;
  onChange: () => void;
}

function SettingToggle({
  title,
  description,
  enabled,
  onChange,
}: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">

      <div className="min-w-0">

        <h3 className="text-sm font-medium text-gray-800">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-5 text-gray-500">
          {description}
        </p>

      </div>


      <button
        onClick={onChange}
        aria-label={`Toggle ${title}`}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          enabled
            ? "bg-emerald-600"
            : "bg-gray-300"
        }`}
      >

        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            enabled
              ? "left-6"
              : "left-1"
          }`}
        />

      </button>

    </div>
  );
}


/* =========================================================
   SETTINGS LINK COMPONENT
========================================================= */

interface SettingsLinkProps {
  title: string;
  description: string;
}

function SettingsLink({
  title,
  description,
}: SettingsLinkProps) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50 sm:px-6"
    >

      <div>

        <h3 className="text-sm font-medium text-gray-800">
          {title}
        </h3>

        <p className="mt-1 text-xs text-gray-500">
          {description}
        </p>

      </div>


      <ChevronRight
        size={18}
        className="shrink-0 text-gray-400"
      />

    </button>
  );
}