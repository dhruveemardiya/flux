import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import CourierTracking from "./CourierTracking";

const CampaignView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const hideTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleLoadChange = (isLoading) => {
    if (isLoading) {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setLoading(true);
      return;
    }

    // delay hiding slightly to avoid flicker when multiple rapid loads occur
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setLoading(false);
      hideTimerRef.current = null;
    }, 800);
  };

  return (
    <div className="p-4">
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/75">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-transparent border-blue-600" />
              <div className="text-sm text-gray-700">Loading campaign...</div>
            </div>
          </div>
        )}

        <div style={{ visibility: loading ? "hidden" : "visible" }}>
          <CourierTracking
            initialCampaignId={id}
            showOnlyActive={Boolean(id)}
            onlyShowCampaignList={!id}
            showHeaderWhenList={!id}
            onLoadChange={handleLoadChange}
            renderActiveHeaderExtras={(
              <button
                type="button"
                onClick={() => navigate("/campaign")}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 mb-2"
              >
                Back
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
};

export default CampaignView;
