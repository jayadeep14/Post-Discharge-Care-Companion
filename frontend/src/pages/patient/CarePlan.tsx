import {
  CheckCircle,
  Clock,
  Calendar,
} from "lucide-react";

const tasks = [
  {
    title: "Take morning medication",
    time: "8:00 AM",
    completed: true,
  },
  {
    title: "Complete CALLE check-in",
    time: "10:30 AM",
    completed: true,
  },
  {
    title: "Take evening medication",
    time: "8:00 PM",
    completed: false,
  },
  {
    title: "Nurse follow-up",
    time: "Tomorrow",
    completed: false,
  },
];

export default function CarePlan() {
  return (
    <div className="space-y-6">

      <div className="flex justify-between items-start">

        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Care Plan
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Patient recovery plan and scheduled activities
          </p>
        </div>

        <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          Edit Care Plan
        </button>

      </div>

      <div className="grid grid-cols-3 gap-5">

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Plan Progress
          </p>

          <p className="text-2xl font-semibold mt-2">
            76%
          </p>

          <p className="text-xs text-green-600 mt-1">
            On track
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Completed Tasks
          </p>

          <p className="text-2xl font-semibold mt-2">
            8
          </p>

          <p className="text-xs text-gray-500 mt-1">
            This week
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">
            Next Follow-up
          </p>

          <p className="text-2xl font-semibold mt-2">
            Tomorrow
          </p>

          <p className="text-xs text-gray-500 mt-1">
            Nurse consultation
          </p>
        </div>

      </div>

      <div className="bg-white border border-gray-200 rounded-xl">

        <div className="px-6 py-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            Today's Care Tasks
          </h3>
        </div>

        <div className="divide-y divide-gray-100">

          {tasks.map((task) => (
            <div
              key={task.title}
              className="px-6 py-5 flex items-center justify-between"
            >

              <div className="flex items-center gap-4">

                {task.completed ? (
                  <CheckCircle
                    size={20}
                    className="text-green-500"
                  />
                ) : (
                  <Clock
                    size={20}
                    className="text-gray-400"
                  />
                )}

                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {task.title}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {task.time}
                  </p>
                </div>

              </div>

              <span
                className={`text-xs px-2.5 py-1 rounded-md ${
                  task.completed
                    ? "bg-green-50 text-green-600"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {task.completed ? "Completed" : "Pending"}
              </span>

            </div>
          ))}

        </div>

      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">

        <div className="flex items-center gap-3">

          <Calendar
            size={20}
            className="text-green-600"
          />

          <div>
            <h3 className="font-semibold text-gray-800">
              Next Follow-up
            </h3>

            <p className="text-sm text-gray-500 mt-1">
              Nurse consultation scheduled for tomorrow at 11:00 AM.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}