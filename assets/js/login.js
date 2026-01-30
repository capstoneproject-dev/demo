  /* =====================
     MAIN SLIDER LOGIC (LEFT <-> RIGHT)
     ===================== */
  const container = document.getElementById("container");
  const signUpBtn = document.getElementById("signUp");
  const signInBtn = document.getElementById("signIn");
  const overlayLeft = document.querySelector('.overlay-left');
  const overlayRight = document.querySelector('.overlay-right');

  // Initial state setup (Login is default, overlay is on Right)
  overlayRight.classList.add('active');
  overlayLeft.classList.remove('active');

  function toggleSlide() {
    container.classList.toggle("right-panel-active");
    
    // Swap overlay text visibility logic
    if (container.classList.contains("right-panel-active")) {
      // Register Active: Overlay moves to Left, show "Go to Login"
      overlayRight.classList.remove('active');
      overlayLeft.classList.add('active');
    } else {
      // Login Active: Overlay is on Right, show "Go to Register"
      overlayLeft.classList.remove('active');
      overlayRight.classList.add('active');
    }
  }

  signUpBtn.addEventListener("click", toggleSlide);
  signInBtn.addEventListener("click", toggleSlide);


  /* =====================
     LEFT PANEL INTERNAL TOGGLE (LOGIN <-> FORGOT)
     ===================== */
  const signInContainer = document.getElementById("signInContainer");

  function toggleForgot() {
    signInContainer.classList.toggle("forgot-mode");
  }


  /* =====================
     REGISTER TABS LOGIC
     ===================== */
  function switchTab(type) {
    // Update Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update Forms
    document.querySelectorAll('.reg-fields').forEach(form => form.classList.remove('active'));
    
    if (type === 'student') {
      document.getElementById('form-student').classList.add('active');
    } else if (type === 'osa') {
      document.getElementById('form-osa').classList.add('active');
    } else if (type === 'org') {
      document.getElementById('form-org').classList.add('active');
    }
  }


  /* =====================
     ORGANIZATION MODAL LOGIC
     ===================== */
  const modal = document.getElementById("orgModal");
  const orgInput = document.getElementById("org-input");

  function openOrgModal() {
    modal.classList.add("open");
  }

  function closeOrgModal() {
    modal.classList.remove("open");
  }

  function selectOrg(orgName) {
    orgInput.value = orgName;
    closeOrgModal();
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeOrgModal();
    }
  });