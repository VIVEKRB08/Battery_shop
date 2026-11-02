import { useEffect, useState } from 'react';
import { API_URL, apiRequest } from './api';

export default function Services({ lang, showAllServices, setShowAllServices, onServiceClick }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/services')
      .then((items) => {
        if (active) setServices(items);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = showAllServices ? services : services.slice(0, 3);
  const getTitle = (service) => (lang === 'ta' && service.title_ta ? service.title_ta : service.title);
  const getImage = (service) => (
    service.image.startsWith('/api/uploads/') ? `${API_URL}${service.image}` : service.image
  );
  const getDescription = (service) => (
    lang === 'ta' && service.description_ta ? service.description_ta : service.description
  );

  if (loading) return <p role="status">Loading services…</p>;
  if (error) return <p role="alert">Services are temporarily unavailable: {error}</p>;
  if (!services.length) return <p>No active services are available right now.</p>;

  return (
    <>
      <div className="services-grid">
        {visible.map((service) => (
          <article
            key={service.id}
            className="battery-card service-card"
            onClick={() => onServiceClick(getTitle(service))}
          >
            <div className="service-image-container">
              <img
                src={getImage(service)}
                alt={getTitle(service)}
                className="card-img"
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = '/images/old-battery-buyback.jpg';
                }}
              />
              <span className="service-icon-badge" aria-hidden="true">{service.icon}</span>
            </div>
            <div className="service-card-content">
              <div>
                <h3 className="service-card-title">{getTitle(service)}</h3>
                <p className="service-card-description">{getDescription(service)}</p>
              </div>
              <button
                type="button"
                className="service-card-action"
                onClick={(event) => {
                  event.stopPropagation();
                  onServiceClick(getTitle(service));
                }}
              >
                {lang === 'en' ? 'Open Form ➔' : 'படிவம் திறக்கவும் ➔'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {services.length > 3 && (
        <button className="expand-btn" onClick={() => setShowAllServices((value) => !value)}>
          {showAllServices
            ? (lang === 'en' ? 'Show Less Services' : 'குறைவாகக் காட்டு')
            : (lang === 'en' ? 'View All Services ➔' : 'அனைத்து சேவைகளையும் காண்க ➔')}
        </button>
      )}
    </>
  );
}
