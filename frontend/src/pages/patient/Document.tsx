import {
  FileText,
  Download,
  Eye,
} from "lucide-react";

const documents = [
  {
    name: "Discharge Summary",
    type: "PDF",
    date: "May 24, 2026",
  },
  {
    name: "Prescription",
    type: "PDF",
    date: "May 24, 2026",
  },
  {
    name: "Lab Results",
    type: "PDF",
    date: "May 25, 2026",
  },
  {
    name: "Follow-up Report",
    type: "PDF",
    date: "May 28, 2026",
  },
];

export default function Documents() {
  return (
    <div className="space-y-6">

      <div className="flex justify-between items-start">

        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Documents
          </h2>

          <p className="text-sm text-gray-500 mt-1">
            Patient medical and discharge documents
          </p>
        </div>

        <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          Upload Document
        </button>

      </div>

      <div className="bg-white border border-gray-200 rounded-xl">

        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">
            Patient Documents
          </h3>
        </div>

        <div className="divide-y divide-gray-100">

          {documents.map((document) => (
            <div
              key={document.name}
              className="px-6 py-5 flex items-center justify-between hover:bg-gray-50"
            >

              <div className="flex items-center gap-4">

                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <FileText
                    size={19}
                    className="text-gray-600"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {document.name}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    {document.type} · {document.date}
                  </p>
                </div>

              </div>

              <div className="flex gap-2">

                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <Eye size={17} />
                </button>

                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                  <Download size={17} />
                </button>

              </div>

            </div>
          ))}

        </div>

      </div>

    </div>
  );
}