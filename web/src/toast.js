import { toast } from "react-toastify";

const defaults = {
  position: "top-right",
  autoClose: 4200,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: false,
};

export const notify = {
  success: (msg, opts = {}) => toast.success(String(msg || ""), { ...defaults, ...opts }),
  error: (msg, opts = {}) => toast.error(String(msg || ""), { ...defaults, autoClose: 5600, ...opts }),
  warning: (msg, opts = {}) => toast.warning(String(msg || ""), { ...defaults, ...opts }),
  info: (msg, opts = {}) => toast.info(String(msg || ""), { ...defaults, ...opts }),
};
