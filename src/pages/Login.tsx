import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Package, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Create a dummy email from username
    const email = `${username.toLowerCase()}@hd-box.local`;

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid username or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This username is already taken.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <Package size={32} color="var(--accent-color)" />
            </div>
            <h1>HD Box Scanner</h1>
            <p>{isLogin ? 'Welcome back! Sign in to continue.' : 'Create an account to start scanning.'}</p>
          </div>

          <form onSubmit={handleAuth} className="login-form">
            <div className="input-group">
              <label><User size={16} /> Username</label>
              <input 
                type="text" 
                placeholder="Enter your login name" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label><Lock size={16} /> Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? (
                <span className="loader"></span>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button onClick={() => setIsLogin(!isLogin)} className="toggle-auth">
                {isLogin ? 'Sign Up' : 'Log In'}
              </button>
            </p>
          </div>
          
          <div className="security-badge">
            <ShieldCheck size={14} />
            Secure Authentication
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
