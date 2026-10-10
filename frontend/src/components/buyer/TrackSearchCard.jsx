import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, PackageCheck } from "lucide-react";

export default function TrackSearchCard({ initialValue = "" }) {
  const [searchTerm, setSearchTerm] = useState(initialValue);
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    const cleanId = searchTerm.trim();
    if (!cleanId) return;
    navigate(`/track/${encodeURIComponent(cleanId)}`);
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 text-center space-y-6">
      <div className="mx-auto w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
        <PackageCheck className="w-7 h-7" />
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-900">Track Production Order</h1>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Real-time visibility into your fabric order from spinning to dispatch
        </p>
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter Tracking ID (e.g. ORD104)"
            className="w-full text-sm rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
          />
        </div>

        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4" />
          Track Order
        </button>
      </form>

      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-400">
        <div>
          <span>Try sample orders: </span>
          <button
            type="button"
            onClick={() => navigate("/track/ORD104")}
            className="text-blue-600 hover:underline font-mono font-medium ml-1 cursor-pointer"
          >
            ORD104
          </button>
          <span className="mx-1">·</span>
          <button
            type="button"
            onClick={() => navigate("/track/ORD071")}
            className="text-blue-600 hover:underline font-mono font-medium cursor-pointer"
          >
            ORD071
          </button>
          <span className="mx-1">·</span>
          <button
            type="button"
            onClick={() => navigate("/track/ORD091")}
            className="text-blue-600 hover:underline font-mono font-medium cursor-pointer"
          >
            ORD091
          </button>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate("/workers")}
            className="text-slate-500 hover:text-slate-800 hover:underline text-[11px] cursor-pointer"
          >
            ← Return to Factory Operations
          </button>
        </div>
      </div>
    </div>
  );
}
