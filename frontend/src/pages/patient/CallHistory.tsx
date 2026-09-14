import { Phone, Clock, CheckCircle } from "lucide-react";

const calls = [
  {
    date: "Today",
    time: "10:30 AM",
    duration: "08:42",
    outcome: "Completed",
    notes: "Patient reported moderate pain.",
  },
  {
    date: "Yesterday",
    time: "2:15 PM",
    duration: "06:18",
    outcome: "Completed",
    notes: "Medication adherence confirmed.",
  },
  {
    date: "May 28",
    time: "11:05 AM",
    duration: "07:31",
    outcome: "Completed",
    notes: "Patient doing well.",
  },
  {
    date: "May 26",
    time: "09:40 AM",
    duration: "05:54",
    outcome: "Completed",
    notes: "No major concerns reported.",
  },
];

export default function CallHistory() {
  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          Call History
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          Previous CALLE patient interactions
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">

        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            Recent Calls
          </h3>
        </div>

        <div className="divide-y divide-gray-100">

          {calls.map((call, index) => (
            <div
              key={index}
              className="px-6 py-5 flex items-center justify-between hover:bg-gray-50"
            >

              <div className="flex items-center gap-4">

                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <Phone size={18} className="text-green-600" />
                </div>

                <div>
                  <p className="font-medium text-gray-800">
                    CALLE Check-in
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {call.date} · {call.time}
                  </p>

                  <p className="text-xs text-gray-400 mt-1">
                    {call.notes}
                  </p>
                </div>

              </div>

              <div className="flex items-center gap-8">

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock size={15} />
                  {call.duration}
                </div>

                <div className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle size={15} />
                  {call.outcome}
                </div>

                <button className="text-sm text-green-600 hover:underline">
                  View
                </button>

              </div>

            </div>
          ))}

        </div>
      </div>

    </div>
  );
}