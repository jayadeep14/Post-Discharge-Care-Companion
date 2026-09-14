import { useState } from "react";
import { ShieldPlus, Lock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Login() {

  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Temporary login for the prototype
    navigate("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8F4] px-4">

      <div className="w-full max-w-md">

        {/* Logo / Brand */}
        <div className="mb-8 text-center">

          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#064E3B]">
              <ShieldPlus
                size={38}
                className="text-white"
                strokeWidth={2}
              />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            AI Post-Discharge Monitoring
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Real-time insights. Better outcomes.
          </p>

        </div>


        {/* Login Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

          <h2 className="text-xl font-semibold text-gray-900">
            Welcome back
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Sign in to your care team dashboard
          </p>


          <form
            onSubmit={handleLogin}
            className="mt-6 space-y-5"
          >

            {/* Email */}
            <div>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>

              <div className="relative">

                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="
                    h-11 w-full
                    rounded-lg
                    border border-gray-200
                    bg-white
                    pl-10 pr-4
                    text-sm
                    outline-none
                    transition
                    focus:border-emerald-600
                    focus:ring-2
                    focus:ring-emerald-100
                  "
                />

              </div>

            </div>


            {/* Password */}
            <div>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>

              <div className="relative">

                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="
                    h-11 w-full
                    rounded-lg
                    border border-gray-200
                    bg-white
                    pl-10 pr-4
                    text-sm
                    outline-none
                    transition
                    focus:border-emerald-600
                    focus:ring-2
                    focus:ring-emerald-100
                  "
                />

              </div>

            </div>


            {/* Login */}
            <button
              type="submit"
              className="
                h-11 w-full
                rounded-lg
                bg-[#064E3B]
                text-sm
                font-semibold
                text-white
                transition
                hover:bg-[#053D2F]
              "
            >
              Sign In
            </button>

          </form>

        </div>


        <p className="mt-6 text-center text-xs text-gray-400">
          Secure healthcare monitoring platform
        </p>

      </div>

    </div>
  );
}