// Draft helpers. Two small behaviours only: the scene toggle at phone width
// and the Edit button in the "What I heard" row. Without script, all content
// stays visible and the toggle button is not shown.
document.documentElement.classList.add('js');

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
