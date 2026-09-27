'use strict';

const STORAGE_KEY = 'dailyTaskPlannerTasks';
const MAX_LENGTH = 200;

const FILTER_ALL = 'all';
const FILTER_PENDING = 'pending';
const FILTER_COMPLETED = 'completed';

const EMPTY_LIST_MESSAGE = 'No tasks yet. Add your first task above.';
const EMPTY_FILTER_MESSAGE = 'No tasks match the selected filter.';

const state = {
  tasks: [],
  filter: FILTER_ALL,
  editingId: null
};

const elements = {};

function cacheElements() {
  elements.form = document.getElementById('taskForm');
  elements.input = document.getElementById('taskInput');
  elements.error = document.getElementById('taskError');
  elements.list = document.getElementById('taskList');
  elements.emptyState = document.getElementById('emptyState');
  elements.emptyText = document.getElementById('emptyText');
  elements.currentDate = document.getElementById('currentDate');
  elements.filterButtons = document.querySelectorAll('.filter-btn');
  elements.statTotal = document.getElementById('statTotal');
  elements.statPending = document.getElementById('statPending');
  elements.statCompleted = document.getElementById('statCompleted');
  elements.countAll = document.getElementById('countAll');
  elements.countPending = document.getElementById('countPending');
  elements.countCompleted = document.getElementById('countCompleted');
}

function createId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normaliseTask(raw, index) {
  if (!raw || typeof raw.text !== 'string' || raw.text.trim() === '') {
    return null;
  }
  return {
    id: typeof raw.id === 'string' && raw.id !== '' ? raw.id : createId() + '-' + index,
    text: raw.text.trim().slice(0, MAX_LENGTH),
    completed: raw.completed === true
  };
}

function loadTasks() {
  let raw;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('localStorage is unavailable, tasks will not be saved.');
    return [];
  }

  if (!raw) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn('Saved tasks could not be parsed, starting with an empty list.');
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map(normaliseTask).filter(task => task !== null);
}

function saveTasks() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (error) {
    console.warn('Tasks could not be saved to localStorage.');
  }
}

function persistAndRender() {
  saveTasks();
  renderTasks();
}

function findTask(id) {
  return state.tasks.find(task => task.id === id) || null;
}

function setFieldError(field, hasError) {
  field.classList.toggle('is-invalid', hasError);
  if (hasError) {
    field.setAttribute('aria-invalid', 'true');
  } else {
    field.removeAttribute('aria-invalid');
  }
}

function setError(message) {
  const hasError = message !== '';
  const editInput = elements.list.querySelector('.task-edit-input');

  elements.error.textContent = message;
  elements.error.classList.toggle('d-none', !hasError);
  setFieldError(elements.input, hasError);
  if (editInput) {
    setFieldError(editInput, hasError);
  }
}

function clearError() {
  setError('');
}

function validate(text) {
  if (text === '') {
    return 'Please enter a task before adding it.';
  }
  if (text.length > MAX_LENGTH) {
    return 'Task text must be ' + MAX_LENGTH + ' characters or fewer.';
  }
  return '';
}

function addTask() {
  clearError();
  const text = elements.input.value.trim();

  const message = validate(text);
  if (message !== '') {
    setError(message);
    elements.input.focus();
    return;
  }

  state.tasks.push({
    id: createId(),
    text: text,
    completed: false
  });

  elements.input.value = '';
  persistAndRender();
  elements.input.focus();
}

function toggleTask(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  task.completed = !task.completed;
  persistAndRender();
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  if (!window.confirm('Delete "' + task.text + '"?')) {
    return;
  }
  state.tasks = state.tasks.filter(item => item.id !== id);
  if (state.editingId === id) {
    state.editingId = null;
  }
  persistAndRender();
}

function startEdit(id) {
  if (state.editingId === id || !findTask(id)) {
    return;
  }
  clearError();
  state.editingId = id;
  renderTasks();
  focusEditInput(id);
}

function saveEdit(id, value) {
  const text = value.trim();
  if (text === '') {
    setError('A task cannot be empty. Enter some text or cancel editing.');
    focusEditInput(id);
    return;
  }

  const task = findTask(id);
  if (!task) {
    state.editingId = null;
    persistAndRender();
    return;
  }

  task.text = text.slice(0, MAX_LENGTH);
  state.editingId = null;
  clearError();
  persistAndRender();
}

function cancelEdit() {
  if (state.editingId === null) {
    return;
  }
  state.editingId = null;
  clearError();
  renderTasks();
}

function focusEditInput(id) {
  const field = document.getElementById('editInput-' + id);
  if (!field) {
    return;
  }
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
}

function setFilter(filter) {
  if (state.filter === filter) {
    return;
  }
  state.filter = filter;
  renderTasks();
}

function getVisibleTasks() {
  if (state.filter === FILTER_PENDING) {
    return state.tasks.filter(task => !task.completed);
  }
  if (state.filter === FILTER_COMPLETED) {
    return state.tasks.filter(task => task.completed);
  }
  return state.tasks.slice();
}

function taskViewHtml(task) {
  const id = escapeHtml(task.id);
  const text = escapeHtml(task.text);
  const checked = task.completed ? 'checked' : '';

  return [
    '<input type="checkbox" class="form-check-input task-check flex-shrink-0"',
    ' id="check-' + id + '" data-action="toggle" ' + checked + ' aria-label="Mark &quot;' + text + '&quot; as complete">',
    '<label class="task-text flex-grow-1" for="check-' + id + '">' + text + '</label>',
    '<div class="task-actions d-flex gap-1 flex-shrink-0">',
    '  <button type="button" class="btn btn-outline-primary" data-action="edit" aria-label="Edit task">Edit</button>',
    '  <button type="button" class="btn btn-outline-danger" data-action="delete" aria-label="Delete task">Delete</button>',
    '</div>'
  ].join('');
}

function taskEditHtml(task) {
  const id = escapeHtml(task.id);

  return [
    '<form class="edit-form d-flex flex-column flex-sm-row gap-2 w-100">',
    '  <input type="text" id="editInput-' + id + '" class="form-control task-edit-input" maxlength="' + MAX_LENGTH + '"',
    ' value="' + escapeHtml(task.text) + '" autocomplete="off" aria-label="Edit task text">',
    '  <div class="d-flex gap-2 flex-shrink-0">',
    '    <button type="submit" class="btn btn-success btn-sm flex-grow-1 flex-sm-grow-0">Save</button>',
    '    <button type="button" class="btn btn-outline-secondary btn-sm flex-grow-1 flex-sm-grow-0" data-action="cancel">Cancel</button>',
    '  </div>',
    '</form>'
  ].join('');
}

function taskItemHtml(task) {
  const isEditing = state.editingId === task.id;
  const className = 'task-item d-flex align-items-center gap-2'
    + (task.completed ? ' task-completed' : '')
    + (isEditing ? ' task-editing' : '');

  return '<li class="' + className + '" data-id="' + escapeHtml(task.id) + '">'
    + (isEditing ? taskEditHtml(task) : taskViewHtml(task))
    + '</li>';
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();

  if (state.editingId !== null && !visibleTasks.some(task => task.id === state.editingId)) {
    state.editingId = null;
    clearError();
  }

  elements.list.innerHTML = visibleTasks.map(taskItemHtml).join('');

  elements.emptyState.classList.toggle('d-none', visibleTasks.length > 0);
  elements.emptyText.textContent = state.tasks.length === 0 ? EMPTY_LIST_MESSAGE : EMPTY_FILTER_MESSAGE;

  updateSummary();
  updateFilterButtons();
}

function updateSummary() {
  const total = state.tasks.length;
  const completed = state.tasks.filter(task => task.completed).length;
  const pending = total - completed;

  elements.statTotal.textContent = total;
  elements.statPending.textContent = pending;
  elements.statCompleted.textContent = completed;
  elements.countAll.textContent = total;
  elements.countPending.textContent = pending;
  elements.countCompleted.textContent = completed;
}

function updateFilterButtons() {
  elements.filterButtons.forEach(button => {
    const isActive = button.dataset.filter === state.filter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function getIdFromEvent(event) {
  const item = event.target.closest('[data-id]');
  return item ? item.dataset.id : '';
}

function handleListClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || !elements.list.contains(trigger)) {
    return;
  }

  const id = getIdFromEvent(event);

  if (trigger.dataset.action === 'edit') {
    startEdit(id);
  } else if (trigger.dataset.action === 'delete') {
    deleteTask(id);
  } else if (trigger.dataset.action === 'cancel') {
    cancelEdit();
  }
}

function handleListChange(event) {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (checkbox) {
    toggleTask(getIdFromEvent(event));
  }
}

function handleListSubmit(event) {
  const form = event.target.closest('.edit-form');
  if (!form) {
    return;
  }
  event.preventDefault();
  const field = form.querySelector('.task-edit-input');
  if (field) {
    saveEdit(getIdFromEvent(event), field.value);
  }
}

function handleListKeydown(event) {
  if (state.editingId === null) {
    return;
  }
  if (event.key === 'Escape') {
    cancelEdit();
  } else if (event.key === 'Enter' && event.target.classList.contains('task-text')) {
    event.preventDefault();
    startEdit(getIdFromEvent(event));
  }
}

function handleListDblclick(event) {
  const label = event.target.closest('.task-text');
  if (label) {
    startEdit(getIdFromEvent(event));
  }
}

function bindEvents() {
  elements.form.addEventListener('submit', function (event) {
    event.preventDefault();
    addTask();
  });

  elements.input.addEventListener('input', clearError);

  elements.filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      setFilter(this.dataset.filter);
    });
  });

  elements.list.addEventListener('click', handleListClick);
  elements.list.addEventListener('change', handleListChange);
  elements.list.addEventListener('submit', handleListSubmit);
  elements.list.addEventListener('keydown', handleListKeydown);
  elements.list.addEventListener('dblclick', handleListDblclick);
}

function formatCurrentDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function init() {
  cacheElements();
  elements.currentDate.textContent = formatCurrentDate();
  state.tasks = loadTasks();
  bindEvents();
  renderTasks();
}

document.addEventListener('DOMContentLoaded', init);
