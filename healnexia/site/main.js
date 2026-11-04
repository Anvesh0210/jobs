/**
 * HEALNEXIA marketing site behaviour. Progressive enhancement: the page is fully readable
 * without JavaScript; this module adds scrollspy, tabs, dialogs and form validation.
 * No innerHTML or network access: the CSP forbids both.
 */

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** Highlights the nav link for the section currently in view. */
function initScrollspy() {
  const links = [...document.querySelectorAll('[data-scrollspy] a[href^="#"]')];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const setCurrent = (id) => links.forEach((a) => a.setAttribute('aria-current', String(a.hash === `#${id}`)));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setCurrent(visible.target.id);
  }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5] });
  sections.forEach((s) => observer.observe(s));
}

/** Closes the popover menu after choosing a destination. */
function initMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (!menu || typeof menu.hidePopover !== 'function') return;
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a[href^="#"], a[href$=".html"], [data-open-dialog]')) menu.hidePopover();
  });
}

/** WAI-ARIA tabs: click or arrow keys / Home / End, roving tabindex. */
function initTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  if (!tabs.length) return;
  const select = (tab, focus = false) => {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      select(tabs[(keys[e.key] + tabs.length) % tabs.length], true);
    });
  });
}

/** Shows an inline error for a field and wires it up for assistive technology. */
function setError(field, message) {
  const error = document.getElementById(`${field.id || field.name}-error`) ||
    (field.type === 'checkbox' ? document.getElementById(field.getAttribute('aria-describedby')) : null);
  field.setAttribute('aria-invalid', String(Boolean(message)));
  if (error) {
    error.textContent = message;
    error.hidden = !message;
    if (field.type !== 'checkbox') field.setAttribute('aria-describedby', error.id);
  }
}

function validate(form) {
  let firstInvalid = null;
  for (const field of form.querySelectorAll('input, select, textarea')) {
    const value = field.type === 'checkbox' ? field.checked : field.value.trim();
    let message = '';
    if (field.required && !value) {
      message = field.type === 'checkbox' ? 'Please tick this box to continue.' : 'This field is required.';
    } else if (field.type === 'email' && value && !EMAIL.test(value)) {
      message = 'Enter an email address like name@example.com.';
    } else if (field.maxLength > 0 && typeof value === 'string' && value.length > field.maxLength) {
      message = `Please use ${field.maxLength} characters or fewer.`;
    }
    setError(field, message);
    if (message && !firstInvalid) firstInvalid = field;
  }
  return firstInvalid;
}

function resetForm(form) {
  form.reset();
  form.querySelectorAll('[aria-invalid]').forEach((f) => setError(f, ''));
  form.querySelector('[data-form-body]').hidden = false;
  form.querySelector('[data-form-success]').hidden = true;
}

/** Native <dialog> modals with validated (local-only) lead forms. */
function initDialogs() {
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-dialog]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.openDialog);
      if (dialog instanceof HTMLDialogElement && !dialog.open) {
        resetForm(dialog.querySelector('form'));
        dialog.showModal();
        dialog.querySelector('input, select, textarea')?.focus();
      }
      return;
    }
    const closer = e.target.closest('[data-close-dialog]');
    if (closer) closer.closest('dialog')?.close();
  });

  document.querySelectorAll('dialog').forEach((dialog) => {
    // Click on the backdrop (outside the panel) closes the dialog.
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  });

  document.querySelectorAll('[data-lead-form]').forEach((form) => {
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') setError(e.target, ''); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const invalid = validate(form);
      if (invalid) { invalid.focus(); return; }
      // Prototype: nothing is sent or stored (connect-src 'none'). A real build would POST to a governed endpoint.
      form.querySelector('[data-form-body]').hidden = true;
      const success = form.querySelector('[data-form-success]');
      success.hidden = false;
      success.focus();
    });
  });
}

initScrollspy();
initMobileMenu();
document.querySelectorAll('[data-tabs]').forEach(initTabs);
initDialogs();
