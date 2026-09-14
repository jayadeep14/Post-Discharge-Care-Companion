import {
  Activity,
  AlertTriangle,
  CalendarDays,
  HeartPulse,
  Pill,
} from "lucide-react";

export default function Overview() {
  return (
    <div className="space-y-6">

      {/* Page title */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          Patient Overview
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Current health status and post-discharge monitoring summary
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-5">

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Readmission Risk
            </p>

            <Activity size={20} className="text-red-500" />
          </div>

          <p className="text-2xl font-semibold text-gray-800 mt-3">
            85%
          </p>

          <p className="text-xs text-red-500 mt-1">
            High risk
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Days Since Discharge
            </p>

            <CalendarDays size={20} className="text-blue-500" />
          </div>

          <p className="text-2xl font-semibold text-gray-800 mt-3">
            7 days
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Monitoring period
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Active Alerts
            </p>

            <AlertTriangle size={20} className="text-red-500" />
          </div>

          <p className="text-2xl font-semibold text-gray-800 mt-3">
            3
          </p>

          <p className="text-xs text-red-500 mt-1">
            Requires attention
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Latest Check-in
            </p>

            <HeartPulse size={20} className="text-green-500" />
          </div>

          <p className="text-2xl font-semibold text-gray-800 mt-3">
            10:30 AM
          </p>

          <p className="text-xs text-green-500 mt-1">
            Completed today
          </p>
        </div>

      </div>

      {/* Main grid */}
      <div className="grid grid-cols-2 gap-6">

        {/* Latest call */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">

          <h3 className="font-semibold text-gray-800">
            Latest CALLE Check-in
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Today, 10:30 AM
          </p>

          <div className="mt-5 space-y-4">

            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Medication adherence
              </span>

              <span className="text-sm font-medium text-green-600">
                Good
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Pain level
              </span>

              <span className="text-sm font-medium">
                4 / 10
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Symptoms
              </span>

              <span className="text-sm font-medium text-orange-600">
                Moderate
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Caregiver support
              </span>

              <span className="text-sm font-medium text-green-600">
                Available
              </span>
            </div>

          </div>
        </div>

        {/* Recommended action */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">

          <h3 className="font-semibold text-gray-800">
            Recommended Action
          </h3>

          <div className="mt-5 p-4 rounded-lg bg-red-50 border border-red-100">

            <div className="flex gap-3">

              <AlertTriangle
                size={20}
                className="text-red-500 mt-0.5"
              />

              <div>
                <p className="font-medium text-red-700">
                  Nurse follow-up required
                </p>

                <p className="text-sm text-red-600 mt-1">
                  Patient reported increased pain during the
                  latest check-in.
                </p>
              </div>

            </div>

          </div>

          <button className="mt-5 w-full py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
            Schedule Follow-up
          </button>

        </div>

      </div>

      {/* Medication */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">

        <div className="flex items-center gap-3 mb-5">
          <Pill size={20} className="text-green-600" />

          <div>
            <h3 className="font-semibold text-gray-800">
              Current Medication
            </h3>

            <p className="text-xs text-gray-500">
              Active prescriptions
            </p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">

          <div className="py-4 flex justify-between">
            <div>
              <p className="text-sm font-medium">
                Medication A
              </p>
              <p className="text-xs text-gray-500">
                500mg · Twice daily
              </p>
            </div>

            <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded">
              Active
            </span>
          </div>

          <div className="py-4 flex justify-between">
            <div>
              <p className="text-sm font-medium">
                Medication B
              </p>
              <p className="text-xs text-gray-500">
                20mg · Once daily
              </p>
            </div>

            <span className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded">
              Active
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}