import { useEffect, useState } from 'react';
import { apiRequest } from '../api';

export default function ReviewPage() {
  const complaintId = new URLSearchParams(window.location.search).get('complaint_id');
  const [form, setForm] = useState({ name: '', location: '', rating: 5, comment: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    apiRequest('/api/reviews')
      .then(setReviews)
      .catch((err) => setError(err.message));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await apiRequest('/api/reviews', { method: 'POST', body: JSON.stringify({ ...form, location: form.location || 'Customer' }) });
      setMessage('Thank you for your review!');
      setForm({ name: '', location: '', rating: 5, comment: '' });
      setReviews(await apiRequest('/api/reviews'));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main style={{ maxWidth: 460, margin: '8vh auto', padding: 24, fontFamily: 'Arial, sans-serif', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 14 }}>
      <h1>Share your review</h1>
      {complaintId && <p>Service request #{complaintId}</p>}
      {message ? <p role="status">{message}</p> : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          <input required maxLength="150" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input maxLength="150" placeholder="Location (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <label>Rating <select value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{'★'.repeat(rating)} ({rating}/5)</option>)}</select></label>
          <textarea required maxLength="2000" rows="5" placeholder="Your comments" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
          {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
          <button type="submit">Submit review</button>
        </form>
      )}
      <section id="reviews" style={{ marginTop: 32 }}>
        <h2>Verified customer reviews</h2>
        {reviews.map((review) => <article key={review.id} style={{ borderTop: '1px solid #e2e8f0', padding: '12px 0' }}>
          <strong>{review.name} · {'★'.repeat(review.rating)}</strong>
          <p>{review.comment}</p>
          <small>{review.location}</small>
        </article>)}
        {!reviews.length && <p>No reviews have been submitted yet.</p>}
      </section>
    </main>
  );
}
