import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * AdminRoute — wraps admin pages to enforce authentication.
 * Optionally requires super_admin role.
 */
export default function AdminRoute ({ children, superAdminOnly = false }) {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const raw   = localStorage.getItem('adminData');

    if (!token || !raw) {
      navigate('/admin/login');
      return;
    }

    try {
      const admin = JSON.parse(raw);
      if (superAdminOnly && admin.role !== 'super_admin') {
        navigate('/admin/dashboard');
      }
    } catch {
      navigate('/admin/login');
    }
  }, [navigate, superAdminOnly]);

  return children;
}