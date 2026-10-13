import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import App from "./App.jsx";
import { AuthProvider } from "./auth.jsx";
import "react-toastify/dist/ReactToastify.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ToastContainer
          position="top-right"
          autoClose={4200}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable={false}
          theme="light"
          limit={3}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
