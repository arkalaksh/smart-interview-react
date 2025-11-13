import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (isSignUp && !formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (isSignUp && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Simulate API call - Replace with your actual authentication logic
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (isSignUp) {
        console.log('Sign Up:', formData);
        // Add your sign-up API call here
        // const response = await fetch('/api/signup', { ... });
      } else {
        console.log('Sign In:', { email: formData.email, password: formData.password });
        // Add your sign-in API call here
        // const response = await fetch('/api/signin', { ... });
      }

      // Store user data in localStorage
      const userData = {
        name: formData.name || formData.email.split('@')[0],
        email: formData.email,
        isGuest: false
      };
      localStorage.setItem('user', JSON.stringify(userData));

      // Navigate to interview platform
      navigate('/interview');

    } catch (error) {
      console.error('Authentication error:', error);
      setErrors({ submit: 'Authentication failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    console.log('Guest access');
    
    // Generate random guest name
    const guestName = `Guest_${Math.random().toString(36).substring(7)}`;
    
    // Store guest user data
    const guestData = {
      name: guestName,
      email: `${guestName}@guest.com`,
      isGuest: true
    };
    localStorage.setItem('user', JSON.stringify(guestData));
    
    // Navigate to interview platform
    navigate('/interview');
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
  };

  return (
    <div style={styles.container}>
      <div style={styles.authBox}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>
            🎥 Interview Platform
          </h1>
          <p style={styles.subtitle}>
            {isSignUp ? 'Create your account' : 'Welcome back!'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {isSignUp && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your name"
                style={{
                  ...styles.input,
                  ...(errors.name ? styles.inputError : {})
                }}
              />
              {errors.name && (
                <span style={styles.errorText}>{errors.name}</span>
              )}
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              style={{
                ...styles.input,
                ...(errors.email ? styles.inputError : {})
              }}
            />
            {errors.email && (
              <span style={styles.errorText}>{errors.email}</span>
            )}
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              style={{
                ...styles.input,
                ...(errors.password ? styles.inputError : {})
              }}
            />
            {errors.password && (
              <span style={styles.errorText}>{errors.password}</span>
            )}
          </div>

          {isSignUp && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                style={{
                  ...styles.input,
                  ...(errors.confirmPassword ? styles.inputError : {})
                }}
              />
              {errors.confirmPassword && (
                <span style={styles.errorText}>{errors.confirmPassword}</span>
              )}
            </div>
          )}

          {errors.submit && (
            <div style={styles.submitError}>{errors.submit}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              ...(loading ? styles.buttonDisabled : {})
            }}
          >
            {loading ? '⏳ Loading...' : (isSignUp ? '✅ Sign Up' : '🔐 Sign In')}
          </button>
        </form>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.dividerLine}></span>
          <span style={styles.dividerText}>OR</span>
          <span style={styles.dividerLine}></span>
        </div>

        {/* Guest Access Button */}
        <button
          onClick={handleGuestAccess}
          style={styles.guestButton}
        >
          👤 Continue as Guest
        </button>

        {/* Toggle Sign In/Sign Up */}
        <div style={styles.toggleContainer}>
          <p style={styles.toggleText}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={toggleMode}
              style={styles.toggleButton}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        {/* Guest Info */}
        <div style={styles.infoBox}>
          <p style={styles.infoText}>
            ℹ️ <strong>Guest Access:</strong> Try the platform without creating an account. 
            Your session data will not be saved.
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  authBox: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '450px',
    width: '100%',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '28px',
    color: '#333'
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#666'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  input: {
    padding: '12px 15px',
    fontSize: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.3s',
  },
  inputError: {
    borderColor: '#dc3545'
  },
  errorText: {
    fontSize: '12px',
    color: '#dc3545',
    marginTop: '4px'
  },
  submitError: {
    padding: '10px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '6px',
    fontSize: '14px',
    textAlign: 'center'
  },
  submitButton: {
    padding: '14px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#667eea',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
    marginTop: '10px'
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '25px 0',
    gap: '10px'
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    backgroundColor: '#e0e0e0'
  },
  dividerText: {
    fontSize: '14px',
    color: '#999',
    fontWeight: '500'
  },
  guestButton: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#667eea',
    backgroundColor: '#f0f4ff',
    border: '2px solid #667eea',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.3s'
  },
  toggleContainer: {
    marginTop: '20px',
    textAlign: 'center'
  },
  toggleText: {
    fontSize: '14px',
    color: '#666',
    margin: 0
  },
  toggleButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    marginLeft: '5px',
    textDecoration: 'underline'
  },
  infoBox: {
    marginTop: '25px',
    padding: '15px',
    backgroundColor: '#fff3cd',
    borderRadius: '8px',
    border: '1px solid #ffc107'
  },
  infoText: {
    margin: 0,
    fontSize: '13px',
    color: '#856404',
    lineHeight: '1.5'
  }
};

export default AuthPage;
