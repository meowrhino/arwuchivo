/**
 * upload/wizard.js
 * Navegación entre los 4 pasos del wizard de subida:
 *   1: video → 2: datos → 3: personas → 4: privacidad/confirmar.
 */

import { escapeHtml } from './util.js';

export const TOTAL_STEPS = 4;
export const STEP_TITLES = {
  1: 'video',
  2: 'datos',
  3: 'personas',
  4: 'privacidad',
};

export function goToStep(step, { selectedPeople, getCompressedBlob }) {
  const title = document.getElementById('wizardTitle');
  if (title) title.textContent = STEP_TITLES[step] || '';

  document.querySelectorAll('.wizard-step').forEach(el => {
    el.classList.toggle('is-active', Number(el.dataset.step) === step);
  });
  document.querySelectorAll('.wizard-step-dot').forEach(el => {
    el.classList.toggle('is-active', Number(el.dataset.step) <= step);
  });

  const back = document.getElementById('wizardBack');
  const next = document.getElementById('wizardNext');
  const submit = document.getElementById('wizardSubmit');
  if (back) back.hidden = step === 1;
  if (next) next.hidden = step === TOTAL_STEPS;
  if (submit) submit.hidden = step !== TOTAL_STEPS;

  if (step === TOTAL_STEPS) renderSummary({ selectedPeople });

  if (next) {
    if (step === 1) next.disabled = !getCompressedBlob();
    else if (step === 3) next.disabled = selectedPeople.length === 0;
    else next.disabled = false;
  }
  if (submit) submit.disabled = !getCompressedBlob() || selectedPeople.length === 0;
}

export function validateStep(step, { selectedPeople, getCompressedBlob, showVideoError }) {
  if (step === 1) {
    if (!getCompressedBlob()) {
      showVideoError('elige un video y espera a que termine');
      return false;
    }
    return true;
  }
  if (step === 2) {
    const date = document.getElementById('uploadDate').value;
    if (!date) {
      alert('pon una fecha');
      return false;
    }
    return true;
  }
  if (step === 3) {
    if (selectedPeople.length === 0) {
      alert('elige al menos una persona');
      return false;
    }
    return true;
  }
  return true;
}

export function renderSummary({ selectedPeople }) {
  const el = document.getElementById('wizardSummary');
  if (!el) return;
  const title = document.getElementById('uploadTitle').value || 'sin título';
  const date = document.getElementById('uploadDate').value || '—';
  const people = selectedPeople.join(', ') || '—';
  el.innerHTML = `
    <div class="summary-row"><span>título</span><strong>${escapeHtml(title)}</strong></div>
    <div class="summary-row"><span>fecha</span><strong>${escapeHtml(date)}</strong></div>
    <div class="summary-row"><span>personas</span><strong>${escapeHtml(people)}</strong></div>
  `;
}
