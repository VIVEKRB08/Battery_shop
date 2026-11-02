import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'complaints', label: 'Complaints' },
  { id: 'broadcast', label: 'Send Broadcast' },
  { id: 'customers', label: 'Customer Database' },
  { id: 'services', label: 'Manage Services' },
];

const emptyAnalytics = {
  total_customers: 0,
  pending_complaints: 0,
  resolved_complaints: 0,
  average_review_rating: 0,
};

async function fetchAll(path) {
  const rows = [];
  for (let skip = 0; ; skip += 500) {
    const page = await apiRequest(`${path}?skip=${skip}&limit=500`);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

function getWhatsAppUrl(phone, message) {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
  const recipient = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [complaints, setComplaints] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [reviewLink, setReviewLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [offer, setOffer] = useState('');
  const [selected, setSelected] = useState([]);
  const [broadcast, setBroadcast] = useState(null);
  const [services, setServices] = useState([]);
  const [serviceDraft, setServiceDraft] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    title: '',
    title_ta: '',
    description: '',
    description_ta: '',
    image: '',
    icon: '🔋',
    is_active: true,
    sort_order: 0,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [dailyInsight, setDailyInsight] = useState(null);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const [items, profiles, reviewList, summary, serviceList] = await Promise.all([
        fetchAll('/api/bookings'),
        fetchAll('/api/customers'),
        apiRequest('/api/admin/reviews'),
        apiRequest('/api/admin/analytics'),
        apiRequest('/api/admin/services'),
      ]);
      setComplaints(items);
      setCustomers(profiles);
      setReviews(reviewList);
      setAnalytics(summary);
      setServices(serviceList);
      setToast('Dashboard data refreshed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiRequest('/api/admin/session')
      .then((session) => {
        setAuthenticated(session.authenticated);
        if (session.authenticated) return loadDashboard();
        return undefined;
      })
      .catch((sessionError) => {
        if (sessionError.status !== 401) setAuthError(sessionError.message);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!broadcast || !['QUEUED', 'SENDING'].includes(broadcast.status)) return undefined;
    const timer = window.setInterval(() => {
      apiRequest(`/api/offers/${broadcast.id}`)
        .then((latest) => {
          setBroadcast(latest);
          if (['SENT', 'PARTIAL', 'FAILED'].includes(latest.status)) {
            setToast(`Broadcast ${latest.status.toLowerCase()}: ${latest.sent} sent, ${latest.failed} failed.`);
          }
        })
        .catch((err) => {
          setError(err.message);
          window.clearInterval(timer);
        });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [broadcast]);

  async function setReviewVerified(review, is_verified) {
    try {
      const updated = await apiRequest(`/api/reviews/${review.id}/verification`, {
        method: 'PATCH',
        body: JSON.stringify({ is_verified }),
      });
      setReviews((current) => current.map((item) => item.id === updated.id ? updated : item));
      setToast(updated.is_verified ? 'Review approved.' : 'Review verification removed.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendOffer(customerIds) {
    if (!offer.trim()) {
      setError('Enter a broadcast message first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest('/api/offers', {
        method: 'POST',
        body: JSON.stringify({
          message: offer.trim(),
          ...(customerIds ? { customer_ids: customerIds } : {}),
        }),
      });
      setBroadcast(result);
      setToast('Broadcast queued for opted-in customers.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(item) {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setWorkingId(item.id);
    setError('');
    try {
      const updated = await apiRequest(`/api/bookings/${item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      setComplaints((current) => current.map((complaint) => (
        complaint.id === updated.id ? updated : complaint
      )));
      setAnalytics((current) => ({
        ...current,
        pending_complaints: Math.max(0, current.pending_complaints - 1),
        resolved_complaints: current.resolved_complaints + 1,
      }));
      const reviewUrl = new URL(`/review?complaint_id=${item.id}`, window.location.origin).href;
      const url = getWhatsAppUrl(
        item.phone,
        `Thank you for choosing Devi Batteries. Please share your feedback: ${reviewUrl}`,
      );
      setReviewLink(url);
      if (popup) popup.location.href = url;
      setToast(`Complaint #${item.id} resolved. WhatsApp feedback request is ready.`);
    } catch (err) {
      popup?.close();
      setError(err.message);
    } finally {
      setWorkingId(null);
    }
  }

  function toggleCustomer(customerId, checked) {
    setSelected((current) => (
      checked
        ? [...new Set([...current, customerId])]
        : current.filter((id) => id !== customerId)
    ));
  }

  async function login(credentials) {
    await apiRequest('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setAuthError('');
    setAuthenticated(true);
    await loadDashboard();
  }

  async function logout() {
    try {
      await apiRequest('/api/admin/logout', { method: 'POST' });
    } finally {
      setAuthenticated(false);
      setComplaints([]);
      setCustomers([]);
      setReviews([]);
      setServices([]);
      setSelected([]);
    }
  }

  async function loadDailyInsight(value) {
    setSelectedDate(value);
    if (!value) return;
    setDailyInsight(null);
    setLoading(true);
    setError('');
    try {
      const insight = await apiRequest(`/api/admin/analytics/daily?selected_date=${encodeURIComponent(value)}`);
      setDailyInsight(insight);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startServiceEdit(service) {
    setServiceDraft(service.id);
    setServiceForm({
      title: service.title,
      title_ta: service.title_ta || '',
      description: service.description,
      description_ta: service.description_ta || '',
      image: service.image,
      icon: service.icon,
      is_active: service.is_active,
      sort_order: service.sort_order,
    });
  }

  function resetServiceForm() {
    setServiceDraft(null);
    setServiceForm({
      title: '',
      title_ta: '',
      description: '',
      description_ta: '',
      image: '',
      icon: '🔋',
      is_active: true,
      sort_order: services.length,
    });
  }

  async function saveService(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const path = serviceDraft ? `/api/admin/services/${serviceDraft}` : '/api/admin/services';
      const saved = await apiRequest(path, {
        method: serviceDraft ? 'PATCH' : 'POST',
        body: JSON.stringify(serviceForm),
      });
      setServices((current) => {
        const next = serviceDraft
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [...current, saved];
        return next.sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
      });
      resetServiceForm();
      setToast(serviceDraft ? 'Service updated.' : 'Service added.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadServiceImage(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const data = new FormData();
    data.append('file', file);
    setUploadingImage(true);
    setError('');
    try {
      const result = await apiRequest('/api/admin/service-images', {
        method: 'POST',
        body: data,
      });
      setServiceForm((current) => ({ ...current, image: result.image }));
      setToast('Service image uploaded.');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
    }
  }

  async function deleteService(service) {
    if (!window.confirm(`Delete "${service.title}"?`)) return;
    try {
      await apiRequest(`/api/admin/services/${service.id}`, { method: 'DELETE' });
      setServices((current) => current.filter((item) => item.id !== service.id));
      if (serviceDraft === service.id) resetServiceForm();
      setToast('Service deleted.');
    } catch (err) {
      setError(err.message);
    }
  }

  const openComplaints = complaints.filter((item) => item.status === 'OPEN');
  const verifiedReviews = reviews.filter((review) => review.is_verified);

  if (authChecking) return <main className="admin-page">Checking admin session…</main>;
  if (!authenticated) return <AdminLogin onLogin={login} initialError={authError} />;

  return (
    <main className="admin-page">
      <style>{`
        .admin-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 28px;
          color: #0f172a;
          background: #f1f5f9;
          font: 14px/1.5 Inter, ui-sans-serif, system-ui, sans-serif;
        }
        .admin-shell { max-width: 1440px; margin: 0 auto; }
        .admin-topbar {
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
          margin-bottom: 22px; padding: 18px 22px; background: #fff;
          border: 1px solid #e2e8f0; border-radius: 16px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, .04);
        }
        .admin-brand { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
        .admin-brand span { color: #0284c7; }
        .admin-top-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
        .admin-date-control { display: grid; gap: 4px; color: #475569; font-size: 12px; font-weight: 700; }
        .admin-date-control input, .admin-page input[type="text"], .admin-page input[type="url"], .admin-page input[type="number"], .admin-page textarea, .customer-search {
          box-sizing: border-box; width: 100%; padding: 11px 13px;
          border: 1px solid #cbd5e1; border-radius: 9px; color: #0f172a;
          background: #fff; font: inherit;
        }
        .admin-page input:focus, .admin-page textarea:focus {
          outline: 2px solid #38bdf8; outline-offset: 1px;
        }
        .admin-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 22px; }
        .admin-nav {
          align-self: start; display: grid; gap: 6px; padding: 12px;
          background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
        }
        .admin-nav button {
          padding: 12px 14px; border: 0; border-radius: 10px; text-align: left;
          color: #475569; background: transparent; font: inherit; font-weight: 700; cursor: pointer;
        }
        .admin-nav button.active, .admin-nav button:hover { color: #0369a1; background: #e0f2fe; }
        .admin-content { min-width: 0; }
        .admin-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 4px 0 18px; }
        .admin-heading h1 { margin: 0; color: #0f172a; font-size: 25px; }
        .admin-heading p { margin: 4px 0 0; color: #64748b; }
        .admin-page h2 { margin: 0 0 14px; color: #0f172a; font-size: 18px; }
        .admin-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
        .admin-kpi {
          padding: 18px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, .04);
        }
        .admin-kpi-label { color: #64748b; font-size: 13px; font-weight: 650; }
        .admin-kpi-value { display: block; margin-top: 7px; color: #0f172a; font-size: 28px; font-weight: 800; }
        .admin-panel {
          margin-bottom: 18px; padding: 20px; background: #fff;
          border: 1px solid #e2e8f0; border-radius: 14px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, .04);
        }
        .admin-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
        .admin-table { width: 100%; min-width: 720px; border-collapse: collapse; text-align: left; }
        .admin-table th {
          padding: 12px; color: #475569; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
          font-size: 12px; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap;
        }
        .admin-table td { padding: 13px 12px; color: #334155; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
        .admin-table tr:last-child td { border-bottom: 0; }
        .admin-status { display: inline-flex; padding: 4px 9px; border-radius: 99px; font-size: 11px; font-weight: 800; }
        .admin-status.open { color: #b45309; background: #fef3c7; }
        .admin-status.resolved { color: #047857; background: #d1fae5; }
        .admin-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px 14px; border: 0; border-radius: 9px; color: #fff;
          background: #0284c7; font: inherit; font-weight: 750; cursor: pointer;
        }
        .admin-button:hover { background: #0369a1; }
        .admin-button.secondary { color: #334155; background: #e2e8f0; }
        .admin-button:disabled { opacity: .55; cursor: not-allowed; }
        .admin-actions { display: flex; flex-wrap: wrap; gap: 10px; }
        .admin-empty { padding: 28px; text-align: center; color: #64748b; }
        .admin-message { min-height: 130px; margin-bottom: 14px; resize: vertical; }
        .admin-muted { color: #64748b; }
        .admin-alert { margin-bottom: 16px; padding: 12px 14px; border-radius: 10px; color: #991b1b; background: #fee2e2; }
        .admin-toast {
          position: fixed; z-index: 10000; right: 24px; bottom: 24px;
          max-width: min(460px, calc(100vw - 48px)); padding: 14px 18px;
          border-radius: 12px; color: #fff; background: #0f172a;
          box-shadow: 0 12px 32px rgba(15, 23, 42, .25);
        }
        .admin-review-list { display: grid; gap: 10px; }
        .admin-review-item { padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; }
        .admin-review-item p { margin: 6px 0; }
        .admin-service-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .admin-service-form label { display: grid; gap: 5px; color: #475569; font-size: 12px; font-weight: 700; }
        .admin-service-form .full { grid-column: 1 / -1; }
        .admin-service-list { display: grid; gap: 10px; }
        .admin-service-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; }
        .admin-service-row h3 { margin: 0; color: #0f172a; font-size: 15px; }
        .admin-service-row p { margin: 4px 0 0; color: #64748b; }
        .admin-modal-backdrop {
          position: fixed; inset: 0; z-index: 12000; display: grid; place-items: center;
          padding: 18px; background: rgba(15, 23, 42, .55); backdrop-filter: blur(3px);
        }
        .admin-modal {
          width: min(560px, 100%); padding: 24px; border-radius: 16px;
          background: #fff; box-shadow: 0 24px 70px rgba(15, 23, 42, .28);
        }
        .admin-modal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .admin-modal-header h2 { margin: 0; }
        .admin-modal-close { padding: 5px 10px !important; color: #475569 !important; background: #e2e8f0 !important; border: 0 !important; }
        .admin-insight-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
        .admin-insight-card { padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
        .admin-insight-card span { display: block; color: #64748b; font-size: 12px; font-weight: 700; }
        .admin-insight-card strong { display: block; margin-top: 5px; color: #0f172a; font-size: 25px; }
        @media (max-width: 900px) {
          .admin-page { padding: 16px; }
          .admin-layout { grid-template-columns: 1fr; }
          .admin-nav { grid-template-columns: repeat(5, minmax(0, 1fr)); }
          .admin-nav button { text-align: center; padding: 10px 6px; }
          .admin-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 620px) {
          .admin-topbar { align-items: stretch; flex-direction: column; padding: 16px; }
          .admin-top-actions { align-items: stretch; }
          .admin-date-control { flex: 1 1 100%; }
          .admin-nav { display: flex; overflow-x: auto; }
          .admin-nav button { flex: 0 0 auto; }
          .admin-kpis { gap: 9px; }
          .admin-kpi { padding: 13px; }
          .admin-kpi-value { font-size: 23px; }
          .admin-heading { align-items: flex-start; flex-direction: column; }
          .admin-panel { padding: 14px; }
          .admin-service-form { grid-template-columns: 1fr; }
          .admin-service-form .full { grid-column: auto; }
          .admin-service-row { align-items: flex-start; flex-direction: column; }
        }
      `}</style>

      <div className="admin-shell">
        <header className="admin-topbar">
          <p className="admin-brand">Devi <span>Batteries</span> Admin</p>
          <div className="admin-top-actions">
            <label className="admin-date-control">
              Complaint date insights
              <input type="date" value={selectedDate} onChange={(event) => loadDailyInsight(event.target.value)} />
            </label>
            <button className="admin-button secondary" type="button" onClick={() => loadDashboard()} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button className="admin-button secondary" type="button" onClick={logout}>Log out</button>
          </div>
        </header>

        <div className="admin-layout">
          <nav className="admin-nav" aria-label="Admin sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <section className="admin-content">
            {error && <div className="admin-alert" role="alert">{error}</div>}
            <div className="admin-heading">
              <div>
                <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
                <p>Manage service requests, customers, reviews, and WhatsApp offers.</p>
              </div>
              <button className="admin-button secondary" type="button" onClick={() => loadDashboard()} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh data'}
              </button>
            </div>

            {activeTab === 'overview' && (
              <>
                <div className="admin-kpis">
                  <article className="admin-kpi"><span className="admin-kpi-label">Total Registered Customers</span><strong className="admin-kpi-value">{analytics.total_customers.toLocaleString()}</strong></article>
                  <article className="admin-kpi"><span className="admin-kpi-label">Pending Complaints</span><strong className="admin-kpi-value">{analytics.pending_complaints.toLocaleString()}</strong></article>
                  <article className="admin-kpi"><span className="admin-kpi-label">Resolved Complaints</span><strong className="admin-kpi-value">{analytics.resolved_complaints.toLocaleString()}</strong></article>
                  <article className="admin-kpi"><span className="admin-kpi-label">Average Customer Rating</span><strong className="admin-kpi-value">{analytics.average_review_rating.toFixed(1)} <small style={{ color: '#f59e0b', fontSize: 18 }}>★</small></strong></article>
                </div>
                <div className="admin-panel">
                  <h2>Recent complaints</h2>
                  <ComplaintTable complaints={complaints.slice(0, 6)} onResolve={changeStatus} workingId={workingId} />
                </div>
                <div className="admin-panel">
                  <h2>Review moderation</h2>
                  <ReviewList reviews={reviews.slice(0, 5)} onToggle={setReviewVerified} />
                </div>
              </>
            )}

            {activeTab === 'complaints' && (
              <div className="admin-panel">
                <h2>Complaints and service requests</h2>
                <ComplaintTable complaints={complaints} onResolve={changeStatus} workingId={workingId} />
              </div>
            )}

            {activeTab === 'broadcast' && (
              <div className="admin-panel">
                <h2>WhatsApp promotional broadcast</h2>
                <p className="admin-muted">Messages are sent only to customers who opted in. Preserve links and special characters as typed; the API handles JSON and WhatsApp template encoding.</p>
                <form onSubmit={(event) => { event.preventDefault(); sendOffer(selected.length ? selected : undefined); }}>
                  <textarea
                    className="admin-message"
                    required
                    maxLength="900"
                    value={offer}
                    onChange={(event) => setOffer(event.target.value)}
                    placeholder={'🎉 Special offer from Devi Batteries!\nGet 10% off selected batteries. Visit: https://example.com'}
                  />
                  <div className="admin-actions">
                    <button className="admin-button" type="submit" disabled={loading || !offer.trim() || (!selected.length && !customers.some((customer) => customer.marketing_opt_in))}>
                      {loading ? 'Sending…' : selected.length ? `Send to selected (${selected.length})` : 'Send to all opted-in'}
                    </button>
                    <button className="admin-button secondary" type="button" onClick={() => setSelected([])} disabled={!selected.length}>
                      Clear selection
                    </button>
                  </div>
                </form>
                {broadcast && (
                  <p role="status" style={{ marginTop: 16 }}>
                    Broadcast #{broadcast.id}: <strong>{broadcast.status}</strong> · Sent {broadcast.sent}/{broadcast.total_recipients} · Failed {broadcast.failed}
                  </p>
                )}
                <p className="admin-muted" style={{ marginTop: 14 }}>
                  {customers.filter((customer) => customer.marketing_opt_in).length} opted-in recipients available.
                </p>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="admin-panel">
                <h2>Customer database</h2>
                <p className="admin-muted">Select customers to target an offer. Only opted-in customers can be selected.</p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr>{['Select', 'Customer', 'Phone', 'Location', 'Last service', 'Registered', 'Orders', 'Complaints', 'Marketing'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
                    <tbody>
                      {customers.map((customer) => (
                        <tr key={customer.id}>
                          <td><input type="checkbox" disabled={!customer.marketing_opt_in} checked={selected.includes(customer.id)} onChange={(event) => toggleCustomer(customer.id, event.target.checked)} aria-label={`Select ${customer.name}`} /></td>
                          <td><strong>{customer.name}</strong></td>
                          <td>{customer.phone}</td>
                          <td>{customer.location || '—'}</td>
                          <td>{customer.requested_service || '—'}</td>
                          <td>{formatDate(customer.created_at)}</td>
                          <td>{customer.total_orders}</td>
                          <td>{customer.total_complaints}</td>
                          <td>{customer.marketing_opt_in ? 'Opted in' : 'Not opted in'}</td>
                        </tr>
                      ))}
                      {!customers.length && <tr><td className="admin-empty" colSpan="9">Load dashboard data to view customers.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {selected.length > 0 && (
                  <button className="admin-button" type="button" style={{ marginTop: 14 }} onClick={() => setActiveTab('broadcast')}>
                    Compose offer for {selected.length} selected
                  </button>
                )}
              </div>
            )}

            {activeTab === 'services' && (
              <>
                <div className="admin-panel">
                  <h2>{serviceDraft ? 'Edit service' : 'Add a service'}</h2>
                  <p className="admin-muted">Use a public image URL or a path such as /images/service-photo.jpg.</p>
                  <form className="admin-service-form" onSubmit={saveService}>
                    <label>
                      Service title
                      <input type="text" required maxLength="200" value={serviceForm.title} onChange={(event) => setServiceForm({ ...serviceForm, title: event.target.value })} />
                    </label>
                    <label>
                      Tamil title (optional)
                      <input type="text" maxLength="200" value={serviceForm.title_ta} onChange={(event) => setServiceForm({ ...serviceForm, title_ta: event.target.value })} />
                    </label>
                    <label className="full">
                      Description
                      <textarea required maxLength="4000" rows="3" value={serviceForm.description} onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })} />
                    </label>
                    <label className="full">
                      Tamil description (optional)
                      <textarea maxLength="4000" rows="2" value={serviceForm.description_ta} onChange={(event) => setServiceForm({ ...serviceForm, description_ta: event.target.value })} />
                    </label>
                    <label className="full">
                      Image URL or existing public path
                      <input type="text" required maxLength="1000" placeholder="/images/solar-service.jpg or https://…" value={serviceForm.image} onChange={(event) => setServiceForm({ ...serviceForm, image: event.target.value })} />
                    </label>
                    <label className="full">
                      Or upload a JPEG, PNG, or WebP (max 5 MB)
                      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingImage} onChange={uploadServiceImage} />
                    </label>
                    <label>
                      Icon / emoji
                      <input type="text" maxLength="40" value={serviceForm.icon} onChange={(event) => setServiceForm({ ...serviceForm, icon: event.target.value })} />
                    </label>
                    <label>
                      Sort order
                      <input type="number" min="0" step="1" value={serviceForm.sort_order} onChange={(event) => setServiceForm({ ...serviceForm, sort_order: Number(event.target.value) })} />
                    </label>
                    <label className="full" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={serviceForm.is_active} onChange={(event) => setServiceForm({ ...serviceForm, is_active: event.target.checked })} />
                      Active (visible on customer website)
                    </label>
                    <div className="admin-actions full">
                      <button className="admin-button" type="submit" disabled={loading || uploadingImage}>
                        {uploadingImage ? 'Uploading image…' : loading ? 'Saving…' : serviceDraft ? 'Save changes' : 'Add service'}
                      </button>
                      {serviceDraft && <button className="admin-button secondary" type="button" onClick={resetServiceForm}>Cancel edit</button>}
                    </div>
                  </form>
                </div>
                <div className="admin-panel">
                  <h2>Existing services ({services.length})</h2>
                  <div className="admin-service-list">
                    {services.map((service) => (
                      <article className="admin-service-row" key={service.id}>
                        <div>
                          <h3>{service.icon} {service.title}</h3>
                          <p>{service.description}</p>
                          <small className="admin-muted">{service.is_active ? 'Active on website' : 'Hidden from website'} · Order {service.sort_order}</small>
                        </div>
                        <div className="admin-actions">
                          <button className="admin-button secondary" type="button" onClick={() => startServiceEdit(service)}>Edit</button>
                          <button className="admin-button" type="button" style={{ background: '#b91c1c' }} onClick={() => deleteService(service)}>Delete</button>
                        </div>
                      </article>
                    ))}
                    {!services.length && <p className="admin-empty">No services found.</p>}
                  </div>
                </div>
              </>
            )}

            {reviewLink && (
              <p className="admin-muted">Feedback link: <a href={reviewLink} target="_blank" rel="noreferrer">Open WhatsApp request</a></p>
            )}
            {activeTab === 'overview' && verifiedReviews.length > 0 && (
              <p className="admin-muted">{verifiedReviews.length} verified reviews · {openComplaints.length} complaints currently open.</p>
            )}
          </section>
        </div>
      </div>

      {dailyInsight && (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setDailyInsight(null)}>
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-insights-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h2 id="daily-insights-title">Complaint insights</h2>
                <p className="admin-muted">{dailyInsight.selected_date}</p>
              </div>
              <button className="admin-modal-close" type="button" onClick={() => setDailyInsight(null)} aria-label="Close insights">Close</button>
            </div>
            <div className="admin-insight-grid">
              <article className="admin-insight-card"><span>Total complaints</span><strong>{dailyInsight.total_complaints}</strong></article>
              <article className="admin-insight-card"><span>Pending</span><strong>{dailyInsight.pending_complaints}</strong></article>
              <article className="admin-insight-card"><span>Resolved</span><strong>{dailyInsight.resolved_complaints}</strong></article>
              <article className="admin-insight-card"><span>Yesterday still pending</span><strong>{dailyInsight.yesterday_pending_complaints}</strong></article>
            </div>
            <p className="admin-muted" style={{ marginBottom: 0, marginTop: 14 }}>
              Yesterday’s pending count shows complaints created yesterday that remain OPEN.
            </p>
          </section>
        </div>
      )}

      {toast && <div className="admin-toast" role="status">{toast}</div>}
    </main>
  );
}

function ComplaintTable({ complaints, onResolve, workingId }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>{['Customer Name', 'Phone', 'Issue Details', 'Date', 'Status', 'Action'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>
          {complaints.map((item) => (
            <tr key={item.id}>
              <td><strong>{item.name}</strong><br /><span className="admin-muted">{item.selected_service}</span></td>
              <td>{item.phone}</td>
              <td>{item.complaint || '—'}</td>
              <td>{formatDate(item.created_at)}</td>
              <td><span className={`admin-status ${item.status === 'RESOLVED' ? 'resolved' : 'open'}`}>{item.status}</span></td>
              <td>
                {item.status === 'OPEN'
                  ? <button className="admin-button" type="button" disabled={workingId !== null} onClick={() => onResolve(item)}>{workingId === item.id ? 'Updating…' : 'Resolve & request review'}</button>
                  : <span className="admin-muted">Completed</span>}
              </td>
            </tr>
          ))}
          {!complaints.length && <tr><td className="admin-empty" colSpan="6">No complaints found. Load dashboard data to refresh.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ReviewList({ reviews, onToggle }) {
  if (!reviews.length) return <p className="admin-empty">No customer reviews to moderate.</p>;
  return (
    <div className="admin-review-list">
      {reviews.map((review) => (
        <article className="admin-review-item" key={review.id}>
          <strong>{review.name} · <span style={{ color: '#f59e0b' }}>{'★'.repeat(review.rating)}</span></strong>
          <p>{review.comment}</p>
          <div className="admin-actions">
            <span className="admin-muted">{review.is_verified ? 'Verified' : 'Pending verification'}</span>
            <button className="admin-button secondary" type="button" onClick={() => onToggle(review, !review.is_verified)}>
              {review.is_verified ? 'Unverify' : 'Approve'}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function AdminLogin({ onLogin, initialError }) {
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onLogin({ phone, password });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest('/api/admin/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setMessage(result.detail);
      setMode('reset');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/admin/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp, new_password: newPassword }),
      });
      await onLogin({ phone, password: newPassword });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <style>{`
        .admin-login-page {
          display: grid; min-height: 100vh; place-items: center; box-sizing: border-box;
          padding: 20px; background: #f1f5f9; color: #0f172a;
          font: 14px/1.5 Inter, ui-sans-serif, system-ui, sans-serif;
        }
        .admin-auth-card {
          width: min(440px, 100%); box-sizing: border-box; padding: 30px;
          border: 1px solid #e2e8f0; border-radius: 18px; background: #fff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, .12);
        }
        .admin-auth-card h1 { margin: 0 0 6px; color: #0f172a; font-size: 25px; }
        .admin-auth-card p { color: #64748b; }
        .admin-auth-form { display: grid; gap: 13px; margin-top: 20px; }
        .admin-auth-form label { display: grid; gap: 5px; color: #475569; font-weight: 700; }
        .admin-auth-form input {
          box-sizing: border-box; width: 100%; padding: 12px;
          border: 1px solid #cbd5e1; border-radius: 9px; color: #0f172a; background: #fff; font: inherit;
        }
        .admin-auth-form input:focus { outline: 2px solid #38bdf8; outline-offset: 1px; }
        .admin-auth-button {
          padding: 12px 16px; border: 0; border-radius: 9px;
          color: #fff; background: #0284c7; font: inherit; font-weight: 750; cursor: pointer;
        }
        .admin-auth-button:disabled { opacity: .55; cursor: wait; }
        .admin-auth-link { padding: 0; border: 0; color: #0369a1; background: transparent; font: inherit; cursor: pointer; }
        .admin-auth-error { color: #b91c1c !important; }
      `}</style>
      <section className="admin-auth-card">
        <h1>Devi Batteries Admin</h1>
        <p>{mode === 'login' ? 'Sign in with your registered admin phone and password.' : 'Password recovery'}</p>
        {(error || initialError) && <p className="admin-auth-error" role="alert">{error || initialError}</p>}
        {message && <p role="status">{message}</p>}
        {mode === 'login' && (
          <form className="admin-auth-form" onSubmit={submitLogin}>
            <label>Admin phone number<input required autoComplete="username" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button className="admin-auth-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <button className="admin-auth-link" type="button" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>Forgot password?</button>
          </form>
        )}
        {mode === 'forgot' && (
          <form className="admin-auth-form" onSubmit={requestOtp}>
            <label>Registered admin phone<input required autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <button className="admin-auth-button" type="submit" disabled={busy}>{busy ? 'Requesting…' : 'Request reset OTP'}</button>
            <button className="admin-auth-link" type="button" onClick={() => setMode('login')}>Back to sign in</button>
          </form>
        )}
        {mode === 'reset' && (
          <form className="admin-auth-form" onSubmit={resetPassword}>
            <label>Six-digit OTP<input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value)} /></label>
            <label>New password (12+ characters)<input required type="password" minLength="12" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
            <button className="admin-auth-button" type="submit" disabled={busy}>{busy ? 'Resetting…' : 'Reset password and sign in'}</button>
            <button className="admin-auth-link" type="button" onClick={() => setMode('forgot')}>Request another OTP</button>
          </form>
        )}
      </section>
    </main>
  );
}
