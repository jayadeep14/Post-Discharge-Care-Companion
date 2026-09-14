import { AlertTriangle } from "lucide-react";

const alerts = [
  {
    title: "Increased pain reported",
    description:
      "Patient reported pain level of 7/10 during today's check-in.",
    severity: "Critical",
    time: "Today, 10:35 AM",
  },
  {
    title: "Medication adherence decreased",
    description:
      "Patient missed one scheduled medication dose.",
    severity: "Moderate",
    time: "Yesterday, 2:20 PM",
  },
  {
    title: "Follow-up approaching",
    description:
      "Scheduled follow-up is due within 24 hours.",
    severity: "Low",
    time: "Yesterday, 9:00 AM",
  },
];

export default function Alerts() {
  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          Patient Alerts
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Alerts generated from patient monitoring
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">

        <div className="bg-red-50 border border-red-100 rounded-xl p-5">
          <p className="text-sm text-red-600">
            Critical
          </p>

          <p className="text-2xl font-semibold text-red-700 mt-2">
            1
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-100 rounded-xl p-5">
          <p className="text-sm text-orange-600">
            Moderate
          </p>

          <p className="text-2xl font-semibold text-orange-700 mt-2">
            1
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-5">
          <p className="text-sm text-yellow-700">
            Low
          </p>

          <p className="text-2xl font-semibold text-yellow-800 mt-2">
            1
          </p>
        </div>

      </div>

      <div className="bg-white border border-gray-200 rounded-xl">

        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            Active Alerts
          </h3>
        </div>

        <div className="divide-y divide-gray-100">

          {alerts.map((alert, index) => {

            const critical = alert.severity === "Critical";
            const moderate = alert.severity === "Moderate";

            return (
              <div
                key={index}
                className="p-6 flex gap-4"
              >

                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    critical
                      ? "bg-red-50"
                      : moderate
                      ? "bg-orange-50"
                      : "bg-yellow-50"
                  }`}
                >
                  <AlertTriangle
                    size={19}
                    className={
                      critical
                        ? "text-red-500"
                        : moderate
                        ? "text-orange-500"
                        : "text-yellow-600"
                    }
                  />
                </div>

                <div className="flex-1">

                  <div className="flex justify-between">

                    <div>
                      <h4 className="font-medium text-gray-800">
                        {alert.title}
                      </h4>

                      <p className="text-sm text-gray-500 mt-1">
                        {alert.description}
                      </p>

                      <p className="text-xs text-gray-400 mt-2">
                        {alert.time}
                      </p>
                    </div>

                    <span className="text-xs px-2.5 py-1 rounded-md bg-red-50 text-red-600 h-fit">
                      {alert.severity}
                    </span>

                  </div>

                </div>

              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}