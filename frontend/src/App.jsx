import { useState, useEffect, useRef } from 'react';
import { apiRequest } from './api';
import Services from './Services';
import AdminPage from './pages/AdminPage';
import ReviewPage from './pages/ReviewPage';

// --- REUSABLE SCROLL REVEAL COMPONENT ---
function ScrollReveal({ children, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.15 }
    );

    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`scroll-reveal-box ${isVisible ? 'is-visible' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// --- BRAND DATA ---
const BRANDS = [
  { name: 'EXIDE', logo: '/exide-logo.png' },
  { name: 'AMARON', logo: '/amaron-logo.png' },
  { name: 'POWERZONE', logo: '/powerzone-logo.png' }
];

// --- LOADING STEPS ---
const LOADING_STEPS = [
  "Initializing Power Systems...",
  "Analyzing Backup Core & Cells...",
  "Calibrating Inverter Voltages...",
  "Securing Premium Gateway..."
];

// --- ABOUT CAROUSEL IMAGES ---
const ABOUT_SLIDER_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?q=80&w=800&auto=format&fit=crop',
    tag: 'Authentic Testing',
    badge: '100% Genuine Certified'
  },
  {
    url: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=800&auto=format&fit=crop',
    tag: 'Expert Technicians',
    badge: 'Fast Doorstep Setup'
  },
  {
    url: 'https://images.unsplash.com/photo-1562141960-c15164571f24?q=80&w=800&auto=format&fit=crop',
    tag: '24/7 Breakdown Support',
    badge: 'Rapid Roadside Jumpstart'
  }
];

// --- ABOUT FEATURE BLOCKS ---
const ABOUT_FEATURES = [
  {
    id: 'f1',
    title: { en: 'Genuine Brands & Warranties', ta: 'அசல் பிராண்டுகள் & வாரண்டி' },
    icon: '🏅',
    desc: { en: 'Authorized dealership network delivering high-performance, original batteries from Exide, Amaron, and Powerzone.', ta: 'எக்ஸைட், அமரோன் மற்றும் பவர்ஜோன் வழங்கும் அசல் உயர்தர பேட்டரிகள்.' }
  },
  {
    id: 'f2',
    title: { en: 'Advanced Diagnostics', ta: 'நவீன பேட்டரி பரிசோதனை' },
    icon: '🛠️',
    desc: { en: 'Equipped with digital testers to evaluate internal cell health and specific gravity fluid densities.', ta: 'டிஜிட்டல் சாதனங்கள் மூலம் பேட்டரி திறன் மற்றும் வோல்டேஜ் துல்லியமாக பரிசோதிக்கப்படும்.' }
  },
  {
    id: 'f3',
    title: { en: 'On-Demand Doorstep Support', ta: 'டோர்ஸ்டெப் சேவை ஆதரவு' },
    icon: '📍',
    desc: { en: 'Swift local response for on-site diagnostics, instant vehicle jump-starts, and professional installations.', ta: 'உடனடி ஆன்-சைட் பரிசோதனை மற்றும் ஜம்ப்-ஸ்டார்ட் வசதி உங்கள் வீட்டு வாசலில்.' }
  }
];

function HomePage() {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [lang, setLang] = useState('en');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  const [testimonials, setTestimonials] = useState([]);
  const [reviewError, setReviewError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slotStatus, setSlotStatus] = useState('');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);

  const [formData, setFormData] = useState({
    name: '', phone: '', location: '', complaint: '', selectedService: '', geoLink: '', marketing_opt_in: false
  });

  const [reviewForm, setReviewForm] = useState({
    name: '', location: '', rating: 5, comment: ''
  });

  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const ownerWhatsApp = "+91 8870020370";
  const shopPhoneDisplay = "+91 8870020370";
  const shopPhone = "+91 8870020370";
  const shopEmail = 'devibatteries@gmail.com';
  
  // OWNER NAME
  const ownerName = "Vignesh T U";

  // EXACT MAP URL SHARED BY USER
  const exactMapsUrl = "https://maps.app.goo.gl/yAUCkKhgEDyFfqmw6";

  useEffect(() => {
    const totalDuration = 2400; 
    const stepInterval = totalDuration / LOADING_STEPS.length;

    const stepTimer = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < LOADING_STEPS.length - 1) return prev + 1;
        clearInterval(stepTimer);
        return prev;
      });
    }, stepInterval);

    const mainTimer = setTimeout(() => setLoading(false), totalDuration); 
    return () => {
      clearTimeout(mainTimer);
      clearInterval(stepTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest('/api/reviews')
      .then((reviews) => { if (active) setTestimonials(reviews); })
      .catch((error) => { if (active) setReviewError(error.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const imageInterval = setInterval(() => {
      setCurrentImgIndex((prevIndex) => (prevIndex + 1) % ABOUT_SLIDER_IMAGES.length);
    }, 4000);

    return () => clearInterval(imageInterval);
  }, []);

  const handleServiceClick = (serviceTitle) => {
    setSlotStatus('');
    setFormData({ name: '', phone: '', location: '', complaint: '', selectedService: serviceTitle, geoLink: '', marketing_opt_in: false });
    setIsModalOpen(true);
  };

  const handleGetLiveLocation = () => {
    if (!navigator.geolocation) {
      alert("Location features are limited on local preview. Please type manually.");
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setFormData(prev => ({
          ...prev,
          location: `Live GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
          geoLink: `https://www.google.com/maps?q=${lat},${lon}`
        }));
        setLocLoading(false);
      },
      () => {
        alert("Could not pull location details. Please write your address below.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const whatsapp = window.open('about:blank', '_blank');
    if (whatsapp) whatsapp.opener = null;
    setSubmitting(true);
    setFormError('');
    apiRequest('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.name,
        phone: formData.phone,
        location: formData.location,
        selected_service: formData.selectedService,
        complaint: formData.complaint,
        geo_link: formData.geoLink || null,
        marketing_opt_in: formData.marketing_opt_in,
      }),
    }).then((booking) => {
      setSlotStatus(booking.status === 'OPEN' ? 'ACTIVE / CONFIRMED' : booking.status);
      const reviewUrl = `${window.location.origin}/review`;
      const message = [
        '*NEW SERVICE INQUIRY - DEVI BATTERIES & INVERTERS SERVICE*',
        `Service Type: ${formData.selectedService}`,
        `Customer Name: ${formData.name}`,
        `Phone: ${formData.phone}`,
        `Location: ${formData.location}`,
        formData.geoLink && `Map: ${formData.geoLink}`,
        `Issue: ${formData.complaint}`,
        `Check verified reviews or submit your review: ${reviewUrl}`,
      ].filter(Boolean).join('\n');
      const url = `https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(message)}`;
      if (whatsapp) whatsapp.location.href = url;
      else window.location.href = url;
      setIsModalOpen(false);
    }).catch((error) => {
      whatsapp?.close();
      setFormError(error.message);
    }).finally(() => setSubmitting(false));
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    try {
      const review = await apiRequest('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ ...reviewForm, location: reviewForm.location || 'Customer', rating: Number(reviewForm.rating) }),
      });
      setTestimonials((current) => [review, ...current]);
      setReviewForm({ name: '', location: '', rating: 5, comment: '' });
      setIsReviewModalOpen(false);
    } catch (error) {
      setReviewError(error.message);
    }
  };

  const visibleTestimonials = showAllReviews ? testimonials : testimonials.slice(0, 4);

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#070a12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999, color: '#ffffff', fontFamily: '"Segoe UI", Roboto, sans-serif' }}>
        <style>{`
          @keyframes dynamicPulseCore {
            0% { transform: scale(0.96); box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); }
            50% { transform: scale(1.04); box-shadow: 0 0 35px rgba(56, 189, 248, 0.8); border-color: #60a5fa; }
            100% { transform: scale(0.96); box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); }
          }
          @keyframes spinRadar { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes progressSequence { 0% { width: 0%; } 100% { width: 100%; } }
          
          .logo-wrapper { position: relative; width: 140px; height: 140px; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; }
          .radar-ring { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 2px dashed rgba(56, 189, 248, 0.3); border-radius: 50%; animation: spinRadar 10s linear infinite; }
          .logo-capsule { width: 110px; height: 110px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 3px solid #38bdf8; overflow: hidden; animation: dynamicPulseCore 2s ease-in-out infinite; }
          .logo-img-fix { width: 105%; height: 105%; object-fit: contain; border-radius: 50%; mix-blend-mode: multiply; }
          .progress-bar-fill { height: 100%; background: linear-gradient(90deg, #0284c7, #38bdf8); animation: progressSequence 2.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        `}</style>
        
        <div className="logo-wrapper">
          <div className="radar-ring"></div>
          <div className="logo-capsule">
            <img 
              src="/shop-logo.png" 
              alt="Devi Batteries Logo" 
              className="logo-img-fix"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentNode.style.background = '#0b111e';
                e.target.parentNode.innerHTML = '<div style="font-size:40px; filter: drop-shadow(0 0 10px #38bdf8);">⚡</div>';
              }}
            />
          </div>
        </div>

        <h2 style={{ fontWeight: '800', letterSpacing: '3px', margin: '0 0 8px 0', fontSize: '22px', textAlign: 'center' }}>DEVI BATTERIES</h2>
        <p style={{ color: '#38bdf8', fontSize: '12px', margin: '0 0 24px 0', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {LOADING_STEPS[loadingStep]}
        </p>
        <div style={{ width: '180px', height: '4px', background: '#111827', borderRadius: '20px', overflow: 'hidden' }}>
          <div className="progress-bar-fill"></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#ffffff', color: '#0f172a', minHeight: '100vh', width: '100vw', margin: 0, padding: 0, fontFamily: '"Segoe UI", Roboto, sans-serif', overflowX: 'hidden' }}>
      
      <style>{`
        html, body, #root { width: 100%; margin: 0; padding: 0; overflow-x: hidden; }

        .scroll-reveal-box {
          opacity: 0;
          transform: translateY(45px) scale(0.98);
          transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }

        .scroll-reveal-box.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes tickerSlide { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }

        .animate-fade { animation: fadeSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .float-badge { animation: floatY 4s ease-in-out infinite; }
        .scroll-ticker { display: flex; width: max-content; animation: tickerSlide 25s linear infinite; align-items: center; }

        .feature-item-card {
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 12px;
          padding: 18px;
          display: flex;
          align-items: flex-start;
          gap: 16px;
          backdrop-filter: blur(8px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .feature-item-card:hover {
          background: rgba(15, 23, 42, 0.9);
          border-color: rgba(56, 189, 248, 0.6);
          transform: translateX(8px) scale(1.02);
          box-shadow: 0 10px 25px rgba(56, 189, 248, 0.15);
        }

        .services-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 24px;
          padding: 24px;
          align-items: stretch;
        }

        @media (min-width: 768px) {
          .services-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1024px) {
          .services-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .battery-card {
          background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer; display: flex; flex-direction: column;
          height: 100%;
        }

        .service-card {
          justify-content: space-between;
          border-color: #f3f4f6;
          box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1);
        }

        .battery-card:hover { 
          transform: translateY(-6px); 
          border-color: #0284c7; 
          box-shadow: 0 22px 40px rgba(2, 132, 199, 0.18); 
        }

        .service-image-container {
          position: relative;
          width: 100%;
          height: 12rem;
          flex: 0 0 auto;
          overflow: hidden;
          background: #f9fafb;
        }

        .card-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .service-icon-badge {
          position: absolute;
          top: 14px;
          right: 14px;
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
        }

        .battery-card:hover .card-img { transform: scale(1.04); }

        .service-card-content {
          display: flex;
          flex: 1;
          flex-direction: column;
          justify-content: space-between;
          padding: 20px;
          text-align: left;
        }

        .service-card-title {
          margin: 0 0 12px;
          color: #0f172a;
          font-size: 18px;
        }

        .service-card-description {
          margin: 0;
          color: #475569;
          font-size: 14px;
        }

        .service-card-action {
          align-self: flex-start;
          margin-top: 20px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #0284c7;
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }

        @media (prefers-reduced-motion: reduce) {
          .battery-card, .card-img { transition: none; }
          .battery-card:hover, .battery-card:hover .card-img { transform: none; }
        }

        .btn-hover { transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .btn-hover:hover { transform: translateY(-3px) scale(1.03); box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .contact-button { display: inline-block; padding: 12px 20px; border-radius: 24px; background: #0284c7; color: white; text-decoration: none; font-weight: 700; }
        .hotline-widget {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 6000;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 12px 18px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 14px;
          background: #0f172a;
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35);
          text-decoration: none;
          text-align: left;
          line-height: 1.35;
        }
        .hotline-widget span:first-child { color: #7dd3fc; font-size: 12px; font-weight: 800; }
        .hotline-widget span:last-child { font-size: 14px; font-weight: 800; white-space: nowrap; }
        @media (max-width: 480px) {
          .hotline-widget { right: 12px; bottom: 12px; padding: 10px 14px; }
        }

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 5000; padding: 16px; box-sizing: border-box; }
        .modal-body { background: #ffffff; border: 1px solid #e2e8f0; width: 100%; max-width: 440px; border-radius: 12px; padding: 24px; box-shadow: 0 20px 25px rgba(0,0,0,0.1); max-height: 85vh; overflow-y: auto; box-sizing: border-box; animation: fadeSlideUp 0.3s ease; }
        .brand-logo-card { display: flex; align-items: center; justify-content: center; padding: 10px 20px; margin: 0 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; height: 65px; width: 170px; box-sizing: border-box; transition: transform 0.3s; }
        .brand-logo-card:hover { transform: scale(1.05); }

        .input-element { width: 100%; padding: 12px 16px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; box-sizing: border-box; outline: none; background: #f8fafc; color: #0f172a; font-weight: 500; margin-bottom: 12px; transition: all 0.2s; }
        .input-element:focus { border-color: #0f172a; background: #ffffff; box-shadow: 0 0 0 3px rgba(15,23,42,0.1); }

        .about-grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; align-items: center; }
        @media (max-width: 960px) { .about-grid-container { grid-template-columns: 1fr; gap: 36px; } }

        .lang-switcher {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2000;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 30px;
          padding: 4px;
          display: flex;
          gap: 4px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        }
        .lang-btn {
          border: none;
          background: transparent;
          color: #94a3b8;
          font-weight: 700;
          font-size: 12px;
          padding: 6px 14px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .lang-btn.active {
          background: #38bdf8;
          color: #0f172a;
        }

        .expand-btn {
          background: #ffffff;
          border: 2px solid #0284c7;
          color: #0284c7;
          font-weight: 800;
          font-size: 14px;
          padding: 12px 28px;
          border-radius: 30px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 36px;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 14px rgba(2, 132, 199, 0.12);
        }
        .expand-btn:hover {
          background: #0284c7;
          color: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(2, 132, 199, 0.25);
        }

        /* --- CENTERED MAP WRAPPER --- */
        .centered-map-card {
          width: 100%;
          max-width: 540px;
          height: 240px;
          margin: 24px auto 0 auto;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 12px 30px rgba(0,0,0,0.4);
        }
      `}</style>

      {/* --- LANGUAGE SWITCHER --- */}
      <div className="lang-switcher">
        <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        <button className={`lang-btn ${lang === 'ta' ? 'active' : ''}`} onClick={() => setLang('ta')}>தமிழ்</button>
      </div>

      {/* --- HERO BANNER --- */}
      <header style={{ position: 'relative', width: '100%', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundImage: `linear-gradient(to bottom, rgba(15, 24, 42, 0.85), rgba(15, 24, 42, 0.95)), url('https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=1974&auto=format&fit=crop')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', color: '#ffffff', padding: '80px 24px', textAlign: 'center', boxSizing: 'border-box' }}>
        <div className="animate-fade" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(32px, 5.5vw, 56px)', fontWeight: '900', margin: '0 0 20px 0', letterSpacing: '-1px', lineHeight: '1.2' }}>
            {lang === 'en' ? 'Devi Batteries & Inverters Service' : 'தேவி பேட்டரிஸ், இன்வெர்ட்டர் மற்றும் சர்வீஸ்'}
          </h1>
          <p style={{ fontSize: '16px', color: '#cbd5e1', margin: '0 auto 36px', maxWidth: '680px', fontWeight: '500', lineHeight: 1.6 }}>
            Main Road Junction, Valliyattan karai, Eraniel, Kanyakumari Dist.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a className="contact-button" href={`https://wa.me/${ownerWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp Chat</a>
            <a className="contact-button" href={`mailto:${shopEmail}`}>Email</a>
          </div>
        </div>
      </header>
      {slotStatus && <p role="status" style={{ background: '#dcfce7', color: '#166534', padding: 12, textAlign: 'center', fontWeight: 800 }}>Slot Status: {slotStatus}</p>}

      {/* --- BRAND MARQUEE TICKER --- */}
      <section style={{ width: '100%', background: '#ffffff', padding: '20px 0', overflow: 'hidden', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div className="scroll-ticker">
            {[...BRANDS, ...BRANDS, ...BRANDS, ...BRANDS].map((brand, idx) => (
              <div key={idx} className="brand-logo-card">
                <img 
                  src={brand.logo} 
                  alt={`${brand.name} Logo`} 
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerText = brand.name; }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- ABOUT DEVI BATTERIES --- */}
      <section style={{ width: '100%', position: 'relative', backgroundImage: `linear-gradient(to bottom, rgba(7, 10, 18, 0.92), rgba(7, 10, 18, 0.97)), url('https://images.unsplash.com/photo-1581092921461-eab62e97a780?q=80&w=1974&auto=format&fit=crop')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed', color: '#ffffff', padding: '100px 32px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
          <div className="about-grid-container">
            
            <ScrollReveal delay={100}>
              <div style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', height: '540px', border: '1px solid rgba(56, 189, 248, 0.3)', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' }}>
                {ABOUT_SLIDER_IMAGES.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      opacity: currentImgIndex === idx ? 1 : 0, transition: 'opacity 0.8s ease-in-out',
                      backgroundImage: `linear-gradient(to top, rgba(7, 10, 18, 0.85) 10%, transparent 60%), url(${item.url})`,
                      backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column',
                      justifyContent: 'space-between', padding: '28px', boxSizing: 'border-box'
                    }}
                  >
                    <div className="float-badge" style={{ alignSelf: 'flex-start', background: 'rgba(56, 189, 248, 0.9)', color: '#0f172a', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px' }}>
                      ⚡ {item.badge}
                    </div>
                    <div>
                      <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>FEATURE HIGHLIGHT</span>
                      <h4 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '800', margin: '6px 0 0 0' }}>{item.tag}</h4>
                    </div>
                  </div>
                ))}
                <div style={{ position: 'absolute', bottom: '20px', right: '24px', display: 'flex', gap: '8px', zIndex: 10 }}>
                  {ABOUT_SLIDER_IMAGES.map((_, idx) => (
                    <button key={idx} onClick={() => setCurrentImgIndex(idx)} style={{ width: currentImgIndex === idx ? '28px' : '8px', height: '8px', borderRadius: '4px', background: currentImgIndex === idx ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)', border: 'none', cursor: 'pointer', transition: 'all 0.3s ease' }} />
                  ))}
                </div>
              </div>
            </ScrollReveal>

            <div style={{ textAlign: 'left' }}>
              <ScrollReveal delay={200}>
                <span style={{ color: '#38bdf8', fontWeight: '800', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>
                  {lang === 'en' ? 'WHO WE ARE' : 'எங்களை பற்றி'}
                </span>
                <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: '800', color: '#ffffff', marginBottom: '20px', letterSpacing: '-0.5px', lineHeight: '1.2' }}>
                  {lang === 'en' ? 'About Devi Batteries' : 'தேவி பேட்டரிஸ் பற்றி'}
                </h2>
                <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: '1.7', margin: '0 0 28px 0' }}>
                  {lang === 'en' 
                    ? 'Welcome to Devi Batteries, Inverters and Service, your trusted destination for heavy-duty power backup and vehicular electrical systems.we' 
                    : 'தேவி பேட்டரிஸ் மற்றும் இன்வெர்ட்டர் சேவை மையத்திற்கு உங்களை வரவேற்கிறோம். அனைத்து இன்வெர்ட்டர் மற்றும் பேட்டரிகளுக்கு நம்பிக்கையான சேவை மையம்.'}
                </p>
              </ScrollReveal>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {ABOUT_FEATURES.map((feat, index) => (
                  <ScrollReveal key={feat.id} delay={300 + index * 150}>
                    <div className="feature-item-card">
                      <div style={{ fontSize: '24px', background: 'rgba(56, 189, 248, 0.1)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>{feat.icon}</div>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', margin: '0 0 4px 0' }}>{feat.title[lang]}</h4>
                        <p style={{ color: '#94a3b8', fontSize: '13.5px', margin: 0, lineHeight: '1.5' }}>{feat.desc[lang]}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* --- EXPERT SERVICE CAPABILITIES --- */}
      <section style={{ width: '100%', background: '#7c2d12', padding: '100px 32px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', textAlign: 'center' }}>
          <ScrollReveal delay={100}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: '800', marginBottom: '40px', color: '#ffffff' }}>
              {lang === 'en' ? 'Expert Service Capabilities' : 'சிறந்த சேவைகள்'}
            </h2>
          </ScrollReveal>

          <Services lang={lang} showAllServices={showAllServices} setShowAllServices={setShowAllServices} onServiceClick={handleServiceClick} />

        </div>
      </section>

      {/* --- CUSTOMER REVIEWS SECTION --- */}
      <section style={{ width: '100%', background: '#f8fafc', padding: '80px 32px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <ScrollReveal delay={100}>
            <span style={{ color: '#0284c7', fontSize: '12px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>
              {lang === 'en' ? 'TESTIMONIALS' : 'வாடிக்கையாளர் கருத்துக்கள்'}
            </span>
            
            <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '8px 0 16px 0', color: '#0f172a' }}>
              {lang === 'en' ? 'What Our Customers Say' : 'எங்கள் வாடிக்கையாளர்கள் சொல்வது'}
            </h2>

            <div style={{ marginBottom: '40px' }}>
              <button 
                onClick={() => setIsReviewModalOpen(true)}
                className="btn-hover"
                style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '12px 26px', borderRadius: '25px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                ✍️ {lang === 'en' ? 'Share Your Review' : 'உங்கள் கருத்தை பகிரவும்'}
              </button>
            </div>
          </ScrollReveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
            {visibleTestimonials.map((t, index) => (
              <ScrollReveal key={t.id || t.name} delay={100 + index * 100}>
                <div 
                  style={{ 
                    background: '#ffffff', 
                    padding: '24px', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    textAlign: 'left', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)', 
                    height: '100%',
                    boxSizing: 'border-box'
                  }} 
                  className="btn-hover"
                >
                  <div style={{ color: '#f59e0b', marginBottom: '8px' }}>{"★".repeat(t.rating)}</div>
                  <p style={{ color: '#334155', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px 0', fontStyle: 'italic' }}>"{t.comment}"</p>
                  <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>📍 {t.location}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          {reviewError && <p role="alert" style={{ color: '#b91c1c', marginTop: 20 }}>Reviews could not be loaded: {reviewError}</p>}
          {!testimonials.length && !reviewError && <p style={{ color: '#64748b', marginTop: 20 }}>No reviews yet. Be the first to share one.</p>}

          {testimonials.length > 4 && (
            <div>
              <button 
                onClick={() => setShowAllReviews(!showAllReviews)}
                className="expand-btn"
              >
                <span>
                  {showAllReviews 
                    ? (lang === 'en' ? 'Show Less' : 'குறைவாகக் காட்டு') 
                    : (lang === 'en' ? 'View More Reviews' : 'மேலும் விமர்சனங்களை காண்க')
                  }
                </span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* --- ADD REVIEW MODAL --- */}
      {isReviewModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReviewModalOpen(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                {lang === 'en' ? 'Write a Review' : 'உங்கள் மதிப்புரையை எழுதுங்கள்'}
              </h3>
              <button onClick={() => setIsReviewModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            
            <form onSubmit={handleReviewSubmit}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>YOUR NAME</label>
              <input type="text" placeholder="e.g. Anand" required value={reviewForm.name} onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })} className="input-element" />
              
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>LOCATION / TOWN</label>
              <input type="text" placeholder="e.g. Eraniel" value={reviewForm.location} onChange={(e) => setReviewForm({ ...reviewForm, location: e.target.value })} className="input-element" />

              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>RATING</label>
              <select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })} className="input-element">
                {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{'⭐'.repeat(rating)} ({rating}/5)</option>)}
              </select>

              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>YOUR EXPERIENCE</label>
              <textarea rows="3" placeholder="Tell us how our service was..." required value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} className="input-element" style={{ fontFamily: 'inherit', resize: 'none' }} />
              {reviewError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{reviewError}</p>}
              
              <button type="submit" style={{ width: '100%', padding: '14px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14.5px', marginTop: '8px' }}>
                {lang === 'en' ? 'Submit Review' : 'மதிப்பாய்வை சமர்ப்பிக்கவும்'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SERVICE TICKET MODAL --- */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Service Ticket Desk</span>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>
            <div style={{ background: '#f0fdf4', color: '#166534', padding: '10px 14px', borderRadius: '6px', fontSize: '13.5px', fontWeight: '700', marginBottom: '18px' }}>🎯 {formData.selectedService}</div>
            {slotStatus && <p role="status" style={{ color: '#166534', fontWeight: 800 }}>Slot Status: {slotStatus}</p>}
            
            <form onSubmit={handleFormSubmit}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>CUSTOMER NAME</label>
              <input type="text" placeholder="Your Name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-element" />
              
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>PHONE NUMBER</label>
              <input type="tel" placeholder="Mobile Number" required value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-element" />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>YOUR LOCATION</label>
                <button type="button" onClick={handleGetLiveLocation} style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>{locLoading ? "Fetching..." : "📍 Use Live GPS"}</button>
              </div>
              <input type="text" placeholder="Street/Village Address" required value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-element" />

              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>ISSUE DETAILS / DESCRIPTION</label>
              <textarea rows="3" placeholder="Describe the battery issue..." required value={formData.complaint} onChange={(e) => setFormData({ ...formData, complaint: e.target.value })} className="input-element" style={{ fontFamily: 'inherit', resize: 'none' }} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#475569', margin: '8px 0' }}>
                <input type="checkbox" checked={formData.marketing_opt_in} onChange={(e) => setFormData({ ...formData, marketing_opt_in: e.target.checked })} />
                I agree to receive promotional WhatsApp offers.
              </label>
              
              {formError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{formError}</p>}
              <button type="submit" disabled={submitting} style={{ width: '100%', padding: '14px', background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: submitting ? 'wait' : 'pointer', fontSize: '14.5px', marginTop: '8px' }}>{submitting ? 'Saving...' : 'Book Service via WhatsApp'}</button>
            </form>
          </div>
        </div>
      )}

      {/* --- FOOTER WITH WORKING GOOGLE MAP LOCATION --- */}
      <footer style={{ width: '100%', background: '#0b1120', color: '#94a3b8', fontSize: '13px', padding: '60px 24px 30px 24px', boxSizing: 'border-box', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
          
          {/* TITLE */}
          <h3 style={{ margin: '0 0 10px 0', fontWeight: '800', color: '#ffffff', fontSize: '22px' }}>
            Devi Batteries & Inverters Service
          </h3>

          {/* OWNER DETAILS */}
          <div style={{ color: '#38bdf8', fontWeight: '700', fontSize: '14px', marginBottom: '12px', letterSpacing: '0.5px' }}>
            👤 Proprietor: {ownerName}
          </div>

          {/* ADDRESS */}
          <p style={{ margin: '0 0 16px 0', color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6' }}>
            📍 Main Road Junction, Valliyattan karai, Eraniel, Kanyakumari Dist.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', margin: '16px 0' }}>
            <a className="contact-button" href={`tel:${shopPhone}`}>Direct Call: {shopPhoneDisplay}</a>
            <a className="contact-button" href={`https://wa.me/${ownerWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp Chat</a>
            <a className="contact-button" href={`mailto:${shopEmail}`}>Email: {shopEmail}</a>
          </div>

          {/* CLICKABLE EXACT MAP LINK */}
          <div style={{ marginBottom: '16px' }}>
            <a 
              href={exactMapsUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '700', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              📖 Open Exact Shop Location in Google Maps ↗
            </a>
          </div>

          {/* TAGLINE */}
          <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 24px 0' }}>
            High-quality automotive, bike, and inverter batteries. Doorstep diagnostic and roadside support.
          </p>

          {/* --- EMBEDDED GOOGLE MAP (EXACT COORDINATES FROM YOUR TAB) --- */}
            <div className="centered-map-card">
              <iframe
                title="Devi Batteries Shop Location"
                /* Exact Pin: 8°12'18.9"N 77°19'12.9"E */
                src="https://maps.google.com/maps?q=8.20525,77.32025&z=17&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
           
          {/* COPYRIGHT */}
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '12px', color: '#64748b' }}>
            © 2026 Devi Batteries. All Rights Reserved.
          </div>

        </div>
      </footer>
      <a className="hotline-widget" href={`tel:${shopPhone}`} aria-label={`Call hotline ${shopPhoneDisplay}`}>
        <span>HOTLINE · CALL NOW</span>
        <span>{shopPhoneDisplay}</span>
      </a>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;
  if (path === '/admin') return <AdminPage />;
  if (path === '/review') return <ReviewPage />;
  return <HomePage />;
}