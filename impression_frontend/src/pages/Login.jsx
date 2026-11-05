
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BASE_URL from "./config";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
export default function Login({ setUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

 const handleSubmit = async (e) => {
  e.preventDefault();
  const credentials = btoa(`${username}:${password}`);

  try {
    const response = await axios.post(`${BASE_URL}/api/login/`, {}, {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    });

    if (response.status === 200) {
      const token = response.data.token;
      localStorage.setItem("authToken", token);

      const userRes = await axios.get(`${BASE_URL}/api/users/me/`, {
        headers: {
          Authorization: `Token ${token}`,
        },
      });

      setUser(userRes.data);
      localStorage.setItem("userRole", userRes.data.role); // ✅ Set userRole here
      toast.success("Successful Login");
      navigate("/dashboard");
    }
  } catch (error) {
    if (error.response) {
      const data = error.response.data;
      const errorMessage =
        (typeof data === "string" ? data : null) ||
        data?.error ||
        data?.detail ||
        data?.message ||
        "";

      if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("username")) {
        setError("Incorrect username. Please try again.");
      } else if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("password")) {
        setError("Incorrect password. Please try again.");
      } else if (error.response.status >= 500) {
        setError("Server error (500). Please check backend server and database connection.");
      } else if (typeof errorMessage === "string" && errorMessage.trim() && !errorMessage.trim().startsWith("<")) {
        setError(errorMessage);
      } else {
        setError("Login failed. Please check your credentials and try again.");
      }
    } else {
      setError("An unexpected error occurred. Please check network connection.");
    }
  }
};


// const handleSubmit = async (e) => {
//   e.preventDefault();

//   // Block TeChAdMin from logging in
//   if (username.trim().toLowerCase() === "techadmin") {
//     setError("This user is not allowed to log in.");
//     return;
//   }

//   const credentials = btoa(`${username}:${password}`);

//   try {
//     const response = await axios.post(`${BASE_URL}/api/login/`, {}, {
//       headers: {
//         Authorization: `Basic ${credentials}`
//       }
//     });

//     if (response.status === 200) {
//       const token = response.data.token;
//       localStorage.setItem("authToken", token);

//       const userRes = await axios.get(`${BASE_URL}/api/users/me/`, {
//         headers: {
//           Authorization: `Token ${token}`,
//         },
//       });

//       setUser(userRes.data);
//       localStorage.setItem("userRole", userRes.data.role);
//       toast.success("Successful Login");
//       navigate("/dashboard");
//     }
//   } catch (error) {
//     if (error.response) {
//       const errorMessage = error.response.data.error || error.response.data.detail;
//       if (errorMessage.includes('username')) {
//         setError("Incorrect username. Please try again.");
//       } else if (errorMessage.includes('password')) {
//         setError("Incorrect password. Please try again.");
//       } else {
//         setError("Login failed. Please try again.");
//       }
//     } else {
//       setError("An unexpected error occurred. Please try again.");
//     }
//   }
// };

  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-gray-200">
          Sign In
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Welcome back! Please enter your details.
        </p>
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium">Username</label>
            <input
              type="text"
              className="w-full px-4 py-3 mt-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 dark:text-gray-300 font-medium">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 mt-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition duration-300 shadow-lg"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

