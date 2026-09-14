import {
  Activity,
  HeartPulse,
  Pill,
  Users,
  Brain,
} from "lucide-react";

const features = [
  {
    name: "Medication Adherence",
    value: 82,
    status: "Good",
    icon: Pill,
  },
  {
    name: "Caregiver Support",
    value: 88,
    status: "Strong",
    icon: Users,
  },
  {
    name: "Symptom Improvement",
    value: 72,
    status: "Improving",
    icon: HeartPulse,
  },
  {
    name: "Recovery Progress",
    value: 76,
    status: "On Track",
    icon: Activity,
  },
  {
    name: "Emotional Wellbeing",
    value: 68,
    status: "Monitor",
    icon: Brain,
  },
];

export default function Features() {
  return (
    <div className="space-y-6">

      <div>
        <h2 className="text-xl font-semibold text-gray-800">
          Patient Features
        </h2>

        <p className="text-sm text-gray-500 mt-1">
          AI-extracted health and recovery indicators
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5">

        {features.map((feature) => {
          const Icon = feature.icon;

          return (
            <div
              key={feature.name}
              className="bg-white border border-gray-200 rounded-xl p-6"
            >

              <div className="flex justify-between items-start">

                <div className="flex items-center gap-3">

                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <Icon
                      size={20}
                      className="text-green-600"
                    />
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-800">
                      {feature.name}
                    </h3>

                    <p className="text-xs text-gray-500 mt-1">
                      Last 14 days
                    </p>
                  </div>

                </div>

                <span className="text-lg font-semibold text-gray-800">
                  {feature.value}%
                </span>

              </div>

              <div className="mt-5">

                <div className="w-full h-2 bg-gray-100 rounded-full">
                  <div
                    className="h-2 bg-green-500 rounded-full"
                    style={{ width: `${feature.value}%` }}
                  />
                </div>

                <div className="flex justify-between mt-2">

                  <span className="text-xs text-gray-400">
                    Score
                  </span>

                  <span className="text-xs text-green-600">
                    {feature.status}
                  </span>

                </div>

              </div>

            </div>
          );
        })}

      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">

        <h3 className="font-semibold text-gray-800">
          Feature Trend
        </h3>

        <p className="text-sm text-gray-500 mt-1">
          Overall recovery indicators over the last 14 days
        </p>

        <div className="h-48 mt-6 flex items-end gap-3">

          {[45, 52, 48, 61, 58, 67, 64, 72, 70, 76, 74, 82].map(
            (height, index) => (
              <div
                key={index}
                className="flex-1 bg-green-100 rounded-t-md relative"
                style={{ height: `${height}%` }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-green-500 rounded-t-md"
                  style={{ height: `${height}%` }}
                />
              </div>
            )
          )}

        </div>

      </div>

    </div>
  );
}