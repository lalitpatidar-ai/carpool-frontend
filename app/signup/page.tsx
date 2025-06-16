'use client';

import { useState, useEffect } from "react";
import { auth, RecaptchaVerifier } from "../../lib/firebase";
import { signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { useRouter } from "next/navigation";

type FormData = {
  name: string;
  email: string;
  address: string;
  vehicle: string;
  kids: string;
};

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

export default function SignUpPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [step, setStep] = useState<"phone" | "code" | "profile">("phone");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      // Cleanup reCAPTCHA when component unmounts
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    };
  }, []);

  const setupRecaptcha = (): RecaptchaVerifier => {
    try {
      console.log('Initializing reCAPTCHA verifier...');
      
      // Clear existing verifier if it exists
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }

      // Create a new verifier
      const verifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: 'invisible',
          callback: () => {
            console.log('reCAPTCHA verified');
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired');
            window.recaptchaVerifier = undefined;
          },
          'error-callback': (error: Error) => {
            console.error('reCAPTCHA error:', error);
            window.recaptchaVerifier = undefined;
          }
        }
      );

      // Store the verifier on window
      window.recaptchaVerifier = verifier;
      console.log('reCAPTCHA verifier created:', verifier);
      
      return verifier;
    } catch (error) {
      console.error('Error setting up reCAPTCHA:', error);
      throw error;
    }
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      console.log('Setting up reCAPTCHA...');
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;
      
      console.log('Attempting to send verification code to:', formattedPhone);
      console.log('reCAPTCHA verifier:', appVerifier);
      
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      console.log('Verification code sent successfully');
      setConfirmation(result);
      setStep("code");
    } catch (err: any) {
      console.error("Error sending code:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
        details: err
      });
      setError(`Failed to send verification code: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await confirmation.confirm(code);
      const token = await result.user.getIdToken();
      setIdToken(token);
      setStep("profile");
    } catch (err) {
      console.error("Error verifying code:", err);
      setError("Invalid verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (formData: FormData) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!idToken) {
        throw new Error("No authentication token found. Please complete phone verification.");
      }

      console.log('Submitting profile data:', formData);
      
      const response = await fetch('https://carpool-backend-ymsm.onrender.com/submit-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save profile');
      }
      
      console.log('Profile saved successfully:', data);
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Error submitting profile:", err);
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {step === "phone" && "Sign up with your phone number"}
          {step === "code" && "Enter verification code"}
          {step === "profile" && "Complete your profile"}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {step === "phone" && (
            <form className="space-y-6" onSubmit={sendCode}>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone number
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">+1</span>
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-12 sm:text-sm border-gray-300 rounded-md p-2 border"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          )}

          {step === "code" && (
            <form className="space-y-6" onSubmit={verifyCode}>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                  Verification code
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="code"
                    id="code"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                    placeholder="Enter 6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  We've sent a verification code to +91{phone}
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep("phone")}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Change number
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </form>
          )}

          {step === "profile" && (
            <ProfileForm 
              token={idToken} 
              onSubmit={handleProfileSubmit} 
              loading={loading}
            />
          )}

          <div id="recaptcha-container" className="invisible"></div>
        </div>
      </div>
    </div>
  );
}

function ProfileForm({ 
  token, 
  onSubmit,
  loading 
}: { 
  token: string | null;
  onSubmit: (data: FormData) => Promise<void>;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    address: "",
    vehicle: "",
    kids: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: false },
    { name: 'address', label: 'Address', type: 'text', required: true },
    { name: 'vehicle', label: 'Vehicle Details', type: 'text', required: false },
    { name: 'kids', label: 'Number of Kids', type: 'number', required: false },
  ] as const;

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {fields.map(({ name, label, type, required }) => (
        <div key={name}>
          <label htmlFor={name} className="block text-sm font-medium text-gray-700">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <div className="mt-1">
            <input
              type={type}
              name={name}
              id={name}
              required={required}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              value={form[name]}
              onChange={handleChange}
            />
          </div>
        </div>
      ))}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
}
