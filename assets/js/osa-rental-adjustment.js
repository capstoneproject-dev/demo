let osaRentalAdjustmentQuote = null;
let osaRentalAdjustmentOtpChallenge = null;
let osaRentalAdjustmentRequestId = 0;
let osaRentalAdjustmentSaveInFlight = false;

function osaRentalAdjustmentResponseError(response, data, fallback) {
    const error = new Error(data.error || fallback);
    error.status = response.status;
    return error;
}

function isCurrentOsaRentalAdjustmentPanel(panel) {
    const modal = document.getElementById('activity-detail-modal');
    return panel && panel.isConnected !== false && document.getElementById('osa-rental-adjustment-panel') === panel
        && (!modal || modal.classList.contains('active'));
}

async function verifyOsaRentalAdjustment(body, status) {
    const request = async (path, details) => {
        const response = await fetch('../api/auth/otp/' + path + '.php', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details)
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw osaRentalAdjustmentResponseError(response, data, 'OTP verification failed.');
        return data;
    };
    const key = JSON.stringify(body);
    if (!osaRentalAdjustmentOtpChallenge || osaRentalAdjustmentOtpChallenge.key !== key
        || osaRentalAdjustmentOtpChallenge.expiresAt <= Date.now()) {
        osaRentalAdjustmentOtpChallenge = null;
        status.textContent = 'Sending an approval code to your registered email...';
        const challenge = await request('send', { ...body, purpose: 'osa_rental_adjustment' });
        osaRentalAdjustmentOtpChallenge = { ...challenge, key, attempts: 0, expiresAt: Date.now() + challenge.expires_in * 1000 };
    }
    const challenge = osaRentalAdjustmentOtpChallenge;
    status.textContent = 'Approval code sent. Verify it to save the adjustment.';
    while (challenge.attempts < 5) {
        if (challenge.expiresAt <= Date.now()) {
            osaRentalAdjustmentOtpChallenge = null;
            throw new Error('The approval code expired. Save again to request a new code.');
        }
        const otp = await window.appPrompt(`Enter the six-digit code sent to ${challenge.recipient_email}. It expires in 10 minutes.`, '', {
            title: 'Verify rental adjustment', placeholder: 'Six-digit code', confirmText: 'Verify and Save'
        });
        if (otp === null) {
            status.textContent = 'OTP verification cancelled. No adjustment was saved.';
            return null;
        }
        if (!/^\d{6}$/.test(otp.trim())) {
            await window.appAlert('Enter the six-digit code from your email.');
            continue;
        }
        status.textContent = 'Checking your approval code...';
        try {
            const verified = await request('verify', { challenge_token: challenge.challenge_token, otp: otp.trim() });
            osaRentalAdjustmentOtpChallenge = null;
            return verified.verification_token;
        } catch (error) {
            if (error.status !== 422) {
                osaRentalAdjustmentOtpChallenge = null;
                throw error;
            }
            challenge.attempts++;
            status.textContent = error.message;
            await window.appAlert(error.message);
        }
    }
    osaRentalAdjustmentOtpChallenge = null;
    throw new Error('Verification failed. Save again to request a new code.');
}

async function osaRentalAdjustmentRequest(body, write = false) {
    const response = await fetch('../api/osa/rentals/adjust.php' + (write ? '' : '?rental_id=' + encodeURIComponent(body.rental_id)), {
        method: write ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        ...(write ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw osaRentalAdjustmentResponseError(response, data, 'Could not process the rental adjustment.');
    return data;
}

async function openOsaRentalAdjustment(rentalId) {
    if (osaRentalAdjustmentSaveInFlight) {
        showToast('Finish or cancel the current verification first.', 'error');
        return;
    }
    const panel = document.getElementById('osa-rental-adjustment-panel');
    if (!panel) return;
    const requestId = ++osaRentalAdjustmentRequestId;
    osaRentalAdjustmentQuote = null;
    panel.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Loading current rental amount...</p>';
    try {
        const data = await osaRentalAdjustmentRequest({ rental_id: rentalId });
        if (requestId !== osaRentalAdjustmentRequestId || !isCurrentOsaRentalAdjustmentPanel(panel)) return;
        const rental = data.rental;
        if (!rental.can_adjust) {
            panel.textContent = 'Only unpaid equipment rentals can be adjusted. Paid records retain their original payment history.';
            return;
        }
        osaRentalAdjustmentQuote = rental;
        panel.innerHTML = `
            <form onsubmit="saveOsaRentalAdjustment(event)" class="activity-detail-section">
                <h4>Adjust Rental Charge</h4>
                <p>${escapeDashboardHtml(rental.student_name)} — ${escapeDashboardHtml(rental.organization)}</p>
                <p>Current amount: <strong>${formatActivityMoney(rental.current_total_cost)}</strong></p>
                ${rental.status === 'active' ? '<p>Future overdue charges will still accrue while this rental is active.</p>' : ''}
                <label for="osa-rental-revised-amount">Revised amount</label>
                <input id="osa-rental-revised-amount" type="number" min="0" max="99999999.99" step="0.01" required value="${Number(rental.current_total_cost).toFixed(2)}">
                <label for="osa-rental-adjustment-reason">Reason (required)</label>
                <textarea id="osa-rental-adjustment-reason" rows="3" maxlength="2000" required placeholder="Explain the correction, waiver, or settlement."></textarea>
                <p>The approving administrator, reason, and before/after amounts will be recorded in the Audit Log.</p>
                <p>Saving requires an OTP sent to your registered OSA email.</p>
                <p id="osa-rental-adjustment-status" role="status"></p>
                <button id="osa-rental-adjustment-save" class="btn btn-primary" type="submit">Review and Save Adjustment</button>
                <button class="btn btn-outline" type="button" onclick="cancelOsaRentalAdjustment()">Cancel</button>
            </form>`;
    } catch (error) {
        if (requestId === osaRentalAdjustmentRequestId && isCurrentOsaRentalAdjustmentPanel(panel)) panel.textContent = error.message;
    }
}

function cancelOsaRentalAdjustment() {
    const button = document.getElementById('osa-rental-adjustment-save');
    if (button?.disabled) return;
    osaRentalAdjustmentRequestId++;
    osaRentalAdjustmentQuote = null;
    document.getElementById('osa-rental-adjustment-panel')?.replaceChildren();
}

async function saveOsaRentalAdjustment(event) {
    event.preventDefault();
    const quote = osaRentalAdjustmentQuote;
    if (!quote) return;
    const button = document.getElementById('osa-rental-adjustment-save');
    const status = document.getElementById('osa-rental-adjustment-status');
    const panel = document.getElementById('osa-rental-adjustment-panel');
    if (!button || !status || osaRentalAdjustmentSaveInFlight || !isCurrentOsaRentalAdjustmentPanel(panel)) return;
    const amountInput = document.getElementById('osa-rental-revised-amount');
    const reasonInput = document.getElementById('osa-rental-adjustment-reason');
    const amount = Number(amountInput.value);
    const reason = reasonInput.value.trim();
    if (!amountInput.value.trim() || !reason || [...reason].length > 2000 || !Number.isFinite(amount)
        || amount < 0 || amount > 99999999.99 || Math.abs(amount - Math.round(amount * 100) / 100) > 0.000001) {
        status.textContent = 'Enter a valid amount and a reason.';
        return;
    }
    if (Math.abs(amount - Number(quote.current_total_cost)) < 0.005) {
        status.textContent = 'The revised amount must differ from the current amount.';
        return;
    }
    osaRentalAdjustmentSaveInFlight = true;
    button.disabled = true;
    amountInput.readOnly = true;
    reasonInput.readOnly = true;
    let saveStarted = false;
    try {
        const confirmed = await window.appConfirm(`Change ${formatActivityMoney(quote.current_total_cost)} to ${formatActivityMoney(amount)}?
Reason: ${reason}`, { title: 'Confirm rental adjustment', confirmText: 'Save Adjustment' });
        if (!confirmed || !isCurrentOsaRentalAdjustmentPanel(panel)) return;
        const adjustment = { rental_id: quote.rental_id, revised_amount: amount,
            expected_amount: quote.current_total_cost, reason };
        const verificationToken = await verifyOsaRentalAdjustment(adjustment, status);
        if (!verificationToken || !isCurrentOsaRentalAdjustmentPanel(panel)) return;
        status.textContent = 'Saving adjustment and audit record...';
        saveStarted = true;
        await osaRentalAdjustmentRequest({ ...adjustment, verification_token: verificationToken }, true);
        osaRentalAdjustmentQuote = null;
        if (isCurrentOsaRentalAdjustmentPanel(panel)) panel.textContent = 'Adjustment saved and audited. Revised amount: ' + formatActivityMoney(amount);
        showToast('Rental adjustment saved.', 'success');
        // Update the existing detail view and monitoring list from the server.
        const rentalId = quote.rental_id;
        try {
            await loadOsaActivityFeed({ preserveOnError: true });
            const activity = osaActivityFeed.find(item => item.sourceType === 'rental' && Number(item.sourceId) === Number(rentalId));
            if (activity && isCurrentOsaRentalAdjustmentPanel(panel)) {
                displayOsaActivityDetails(activity);
                const refreshedPanel = document.getElementById('osa-rental-adjustment-panel');
                if (refreshedPanel) refreshedPanel.textContent = 'Adjustment saved and audited.';
            }
        } catch (_refreshError) {
            showToast('Adjustment saved. Refresh the activity list to see the latest details.', 'success');
        }
    } catch (error) {
        if (saveStarted && !error.status) {
            osaRentalAdjustmentQuote = null;
            if (isCurrentOsaRentalAdjustmentPanel(panel)) panel.textContent = 'The save result could not be confirmed. Reopen this rental to check its latest amount before trying again.';
        } else {
            status.textContent = error.message;
        }
    } finally {
        osaRentalAdjustmentSaveInFlight = false;
        button.disabled = false;
        amountInput.readOnly = false;
        reasonInput.readOnly = false;
    }
}
