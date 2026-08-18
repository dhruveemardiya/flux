const envBaseUrl = String(process.env.REACT_APP_API_BASE_URL || "").trim();
const BASE_URL = envBaseUrl || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");


export default BASE_URL;
