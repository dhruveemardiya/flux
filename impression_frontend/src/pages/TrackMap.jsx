import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useLocation } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import BASE_URL from "./config";
import { divIcon } from "leaflet";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const leadStatusColors = {
  Pending: "#dc2626",
  Dispatched: "#2563eb",
  Delivered: "#16a34a",
  Failed: "#f97316",
  Returned: "#7c3aed",
};

const visibleTrackMapStatuses = new Set(["Dispatched", "Delivered", "Failed", "Returned"]);

const trackMapStatusLegend = [
  { label: "Pending", color: leadStatusColors.Pending },
  { label: "Dispatched", color: leadStatusColors.Dispatched },
  { label: "Delivered", color: leadStatusColors.Delivered },
  { label: "Failed", color: leadStatusColors.Failed },
  { label: "Returned", color: leadStatusColors.Returned },
];

const cityCoordinates = {
  ahmedabad: [23.0225, 72.5714],
  bangalore: [12.9716, 77.5946],
  bengaluru: [12.9716, 77.5946],
  bhopal: [23.2599, 77.4126],
  "andhra pradesh": [15.9129, 79.74],
  "arunachal pradesh": [28.218, 94.7278],
  assam: [26.2006, 92.9376],
  hubli: [15.3647, 75.124],
  hubballi: [15.3647, 75.124],
  mangaluru: [12.9141, 74.856],
  mangalore: [12.9141, 74.856],
  rourkela: [22.2604, 84.8536],
  mysuru: [12.2958, 76.6394],
  bhubaneswar: [20.2961, 85.8245],
  cuttack: [20.4625, 85.883],
  berhampur: [19.315, 84.7941],
  sambalpur: [21.4669, 83.9756],
  bhadrak: [21.0583, 86.4952],
  bankashi: [21.0583, 86.4952],
  belgaum: [15.8497, 74.4977],
  belagavi: [15.8497, 74.4977],
  shimoga: [13.9299, 75.5681],
  shivamogga: [13.9299, 75.5681],
  tumkur: [13.3409, 77.101],
  davangere: [14.4644, 75.9218],
  bellary: [15.1394, 76.9214],
  bidar: [17.9104, 77.5199],
  gulbarga: [17.3297, 76.8343],
  kalaburagi: [17.3297, 76.8343],
  udupi: [13.3409, 74.7421],
  hassan: [13.0072, 76.1004],
  mandya: [12.5218, 76.8951],
  chikmagalur: [13.3153, 75.7754],
  raichur: [16.212, 77.3566],
  hospet: [15.2689, 76.387],
  tiruppur: [11.1085, 77.3411],
  salem: [11.6643, 78.146],
  erode: [11.341, 77.7172],
  vellore: [12.9165, 79.1325],
  tiruchirappalli: [10.7905, 78.7047],
  trichy: [10.7905, 78.7047],
  tirunelveli: [8.7139, 77.7567],
  thoothukudi: [8.7642, 78.1348],
  dindigul: [10.3673, 77.9803],
  thanjavur: [10.787, 79.1378],
  nellore: [14.4426, 79.9865],
  kurnool: [15.8281, 78.0373],
  rajahmundry: [17.0005, 81.804],
  kakinada: [16.9891, 82.2475],
  guntur: [16.2999, 80.4542],
  anantapur: [14.6819, 77.6006],
  warangal: [17.9784, 79.5941],
  nizamabad: [18.6725, 78.0941],
  karimnagar: [18.4386, 79.1288],
  khammam: [17.2473, 80.1514],
  ajmer: [26.4499, 74.6399],
  bikaner: [28.0229, 73.3119],
  jodhpur: [26.2389, 73.0243],
  udaipur: [24.5854, 73.7125],
  kota: [25.2138, 75.8648],
  alwar: [27.553, 76.6346],
  sikar: [27.6094, 75.1399],
  bhilwara: [25.3407, 74.6313],
  amritsar: [31.634, 74.8723],
  jalandhar: [31.326, 75.5762],
  patiala: [30.3398, 76.3869],
  bathinda: [30.211, 74.9455],
  rohtak: [28.8955, 76.6066],
  faridabad: [28.4089, 77.3178],
  panipat: [29.3909, 76.9635],
  ambala: [30.3782, 76.7767],
  dehradun: [30.3165, 78.0322],
  haridwar: [29.9457, 78.1642],
  roorkee: [29.8543, 77.888],
  agra: [27.1767, 78.0081],
  meerut: [28.9845, 77.7064],
  allahabad: [25.4358, 81.8463],
  prayagraj: [25.4358, 81.8463],
  varanasi: [25.3176, 82.9739],
  gorakhpur: [26.7606, 83.3732],
  aligarh: [27.8974, 78.088],
  moradabad: [28.8386, 78.7733],
  bareilly: [28.367, 79.4304],
  ghaziabad: [28.6692, 77.4538],
  noida: [28.5355, 77.391],
  ranchi: [23.3441, 85.3096],
  jamshedpur: [22.8046, 86.2029],
  dhanbad: [23.7957, 86.4304],
  bokaro: [23.6693, 86.1511],
  guwahati: [26.1445, 91.7362],
  dibrugarh: [27.4728, 94.912],
  silchar: [24.8333, 92.7789],
  imphal: [24.817, 93.9368],
  shillong: [25.5788, 91.8933],
  aizawl: [23.1645, 92.9376],
  kohima: [25.6701, 94.1077],
  agartala: [23.8315, 91.2868],
  gangtok: [27.3314, 88.6138],
  itanagar: [27.0844, 93.6053],
  raipur: [21.2514, 81.6296],
  bilaspur: [22.0796, 82.1391],
  durg: [21.1904, 81.2849],
  bhilai: [21.1938, 81.3509],
  jabalpur: [23.1815, 79.9864],
  gwalior: [26.2183, 78.1828],
  ujjain: [23.1765, 75.7885],
  sagar: [23.8388, 78.7378],
  satna: [24.5875, 80.8322],
  rewa: [24.537, 81.3042],
  vadodara: [22.3072, 73.1812],
  rajkot: [22.3039, 70.8022],
  bhavnagar: [21.7645, 72.1519],
  jamnagar: [22.4707, 70.0577],
  junagadh: [21.5222, 70.4579],
  anand: [22.5645, 72.9289],
  gandhinagar: [23.2156, 72.6369],
  amravati: [20.9374, 77.7796],
  aurangabad: [19.8762, 75.3433],
  solapur: [17.6599, 75.9064],
  kolhapur: [16.705, 74.2433],
  nanded: [19.1383, 77.321],
  jalgaon: [21.0077, 75.5626],
  akola: [20.7002, 77.0082],
  latur: [18.4088, 76.5604],
  dhule: [20.9042, 74.7749],
  sangli: [16.8544, 74.5815],
  satara: [17.6805, 74.0183],
  ratnagiri: [16.9944, 73.3],
  parbhani: [19.2704, 76.7762],
  chandrapur: [19.9615, 79.2961],
  yavatmal: [20.3888, 78.1204],
  thiruvananthapuram: [8.5241, 76.9366],
  kozhikode: [11.2588, 75.7804],
  thrissur: [10.5276, 76.2144],
  kollam: [8.8932, 76.6141],
  kannur: [11.8745, 75.3704],
  palakkad: [10.7867, 76.6548],
  malappuram: [11.051, 76.0711],
  alappuzha: [9.4981, 76.3388],
  kottayam: [9.5916, 76.5222],
  idukki: [9.9189, 77.1025],
  wayanad: [11.6854, 76.132],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  bihar: [25.0961, 85.3131],
  chhattisgarh: [21.2787, 81.8661],
  goa: [15.2993, 74.124],
  delhi: [28.6139, 77.209],
  gujarat: [22.2587, 71.1924],
  haryana: [29.0588, 76.0856],
  "himachal pradesh": [31.1048, 77.1734],
  gurgaon: [28.4595, 77.0266],
  hyderabad: [17.385, 78.4867],
  jharkhand: [23.6102, 85.2799],
  indore: [22.7196, 75.8577],
  jaipur: [26.9124, 75.7873],
  karnataka: [15.3173, 75.7139],
  kanpur: [26.4499, 80.3319],
  kerala: [10.8505, 76.2711],
  kochi: [9.9312, 76.2673],
  kolkata: [22.5726, 88.3639],
  "madhya pradesh": [22.9734, 78.6569],
  lucknow: [26.8467, 80.9466],
  ludhiana: [30.901, 75.8573],
  madurai: [9.9252, 78.1198],
  maharashtra: [19.7515, 75.7139],
  manipur: [24.6637, 93.9063],
  meghalaya: [25.467, 91.3662],
  mizoram: [23.1645, 92.9376],
  mumbai: [19.076, 72.8777],
  mysore: [12.2958, 76.6394],
  nagaland: [26.1584, 94.5624],
  nagpur: [21.1458, 79.0887],
  nashik: [19.9975, 73.7898],
  odisha: [20.9517, 85.0985],
  patna: [25.5941, 85.1376],
  pune: [18.5204, 73.8567],
  punjab: [31.1471, 75.3412],
  rajasthan: [27.0238, 74.2179],
  sikkim: [27.533, 88.5122],
  surat: [21.1702, 72.8311],
  "tamil nadu": [11.1271, 78.6569],
  telangana: [18.1124, 79.0193],
  tripura: [23.9408, 91.9882],
  "uttar pradesh": [26.8467, 80.9462],
  uttarakhand: [30.0668, 79.0193],
  "west bengal": [22.9868, 87.855],
  chandigarh: [30.7333, 76.7794],
  "jammu and kashmir": [33.7782, 76.5762],
  ladakh: [34.1526, 77.5771],
  vijayawada: [16.5062, 80.648],
  visakhapatnam: [17.6868, 83.2185],
};

const getCityCoordinates = (city) => {
  const normalizedCity = String(city || "").trim().toLowerCase();
  if (!normalizedCity) return [22.8, 78.9];

  if (cityCoordinates[normalizedCity]) {
    return cityCoordinates[normalizedCity];
  }

  let hash = 0;
  for (let index = 0; index < normalizedCity.length; index += 1) {
    hash = (hash * 31 + normalizedCity.charCodeAt(index)) >>> 0;
  }

  const lat = 10 + ((hash % 1700) / 100);
  const lng = 68 + (((Math.floor(hash / 1700)) % 1900) / 100);
  return [Math.min(lat, 35), Math.min(lng, 97)];
};

const buildLeadLocationLabel = (lead) => {
  const address = String(lead?.address_line1 ?? lead?.address ?? "").trim();
  const addressLine2 = String(lead?.address_line2 ?? "").trim();
  const city = String(lead?.city ?? "").trim();
  const state = String(lead?.state ?? "").trim();
  const pincode = String(lead?.pincode ?? "").trim();

  return [address, addressLine2, city, state, pincode].filter(Boolean).join(", ");
};

const getLeadLocationCoordinates = (lead, index = 0) => {
  const city = String(lead?.city ?? "").trim().toLowerCase();
  const state = String(lead?.state ?? "").trim().toLowerCase();
  const address = String(lead?.address_line1 ?? lead?.address ?? "").trim().toLowerCase();

  // Much smaller jitter - only about 1.5km spread so markers stay visually on the city.
  const jLat = (((index * 17) % 7) - 3) * 0.004;
  const jLng = (((index * 13) % 7) - 3) * 0.004;

  // 1. Direct city match.
  if (city && cityCoordinates[city]) {
    const [lat, lng] = cityCoordinates[city];
    return [lat + jLat, lng + jLng];
  }

  // 2. Partial city match, e.g. "visakhapatnam" in "visakhapatnam-530026".
  // Only match if the city field starts with a known city to avoid false matches.
  for (const knownCity of Object.keys(cityCoordinates)) {
    if (knownCity.length >= 5 && city.startsWith(knownCity)) {
      const [lat, lng] = cityCoordinates[knownCity];
      return [lat + jLat, lng + jLng];
    }
  }

  // 3. Try finding a known city name inside the address text.
  for (const knownCity of Object.keys(cityCoordinates)) {
    if (knownCity === city) continue;
    const wordBoundary = new RegExp(`\\b${knownCity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (wordBoundary.test(address)) {
      const [lat, lng] = cityCoordinates[knownCity];
      return [lat + jLat, lng + jLng];
    }
  }

  // 4. State-level fallback without a large random offset.
  if (state && cityCoordinates[state]) {
    const [lat, lng] = cityCoordinates[state];
    return [lat + jLat, lng + jLng];
  }

  // 5. Hash fallback for unknown state.
  if (state) {
    let hash = 0;
    for (let i = 0; i < state.length; i += 1) {
      hash = (hash * 31 + state.charCodeAt(i)) >>> 0;
    }

    const lat = Math.min(Math.max(8 + (hash % 2900) / 100, 8), 37);
    const lng = Math.min(Math.max(68 + ((hash >> 8) % 2900) / 100, 68), 97);
    return [lat + jLat, lng + jLng];
  }

  return [22.8 + jLat, 78.9 + jLng];
};

const getLeadMapIcon = (color) =>
  divIcon({
    className: "courier-map-pin",
    html: `
      <div style="position:relative;width:28px;height:28px;transform:translate(-50%,-100%);">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path fill="${color}" d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
          <circle cx="12" cy="9" r="2.2" fill="#ffffff" opacity="0.95" />
        </svg>
      </div>
    `,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });

const getAuthHeaders = () => {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Token ${token}` } : {};
};

const buildLeadName = (lead) => {
  const firstName = String(lead?.first_name ?? "").trim();
  const lastName = String(lead?.last_name ?? "").trim();
  const companyName = String(lead?.company_upload_name ?? lead?.company_name ?? lead?.customer_company_name ?? "").trim();
  return [firstName, lastName].filter(Boolean).join(" ") || companyName || `Lead ${lead?.id ?? "-"}`;
};

const buildAddressLabel = (item) => {
  const line1 = String(item?.address_line1 ?? item?.address ?? "").trim();
  const line2 = String(item?.address_line2 ?? "").trim();
  return [line1, line2].filter(Boolean).join(", ") || "-";
};

function FitBounds({ markers }) {
  const map = useMap();

  useEffect(() => {
    if (!markers.length) return;

    const bounds = markers.map((marker) => [marker.lat, marker.lng]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
  }, [markers, map]);

  return null;
}

export default function TrackMap() {
  const query = useQuery();
  const paramCampaign = query.get("campaign");
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(
    paramCampaign || localStorage.getItem("selectedCampaignId") || null
  );
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/campaigns/`, { headers: getAuthHeaders() });
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.campaigns) ? res.data.campaigns : [];
        setCampaigns(data);
      } catch (error) {
        console.error(error);
        setCampaigns([]);
      }
    };

    fetchCampaigns();
  }, []);

  useEffect(() => {
    const fetchLeads = async (campaignId) => {
      if (!campaignId) {
        setLeads([]);
        return;
      }
      setLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/api/campaigns/${campaignId}/leads/`, { headers: getAuthHeaders() });
        const data = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.leads) ? res.data.leads : [];
        setLeads(data);
      } catch (error) {
        console.error(error);
        setLeads([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedCampaign) fetchLeads(selectedCampaign);
    else setLeads([]);
  }, [selectedCampaign]);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const lead of leads) {
      const status = String(lead?.courier_status ?? lead?.status ?? "Pending").trim();
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [leads]);

  const markers = useMemo(() => {
    return leads
      .filter((lead) => {
        const resolvedStatus = String(lead?.courier_status ?? lead?.status ?? "").trim();
        return visibleTrackMapStatuses.has(resolvedStatus);
      })
      .map((lead, index) => {
        const resolvedStatus = String(lead?.courier_status ?? lead?.status ?? "").trim();
        const [baseLat, baseLng] = getLeadLocationCoordinates(lead, index);
        return { ...lead, resolvedStatus, lat: baseLat, lng: baseLng };
      });
  }, [leads]);

  const position = [22.8, 78.9];

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Track Map</h1>
      <div className="mb-4 flex items-center gap-4">
        <p className="text-sm text-gray-600">Showing map for campaign:</p>
        <div className="min-w-[240px]">
          <select
            value={selectedCampaign || ""}
            onChange={(e) => setSelectedCampaign(e.target.value || null)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none"
          >
            <option value="">-- Select campaign --</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name || `Campaign ${c.id}`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-sm">
        <div className="flex flex-1 flex-wrap gap-3">
          {trackMapStatusLegend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-2 py-1">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                {statusCounts[item.label] ?? 0}
              </span>
            </span>
          ))}
        </div>
        {leads.length > 0 && (
          <span className="ml-auto inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-semibold text-gray-700">
            Total: {leads.length}
          </span>
        )}
      </div>

      <div style={{ height: "560px" }}>
        {loading ? (
          <div className="flex h-full items-center justify-center">Loading map...</div>
        ) : markers.length ? (
          <MapContainer center={position} zoom={6} style={{ height: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            <FitBounds markers={markers} />
            {markers.map((lead, index) => {
              const status = lead.resolvedStatus || String(lead?.courier_status ?? lead?.status ?? "Pending");
              const color = leadStatusColors[status] || "#6b7280";
              return (
                <Marker key={`lead-${lead.id ?? index}`} position={[lead.lat, lead.lng]} icon={getLeadMapIcon(color)}>
                  <Popup minWidth={220}>
                    <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{buildLeadName(lead)}</div>
                      <span style={{ background: (leadStatusColors[status] || "#6b7280") + "22", color: leadStatusColors[status] || "#6b7280", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, display: "inline-block", marginBottom: 8 }}>{status}</span>
                      <table style={{ fontSize: 12, borderCollapse: "collapse", width: "100%" }}>
                        <tbody>
                          {[["Courier", lead?.courier_name], ["Address", buildAddressLabel(lead)], ["Location", buildLeadLocationLabel(lead)], ["City", lead?.city], ["State", lead?.state], ["Pincode", lead?.pincode], ["Phone", lead?.phone]].map(([label, value]) => (
                            <tr key={label}>
                              <td style={{ color: "#6b7280", paddingBottom: 3, width: 75 }}>{label}</td>
                              <td style={{ fontWeight: 500 }}>{value || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="flex h-full items-center justify-center">No map data for selected campaign.</div>
        )}
      </div>
    </div>
  );
}
