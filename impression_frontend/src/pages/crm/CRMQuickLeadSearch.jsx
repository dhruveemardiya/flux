import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  FaSearch, FaBuilding, FaUser, FaPhoneAlt, FaEnvelope,
  FaMapMarkerAlt, FaCalendarAlt, FaClock, FaCommentDots,
  FaPlusCircle, FaHistory, FaTag, FaSpinner, FaPaperPlane,
  FaPhoneVolume, FaEnvelopeOpenText, FaHandshake, FaWhatsapp
} from "react-icons/fa";
import BASE_URL from "../config";
import axiosInstance from "../axiosconfig";

export default function CRMQuickLeadSearch({ user }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  // Lead 360 & Timeline State
  const [leadProfile, setLeadProfile] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // New Communication Form State
  const [channel, setChannel] = useState("Call");
  const [commNotes, setCommNotes] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [followupTime, setFollowupTime] = useState("");
  const [submittingComm, setSubmittingComm] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axiosInstance.get(`${BASE_URL}/api/crm/quick-search/`, {
          params: { q: searchTerm.trim() },
        });
        setSearchResults(res.data.results || []);
      } catch (err) {
        // silent fail on debounce
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadLeadTimeline = async (leadId) => {
    setSelectedLeadId(leadId);
    setLoadingTimeline(true);
    try {
      const res = await axiosInstance.get(`${BASE_URL}/api/crm/leads/${leadId}/timeline/`);
      setLeadProfile(res.data.lead || null);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load lead timeline.");
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleAddCommunication = async (e) => {
    e.preventDefault();
    if (!selectedLeadId) return;
    if (!commNotes.trim()) {
      toast.warning("Please enter discussion notes.");
      return;
    }

    setSubmittingComm(true);
    try {
      await axiosInstance.post(`${BASE_URL}/api/crm/leads/${selectedLeadId}/timeline/`, {
        channel,
        notes: commNotes.trim(),
        next_followup_date: followupDate || null,
        next_followup_time: followupTime || null,
      });

      toast.success("Communication logged and timeline updated!");
      setCommNotes("");
      setFollowupDate("");
      setFollowupTime("");
      // Reload timeline
      loadLeadTimeline(selectedLeadId);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to log communication.");
    } finally {
      setSubmittingComm(false);
    }
  };

  const getChannelIcon = (ch) => {
    switch (ch?.toLowerCase()) {
      case "call":
        return <FaPhoneVolume className="text-blue-500" />;
      case "email":
        return <FaEnvelopeOpenText className="text-amber-500" />;
      case "meeting":
        return <FaHandshake className="text-emerald-500" />;
      case "whatsapp":
        return <FaWhatsapp className="text-green-500" />;
      default:
        return <FaCommentDots className="text-purple-500" />;
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FaSearch className="text-blue-600" /> Quick Lead Search & 360° Timeline
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Instant multi-field search across company, contact, phone, email with full chronological interaction history.
        </p>
      </div>

      {/* Global Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative">
          <FaSearch className="absolute left-4 top-3.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Type Company Name, Contact Person, Phone, Alternate Mobile, or Email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-10 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
            autoFocus
          />
          {searching && (
            <FaSpinner className="animate-spin absolute right-4 top-3.5 text-blue-600" size={16} />
          )}
        </div>
      </div>

      {/* Main Content: Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search Results */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">Search Results</h2>
              <span className="text-xs text-slate-500 font-medium">
                {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
              </span>
            </div>

            <div className="p-3 divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  {searchTerm.length < 2
                    ? "Enter at least 2 characters to search leads..."
                    : "No matching leads found."}
                </div>
              ) : (
                searchResults.map((ld) => {
                  const isSelected = selectedLeadId === ld.id;
                  return (
                    <div
                      key={ld.id}
                      onClick={() => loadLeadTimeline(ld.id)}
                      className={`p-3.5 rounded-xl cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-50 border-2 border-blue-500 shadow-sm"
                          : "hover:bg-slate-50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <FaBuilding className="text-slate-400" size={12} />
                          {ld.company_name}
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                          {ld.segment}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                        <FaUser className="text-slate-400" size={11} /> {ld.contact_person}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                        {ld.mobile_number && (
                          <span className="flex items-center gap-1 text-blue-600 font-medium">
                            <FaPhoneAlt size={10} /> {ld.mobile_number}
                          </span>
                        )}
                        {ld.email && (
                          <span className="flex items-center gap-1 truncate max-w-[160px]">
                            <FaEnvelope size={10} /> {ld.email}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic truncate">
                        Last: {ld.last_interaction}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: 360° Lead View & Timeline */}
        <div className="lg:col-span-7 space-y-6">
          {!selectedLeadId ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
              <FaHistory className="mx-auto text-4xl text-slate-300 mb-3" />
              <p className="text-base font-semibold text-slate-700">No Lead Selected</p>
              <p className="text-sm mt-1">
                Select a lead from the search results on the left to view their 360° profile, communication timeline, and log interactions.
              </p>
            </div>
          ) : loadingTimeline ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-500">
              <FaSpinner className="animate-spin text-3xl text-blue-600 mx-auto mb-2" />
              <p className="text-sm">Loading 360° Lead Timeline...</p>
            </div>
          ) : (
            <>
              {/* 360° Profile Header */}
              {leadProfile && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FaBuilding className="text-blue-600" /> {leadProfile.company_name}
                      </h2>
                      <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{leadProfile.contact_person}</span>
                        {leadProfile.designation && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {leadProfile.designation}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full self-start">
                      {leadProfile.segment || "Unassigned Segment"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 font-semibold uppercase block text-[10px]">Primary Mobile</span>
                      <a href={`tel:${leadProfile.mobile}`} className="text-blue-600 font-bold hover:underline">
                        {leadProfile.mobile || "N/A"}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold uppercase block text-[10px]">Email Address</span>
                      <a href={`mailto:${leadProfile.email}`} className="text-slate-700 font-medium hover:underline truncate block">
                        {leadProfile.email || "N/A"}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold uppercase block text-[10px]">Location</span>
                      <span className="text-slate-700 font-medium">
                        {[leadProfile.city, leadProfile.state].filter(Boolean).join(", ") || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Log Communication Form */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-3">
                  <FaPlusCircle className="text-blue-600" /> Log Interaction & Schedule Follow-Up
                </h3>

                <form onSubmit={handleAddCommunication} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Channel</label>
                      <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="Call">Phone Call</option>
                        <option value="Meeting">Direct Meeting</option>
                        <option value="Email">Email Communication</option>
                        <option value="WhatsApp">WhatsApp Message</option>
                        <option value="Note">Internal Discussion Note</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Next Follow-Up Date</label>
                      <input
                        type="date"
                        value={followupDate}
                        onChange={(e) => setFollowupDate(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Follow-Up Time</label>
                      <input
                        type="time"
                        value={followupTime}
                        onChange={(e) => setFollowupTime(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Discussion Details *</label>
                    <textarea
                      rows={2}
                      placeholder="Enter discussion notes, call summary, customer feedback, next steps..."
                      value={commNotes}
                      onChange={(e) => setCommNotes(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingComm}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-2"
                    >
                      {submittingComm ? <FaSpinner className="animate-spin" /> : <FaPaperPlane size={11} />}
                      Add to Timeline
                    </button>
                  </div>
                </form>
              </div>

              {/* 360° Chronological Timeline */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FaHistory className="text-blue-600" /> Chronological Timeline
                  </h3>
                  <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2.5 py-0.5 rounded-full">
                    {timeline.length} {timeline.length === 1 ? "entry" : "entries"}
                  </span>
                </div>

                {timeline.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No communication or task updates logged yet for this lead.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {timeline.map((entry) => (
                      <div key={entry.id} className="relative group">
                        {/* Dot */}
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        </div>

                        {/* Content Box */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 group-hover:border-slate-300 transition space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{getChannelIcon(entry.channel)}</span>
                              <span className="text-xs font-bold text-slate-800">{entry.channel}</span>
                              <span className="text-xs text-slate-500">by {entry.staff_name}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ""}
                            </span>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
                            {entry.notes}
                          </p>

                          {entry.next_followup_date && (
                            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700">
                              <FaClock size={10} />
                              Scheduled Follow-up: {entry.next_followup_date} {entry.next_followup_time || ""}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

