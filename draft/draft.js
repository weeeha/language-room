// Draft helpers: the scene toggle at phone width, the Edit button in the
// "What I heard" row, the microphone label, the correction chip note, the
// Coming soon note on controls with no behaviour, and ?theme=dark or light. Without script, all content
// stays visible and the toggle button is not shown.
document.documentElement.classList.add('js');

var theme = /[?&]theme=(dark|light)\b/.exec(location.search);
if (theme) document.documentElement.setAttribute('data-theme', theme[1]);

document.addEventListener('DOMContentLoaded', function () {
  var scene = document.querySelector('.scene');
  var toggle = document.querySelector('[data-scene-toggle]');
  if (scene && toggle) {
    toggle.addEventListener('click', function () {
      var open = scene.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? 'Hide scene' : 'Show scene';
    });
  }

  document.querySelectorAll('[data-soon]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = btn.nextElementSibling;
      if (next && next.classList.contains('soon')) return;
      var note = document.createElement('span');
      note.className = 'soon';
      note.setAttribute('role', 'status');
      btn.insertAdjacentElement('afterend', note);
      setTimeout(function () { note.textContent = 'Coming soon'; }, 50);
    });
  });

  document.querySelectorAll('[data-chip]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var open = chip.getAttribute('aria-expanded') === 'true';
      chip.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  });

  document.querySelectorAll('[data-mic]').forEach(function (mic) {
    var label = document.getElementById(mic.getAttribute('aria-labelledby'));
    var use = mic.querySelector('use');
    mic.addEventListener('click', function () {
      var on = mic.getAttribute('data-on') === 'true';
      mic.setAttribute('data-on', on ? 'false' : 'true');
      if (label) label.textContent = on ? 'Start speaking' : 'Stop speaking';
      if (use) use.setAttribute('href', on ? '#i-mic' : '#i-stop');
    });
  });

  document.querySelectorAll('[data-confirm]').forEach(function (box) {
    var edit = box.querySelector('[data-edit]');
    var text = box.querySelector('[data-heard-text]');
    var field = box.querySelector('[data-heard-edit]');
    if (!edit || !text || !field) return;
    edit.addEventListener('click', function () {
      var editing = edit.getAttribute('aria-pressed') === 'true';
      if (editing) {
        text.textContent = field.value;
        text.hidden = false;
        field.hidden = true;
      } else {
        field.value = text.textContent;
        text.hidden = true;
        field.hidden = false;
        field.focus();
      }
      edit.setAttribute('aria-pressed', editing ? 'false' : 'true');
    });
  });
});
