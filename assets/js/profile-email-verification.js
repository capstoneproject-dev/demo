/* Verify a changed address before any dashboard saves it. */
window.verifyProfileEmailChange = async function (email, currentEmail) {
    email = email.trim().toLowerCase();
    if (email === String(currentEmail || '').trim().toLowerCase()) return '';
    const emailInput = document.querySelector('#profile input[type="email"]');
    let status = document.getElementById('profileEmailVerificationStatus');
    if (!status && emailInput) {
        status = document.createElement('div');
        status.id = 'profileEmailVerificationStatus';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px;font-size:0.875rem;';
        emailInput.insertAdjacentElement('afterend', status);
    }
    const showStatus = (message, loading = false, failed = false) => {
        emailInput?.setAttribute('aria-busy', String(loading));
        if (!status) return;
        status.style.color = failed ? '#dc2626' : 'var(--muted, #64748b)';
        const icon = document.createElement('i');
        icon.className = loading ? 'fa-solid fa-spinner fa-spin' : (failed ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check');
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = message;
        status.replaceChildren(icon, label);
    };
    const request = async (path, body) => {
        const response = await fetch('../api/auth/otp/' + path + '.php', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Email verification failed.');
        return data;
    };
    showStatus('Sending a verification code to your new email…', true);
    let challenge;
    try {
        challenge = await request('send', { purpose: 'profile_email_change', email });
        showStatus('Verification code sent. Check your new email to continue.');
    } catch (error) {
        showStatus(error.message || 'Could not send the verification code. Please try again.', false, true);
        throw error;
    }
    while (true) {
        const otp = await window.appPrompt(`Enter the six-digit code sent to ${email}. The code expires in 10 minutes.`, '', {
            title: 'Verify new email', placeholder: 'Six-digit code', confirmText: 'Verify email'
        });
        if (otp === null) {
            showStatus('Verification cancelled. Your email has not been changed.', false, true);
            return null;
        }
        if (!/^\d{6}$/.test(otp.trim())) {
            await window.appAlert('Enter the six-digit verification code.');
            continue;
        }
        try {
            showStatus('Checking your verification code…', true);
            const verified = await request('verify', { challenge_token: challenge.challenge_token, otp: otp.trim() });
            showStatus('New email verified.');
            return verified.verification_token;
        } catch (error) {
            showStatus(error.message || 'Could not verify the code.', false, true);
            await window.appAlert(error.message);
        }
    }
};
