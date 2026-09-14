import {
  FileText,
  Users,
  AlertTriangle,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

export default function Reports() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f6f2e8]">

      {/* HEADER */}
      <div className="bg-[#064E3B] px-6 py-5 text-white">

        {/* BACK BUTTON */}
        <button
          onClick={() => navigate("/")}
          className="mb-4 flex items-center gap-2 text-sm text-white transition hover:text-emerald-200"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
          <span>Back</span>
        </button>

        <h1 className="text-2xl font-semibold">
          Reports
        </h1>

        <p className="mt-1 text-sm text-emerald-100">
          Patient monitoring and post-discharge reports
        </p>

      </div>

      {/* CONTENT */}
      <main className="p-6">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* PATIENT REPORT */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700">
              <Users size={22} />
            </div>

            <h2 className="text-lg font-semibold text-gray-800">
              Patient Report
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              View patient monitoring and recovery information.
            </p>

            <button className="mt-4 text-sm font-medium text-green-700 hover:underline">
              View report →
            </button>
          </div>

          {/* ALERT REPORT */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle size={22} />
            </div>

            <h2 className="text-lg font-semibold text-gray-800">
              Alert Report
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Review patient alerts, risk levels and active issues.
            </p>

            <button className="mt-4 text-sm font-medium text-green-700 hover:underline">
              View report →
            </button>
          </div>

          {/* RECOVERY REPORT */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700">
              <TrendingUp size={22} />
            </div>

            <h2 className="text-lg font-semibold text-gray-800">
              Recovery Report
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Track recovery trends and post-discharge outcomes.
            </p>

            <button className="mt-4 text-sm font-medium text-green-700 hover:underline">
              View report →
            </button>
          </div>

        </div>

      </main>
    </div>
  );
}