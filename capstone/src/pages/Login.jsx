import React, { useState } from 'react';
import styles from './Login.module.css';
import linesBg from '../photos/lines.png';

const Login = () => {
  // State Management
  const [isRightPanelActive, setIsRightPanelActive] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [activeTab, setActiveTab] = useState('student');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [loginType, setLoginType] = useState('');

  // Toggle between Login and Register panels
  const toggleSlide = () => {
    setIsRightPanelActive(!isRightPanelActive);
  };

  // Toggle between Login and Forgot Password
  const toggleForgot = () => {
    setIsForgotMode(!isForgotMode);
  };

  // Switch registration tabs
  const switchTab = (type) => {
    setActiveTab(type);
  };

  // Organization modal handlers
  const openOrgModal = () => {
    setIsOrgModalOpen(true);
  };

  const closeOrgModal = () => {
    setIsOrgModalOpen(false);
  };

  const selectOrg = (orgName) => {
    setSelectedOrg(orgName);
    closeOrgModal();
  };

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault();
    const type = loginType.trim().toLowerCase();
    if (type === 'student') {
      window.location.href = 'studentDashboard.html';
    } else if (type === 'org') {
      window.location.href = 'officerDashboard.html';
    } else if (type === 'osa') {
      window.location.href = 'osaDashboard.html';
    } else {
      alert('Please enter a valid user type: student, org, or osa.');
    }
  };

  // Container class names with conditional classes
  const containerClasses = `${styles.container} ${isRightPanelActive ? styles.rightPanelActive : ''}`;
  const signInContainerClasses = `${styles.formContainer} ${styles.signInContainer} ${isForgotMode ? styles.forgotMode : ''}`;
  const signUpContainerClasses = `${styles.formContainer} ${styles.signUpContainer}`;

  // Overlay background style with imported image
  const overlayStyle = {
    backgroundImage: `url(${linesBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={containerClasses}>
        
        {/* LOGIN / FORGOT CONTAINER (LEFT) */}
        <div className={signInContainerClasses}>
          <div className={styles.signInContentWrapper}>
            
            {/* LOGIN PANEL */}
            <div className={styles.panelLogin}>
              <h1 className={styles.heading}>LOGIN</h1>
              <p className={styles.subtitle}>NAAP ORG - SYSTEM Organization Management System</p>

              <form className={styles.form} onSubmit={handleLogin}>
                <input 
                  type="text" 
                  className={styles.input}
                  placeholder="type student/org/osa" 
                  value={loginType}
                  onChange={(e) => setLoginType(e.target.value)}
                />
                <input 
                  type="password" 
                  className={styles.input}
                  placeholder="Password" 
                />
                <button type="submit" className={styles.button}>LOGIN</button>

                <div className={styles.navLinks}>
                  <a onClick={toggleForgot}>Forgot Account?</a>
                </div>
              </form>

              <p className={styles.mobileToggle} onClick={toggleSlide}>
                Don't have an account? Register
              </p>
            </div>

            {/* FORGOT PASSWORD PANEL */}
            <div className={styles.panelForgot}>
              <h1 className={styles.heading}>FORGOT PASSWORD</h1>
              <p className={styles.subtitle}>Enter your details to reset your password</p>

              <form className={styles.form}>
                <input 
                  type="text" 
                  className={styles.input}
                  placeholder="Student Number" 
                />
                <input 
                  type="email" 
                  className={styles.input}
                  placeholder="Email" 
                />
                <button type="button" className={styles.button}>SEND LINK</button>
              </form>

              <a className={styles.backLink} onClick={toggleForgot}>
                Back to Login
              </a>

              <p className={styles.mobileToggle} onClick={toggleSlide}>
                Don't have an account? Register
              </p>
            </div>

          </div>
        </div>

        {/* REGISTER FORM (RIGHT) */}
        <div className={signUpContainerClasses}>
          <div style={{ width: '100%', maxWidth: '380px' }}>
            <h1 className={styles.heading}>Create Account</h1>
            <p className={styles.subtitle}>NATIONAL AVIATION ACADEMY OF THE PHILIPPINES</p>

            {/* Registration Tabs */}
            <div className={styles.registerTabs}>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'student' ? styles.active : ''}`}
                onClick={() => switchTab('student')}
              >
                Student
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'org' ? styles.active : ''}`}
                onClick={() => switchTab('org')}
              >
                Organization
              </button>
              <button 
                className={`${styles.tabBtn} ${activeTab === 'osa' ? styles.active : ''}`}
                onClick={() => switchTab('osa')}
              >
                OSA
              </button>
            </div>

            {/* Student Fields */}
            <form className={`${styles.form} ${styles.regFields} ${activeTab === 'student' ? styles.active : ''}`}>
              <input type="text" className={styles.input} placeholder="Student Number" />
              <input type="text" className={styles.input} placeholder="Name" />
              <input type="text" className={styles.input} placeholder="Course & Section" />
              <input type="email" className={styles.input} placeholder="Email" />
              <input type="password" className={styles.input} placeholder="Password" />
              <input type="password" className={styles.input} placeholder="Re-enter Password" />
              <button type="button" className={styles.button}>REGISTER</button>
            </form>

            {/* OSA Fields */}
            <form className={`${styles.form} ${styles.regFields} ${activeTab === 'osa' ? styles.active : ''}`}>
              <input type="text" className={styles.input} placeholder="Employee Number" />
              <input type="text" className={styles.input} placeholder="Name" />
              <input type="email" className={styles.input} placeholder="Email" />
              <input type="password" className={styles.input} placeholder="Password" />
              <input type="password" className={styles.input} placeholder="Re-enter Password" />
              <button type="button" className={styles.button}>REGISTER</button>
            </form>

            {/* Organization Fields */}
            <form className={`${styles.form} ${styles.regFields} ${activeTab === 'org' ? styles.active : ''}`}>
              <input type="text" className={styles.input} placeholder="Student Number" />
              <input type="text" className={styles.input} placeholder="Name" />
              <input type="text" className={styles.input} placeholder="Course & Section" />
              <input 
                type="text" 
                className={`${styles.input} ${styles.orgSelectTrigger}`}
                placeholder="Select Organization" 
                value={selectedOrg}
                readOnly
                onClick={openOrgModal}
              />
              <input type="email" className={styles.input} placeholder="Email" />
              <input type="password" className={styles.input} placeholder="Password" />
              <input type="password" className={styles.input} placeholder="Re-enter Password" />
              <button type="button" className={styles.button}>REGISTER</button>
            </form>

            <p className={styles.mobileToggle} onClick={toggleSlide}>
              Already have an account? Sign In
            </p>
          </div>
        </div>

        {/* NAVY BLUE SLIDING PANEL (DISCONNECTED & ROUNDED) */}
        <div className={styles.overlayContainer} style={overlayStyle}>
          <div className={styles.overlay}>

            {/* RIGHT PANEL (Visible when Login is Active) */}
            <div className={`${styles.overlayPanel} ${!isRightPanelActive ? styles.active : ''}`}>
              <div className={styles.logoArea}>NAAP</div>
              <h1 className={styles.heading}>Hello, Student!</h1>
              <p>Enter your personal details and start your journey with National Aviation Academy</p>
              <button className={`${styles.button} ${styles.ghost}`} onClick={toggleSlide}>
                Go to Register
              </button>
            </div>

            {/* LEFT PANEL (Visible when Register is Active) */}
            <div className={`${styles.overlayPanel} ${isRightPanelActive ? styles.active : ''}`}>
              <div className={styles.logoArea}>NAAP</div>
              <h1 className={styles.heading}>Welcome Back!</h1>
              <p>To keep connected with your organization please login with your personal info</p>
              <button className={`${styles.button} ${styles.ghost}`} onClick={toggleSlide}>
                Go to Login
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* ORGANIZATION SELECTION MODAL */}
      <div 
        className={`${styles.modalOverlay} ${isOrgModalOpen ? styles.open : ''}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeOrgModal();
          }
        }}
      >
        <div className={styles.modalBox}>
          <div className={styles.modalHeader}>
            <h3>Select Organization</h3>
            <button className={styles.closeModal} onClick={closeOrgModal}>&times;</button>
          </div>
          <div className={styles.modalBody}>

            <div className={styles.orgCategory}>
              <div className={styles.orgCategoryTitle}>Supreme Student Council</div>
              <div className={styles.orgList}>
                <div className={styles.orgItem} onClick={() => selectOrg('Supreme Student Council')}>
                  Supreme Student Council
                </div>
              </div>
            </div>

            <div className={styles.orgCategory}>
              <div className={styles.orgCategoryTitle}>ICS</div>
              <div className={styles.orgList}>
                <div className={styles.orgItem} onClick={() => selectOrg('AISERS')}>AISERS</div>
                <div className={styles.orgItem} onClick={() => selectOrg('ELITECH')}>ELITECH</div>
              </div>
            </div>

            <div className={styles.orgCategory}>
              <div className={styles.orgCategoryTitle}>ILAS</div>
              <div className={styles.orgList}>
                <div className={styles.orgItem} onClick={() => selectOrg('ILASSO')}>ILASSO</div>
              </div>
            </div>

            <div className={styles.orgCategory}>
              <div className={styles.orgCategoryTitle}>INET</div>
              <div className={styles.orgList}>
                <div className={styles.orgItem} onClick={() => selectOrg('AERO-ATSO')}>AERO-ATSO</div>
                <div className={styles.orgItem} onClick={() => selectOrg('AETSO')}>AETSO</div>
                <div className={styles.orgItem} onClick={() => selectOrg('AMTSO')}>AMTSO</div>
              </div>
            </div>

            <div className={styles.orgCategory}>
              <div className={styles.orgCategoryTitle}>Interest Club</div>
              <div className={styles.orgList}>
                <div className={styles.orgItem} onClick={() => selectOrg('RCYC')}>RCYC</div>
                <div className={styles.orgItem} onClick={() => selectOrg('CYC')}>CYC</div>
                <div className={styles.orgItem} onClick={() => selectOrg("SCHOLAR'S GUILD")}>SCHOLAR'S GUILD</div>
                <div className={styles.orgItem} onClick={() => selectOrg('AERONAUTICA')}>AERONAUTICA</div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
