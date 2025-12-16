// components/HRLoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HRLoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateRequestOtpLogin = () => {
    let errs = {};
    if (!formData.email.trim()) errs.email = 'Email is required';
    return errs;
  };

  const validateVerifyOtp = () => {
    let errs = {};
    if (!formData.otp.trim()) errs.otp = 'OTP is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    return errs;
  };

  const requestOtp = async () => {
    const errs = validateRequestOtpLogin();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return false;
    }

    setLoading(true);
    try {
      const url = 'http://localhost:5000/api/auth/login-request-otp';

      const body = {
        email: formData.email,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (response.ok) {
        setOtpSent(true);
        setErrors({});
      } else {
        setErrors({ submit: data.error || 'Failed to send OTP' });
      }
    } catch (e) {
      setErrors({ submit: e.message || 'Error requesting OTP' });
    } finally {
      setLoading(false);
    }
    return true;
  };

  const verifyOtp = async () => {
    const errs = validateVerifyOtp();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const url = 'http://localhost:5000/api/auth/login-verify-otp';

      const body = {
        email: formData.email,
        otp: formData.otp,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (response.ok) {
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        navigate('/interview');
      } else {
        setErrors({ submit: data.error || 'OTP verification failed' });
      }
    } catch (e) {
      setErrors({ submit: e.message || 'Error verifying OTP' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrors({});
    if (!otpSent) {
      requestOtp();
    } else {
      verifyOtp();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.authBox}>
        <div style={styles.header}>
          <div style={styles.logoCircle}>
            <span style={styles.logoIcon}>🎯</span>
          </div>
          <h1 style={styles.title}>HR Interview Portal</h1>
          <p style={styles.subtitle}>
            {!otpSent
              ? 'Login to your HR account'
              : 'Enter the OTP sent to your email'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* LOGIN: only email first */}
          {!otpSent && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                Email Address <span style={styles.required}>*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="hr@company.com"
                style={{
                  ...styles.input,
                  ...(errors.email ? styles.inputError : {}),
                }}
                required
              />
              {errors.email && (
                <span style={styles.errorText}>{errors.email}</span>
              )}
            </div>
          )}

          {/* OTP when sent */}
          {otpSent && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                OTP Code <span style={styles.required}>*</span>
              </label>
              <input
                type="text"
                name="otp"
                value={formData.otp}
                onChange={handleChange}
                placeholder="Enter the OTP"
                style={{
                  ...styles.input,
                  ...(errors.otp ? styles.inputError : {}),
                }}
                required
              />
              {errors.otp && (
                <span style={styles.errorText}>{errors.otp}</span>
              )}
            </div>
          )}

          {errors.submit && (
            <div style={styles.submitError}>❌ {errors.submit}</div>
          )}

          <button type="submit" disabled={loading} style={styles.submitButton}>
            {loading
              ? 'Please wait...'
              : otpSent
              ? 'Verify OTP & Login'
              : 'Send OTP'}
          </button>

          {/* Text link -> Signup page */}
          <div style={{ marginTop: '10px', textAlign: 'center', fontSize: 14 }}>
            New here?{' '}
            <button
              type="button"
              onClick={() => navigate('/signup')}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                cursor: 'pointer',
                fontWeight: 600,
                padding: 0,
              }}
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reuse same styles object as in signup
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  authBox: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '40px 45px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    animation: 'fadeIn 0.4s ease-in',
  },
  header: {
    textAlign: 'center',
    marginBottom: '25px',
  },
  logoCircle: {
    width: '80px',
    height: '80px',
    margin: '0 auto 20px',
    backgroundColor: '#f0f4ff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
  },
  logoIcon: {
    fontSize: '40px',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '26px',
    fontWeight: '700',
    color: '#1a1a2e',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: 0,
    fontSize: '15px',
    color: '#64748b',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1e293b',
  },
  required: {
    color: '#dc2626',
    marginLeft: '2px',
  },
  input: {
    padding: '12px 15px',
    fontSize: '15px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'all 0.2s',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
  },
  inputError: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: '12px',
    color: '#dc2626',
    marginTop: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  submitError: {
    padding: '12px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    border: '1px solid #fecaca',
    fontWeight: '500',
  },
  submitButton: {
    padding: '15px',
    fontSize: '16px',
    fontWeight: '700',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '10px',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
    letterSpacing: '0.3px',
  },
};

export default HRLoginPage;
