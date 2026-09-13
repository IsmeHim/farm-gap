import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    // Safely parse user from localStorage and guard against "undefined" or corrupted JSON
    if (u && u !== 'undefined' && u !== 'null') {
      try {
        setUser(JSON.parse(u));
      } catch (err) {
        console.warn('Corrupted user in localStorage, clearing:', err);
        localStorage.removeItem('user');
      }
    } else if (u === 'undefined' || u === 'null') {
      localStorage.removeItem('user');
    }

    if (token && token !== 'undefined' && token !== 'null') {
      api.get('/api/auth/me')
        .then(res => {
          if (res?.data) {
            localStorage.setItem('user', JSON.stringify(res.data));
            setUser(res.data);
          }
        })
        .catch(() => {
          // If token is invalid or expired
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      if (token === 'undefined' || token === 'null') {
        localStorage.removeItem('token');
      }
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    if (data?.token) localStorage.setItem('token', data.token);
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    }
  };

  const register = async (payload) => {
    const { data } = await api.post('/api/auth/register', payload);
    if (data?.token) localStorage.setItem('token', data.token);
    if (data?.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
    }
  };

  const updateProfile = (updatedUser, token) => {
    if (token) localStorage.setItem('token', token);
    if (updatedUser) {
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, updateProfile }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
