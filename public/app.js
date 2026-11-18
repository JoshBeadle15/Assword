const tbody = document.getElementById('entries-body');
const modal = document.getElementById('entry-modal');
const modalTitle = document.getElementById('modal-title');
const modalError = document.getElementById('modal-error');
const entryForm = document.getElementById('entry-form');
const entryIdField = document.getElementById('entry-id');
const entrySiteField = document.getElementById('entry-site');
const entryUsernameField = document.getElementById('entry-username');
const entryPasswordField = document.getElementById('entry-password');
const entryNameField = document.getElementById('entry-name');
const searchInput = document.getElementById('search-input');

let allEntries = [];

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadEntries() {
  const res = await fetch('/api/entries');
  if (res.status === 401) {
    window.location.href = '/login.html';
    return;
  }
  allEntries = await res.json();
  applyFilter();
}

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? allEntries.filter(
        (entry) =>
          entry.site.toLowerCase().includes(query) || entry.username.toLowerCase().includes(query)
      )
    : allEntries;
  renderEntries(filtered, query);
}

function renderEntries(entries, query = '') {
  if (entries.length === 0) {
    const message = query
      ? `No sites match "${escapeHtml(searchInput.value.trim())}".`
      : 'No sites yet. Click "+ Add Site" to start the vault.';
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">${message}</td></tr>`;
    return;
  }

  tbody.innerHTML = entries
    .map((entry) => {
      const maskedId = `pw-${entry.id}`;
      return `
        <tr data-id="${entry.id}">
          <td class="site-cell">${escapeHtml(entry.site)}</td>
          <td class="username-cell">${escapeHtml(entry.username)}</td>
          <td>
            <div class="password-row">
              <span class="password-value" id="${maskedId}" data-password="${escapeHtml(entry.password)}" data-revealed="false">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
              <button class="icon-btn reveal-btn" data-id="${entry.id}" title="Show / hide password">&#128065;</button>
              <button class="icon-btn copy-btn" data-id="${entry.id}" title="Copy password">&#128203;</button>
            </div>
          </td>
          <td>
            <div class="updated-stack">
              <span class="updated-date">${fmtDate(entry.updated_at)}</span>
              <span class="updated-by">by ${escapeHtml(entry.updated_by)}</span>
            </div>
          </td>
          <td class="col-actions">
            <div class="actions-row">
              <button class="icon-btn edit-btn" data-id="${entry.id}" title="Edit">&#9998;</button>
              <button class="icon-btn delete-btn" data-id="${entry.id}" title="Delete">&#128465;</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

tbody.addEventListener('click', async (e) => {
  const revealBtn = e.target.closest('.reveal-btn');
  const copyBtn = e.target.closest('.copy-btn');
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');

  if (revealBtn) {
    const span = document.getElementById(`pw-${revealBtn.dataset.id}`);
    const revealed = span.dataset.revealed === 'true';
    span.textContent = revealed ? '••••••••' : span.dataset.password;
    span.dataset.revealed = revealed ? 'false' : 'true';
  }

  if (copyBtn) {
    const span = document.getElementById(`pw-${copyBtn.dataset.id}`);
    try {
      await navigator.clipboard.writeText(span.dataset.password);
      copyBtn.textContent = '✔';
      setTimeout(() => (copyBtn.innerHTML = '&#128203;'), 1200);
    } catch (err) {
      alert('Could not copy automatically. Reveal the password and copy it manually.');
    }
  }

  if (editBtn) {
    const row = editBtn.closest('tr');
    const site = row.querySelector('.site-cell').textContent;
    const username = row.querySelector('.username-cell').textContent;
    const password = document.getElementById(`pw-${editBtn.dataset.id}`).dataset.password;
    openModal({ id: editBtn.dataset.id, site, username, password });
  }

  if (deleteBtn) {
    const row = deleteBtn.closest('tr');
    const site = row.querySelector('.site-cell').textContent;
    if (confirm(`Remove "${site}" from the vault? This cannot be undone.`)) {
      await fetch(`/api/entries/${deleteBtn.dataset.id}`, { method: 'DELETE' });
      loadEntries();
    }
  }
});

function openModal({ id = '', site = '', username = '', password = '' } = {}) {
  modalTitle.textContent = id ? 'Update Password' : 'Add Site';
  entryIdField.value = id;
  entrySiteField.value = site;
  entryUsernameField.value = username;
  entryPasswordField.value = id ? '' : password;
  entryNameField.value = '';
  modalError.hidden = true;
  modal.hidden = false;
  entrySiteField.disabled = Boolean(id);
  entryUsernameField.disabled = Boolean(id);
  (id ? entryPasswordField : entrySiteField).focus();
}

function closeModal() {
  modal.hidden = true;
  entryForm.reset();
}

document.getElementById('add-btn').addEventListener('click', () => openModal());
document.getElementById('modal-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalError.hidden = true;

  const id = entryIdField.value;
  const payload = {
    site: entrySiteField.value.trim(),
    username: entryUsernameField.value.trim(),
    password: entryPasswordField.value,
    name: entryNameField.value.trim(),
  };

  const res = await fetch(id ? `/api/entries/${id}` : '/api/entries', {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    window.location.href = '/login.html';
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    modalError.textContent = data.error || 'Something went wrong.';
    modalError.hidden = false;
    return;
  }

  closeModal();
  loadEntries();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login.html';
});

searchInput.addEventListener('input', applyFilter);

loadEntries();
