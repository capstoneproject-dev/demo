import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudentDashboard.module.css';

// --- MOCK DATA (Moved from JS) ---
const announcementsData = [
  { title: "Enrollment for 2nd Sem", date: "Today", content: "Please settle your balance before 25th." },
  { title: "Office Hours", date: "Yesterday", content: "Org offices will be closed on holidays." },
  { title: "Job Fair", date: "2 days ago", content: "Prepare your resumes for upcoming fair." }
];

const eventsData = [
  { title: "Annual Tech Summit", date: "Oct 25", org: "AISERS", desc: "A gathering of tech enthusiasts." },
  { title: "Sports Fest 2023", date: "Nov 02", org: "SSC", desc: "Inter-department sports league." },
  { title: "Aero Workshop", date: "Nov 10", org: "AERO-ATSO", desc: "Drone flying basics." }
];

const servicesData = [
  { name: "Shoe Rag", org: "AISERS", icon: "fa-shoe-prints", backgroundImage: "/assets/photos/studentDashboard/Services/shoerag.png" },
  { name: "Business Calculator", org: "AISERS", icon: "fa-calculator", backgroundImage: "/assets/photos/studentDashboard/Services/businesscalculator.png" },
  { name: "Scientific Calculator", org: "SSC", icon: "fa-calculator", backgroundImage: "/assets/photos/studentDashboard/Services/scical.png" },
  { name: "Arnis", org: "AISERS", icon: "fa-hand-fist", backgroundImage: "/assets/photos/studentDashboard/Services/arnis.png" },
  { name: "Printing", org: "SSC", icon: "fa-print", backgroundImage: null }, // Use default if null
  { name: "Lockers", org: "SSC", icon: "fa-box", backgroundImage: "/assets/photos/studentDashboard/Services/locker.png" }
];

const StudentDashboard = () => {
  const navigate = useNavigate();
  
  // --- STATE MANAGEMENT ---
  const [activeView, setActiveView] = useState('dashboard'); // dashboard, organizations, services, profile
  const [activeOrgTab, setActiveOrgTab] = useState('about');
  const [currentDate, setCurrentDate] = useState('');
  
  // Modal States
  const [isRentalModalOpen, setIsRentalModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  
  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);

  // --- EFFECTS ---
  useEffect(() => {
    // Set Date on Load
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setCurrentDate(new Date().toLocaleDateString('en-US', options));
    
    // Generate Calendar
    generateCalendar(calendarDate);
  }, [calendarDate]);

  // --- HELPERS ---
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      navigate('/');
    }
  };

  const generateCalendar = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    setCalendarDays(days);
  };

  const changeMonth = (direction) => {
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCalendarDate(newDate);
  };

  const openRentalModal = (service) => {
    setSelectedService(service);
    setIsRentalModalOpen(true);
  };

  // --- RENDERERS ---

  return (
    <div className={styles.dashboardContainer}>
      
      {/* SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.logoArea}>
          <i className={`fa-solid fa-graduation-cap ${styles.logoIcon}`}></i>
          <span className={styles.logoText}>StudentHub</span>
        </div>

        <ul className={styles.navMenu}>
          <li className={styles.navItem}>
            <a onClick={() => setActiveView('dashboard')} 
               className={`${styles.navLink} ${activeView === 'dashboard' ? styles.navLinkActive : ''}`}>
              <i className={`fa-solid fa-table-columns ${styles.navIcon}`}></i>
              <span className={styles.navLabel}>Dashboard</span>
            </a>
          </li>
          <li className={styles.navItem}>
            <a onClick={() => setActiveView('organizations')} 
               className={`${styles.navLink} ${activeView === 'organizations' ? styles.navLinkActive : ''}`}>
              <i className={`fa-solid fa-people-group ${styles.navIcon}`}></i>
              <span className={styles.navLabel}>Organizations</span>
            </a>
          </li>
          <li className={styles.navItem}>
            <a onClick={() => setActiveView('services')} 
               className={`${styles.navLink} ${activeView === 'services' ? styles.navLinkActive : ''}`}>
              <i className={`fa-solid fa-basket-shopping ${styles.navIcon}`}></i>
              <span className={styles.navLabel}>Services</span>
            </a>
          </li>
          <li className={styles.navItem}>
            <a onClick={() => setActiveView('profile')} 
               className={`${styles.navLink} ${activeView === 'profile' ? styles.navLinkActive : ''}`}>
              <i className={`fa-regular fa-id-card ${styles.navIcon}`}></i>
              <span className={styles.navLabel}>Profile</span>
            </a>
          </li>
          <li className={styles.navItem} style={{ marginTop: 'auto' }}>
            <a onClick={handleLogout} className={styles.navLink} style={{ color: '#ef4444' }}>
              <i className={`fa-solid fa-arrow-right-from-bracket ${styles.navIcon}`}></i>
              <span className={styles.navLabel}>Logout</span>
            </a>
          </li>
        </ul>
      </aside>

      {/* MAIN CONTENT */}
      <main className={styles.mainContent}>
        
        {/* HEADER */}
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            <h1>{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</h1>
            <p>{currentDate}</p>
          </div>
          <div className={styles.userProfileBox} onClick={() => setActiveView('profile')}>
            <img src="https://picsum.photos/seed/student1/100/100" alt="User" className={styles.avatar} />
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 'bold' }}>Juan Dela Cruz</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>BSCS - Year 3</span>
            </div>
          </div>
        </header>

        {/* --- VIEW: DASHBOARD --- */}
        {activeView === 'dashboard' && (
          <div className={styles.dashboardLayout}>
            {/* Left Col */}
            <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>
              
              {/* Announcements */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>Latest Announcements</div>
                </div>
                {announcementsData.map((item, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <div className={styles.itemIcon}><i className="fa-solid fa-bullhorn"></i></div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{item.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{item.content}</p>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>{item.date}</span>
                  </div>
                ))}
              </div>

              {/* Recent Activity */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>Upcoming Events</div>
                </div>
                {eventsData.map((ev, idx) => (
                  <div key={idx} className={styles.listItem}>
                    <div className={styles.itemIcon}><i className="fa-regular fa-calendar"></i></div>
                    <div>
                      <h4 style={{ margin: 0 }}>{ev.title}</h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{ev.date} - {ev.org}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Col (Calendar) */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <div style={{ display:'flex', gap:'10px' }}>
                  <button onClick={() => changeMonth(-1)} style={{ border:'none', background:'none', cursor:'pointer' }}>
                    <i className="fa-solid fa-chevron-left"></i>
                  </button>
                  <button onClick={() => changeMonth(1)} style={{ border:'none', background:'none', cursor:'pointer' }}>
                    <i className="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>
              <div className={styles.calendarGrid}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} className={styles.calendarDayHeader}>{d}</div>
                ))}
                {calendarDays.map((day, idx) => (
                  <div key={idx} className={`${styles.calendarDay} ${!day ? '' : ''} ${day === new Date().getDate() ? styles.today : ''}`}>
                    {day}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: ORGANIZATIONS --- */}
        {activeView === 'organizations' && (
          <div>
            <div className={styles.tabs}>
              {['about', 'my-organization', 'membership', 'events'].map(tab => (
                <button 
                  key={tab} 
                  className={`${styles.tabBtn} ${activeOrgTab === tab ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveOrgTab(tab)}
                >
                  {tab.replace('-', ' ').toUpperCase()}
                </button>
              ))}
            </div>
            
            <div className={styles.card}>
              {activeOrgTab === 'about' && <p>List of Student Organizations will appear here.</p>}
              {activeOrgTab === 'my-organization' && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <i className="fa-solid fa-users-slash" style={{ fontSize: '3rem', marginBottom: '10px' }}></i>
                  <h3>No Organization Joined</h3>
                </div>
              )}
              {activeOrgTab === 'membership' && <p>Membership Application Forms.</p>}
            </div>
          </div>
        )}

        {/* --- VIEW: SERVICES --- */}
        {activeView === 'services' && (
          <div>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Rent an Item</h2>
            </div>
            <div className={styles.servicesGrid}>
              {servicesData.map((service, idx) => (
                <div key={idx} className={styles.serviceCard} onClick={() => openRentalModal(service)}>
                  {service.backgroundImage ? (
                    <>
                      <div className={styles.galleryImgWrapper}>
                        <img src={service.backgroundImage} alt={service.name} />
                      </div>
                      <div className={styles.galleryContent}>{service.name}</div>
                    </>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center' }}>
                      <i className={`fa-solid ${service.icon}`} style={{ fontSize: '2rem', color: '#002147' }}></i>
                      <div style={{ marginTop: '10px', fontWeight: 'bold' }}>{service.name}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* --- RENTAL MODAL --- */ }
      {isRentalModalOpen && selectedService && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setIsRentalModalOpen(false)}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3>Rent {selectedService.name}</h3>
              <button className={styles.closeModal} onClick={() => setIsRentalModalOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div className={styles.formGroup}>
              <label>Select Date</label>
              <input type="date" />
            </div>
            <div className={styles.formGroup}>
              <label>Start Time</label>
              <input type="time" />
            </div>
            <div className={styles.formGroup}>
              <label>Duration (Hours)</label>
              <input type="number" min="1" max="5" defaultValue="1" />
            </div>
            <button className={styles.btnSubmit}>Confirm Rental</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentDashboard;
